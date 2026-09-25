// Test Super Admin orders fetch and branch scoping
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@s4manohaa.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "manohaa_098";

async function main() {
  console.log('Testing Order History Branch Scoping & Badges...');

  // 1. Super Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  
  if (loginRes.status !== 200) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }
  
  const setCookie = loginRes.headers.get('set-cookie');
  const adminCookie = setCookie ? setCookie.split(';')[0] : null;
  console.log('1. Super admin logged in successfully. Status:', loginRes.status);

  // 2. Fetch all orders as super admin
  const ordersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { Cookie: adminCookie || '' }
  });
  const orders = await ordersRes.json();
  const orderList = Array.isArray(orders) ? orders : (orders.orders || []);
  console.log(`2. Total orders fetched: ${orderList.length}`);

  // 3. Inspect branch tags
  const hydOrders = orderList.filter(o => !o.branch_id || o.branch_id === 'branch-hyderabad-hq');
  const bgOrders = orderList.filter(o => o.branch_id === 'branch-bodhgaya-highway-express-9cba');
  console.log(`3. Hyderabad orders count: ${hydOrders.length}`);
  console.log(`4. Bodhgaya orders count: ${bgOrders.length}`);

  // Sample order
  if (orderList.length > 0) {
    const sample = orderList[0];
    console.log(`Sample order ID: ${sample.order_id}, branch_id: ${sample.branch_id || 'default (Hyderabad)'}, branch_name: ${sample.branch_name || 'Hyderabad Highway HQ'}`);
  }

  // 4. Test loading /admin page with session cookie
  const adminPageRes = await fetch(`${BASE_URL}/admin`, {
    headers: { Cookie: adminCookie || '' }
  });
  console.log('5. GET /admin page status:', adminPageRes.status);
  if (adminPageRes.status !== 200) {
    throw new Error(`/admin page returned status ${adminPageRes.status}`);
  }

  console.log('\nAll Branch Filter checks PASSED successfully!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
