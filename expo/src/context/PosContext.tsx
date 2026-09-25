/**
 * PosContext — Thin orchestrator that composes domain hooks.
 *
 * Provides a single context for all POS-related state to screens.
 * Business logic lives in hooks/useCart, hooks/useOrders, hooks/useNetwork.
 */

import React, { createContext, useState, useCallback, useContext } from 'react';
import { useCart, CartItem } from '../hooks/useCart';
import {
  useOrders, OrderType, Ticket, OrderEventCallback,
  EditOrderPayload, EditOrderItem,
} from '../hooks/useOrders';
import { useNetwork } from '../hooks/useNetwork';
import { useNotification } from './NotificationContext';
import { AuthContext } from './AuthContext';
import { hapticSuccess } from '../utils/haptics';

// Re-export types for consumers
export type { CartItem } from '../hooks/useCart';
export type { OrderType, Ticket, TicketItem, EditOrderPayload, EditOrderItem } from '../hooks/useOrders';

interface PosContextType {
  // Menu data
  categories: any[];
  menuItems: any[];

  // Cart
  cart: CartItem[];
  updateCart: (item: any, delta: number) => void;
  updateCartItemNotes: (itemId: string, notes: string) => void;
  clearCart: () => void;

  // Order config
  tableNumber: string;
  setTableNumber: (v: string) => void;
  orderType: OrderType;
  setOrderType: (v: OrderType) => void;
  coverCount: number;
  setCoverCount: (v: number) => void;
  orderNotes: string;
  setOrderNotes: (v: string) => void;

  // Order actions
  handlePlaceOrder: () => void;
  placingOrder: boolean;

  // Tickets / history
  tickets: Ticket[];
  handleCancelTicket: (ticket: Ticket) => void;
  handleEditTicket: (ticket: Ticket) => void;
  updateOrderDetails: (payload: EditOrderPayload) => Promise<void>;
  markKitchenReady: (ticket: Ticket) => void;
  toggleTicketItemDone: (ticketTime: string, itemId: string) => void;
  markTicketInProgress: (ticket: Ticket) => void;
  recallTicketToKitchen: (ticket: Ticket) => void;
  toggleTicketRush: (ticket: Ticket) => void;

  // UI state
  isOffline: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  currentTime: number;

  // Success modal
  showSuccess: boolean;
  setShowSuccess: (v: boolean) => void;
  lastOrderSummary: { itemCount: number; total: number; table: string; orderId: string } | null;
}

export const PosContext = createContext<PosContextType>({} as PosContextType);

export const PosProvider = ({ children }: { children: React.ReactNode }) => {
  // ─── Compose hooks ─────────────────────────────────────────────────────────
  const { userRole } = useContext(AuthContext);
  const { isOffline } = useNetwork();
  const { showNotification } = useNotification();

  const {
    cart, setCart, updateCart, updateCartItemNotes, clearCart,
    cartTotal, cartQty,
  } = useCart();

  // ─── Order config state ────────────────────────────────────────────────────
  const [tableNumber, setTableNumber] = useState('Walk-in');
  const [orderType, setOrderType] = useState<OrderType>('walk-in');
  const [coverCount, setCoverCount] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrderSummary, setLastOrderSummary] = useState<{
    itemCount: number; total: number; table: string; orderId: string;
  } | null>(null);

  // Notification callback for order events (silenced for admin)
  const onOrderEvent = useCallback<OrderEventCallback>((event) => {
    if (userRole === 'admin') return;
    if (event.type === 'order_ready') {
      showNotification('Order Ready', event.message, 'order_ready');
    } else if (event.type === 'new_order') {
      showNotification('New Order', event.message, 'info');
    }
  }, [showNotification, userRole]);

  const {
    categories, menuItems, tickets,
    placeOrderMutation,
    handleCancelTicket,
    handleEditTicket: editTicketRaw,
    updateOrderDetails,
    markKitchenReady,
    markTicketInProgress,
    recallTicketToKitchen,
    toggleTicketRush,
    toggleTicketItemDone,
    refreshing, onRefresh,
  } = useOrders(isOffline, onOrderEvent, userRole);

  // ─── Place Order (Instant Optimistic UI — 0ms Latency) ──────────────────────
  const handlePlaceOrder = useCallback(() => {
    if (cart.length === 0) return;

    const cartSnapshot = [...cart];
    const cartQtySnapshot = cartQty;
    const cartTotalSnapshot = cartTotal;

    const nextOrderId = `#ORD-${1001 + tickets.length}`;
    const tableLabel = tableNumber.trim().split(' | ')[0] || 'Walk-in';

    // 1. Instant summary capture
    setLastOrderSummary({
      itemCount: cartQtySnapshot,
      total: cartTotalSnapshot,
      table: tableLabel,
      orderId: nextOrderId,
    });

    // 2. Instant 0ms Optimistic UI updates & rich tactile feedback
    hapticSuccess();
    setShowSuccess(true);
    clearCart();
    setTableNumber('Walk-in');
    setOrderType('walk-in');
    setCoverCount(1);
    setOrderNotes('');

    // 3. Dispatch order mutation in background (handles SQLite offline + AWS REST API sync)
    const encodedTable = `${tableLabel} | ${orderType}${
      orderNotes.trim() ? ` | NOTE:${orderNotes.trim()}` : ''
    }`;

    placeOrderMutation.mutate(
      { currentCart: cartSnapshot, currentTable: encodedTable, orderId: nextOrderId },
      {
        onError: (err) => {
          console.warn('Background order dispatch notice:', err);
        },
      },
    );
  }, [cart, tableNumber, orderType, orderNotes, placeOrderMutation, cartQty, cartTotal, clearCart, tickets.length]);

  // ─── Edit ticket → rebuild cart ────────────────────────────────────────────
  const handleEditTicket = useCallback(
    (ticket: Ticket) => {
      editTicketRaw(ticket).then(rebuiltCart => {
        if (rebuiltCart) {
          setCart(rebuiltCart);
          setTableNumber(ticket.table);
          setOrderType(ticket.orderType);
          setCoverCount(ticket.coverCount);
        }
      });
    },
    [editTicketRaw, setCart],
  );

  // Ticking currentTime for HistoryScreen edit window countdown
  const [currentTime, setCurrentTime] = useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PosContext.Provider
      value={{
        categories,
        menuItems,
        cart,
        updateCart,
        updateCartItemNotes,
        clearCart,
        tableNumber,
        setTableNumber,
        orderType,
        setOrderType,
        coverCount,
        setCoverCount,
        orderNotes,
        setOrderNotes,
        handlePlaceOrder,
        placingOrder: placeOrderMutation.isPending,
        tickets,
        handleCancelTicket,
        handleEditTicket,
        updateOrderDetails,
        markKitchenReady,
        markTicketInProgress,
        recallTicketToKitchen,
        toggleTicketRush,
        toggleTicketItemDone,
        isOffline,
        refreshing,
        onRefresh,
        currentTime,
        showSuccess,
        setShowSuccess,
        lastOrderSummary,
      }}
    >
      {children}
    </PosContext.Provider>
  );
};