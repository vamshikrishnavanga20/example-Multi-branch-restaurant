// =============================================================================
// Automated RBAC & Branch Isolation Verification Suite
// =============================================================================

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@s4manohaa.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "manohaa_098";

let passed = 0;
let failed = 0;

function assert(condition, testName, extra = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${extra}`);
    failed++;
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("S4 Manohaa — Automated RBAC & Multi-Branch Verification");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("============================================================\n");

  // 1. Branch Manager Auth: Branch ID + Password (Hyderabad Manager)
  console.log("1. Testing Branch ID + Password Login for Hyderabad Manager...");
  const managerLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch_id: "branch-hyderabad-hq", password: "Manohaa@Hyd2026!" }),
  });
  const managerLoginData = await managerLoginRes.json();
  assert(managerLoginRes.status === 200, "Hyderabad manager login status 200");
  assert(managerLoginData.role === "manager", "Hyderabad manager has role 'manager'");
  assert(managerLoginData.branch_id === "branch-hyderabad-hq", "Hyderabad manager has branch_id 'branch-hyderabad-hq'");
  const managerRawCookie = managerLoginRes.headers.get("set-cookie");
  const managerCookie = managerRawCookie ? managerRawCookie.split(";")[0] : null;
  assert(!!managerCookie, "Hyderabad manager received session cookie");

  // 2. Branch Manager Auth: Branch Code + Password (Bodhgaya Manager)
  console.log("\n2. Testing Branch Code + Password Login for Bodhgaya Manager (BDG-02)...");
  const bgManagerRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch_code: "BDG-02", password: "Manohaa@Bdg2026!" }),
  });
  const bgManagerData = await bgManagerRes.json();
  assert(bgManagerRes.status === 200, "Bodhgaya manager login status 200");
  assert(bgManagerData.role === "manager", "Bodhgaya manager has role 'manager'");
  assert(bgManagerData.branch_id === "branch-bodhgaya-highway-express-9cba", "Bodhgaya manager has correct branch_id");
  const bgManagerRawCookie = bgManagerRes.headers.get("set-cookie");
  const bgManagerCookie = bgManagerRawCookie ? bgManagerRawCookie.split(";")[0] : null;

  // 3. Invalid Branch Password
  console.log("\n3. Testing Invalid Password ('WrongPassword123')...");
  const badLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch_id: "branch-hyderabad-hq", password: "WrongPassword123" }),
  });
  assert(badLoginRes.status === 401, "Invalid password rejected with 401");

  // 4. Super Admin Login (Email + Password)
  console.log("\n4. Testing Super Admin Email/Password Login...");
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.status === 200, "Super admin login status 200");
  assert(adminLoginData.role === "super_admin", "Super admin has role 'super_admin'");
  const adminRawCookie = adminLoginRes.headers.get("set-cookie");
  const adminCookie = adminRawCookie ? adminRawCookie.split(";")[0] : null;

  // 5. System Settings API
  console.log("\n5. Testing System Settings API (Toggle menu management)...");
  const settingsRes = await fetch(`${BASE_URL}/api/settings`);
  const settingsData = await settingsRes.json();
  assert(settingsRes.status === 200, "GET /api/settings status 200");
  assert(typeof settingsData.allow_branch_menu_management === "boolean", "Settings contains allow_branch_menu_management");

  // Non-super admin updating settings should fail
  const nonAdminUpdate = await fetch(`${BASE_URL}/api/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: managerCookie || "",
    },
    body: JSON.stringify({ allow_branch_menu_management: true }),
  });
  assert(nonAdminUpdate.status === 403, "Branch manager rejected from updating system settings (403)");

  // Super admin updating settings should succeed
  const adminUpdate = await fetch(`${BASE_URL}/api/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie || "",
    },
    body: JSON.stringify({ allow_branch_menu_management: false }),
  });
  assert(adminUpdate.status === 200, "Super admin can update system settings (200)");

  // 6. Branch Data Isolation: Orders
  console.log("\n6. Testing Branch Data Isolation on Orders...");
  // Hyderabad manager fetching orders
  const hydOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { Cookie: managerCookie || "" },
  });
  const hydOrders = await hydOrdersRes.json();
  assert(hydOrdersRes.status === 200, "Hyderabad manager can GET /api/orders");
  const hydOrderList = Array.isArray(hydOrders) ? hydOrders : (hydOrders.orders || []);
  const hasOnlyHydOrders = hydOrderList.every(o => !o.branch_id || o.branch_id === "branch-hyderabad-hq");
  assert(hasOnlyHydOrders, `Hyderabad manager only receives Hyderabad branch orders (${hydOrderList.length} orders)`);

  // Bodhgaya manager fetching orders
  const bgOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { Cookie: bgManagerCookie || "" },
  });
  const bgOrders = await bgOrdersRes.json();
  assert(bgOrdersRes.status === 200, "Bodhgaya manager can GET /api/orders");
  const bgOrderList = Array.isArray(bgOrders) ? bgOrders : (bgOrders.orders || []);
  const hasOnlyBgOrders = bgOrderList.every(o => !o.branch_id || o.branch_id === "branch-bodhgaya-highway-express-9cba");
  assert(hasOnlyBgOrders, `Bodhgaya manager only receives Bodhgaya branch orders (${bgOrderList.length} orders)`);

  // 7. Menu Editing Guard
  console.log("\n7. Testing Menu Management Guard when Toggle is OFF...");
  const managerMenuCreate = await fetch(`${BASE_URL}/api/menu`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: managerCookie || "",
    },
    body: JSON.stringify({
      name: "Unauthorized Dish",
      category_id: "cat-main-course",
      price: 199,
      description: "Test dish",
    }),
  });
  assert(managerMenuCreate.status === 403, "Branch manager blocked from creating menu items when toggle is OFF (403)");

  // 8. Public Pages Verification
  console.log("\n8. Testing Public Landing Page...");
  const publicPageRes = await fetch(`${BASE_URL}/`);
  assert(publicPageRes.status === 200, "Public landing page returns 200 OK");

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
