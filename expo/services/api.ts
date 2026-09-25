// services/api.ts — Branch-aware REST API client for Example Project POS
import { Platform } from 'react-native';
import { BranchStorage, ActiveBranch } from '../lib/branchStorage';

// NOTE: Replace this IP with your computer's local Wi-Fi IPv4 address (run `ipconfig` in cmd)
const DEV_MACHINE_IP = "192.168.29.89"; // <-- UPDATE TO YOUR IP

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (__DEV__
    ? Platform.OS === 'android'
      ? `http://${DEV_MACHINE_IP}:3000`
      : `http://${DEV_MACHINE_IP}:3000`
    : "https://your-production-domain.com");

// ── 0. Franchise Branches ─────────────────────────────────────────────────────

/** Fetch all active franchise branches (includes passcodes for terminal PIN auth). */
export async function getBranches(): Promise<ActiveBranch[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/branches`);
    if (!res.ok) throw new Error('Failed to fetch branches');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('API getBranches error:', error);
    // Fallback default for offline first launch
    return [
      {
        id: 'branch-hyderabad-hq',
        name: 'Hyderabad Highway HQ',
        code: 'HYD-01',
        city: 'Hyderabad',
        owner_passcode: '9999',
        manager_passcode: '4040',
        waiter_passcode: '1111',
        chef_passcode: '2222',
        status: 'active',
      },
    ];
  }
}

// ── 1. Categories ─────────────────────────────────────────────────────────────

export async function getCategories() {
  const res = await fetch(`${API_BASE_URL}/api/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

// ── 2. Menu Items ─────────────────────────────────────────────────────────────

export async function getMenu(availableOnly = true) {
  const url = availableOnly 
    ? `${API_BASE_URL}/api/menu?available=true` 
    : `${API_BASE_URL}/api/menu`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}

// ── 3. Submit Waiter Order (Branch-Stamped) ───────────────────────────────────

export async function submitOrder(orderData: {
  table_number: string;
  order_type?: 'dine-in' | 'takeaway' | 'delivery' | 'walk-in' | 'parcel' | 'catering';
  items: { menu_item_id: string; quantity: number; notes?: string; item_notes?: string }[];
  notes?: string;
  client_order_id?: string;
}) {
  const branch = await BranchStorage.getBranch();
  const session = await BranchStorage.getSession();
  const client_order_id = orderData.client_order_id || `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  
  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_order_id,
      ...orderData,
      // Automatic franchise attribution
      branch_id: branch?.id || 'branch-hyderabad-hq',
      branch_name: branch?.name || 'Hyderabad Highway HQ',
      staff_role: session.role || 'waiter',
      staff_name: session.staffName || 'Staff',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Order creation failed");
  }

  return res.json();
}

// ── 4. Kitchen Screen: Get Active Orders (Branch-Scoped) ──────────────────────

export async function getKitchenOrders() {
  const branch = await BranchStorage.getBranch();
  const branchParam = branch?.id ? `?branch_id=${encodeURIComponent(branch.id)}` : '';
  const res = await fetch(`${API_BASE_URL}/api/orders${branchParam}`);
  if (!res.ok) throw new Error("Failed to fetch kitchen orders");
  return res.json();
}

/** Fetch all network orders across all franchise branches (for Enterprise Super Admin telemetry) */
export async function getGlobalNetworkOrders(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders`);
    if (!res.ok) throw new Error("Failed to fetch global network orders");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("API getGlobalNetworkOrders error:", err);
    return [];
  }
}

// ── 5. Update Order Status ────────────────────────────────────────────────────

export async function updateOrderStatus(order_id: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id, status }),
  });
  if (!res.ok) throw new Error("Failed to update order status");
  return res.json();
}

// ── 6. Staff Attendance ───────────────────────────────────────────────────────

export async function recordAttendance(staffId: string, staffName: string, action: 'clock_in' | 'clock_out', notes?: string) {
  const res = await fetch(`${API_BASE_URL}/api/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staff_id: staffId, staff_name: staffName, action, notes }),
  });
  if (!res.ok) throw new Error("Attendance recording failed");
  return res.json();
}

// ── 7. Customer Review ────────────────────────────────────────────────────────

export async function submitReview(customerName: string, rating: number, comment: string) {
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_name: customerName, rating, comment }),
  });
  if (!res.ok) throw new Error("Review submission failed");
  return res.json();
}
