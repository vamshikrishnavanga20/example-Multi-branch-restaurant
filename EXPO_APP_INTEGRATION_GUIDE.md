# Example Project — Expo Native App Integration Guide

This guide contains everything you need to connect your **React Native (Expo)** waiter and kitchen app to the **AWS Serverless Backend**.

---

## 1. Copy-Paste AI Prompt for Your Expo App Folder

Open your separate Expo project folder in your AI assistant, and send it this prompt:

```markdown
We have migrated our backend from Supabase to an AWS Serverless Next.js REST API (powered by DynamoDB in ap-south-2 Hyderabad and S3).

Please update this Expo app to use our REST API endpoints instead of Supabase:

1. API Base URL:
   - For local development: `http://<YOUR_COMPUTER_LOCAL_IP>:3000` (e.g., http://192.168.1.10:3000 - do not use localhost on mobile!)
   - For production: `https://your-domain.com`

2. Available Endpoints:
   - `GET /api/categories` -> Returns all category sections [{ id, name, img, sort_order }]
   - `GET /api/menu?available=true` -> Returns active dishes [{ id, name, desc, price, img, available, category_id, popular, is_veg, dietary_tags }]
   - `POST /api/orders` -> Waiter submits an order:
     Payload: { client_order_id: string, table_number: string, order_type: "dine-in" | "takeaway", items: [{ menu_item_id: string, quantity: number }], notes?: string }
   - `GET /api/orders` -> Kitchen view: lists active order tickets with item breakdown and status.
   - `PUT /api/orders` -> Update order status:
     Payload: { order_id: string, status: "pending" | "in_progress" | "completed" | "cancelled" }
   - `POST /api/attendance` -> Staff clock-in / clock-out:
     Payload: { staff_id: string, staff_name: string, action: "clock_in" | "clock_out", notes?: string }
   - `POST /api/reviews` -> Customer review submission:
     Payload: { customer_name: string, rating: number, comment: string }

3. Remove any direct `@supabase/supabase-js` imports and replace with clean `fetch()` or `axios` calls to the above endpoints.
```

---

## 2. Drop-in API Client for Your Expo App (`services/api.ts`)

You can create this file inside your Expo project at `services/api.ts`:

```typescript
// services/api.ts
import { Platform } from 'react-native';

// NOTE: Replace this IP with your computer's local Wi-Fi IPv4 address (run `ipconfig` in cmd)
const DEV_MACHINE_IP = "192.168.29.89"; // <-- UPDATE TO YOUR IP

export const API_BASE_URL = __DEV__
  ? Platform.OS === 'android'
    ? `http://${DEV_MACHINE_IP}:3000`
    : `http://${DEV_MACHINE_IP}:3000`
  : "https://your-production-domain.com";

// 1. Categories
export async function getCategories() {
  const res = await fetch(`${API_BASE_URL}/api/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

// 2. Menu Items
export async function getMenu(availableOnly = true) {
  const url = availableOnly 
    ? `${API_BASE_URL}/api/menu?available=true` 
    : `${API_BASE_URL}/api/menu`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}

// 3. Submit Waiter Order
export async function submitOrder(orderData: {
  table_number: string;
  order_type?: 'dine-in' | 'takeaway' | 'delivery';
  items: { menu_item_id: string; quantity: number }[];
  notes?: string;
}) {
  const client_order_id = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  
  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_order_id,
      ...orderData,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Order creation failed");
  }

  return res.json();
}

// 4. Kitchen Screen: Get Active Orders
export async function getKitchenOrders() {
  const res = await fetch(`${API_BASE_URL}/api/orders`);
  if (!res.ok) throw new Error("Failed to fetch kitchen orders");
  return res.json();
}

// 5. Update Order Status (e.g. from Kitchen: Cooking -> Ready -> Served)
export async function updateOrderStatus(order_id: string, status: 'in_progress' | 'completed' | 'cancelled') {
  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id, status }),
  });
  if (!res.ok) throw new Error("Failed to update order status");
  return res.json();
}

// 6. Staff Attendance (Clock in / Clock out)
export async function recordAttendance(staffId: string, staffName: string, action: 'clock_in' | 'clock_out', notes?: string) {
  const res = await fetch(`${API_BASE_URL}/api/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staff_id: staffId, staff_name: staffName, action, notes }),
  });
  if (!res.ok) throw new Error("Attendance recording failed");
  return res.json();
}
```

---

## 3. How Waiter Order Flow Works in Real Time

```text
[ Waiter's Phone (Expo App) ]
         │
         │  POST /api/orders { table: "Table 3", items: [...] }
         ▼
[ Next.js API Route ]
         │
         │  Atomic PutItem & BatchWrite (sub-10ms)
         ▼
[ AWS DynamoDB (Hyderabad ap-south-2) ]
   ├── Partition ORDER: ORD#<date>#<id>
   └── Partition LEDGER: LED#<date>#<id>
         │
         ├──► [ Admin Command Center (Web) ] (Updates via SSE in 1 second)
         └──► [ Kitchen Display Screen (Expo) ] (Polls/refreshes live ticket queue)
```

No AWS keys or secrets ever touch the mobile phone. Everything is fast, secure, and authenticated through your server.
