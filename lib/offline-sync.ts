// =============================================================================
// WEB POS OFFLINE ENGINE & BACKGROUND SYNC MANAGER
// =============================================================================
// Provides zero-downtime offline order punching, local queueing with
// idempotent client_order_id, offline menu catalog caching, and automatic
// background cloud synchronization when internet connection is restored.
// =============================================================================

export interface OfflineCartItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  item_notes?: string;
}

export interface QueuedOrder {
  client_order_id: string;
  items: OfflineCartItem[];
  table_number: string;
  order_type: 'dine-in' | 'takeaway' | 'delivery' | 'walk-in' | string;
  notes?: string;
  branch_id?: string;
  branch_name?: string;
  total_amount: number;
  created_at: string;
  retry_count: number;
  last_error?: string;
}

const QUEUE_KEY = 'manohaa_web_pos_queue_v1';
const MENU_CACHE_KEY = 'manohaa_web_pos_menu_cache_v1';

type QueueListener = (queuedCount: number, isOnline: boolean) => void;
const listeners = new Set<QueueListener>();

function notifyListeners() {
  const count = getQueueCount();
  const online = isOnline();
  listeners.forEach((fn) => {
    try {
      fn(count, online);
    } catch {}
  });
}

/** Check if the browser currently has network connectivity */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

/** Retrieve all queued offline orders from local persistence */
export function getQueuedOrders(): QueuedOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[OfflineSync] Failed to read offline queue:', err);
    return [];
  }
}

/** Get number of pending offline orders */
export function getQueueCount(): number {
  return getQueuedOrders().length;
}

/** Push an order to the local offline queue */
export function queueOfflineOrder(order: Omit<QueuedOrder, 'created_at' | 'retry_count'>): QueuedOrder {
  if (typeof window === 'undefined') throw new Error('Offline storage unavailable on server');
  const fullOrder: QueuedOrder = {
    ...order,
    created_at: new Date().toISOString(),
    retry_count: 0,
  };

  const queue = getQueuedOrders();
  // Prevent duplicate queuing of same client_order_id
  const existingIdx = queue.findIndex((q) => q.client_order_id === order.client_order_id);
  if (existingIdx >= 0) {
    queue[existingIdx] = fullOrder;
  } else {
    queue.push(fullOrder);
  }

  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    notifyListeners();
  } catch (err) {
    console.error('[OfflineSync] Failed to save offline order to localStorage:', err);
  }

  return fullOrder;
}

/** Remove an order from queue once successfully synced */
export function removeQueuedOrder(clientOrderId: string): void {
  if (typeof window === 'undefined') return;
  const queue = getQueuedOrders().filter((q) => q.client_order_id !== clientOrderId);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    notifyListeners();
  } catch (err) {
    console.error('[OfflineSync] Failed to remove order from queue:', err);
  }
}

/** Flush and sync all queued orders to the cloud backend */
export async function syncOfflineQueue(): Promise<{
  synced: number;
  remaining: number;
  errors: string[];
}> {
  if (typeof window === 'undefined') return { synced: 0, remaining: 0, errors: [] };
  if (!isOnline()) {
    return { synced: 0, remaining: getQueueCount(), errors: ['Network is currently offline'] };
  }

  const queue = getQueuedOrders();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0, errors: [] };
  }

  let synced = 0;
  const errors: string[] = [];

  for (const queued of queue) {
    try {
      const payload = {
        client_order_id: queued.client_order_id,
        items: queued.items.map((i) => ({
          menu_item_id: i.menu_item_id,
          quantity: i.quantity,
          notes: i.notes || i.item_notes,
          item_notes: i.notes || i.item_notes,
        })),
        table_number: queued.table_number,
        order_type: queued.order_type,
        notes: queued.notes,
        branch_id: queued.branch_id,
        branch_name: queued.branch_name,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      removeQueuedOrder(queued.client_order_id);
      synced++;
    } catch (err: any) {
      console.warn(`[OfflineSync] Sync failed for order ${queued.client_order_id}:`, err?.message);
      errors.push(`${queued.client_order_id}: ${err?.message || 'Network error'}`);
      // If network disconnected during loop, stop further attempts
      if (!isOnline()) break;
    }
  }

  notifyListeners();
  return { synced, remaining: getQueueCount(), errors };
}

/** Cache menu catalog for offline browsing & POS cart creation */
export function cacheMenuCatalog(categories: any[], dishes: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      MENU_CACHE_KEY,
      JSON.stringify({
        categories,
        dishes,
        timestamp: new Date().toISOString(),
      })
    );
  } catch {}
}

/** Retrieve cached menu catalog when offline */
export function getCachedMenuCatalog(): { categories: any[]; dishes: any[]; timestamp: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Subscribe to online/offline status and queue size changes */
export function subscribeToSyncStatus(listener: QueueListener): () => void {
  listeners.add(listener);
  if (typeof window !== 'undefined') {
    listener(getQueueCount(), isOnline());
  }
  return () => {
    listeners.delete(listener);
  };
}

// Automatically setup browser network event listeners on client load
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Network restored. Triggering auto-sync...');
    notifyListeners();
    syncOfflineQueue();
  });

  window.addEventListener('offline', () => {
    console.warn('[OfflineSync] Network connection lost. Operating in offline POS mode.');
    notifyListeners();
  });
}
