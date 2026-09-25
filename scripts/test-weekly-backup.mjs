// =============================================================================
// S4 MANOHAA FOOD PLAZA — WEEKLY BACKUP AUTOMATED TEST SUITE
// =============================================================================
// Verifies:
//   1. Previous week date range calculation
//   2. Unauthorized request rejection (401)
//   3. Execution of weekly backup via Next.js Cron API route
//   4. Archive metadata, order extraction, and analytics generation
//   5. Idempotency (subsequent runs skip duplicate uploads unless force=true)
// =============================================================================

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "VT_vt777";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n============================================================");
  console.log("   S4 MANOHAA — WEEKLY BACKUP VERIFICATION SUITE");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log("============================================================\n");

  // 1. Security Check: Unauthorized call rejected
  console.log("1. Testing Security Guard (No Authorization Header)...");
  const unauthRes = await fetch(`${BASE_URL}/api/cron/weekly-backup`);
  assert(unauthRes.status === 401, "Unauthenticated request rejected with HTTP 401");

  // 2. Security Check: Invalid Token rejected
  console.log("\n2. Testing Invalid Cron Token...");
  const invalidTokenRes = await fetch(`${BASE_URL}/api/cron/weekly-backup`, {
    headers: { Authorization: "Bearer wrong-token-123" },
  });
  assert(invalidTokenRes.status === 401, "Invalid token rejected with HTTP 401");

  // 3. List Archives endpoint
  console.log("\n3. Testing Archives Listing (?action=list)...");
  const listRes = await fetch(`${BASE_URL}/api/cron/weekly-backup?action=list`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  assert(listRes.status === 200, "GET /api/cron/weekly-backup?action=list returns HTTP 200");
  const listData = await listRes.json();
  assert(listData.success === true, "Listing reports success: true");
  assert(!!listData.previous_week?.weekString, `Calculated previous week: ${listData.previous_week?.weekString}`);
  console.log(`     Previous Week Range: ${listData.previous_week?.startDate} to ${listData.previous_week?.endDate}`);

  // 4. Execute Weekly Backup
  console.log("\n4. Executing Weekly Backup for Previous Week...");
  const backupRes = await fetch(`${BASE_URL}/api/cron/weekly-backup?force=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  assert(backupRes.status === 200, "Backup execution returns HTTP 200");
  const backupData = await backupRes.json();
  assert(backupData.success === true, "Backup result indicates success: true");
  assert(Array.isArray(backupData.files) && backupData.files.length === 4, "Generated all 4 expected archive files (orders, attendance, analytics, metadata)");
  assert(backupData.files.includes("orders.json"), "Contains orders.json");
  assert(backupData.files.includes("attendance.json"), "Contains attendance.json");
  assert(backupData.files.includes("analytics.json"), "Contains analytics.json");
  assert(backupData.files.includes("backup-metadata.json"), "Contains backup-metadata.json");
  console.log(`     S3 Bucket: ${backupData.s3_bucket}`);
  console.log(`     S3 Prefix: ${backupData.s3_prefix}`);
  console.log(`     Duration: ${backupData.duration_ms}ms`);

  // 5. Test Idempotency (Run again without force=true)
  console.log("\n5. Testing Idempotency (Duplicate run without force flag)...");
  const idempRes = await fetch(`${BASE_URL}/api/cron/weekly-backup`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  assert(idempRes.status === 200, "Idempotent check returns HTTP 200");
  const idempData = await idempRes.json();
  assert(idempData.skipped === true, "Second execution safely skipped redundant upload (skipped: true)");
  console.log(`     Reason: ${idempData.reason}`);

  console.log("\n============================================================");
  console.log(`   RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
