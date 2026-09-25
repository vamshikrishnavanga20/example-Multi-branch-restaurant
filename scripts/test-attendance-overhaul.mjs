// ============================================================================
// Automated Test Suite: Attendance Overhaul, Staff Rosters, and Calendar Governance
// ============================================================================
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

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("S4 Manohaa — Attendance & Staff Roster Automated Verification");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("============================================================\n");

  // 1. Authenticate Super Admin
  console.log("1. Authenticating Super Admin...");
  const superRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  check(superRes.status === 200, "Super admin login status 200");
  const superCookie = superRes.headers.get("set-cookie")?.split(";")[0] || "";

  // 2. Authenticate Hyderabad Manager
  console.log("\n2. Authenticating Hyderabad Branch Manager...");
  const hydRes = await fetch(`${BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch_id: "branch-hyderabad-hq", password: "Manohaa@Hyd2026!" }),
  });
  check(hydRes.status === 200, "Hyderabad manager login status 200");
  const hydCookie = hydRes.headers.get("set-cookie")?.split(";")[0] || "";

  // 3. Test Staff Roster per Branch
  console.log("\n3. Testing Staff Roster Isolation by Branch...");
  const hydStaffRes = await fetch(`${BASE_URL}/api/staff?branch_id=branch-hyderabad-hq`, {
    headers: { Cookie: superCookie },
  });
  const hydStaff = await hydStaffRes.json();
  check(hydStaffRes.status === 200, "GET /api/staff for Hyderabad returned 200");
  check(Array.isArray(hydStaff) && hydStaff.length >= 7, `Hyderabad has ${hydStaff.length} staff members seeded`);

  const bdgStaffRes = await fetch(`${BASE_URL}/api/staff?branch_id=branch-bodhgaya-highway-express-9cba`, {
    headers: { Cookie: superCookie },
  });
  const bdgStaff = await bdgStaffRes.json();
  check(bdgStaffRes.status === 200, "GET /api/staff for Bodhgaya returned 200");
  check(Array.isArray(bdgStaff) && bdgStaff.length >= 5, `Bodhgaya has ${bdgStaff.length} staff members seeded`);

  // 4. Test Adding Staff Member with Custom Role
  console.log("\n4. Testing Staff Creation with Custom Role...");
  const newStaffRes = await fetch(`${BASE_URL}/api/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superCookie },
    body: JSON.stringify({
      name: "Test Captain Arvind",
      role: "Floor Captain",
      department: "Service",
      phone: "+91 99887 76655",
      branch_id: "branch-bodhgaya-highway-express-9cba",
      branch_name: "Bodhgaya Highway Express",
    }),
  });
  check(newStaffRes.status === 201, "POST /api/staff created new staff (status 201)");
  const newStaff = await newStaffRes.json();
  check(newStaff.id && newStaff.name === "Test Captain Arvind", "Created staff has correct id and name");
  check(newStaff.role === "Floor Captain", "Assigned role is 'Floor Captain'");

  // 5. Test Role Update
  console.log("\n5. Testing Staff Role Modification...");
  const updateRoleRes = await fetch(`${BASE_URL}/api/staff`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: superCookie },
    body: JSON.stringify({
      id: newStaff.id,
      branch_id: "branch-bodhgaya-highway-express-9cba",
      role: "Senior Floor Manager",
      department: "Operations",
    }),
  });
  check(updateRoleRes.status === 200, "PUT /api/staff updated role (status 200)");
  const updatedStaff = await updateRoleRes.json();
  check(updatedStaff.role === "Senior Floor Manager", "Role successfully updated to 'Senior Floor Manager'");

  // 6. Test Branch Manager Authorization Guard (Hyderabad Manager cannot delete Bodhgaya Staff)
  console.log("\n6. Testing RBAC Isolation Guard on Staff Modifications...");
  const unauthorizedDelRes = await fetch(
    `${BASE_URL}/api/staff?id=${newStaff.id}&branch_id=branch-bodhgaya-highway-express-9cba`,
    {
      method: "DELETE",
      headers: { Cookie: hydCookie },
    }
  );
  check(unauthorizedDelRes.status === 403, "Hyderabad manager blocked from deleting Bodhgaya staff (403 Forbidden)");

  // 7. Test Deletion by Super Admin
  console.log("\n7. Testing Staff Removal by Authorized Admin...");
  const authorizedDelRes = await fetch(
    `${BASE_URL}/api/staff?id=${newStaff.id}&branch_id=branch-bodhgaya-highway-express-9cba`,
    {
      method: "DELETE",
      headers: { Cookie: superCookie },
    }
  );
  check(authorizedDelRes.status === 200, "Super admin deleted staff (status 200)");

  // 8. Test Attendance Date Range Query
  console.log("\n8. Testing Attendance Date-Range Filtering...");
  const rangeRes = await fetch(
    `${BASE_URL}/api/attendance?start_date=2026-09-01&end_date=2026-09-25&branch_id=branch-hyderabad-hq`,
    {
      headers: { Cookie: superCookie },
    }
  );
  check(rangeRes.status === 200, "GET /api/attendance with start_date & end_date returned 200");
  const rangeLogs = await rangeRes.json();
  check(Array.isArray(rangeLogs), "Date range returned array of logs");

  // 9. Test Clock In / Clock Out with Branch Tagging
  console.log("\n9. Testing Clock In and Clock Out with Branch Association...");
  const clockInRes = await fetch(`${BASE_URL}/api/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superCookie },
    body: JSON.stringify({
      staff_id: "staff-hyd-001",
      staff_name: "Chef Ramesh Kumar",
      action: "clock_in",
      notes: "Breakfast Shift Opening",
      branch_id: "branch-hyderabad-hq",
      branch_name: "Hyderabad Highway HQ",
    }),
  });
  check(clockInRes.status === 201, "Clock In recorded with 201 Created");
  const inEntry = await clockInRes.json();
  check(inEntry.branch_id === "branch-hyderabad-hq", "Clock In tagged with correct branch_id");
  check(inEntry.action === "clock_in", "Action is clock_in");

  const clockOutRes = await fetch(`${BASE_URL}/api/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superCookie },
    body: JSON.stringify({
      staff_id: "staff-hyd-001",
      staff_name: "Chef Ramesh Kumar",
      action: "clock_out",
      notes: "Breakfast Shift Completed",
      branch_id: "branch-hyderabad-hq",
      branch_name: "Hyderabad Highway HQ",
    }),
  });
  check(clockOutRes.status === 201, "Clock Out recorded with 201 Created");
  const outEntry = await clockOutRes.json();
  check(outEntry.action === "clock_out", "Action is clock_out");

  // 10. Test Super Admin Calendar Working Days vs Holidays Governance
  console.log("\n10. Testing Calendar Working Days & Holidays Management...");
  // Branch manager should be rejected from configuring calendar
  const mgrCalRes = await fetch(`${BASE_URL}/api/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: hydCookie },
    body: JSON.stringify({
      date: "2026-09-25",
      is_working_day: false,
      reason: "Ganesh Chaturthi Holiday",
    }),
  });
  check(mgrCalRes.status === 403, "Branch manager rejected from calendar holiday config (403 Forbidden)");

  // Super admin should be allowed
  const superCalRes = await fetch(`${BASE_URL}/api/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: superCookie },
    body: JSON.stringify({
      date: "2026-09-25",
      is_working_day: false,
      reason: "Ganesh Chaturthi Holiday",
    }),
  });
  check(superCalRes.status === 200, "Super admin set 2026-09-25 as holiday (200 OK)");
  const savedDay = await superCalRes.json();
  check(savedDay.is_working_day === false, "Day marked as non-working holiday");
  check(savedDay.reason === "Ganesh Chaturthi Holiday", "Holiday reason stored correctly");

  // Query month
  const getCalRes = await fetch(`${BASE_URL}/api/calendar?month=2026-09`, {
    headers: { Cookie: superCookie },
  });
  const monthDays = await getCalRes.json();
  check(getCalRes.status === 200, "GET /api/calendar?month=2026-09 returned 200");
  const foundHoliday = monthDays.find(d => d.date === "2026-09-25");
  check(!!foundHoliday && foundHoliday.is_working_day === false, "Configured holiday retrieved in month schedule");

  // Clean up calendar override
  const cleanCalRes = await fetch(`${BASE_URL}/api/calendar?date=2026-09-25`, {
    method: "DELETE",
    headers: { Cookie: superCookie },
  });
  check(cleanCalRes.status === 200, "Super admin reset calendar day override (200 OK)");

  console.log("\n============================================================");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
