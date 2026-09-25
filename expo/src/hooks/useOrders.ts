/**
 * useOrders — Server-side & Offline-first order management hook.
 *
 * Encapsulates:
 * - Local SQLite persistence (offlineQueue) for 100% offline order taking & KDS
 * - TanStack Query for categories, menu items, order history via AWS Next.js REST API
 * - Automatic background cloud sync when network is active
 * - Derived ticket grouping from REST orders & offline_tickets
 * - Mutations: placeOrder, cancelOrder, editOrder, markReady, markInProgress, recallTicket, toggleRush
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert, Vibration } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import {
  getCategories,
  getMenu,
  getKitchenOrders,
  submitOrder,
  updateOrderStatus,
} from '../services/api';
import {
  cacheCategories,
  getCachedCategories,
  cacheMenuItems,
  getCachedMenuItems,
  placeOrderLocally,
  getLocalTickets,
  updateLocalTicketStatus,
  updateLocalTicketFull,
  syncOfflineTicketsToSupabase,
} from '../../lib/offlineQueue';
import type { CartItem } from './useCart';
import { sendLocalNotification, setNotificationsSilenced } from '../services/notificationService';
import type { UserRole } from '../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
export type OrderType = 'walk-in' | 'parcel' | 'catering';

export interface TicketItem {
  ledger_id: string | number;
  item_id: string;
  qty: number;
  name: string;
  price: number;
  notes?: string;
  done?: boolean;
}

export interface Ticket {
  orderId: string;
  time: string;
  status: string;
  table: string;
  orderType: OrderType;
  coverCount: number;
  isRush: boolean;
  isOffline?: boolean;
  notes?: string;
  items: TicketItem[];
  total: number;
}

// Edit Order Payload
export interface EditOrderItem {
  ledger_id?: string | number;
  item_id: string;
  qty: number;
  price: number;
  name: string;
  notes?: string;
}

export interface EditOrderPayload {
  ticketTime: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  table: string;
  orderType: OrderType;
  notes: string;
  items: EditOrderItem[];
}

// Callback type for notification events
export type OrderEventCallback = (event: {
  type: 'new_order' | 'order_ready';
  table: string;
  message: string;
}) => void;

// Debounce set for order completion notifications
const notifiedOrders = new Set<string>();

function handleOrderCompleteNotification(
  ticket: { orderId: string; time: string; table: string; items: { name: string; qty: number }[] },
  onOrderEvent?: OrderEventCallback,
  userRole?: UserRole,
) {
  // Never notify or vibrate for administrator
  if (userRole === 'admin') return;

  const orderId = ticket.orderId || ticket.time;
  if (notifiedOrders.has(orderId)) return;
  notifiedOrders.add(orderId);

  // Clear after 30 seconds to prevent memory leaks while still debouncing
  setTimeout(() => notifiedOrders.delete(orderId), 30000);

  Vibration.vibrate([0, 200, 100, 200]);
  const table = ticket.table || 'Unknown';
  const shortId = orderId.startsWith('#') ? orderId : `#${orderId.slice(-5)}`;
  const itemsStr = ticket.items?.map(i => `${i.qty}x ${i.name}`).join('\n') || 'Order ready to serve';
  const message = `${table} • ${shortId}\n${itemsStr}`;

  // Trigger Native System Notification
  sendLocalNotification(
    'Order Ready',
    message,
    { ticketId: orderId, table },
  ).catch(console.warn);

  if (onOrderEvent) {
    onOrderEvent({
      type: 'order_ready',
      table,
      message,
    });
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useOrders(
  isOffline: boolean,
  onOrderEvent?: OrderEventCallback,
  userRole?: UserRole,
) {
  const queryClient = useQueryClient();
  const [itemDoneMap, setItemDoneMap] = useState<Record<string, Record<string, boolean>>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Track previous ticket statuses to trigger notifications on changes
  const prevTicketsRef = useRef<Map<string, string>>(new Map());

  // Sync notification silence state with user role
  useEffect(() => {
    setNotificationsSilenced(userRole === 'admin');
  }, [userRole]);

  // ── Background Auto-Sync ───────────────────────────────────────────────────
  useEffect(() => {
    let syncInterval: any;

    const performSync = async () => {
      try {
        const syncedCount = await syncOfflineTicketsToSupabase();
        if (syncedCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          if (onOrderEvent) {
            onOrderEvent({
              type: 'new_order',
              table: 'Sync',
              message: `Synced ${syncedCount} offline orders to cloud`,
            });
          }
        }
      } catch (err) {
        console.warn('Auto-sync error:', err);
      }
    };

    // Initial sync check
    performSync();

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        performSync();
      }
    });

    // Check periodically every 20 seconds
    syncInterval = setInterval(() => {
      performSync();
    }, 20000);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
    };
  }, [queryClient, onOrderEvent]);

  // ── Categories (Online REST API + Offline SQLite Cache) ────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const data = await getCategories();
        if (Array.isArray(data) && data.length > 0) {
          cacheCategories(data);
          return data;
        }
      } catch (e) {
        console.warn('Online categories fetch failed, loading SQLite cache:', e);
      }
      return getCachedCategories();
    },
    staleTime: 1000 * 60 * 30,
  });

  // ── Menu Items (Online REST API + Offline SQLite Cache) ───────────────────
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: async () => {
      try {
        const data = await getMenu(true);
        if (Array.isArray(data) && data.length > 0) {
          cacheMenuItems(data);
          return data;
        }
      } catch (e) {
        console.warn('Online menuItems fetch failed, loading SQLite cache:', e);
      }
      return getCachedMenuItems();
    },
    staleTime: 1000 * 60 * 30,
  });

  // ── Order History (Online REST API + Local SQLite Offline Tickets) ─────────
  const { data: serverOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      try {
        const data = await getKitchenOrders();
        if (Array.isArray(data)) {
          return data;
        }
      } catch (e) {
        console.warn('Online kitchen orders fetch failed:', e);
      }
      return [];
    },
    refetchInterval: 3000,
  });

  // ── Derived Tickets ───────────────────────────────────────────────────────
  const tickets: Ticket[] = useMemo(() => {
    const groups: Record<string, Ticket> = {};

    // 1. Process server tickets/orders
    serverOrders.forEach((order: any) => {
      // If server returned structured ticket object
      if (order.items && Array.isArray(order.items)) {
        const groupKey = order.order_id || order.created_at || `order-${Date.now()}`;
        const rawTable = order.table_number || 'Walk-in';
        const parts = rawTable.split(' | ');

        let parsedTable = parts[0] || 'Walk-in';
        let parsedType: OrderType = 'walk-in';

        const lower = rawTable.toLowerCase();
        if (lower.includes('parcel') || lower.includes('takeaway')) {
          parsedType = 'parcel';
          if (!parsedTable.toLowerCase().includes('parcel')) parsedTable = 'Parcel';
        } else if (lower.includes('catering')) {
          parsedType = 'catering';
          if (!parsedTable.toLowerCase().includes('catering')) parsedTable = 'Catering Service';
        } else {
          parsedType = 'walk-in';
        }

        let parsedNotes = order.notes || '';
        if (!parsedNotes) {
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('NOTE:')) parsedNotes = part.substring(5);
            else if (!parsedNotes && !part.toLowerCase().includes('dine-in') && !part.toLowerCase().includes('takeaway')) {
              parsedNotes = part;
            }
          }
        }

        const ticketItems: TicketItem[] = order.items.map((it: any) => {
          const localItem = (menuItems as any[]).find((m: any) => m.id === it.menu_item_id);
          const safeQty = Number(it.quantity) || 1;
          const safePrice = Number(it.price) || (localItem ? Number(localItem.price) : 0);

          return {
            ledger_id: it.id || `${groupKey}-${it.menu_item_id}`,
            item_id: it.menu_item_id,
            qty: safeQty,
            name: it.name || localItem?.name || 'Dish',
            price: safePrice,
            notes: it.notes || it.item_notes || '',
            done: itemDoneMap[order.created_at || groupKey]?.[it.menu_item_id] ?? false,
          };
        });

        groups[groupKey] = {
          orderId: order.order_id || order.client_order_id || '',
          time: order.created_at || new Date().toISOString(),
          status: order.status || 'pending',
          table: parsedTable,
          orderType: parsedType,
          coverCount: 1,
          isRush: rawTable.includes('RUSH'),
          isOffline: false,
          notes: parsedNotes,
          items: ticketItems,
          total: Number(order.total_amount) || ticketItems.reduce((sum, i) => sum + i.price * i.qty, 0),
        };
      } else {
        // Fallback: If server returned flat ledger entry row
        const row = order;
        const groupKey = row.created_at;
        if (!groups[groupKey]) {
          const rawTable = row.table_number || 'Walk-in';
          const parts = rawTable.split(' | ');

          let parsedTable = parts[0] || 'Walk-in';
          let parsedType: OrderType = 'walk-in';

          const lower = parsedTable.toLowerCase();
          if (lower.includes('parcel') || lower.includes('takeaway')) {
            parsedType = 'parcel';
            parsedTable = 'Parcel';
          } else if (lower.includes('catering')) {
            parsedType = 'catering';
            parsedTable = 'Catering Service';
          }

          let parsedNotes = '';
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('NOTE:')) parsedNotes = part.substring(5);
            else if (!parsedNotes) parsedNotes = part;
          }

          groups[groupKey] = {
            orderId: row.order_id || '',
            time: groupKey,
            status: row.status || 'pending',
            table: parsedTable,
            orderType: parsedType,
            coverCount: 1,
            isRush: false,
            isOffline: !!row.is_offline,
            notes: parsedNotes,
            items: [],
            total: 0,
          };
        }

        const localItem = (menuItems as any[]).find((m: any) => m.id === row.menu_item_id);
        const safeTotal = Number(row.total_price) || 0;
        const safeQty = Number(row.quantity) || 1;
        const itemPrice = localItem ? Number(localItem.price) || 0 : safeTotal / safeQty;

        groups[groupKey].items.push({
          ledger_id: row.id,
          item_id: row.menu_item_id,
          qty: safeQty,
          name: localItem ? localItem.name : row.item_name || 'Dish',
          price: itemPrice,
          notes: row.notes || row.item_notes || '',
          done: itemDoneMap[groupKey]?.[row.menu_item_id] ?? false,
        });
        groups[groupKey].total += safeTotal;
      }
    });

    // 2. Read local SQLite tickets and merge any unsynced records
    const localRecords = getLocalTickets();
    localRecords.forEach(local => {
      const groupKey = local.order_id || local.created_at;
      if (!groups[groupKey] && local.synced === 0) {
        const rawTable = local.table_number || 'Walk-in';
        const parts = rawTable.split(' | ');

        let parsedTable = parts[0] || 'Walk-in';
        let parsedType: OrderType = 'walk-in';

        const lower = parsedTable.toLowerCase();
        if (lower.includes('parcel') || lower.includes('takeaway')) {
          parsedType = 'parcel';
        } else if (lower.includes('catering')) {
          parsedType = 'catering';
        }

        let parsedNotes = local.item_notes || '';
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (part.startsWith('NOTE:')) parsedNotes = part.substring(5);
          else if (!parsedNotes) parsedNotes = part;
        }

        groups[groupKey] = {
          orderId: local.order_id || '',
          time: local.created_at,
          status: local.status || 'pending',
          table: parsedTable,
          orderType: parsedType,
          coverCount: 1,
          isRush: false,
          isOffline: true,
          notes: parsedNotes,
          items: [],
          total: 0,
        };
      }

      if (groups[groupKey] && local.synced === 0) {
        const existingItem = groups[groupKey].items.find(i => i.item_id === local.menu_item_id);
        if (!existingItem) {
          const localItem = (menuItems as any[]).find((m: any) => m.id === local.menu_item_id);
          const safeTotal = Number(local.total_price) || 0;
          const safeQty = Number(local.quantity) || 1;
          const itemPrice = localItem ? Number(localItem.price) || 0 : safeTotal / safeQty;

          groups[groupKey].items.push({
            ledger_id: `local-${local.id || Date.now()}`,
            item_id: local.menu_item_id,
            qty: safeQty,
            name: localItem ? localItem.name : local.item_name || 'Dish',
            price: itemPrice,
            notes: local.item_notes || '',
            done: false,
          });
          groups[groupKey].total += safeTotal;
          groups[groupKey].isOffline = true;
        }
      }
    });

    // Chronological sort oldest-first to guarantee stable, sequential order IDs
    const sortedOldest = Object.values(groups).sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
    );

    sortedOldest.forEach((ticket, idx) => {
      if (!ticket.orderId) {
        ticket.orderId = `#ORD-${1001 + idx}`;
      } else if (!ticket.orderId.startsWith('#')) {
        ticket.orderId = `#${ticket.orderId}`;
      }
    });

    // Return newest first for UI display
    return sortedOldest.reverse();
  }, [serverOrders, menuItems, itemDoneMap]);

  // ── Notification Trigger on Status Changes ─────────────────────────────────
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;

    tickets.forEach(ticket => {
      const prevStatus = prevTicketsRef.current.get(ticket.time);

      if (prevStatus && prevStatus !== 'completed' && ticket.status === 'completed') {
        handleOrderCompleteNotification(ticket, onOrderEvent, userRole);
      } else if (!prevStatus && ticket.status === 'pending' && prevTicketsRef.current.size > 0) {
        if (userRole !== 'admin') {
          Vibration.vibrate([0, 80, 60, 80]);
          sendLocalNotification('New Order Received', `Order from ${ticket.table}`, { table: ticket.table }, 'orders').catch(console.warn);
          if (onOrderEvent) {
            onOrderEvent({
              type: 'new_order',
              table: ticket.table,
              message: `New order from ${ticket.table}`,
            });
          }
        }
      }

      prevTicketsRef.current.set(ticket.time, ticket.status);
    });
  }, [tickets, onOrderEvent, userRole]);

  // ── Place Order Mutation (Offline First -> AWS REST API) ───────────────────
  const placeOrderMutation = useMutation({
    mutationFn: async ({
      currentCart,
      currentTable,
      orderId,
    }: {
      currentCart: CartItem[];
      currentTable: string;
      orderId?: string;
    }) => {
      const timestamp = new Date().toISOString();

      // Check current network connectivity
      const netState = await NetInfo.fetch();
      const online = netState.isConnected && !isOffline;

      if (online) {
        try {
          const parts = currentTable.split(' | ');
          const tableLabel = parts[0] || 'Walk-in';
          let orderTypeVal: 'dine-in' | 'takeaway' = 'dine-in';
          let notesVal = '';

          for (let i = 1; i < parts.length; i++) {
            const p = parts[i];
            if (p.toLowerCase().includes('parcel') || p.toLowerCase().includes('takeaway')) {
              orderTypeVal = 'takeaway';
            } else if (p.startsWith('NOTE:')) {
              notesVal = p.substring(5);
            }
          }

          const result = await submitOrder({
            table_number: currentTable,
            order_type: orderTypeVal,
            items: currentCart.map(item => ({
              menu_item_id: item.id,
              quantity: item.qty,
              notes: item.notes || undefined,
              item_notes: item.notes || undefined,
            })),
            notes: notesVal || undefined,
          });

          const remoteOrderId = result?.order_id || orderId;
          placeOrderLocally(currentCart, currentTable, timestamp, true, remoteOrderId);
          return;
        } catch (err) {
          console.warn('Online order placement failed, falling back to local SQLite:', err);
        }
      }

      // Offline path: Save in SQLite
      placeOrderLocally(currentCart, currentTable, timestamp, false, orderId);
    },

    onMutate: async ({ currentCart, currentTable, orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previousOrders = queryClient.getQueryData(['orders']);

      const timestamp = new Date().toISOString();
      const optimisticOrder = {
        order_id: orderId || `temp-${Date.now()}`,
        client_order_id: orderId || `temp-${Date.now()}`,
        table_number: currentTable,
        status: 'pending',
        created_at: timestamp,
        total_amount: currentCart.reduce((s, i) => s + i.price * i.qty, 0),
        items: currentCart.map((item, index) => ({
          id: `local-${Date.now()}-${index}`,
          menu_item_id: item.id,
          name: item.name,
          quantity: item.qty,
          price: item.price,
          notes: item.notes || '',
        })),
        is_offline: isOffline,
      };

      queryClient.setQueryData(['orders'], (old: any) => [
        optimisticOrder,
        ...(old || []),
      ]);

      return { previousOrders };
    },

    onError: (_err, _variables, context) => {
      queryClient.setQueryData(['orders'], context?.previousOrders);
      Alert.alert('Order Warning', 'Could not record order locally.');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // ── Ticket Actions ────────────────────────────────────────────────────────
  const handleCancelTicket = useCallback(
    (ticket: Ticket) => {
      Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            updateLocalTicketStatus(ticket.time, 'cancelled');
            if (!isOffline && ticket.orderId) {
              const cleanId = ticket.orderId.replace(/^#/, '');
              await updateOrderStatus(cleanId, 'cancelled').catch(console.warn);
            }
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          },
        },
      ]);
    },
    [isOffline, queryClient],
  );

  const handleEditTicket = useCallback(
    (ticket: Ticket): Promise<CartItem[] | null> => {
      return new Promise(resolve => {
        Alert.alert(
          'Load into Cart',
          "Load this order's items into your POS cart to build a new order? (Existing order will remain active).",
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            {
              text: 'Load into Cart',
              onPress: () => {
                const rebuiltCart: CartItem[] = ticket.items.map(i => ({
                  id: i.item_id,
                  name: i.name,
                  price: i.price,
                  qty: i.qty,
                  notes: i.notes || '',
                }));
                resolve(rebuiltCart);
              },
            },
          ],
        );
      });
    },
    [],
  );

  // ── In-Place Order Update Mutation (Online & Offline) ───────────────────────
  const updateOrderDetails = useCallback(
    async (payload: EditOrderPayload) => {
      const { ticketTime, status, table, orderType, notes, items } = payload;

      const tablePrefix =
        orderType === 'parcel'
          ? 'Parcel'
          : orderType === 'catering'
          ? 'Catering Service'
          : (table || 'Walk-in');
      const encodedTable = notes.trim()
        ? `${tablePrefix} | NOTE:${notes.trim()}`
        : tablePrefix;

      // 1. Update local SQLite DB first (offline-first, zero lag)
      updateLocalTicketFull(ticketTime, {
        status,
        table_number: encodedTable,
        item_notes: notes.trim() || undefined,
        items: items.map(i => ({
          id:
            typeof i.ledger_id === 'string' && i.ledger_id.startsWith('local-')
              ? parseInt(i.ledger_id.replace('local-', ''), 10)
              : undefined,
          menu_item_id: i.item_id,
          item_name: i.name,
          quantity: i.qty,
          price: i.price,
          total_price: i.qty * i.price,
          notes: i.notes,
        })),
      });

      // 2. Update via REST API if online
      if (!isOffline) {
        try {
          const match = tickets.find(t => t.time === ticketTime);
          if (match?.orderId) {
            const cleanId = match.orderId.replace(/^#/, '');
            await updateOrderStatus(cleanId, status);
          }
        } catch (err) {
          console.warn('REST updateOrderDetails error:', err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [isOffline, queryClient, tickets],
  );

  const markKitchenReady = useCallback(
    async (ticket: Ticket) => {
      Vibration.vibrate([0, 60, 40, 120]);
      updateLocalTicketStatus(ticket.time, 'completed');

      if (!isOffline && ticket.orderId) {
        const cleanId = ticket.orderId.replace(/^#/, '');
        await updateOrderStatus(cleanId, 'completed').catch(console.warn);
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [isOffline, queryClient],
  );

  const markTicketInProgress = useCallback(
    async (ticket: Ticket) => {
      Vibration.vibrate(40);
      updateLocalTicketStatus(ticket.time, 'in_progress');

      if (!isOffline && ticket.orderId) {
        const cleanId = ticket.orderId.replace(/^#/, '');
        await updateOrderStatus(cleanId, 'in_progress').catch(console.warn);
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [isOffline, queryClient],
  );

  const recallTicketToKitchen = useCallback(
    async (ticket: Ticket) => {
      Vibration.vibrate([0, 50, 50, 100]);
      updateLocalTicketStatus(ticket.time, 'in_progress');

      if (!isOffline && ticket.orderId) {
        const cleanId = ticket.orderId.replace(/^#/, '');
        await updateOrderStatus(cleanId, 'in_progress').catch(console.warn);
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [isOffline, queryClient],
  );

  const toggleTicketRush = useCallback(
    async (ticket: Ticket) => {
      Vibration.vibrate([0, 100, 50, 100]);
      const currentTable = ticket.table;
      const rushFlag = ticket.isRush ? '' : ' | RUSH';
      const newTableVal = currentTable.includes('RUSH')
        ? currentTable.replace(' | RUSH', '')
        : `${currentTable}${rushFlag}`;

      updateLocalTicketFull(ticket.time, { table_number: newTableVal });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [queryClient],
  );

  const toggleTicketItemDone = useCallback((ticketTime: string, itemId: string) => {
    Vibration.vibrate(25);
    setItemDoneMap(prev => ({
      ...prev,
      [ticketTime]: {
        ...(prev[ticketTime] || {}),
        [itemId]: !(prev[ticketTime]?.[itemId] ?? false),
      },
    }));
  }, []);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchOrders(), syncOfflineTicketsToSupabase()]);
    setRefreshing(false);
  }, [refetchOrders]);

  return {
    categories,
    menuItems,
    tickets,
    placeOrderMutation,
    handleCancelTicket,
    handleEditTicket,
    updateOrderDetails,
    markKitchenReady,
    markTicketInProgress,
    recallTicketToKitchen,
    toggleTicketRush,
    toggleTicketItemDone,
    refreshing,
    onRefresh,
  };
}
