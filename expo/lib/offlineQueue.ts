import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { submitOrder } from '../services/api';

const db = SQLite.openDatabaseSync('manohaa_pos.db');

export interface OfflineTicketRecord {
  id?: number;
  menu_item_id: string;
  item_name?: string;
  quantity: number;
  price?: number;
  total_price: number;
  item_notes?: string;
  status: string;
  table_number: string;
  order_id?: string;
  synced: number; // 0 = unsynced, 1 = synced
  created_at: string;
}

export interface CachedMenuItem {
  id: string;
  name: string;
  price: number;
  category_id?: string;
  is_veg?: number;
  available?: number;
}

export interface CachedCategory {
  id: string;
  name: string;
}

/**
 * Initialize SQLite tables on startup
 */
export function initOfflineDatabase() {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS offline_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_item_id TEXT NOT NULL,
        item_name TEXT,
        quantity INTEGER NOT NULL,
        price REAL,
        total_price REAL NOT NULL,
        item_notes TEXT,
        status TEXT NOT NULL,
        table_number TEXT NOT NULL,
        order_id TEXT,
        synced INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cached_menu (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category_id TEXT,
        is_veg INTEGER DEFAULT 1,
        available INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS cached_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_offline_tickets_synced ON offline_tickets(synced);
      CREATE INDEX IF NOT EXISTS idx_offline_tickets_created_at ON offline_tickets(created_at);
      CREATE INDEX IF NOT EXISTS idx_offline_tickets_order_id ON offline_tickets(order_id);
    `);

    // Automatic migration: verify columns on existing devices
    migrateOfflineTicketsTable();

    // Enforce 6-month (180 days) local storage retention for already-synced tickets
    cleanupOldSyncedTickets(180);
  } catch (err) {
    console.warn('initOfflineDatabase error:', err);
  }
}

/**
 * Prunes local already-synced records older than retentionDays (default: 180 days = 6 months).
 * CRITICAL SAFETY RULES:
 * 1. Unsynced tickets (synced = 0) are NEVER deleted, preventing any data loss.
 * 2. Remote Supabase cloud records are permanent and unaffected.
 */
export function cleanupOldSyncedTickets(retentionDays = 180): number {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const result = db.runSync(
      'DELETE FROM offline_tickets WHERE synced = 1 AND created_at < ?',
      [cutoffDate]
    );
    if (result.changes > 0) {
      console.log(`[Storage Prune] Cleaned up ${result.changes} synced tickets older than ${retentionDays} days.`);
    }
    return result.changes;
  } catch (err) {
    console.warn('cleanupOldSyncedTickets error:', err);
    return 0;
  }
}

/**
 * Migration helper to ensure older client databases are upgraded seamlessly.
 */
function migrateOfflineTicketsTable() {
  try {
    const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(offline_tickets)');
    const colSet = new Set(columns.map(c => c.name));

    if (!colSet.has('item_name')) {
      db.execSync('ALTER TABLE offline_tickets ADD COLUMN item_name TEXT;');
    }
    if (!colSet.has('price')) {
      db.execSync('ALTER TABLE offline_tickets ADD COLUMN price REAL;');
    }
    if (!colSet.has('item_notes')) {
      db.execSync('ALTER TABLE offline_tickets ADD COLUMN item_notes TEXT;');
    }
    if (!colSet.has('table_number')) {
      db.execSync('ALTER TABLE offline_tickets ADD COLUMN table_number TEXT DEFAULT "Walk-in";');
    }
    if (!colSet.has('order_id')) {
      db.execSync('ALTER TABLE offline_tickets ADD COLUMN order_id TEXT;');
    }

    // Ensure indexes exist even after migration
    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_offline_tickets_synced ON offline_tickets(synced);
      CREATE INDEX IF NOT EXISTS idx_offline_tickets_created_at ON offline_tickets(created_at);
      CREATE INDEX IF NOT EXISTS idx_offline_tickets_order_id ON offline_tickets(order_id);
    `);
  } catch (err) {
    console.warn('migrateOfflineTicketsTable error:', err);
  }
}

/**
 * Cache categories locally
 */
export function cacheCategories(categories: any[]) {
  try {
    if (!categories || categories.length === 0) return;
    db.execSync('DELETE FROM cached_categories;');
    for (const cat of categories) {
      db.runSync(
        'INSERT OR REPLACE INTO cached_categories (id, name) VALUES (?, ?)',
        [cat.id, cat.name]
      );
    }
  } catch (err) {
    console.warn('cacheCategories error:', err);
  }
}

/**
 * Get cached categories when offline
 */
export function getCachedCategories(): CachedCategory[] {
  try {
    return db.getAllSync<CachedCategory>('SELECT * FROM cached_categories ORDER BY name ASC');
  } catch (err) {
    console.warn('getCachedCategories error:', err);
    return [];
  }
}

/**
 * Cache menu items locally for offline browsing
 */
export function cacheMenuItems(items: any[]) {
  try {
    if (!items || items.length === 0) return;
    db.execSync('DELETE FROM cached_menu;');
    for (const item of items) {
      db.runSync(
        `INSERT OR REPLACE INTO cached_menu (id, name, price, category_id, is_veg, available)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.name,
          item.price,
          item.category_id || '',
          item.is_veg ? 1 : 0,
          item.available !== false ? 1 : 0,
        ]
      );
    }
  } catch (err) {
    console.warn('cacheMenuItems error:', err);
  }
}

/**
 * Retrieve cached menu when offline
 */
export function getCachedMenuItems(): CachedMenuItem[] {
  try {
    return db.getAllSync<CachedMenuItem>('SELECT * FROM cached_menu WHERE available = 1 ORDER BY name ASC');
  } catch (err) {
    console.warn('getCachedMenuItems error:', err);
    return [];
  }
}

/**
 * Save an order bundle locally in SQLite
 */
export function placeOrderLocally(
  items: Array<{
    id: string;
    name: string;
    price: number;
    qty: number;
    notes?: string;
  }>,
  tableNumber: string,
  createdAt: string,
  isSynced = false,
  orderId?: string
) {
  const insertItems = () => {
    for (const item of items) {
      db.runSync(
        `INSERT INTO offline_tickets 
          (menu_item_id, item_name, quantity, price, total_price, item_notes, status, table_number, order_id, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [
          item.id,
          item.name,
          item.qty,
          item.price,
          item.price * item.qty,
          item.notes || '',
          tableNumber,
          orderId || '',
          isSynced ? 1 : 0,
          createdAt,
        ]
      );
    }
  };

  try {
    insertItems();
  } catch (err: any) {
    // If schema mismatch occurred, attempt migration and retry once
    console.warn('placeOrderLocally error, attempting table migration:', err);
    try {
      migrateOfflineTicketsTable();
      insertItems();
    } catch (retryErr) {
      console.error('placeOrderLocally retry failed:', retryErr);
    }
  }
}

/**
 * Get all local tickets from SQLite (useful for offline KDS & Waiter History)
 */
export function getLocalTickets(): OfflineTicketRecord[] {
  try {
    return db.getAllSync<OfflineTicketRecord>(
      'SELECT * FROM offline_tickets ORDER BY created_at DESC LIMIT 300'
    );
  } catch (err) {
    console.warn('getLocalTickets error:', err);
    return [];
  }
}

/**
 * Update local ticket status in SQLite (e.g. when Chef marks Ready or In Progress while offline)
 */
export function updateLocalTicketStatus(createdAt: string, status: string) {
  try {
    db.runSync(
      'UPDATE offline_tickets SET status = ? WHERE created_at = ?',
      [status, createdAt]
    );
  } catch (err) {
    console.warn('updateLocalTicketStatus error:', err);
  }
}

export interface LocalTicketItemUpdate {
  id?: number;
  menu_item_id: string;
  item_name?: string;
  quantity: number;
  price?: number;
  total_price: number;
  notes?: string;
}

/**
 * Full update for offline ticket details (status, table, quantities) without destroying records
 */
export function updateLocalTicketFull(
  createdAt: string,
  updates: {
    status?: string;
    table_number?: string;
    item_notes?: string;
    items?: LocalTicketItemUpdate[];
  }
) {
  try {
    if (updates.status && updates.table_number) {
      db.runSync(
        'UPDATE offline_tickets SET status = ?, table_number = ? WHERE created_at = ?',
        [updates.status, updates.table_number, createdAt]
      );
    } else if (updates.status) {
      db.runSync(
        'UPDATE offline_tickets SET status = ? WHERE created_at = ?',
        [updates.status, createdAt]
      );
    } else if (updates.table_number) {
      db.runSync(
        'UPDATE offline_tickets SET table_number = ? WHERE created_at = ?',
        [updates.table_number, createdAt]
      );
    }

    if (updates.items && updates.items.length > 0) {
      for (const item of updates.items) {
        if (item.id && typeof item.id === 'number') {
          if (item.quantity <= 0) {
            db.runSync('DELETE FROM offline_tickets WHERE id = ?', [item.id]);
          } else {
            db.runSync(
              'UPDATE offline_tickets SET quantity = ?, total_price = ? WHERE id = ?',
              [item.quantity, item.total_price, item.id]
            );
          }
        } else if (item.quantity > 0) {
          // If a new item was added to the ticket locally
          db.runSync(
            `INSERT INTO offline_tickets (menu_item_id, item_name, quantity, price, total_price, status, table_number, created_at, synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              item.menu_item_id,
              item.item_name || 'Dish',
              item.quantity,
              item.price || 0,
              item.total_price,
              updates.status || 'pending',
              updates.table_number || 'Walk-in',
              createdAt,
            ]
          );
        }
      }
    }
  } catch (err) {
    console.warn('updateLocalTicketFull error:', err);
  }
}

// Mutex lock to prevent race conditions and duplicate inserts when network toggles rapidly
let isSyncing = false;

/**
 * Sync unsent offline tickets to REST API when network is restored
 */
export async function syncOfflineTicketsToSupabase(): Promise<number> {
  if (isSyncing) {
    return 0;
  }
  isSyncing = true;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return 0;

    const unsyncedTickets = db.getAllSync<OfflineTicketRecord>(
      'SELECT * FROM offline_tickets WHERE synced = 0'
    );

    if (!unsyncedTickets || unsyncedTickets.length === 0) return 0;

    let syncedCount = 0;

    // Group unsynced items by created_at / table_number so orders are dispatched as batches
    const grouped = new Map<string, OfflineTicketRecord[]>();
    for (const ticket of unsyncedTickets) {
      const groupKey = ticket.order_id || ticket.created_at;
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey)!.push(ticket);
    }

    for (const [groupKey, items] of grouped.entries()) {
      const firstItem = items[0];
      const tableNumber = firstItem.table_number || 'Walk-in';
      const notes = items.map(i => i.item_notes).filter(Boolean).join(', ') || undefined;

      try {
        const deterministicOrderId = groupKey.startsWith('mobile-') || groupKey.startsWith('pos-') 
          ? groupKey 
          : `offline-${groupKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        await submitOrder({
          client_order_id: deterministicOrderId,
          table_number: tableNumber,
          items: items.map(i => ({
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            notes: i.item_notes,
            item_notes: i.item_notes,
          })),
          notes,
        });

        for (const item of items) {
          if (item.id) {
            db.runSync('UPDATE offline_tickets SET synced = 1 WHERE id = ?', [item.id]);
          }
        }
        syncedCount += items.length;
      } catch (err: any) {
        console.warn('Sync ticket failed for group:', groupKey, err?.message);
      }
    }

    return syncedCount;
  } catch (err) {
    console.warn('syncOfflineTickets error:', err);
    return 0;
  } finally {
    isSyncing = false;
  }
}

// Alias for clean naming across the app
export const syncOfflineTickets = syncOfflineTicketsToSupabase;