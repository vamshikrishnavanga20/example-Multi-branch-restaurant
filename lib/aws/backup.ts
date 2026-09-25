// =============================================================================
// EXAMPLE PROJECT — WEEKLY AUTOMATED BACKUP & ARCHIVE ENGINE
// =============================================================================
// Copies the previous week's business data (Orders, Attendance, and Analytics)
// from Amazon DynamoDB ("ManohaaHotel") to a dedicated, encrypted S3 bucket.
//
// Target S3 Layout:
//   s3://<BACKUP_S3_BUCKET_NAME>/<YYYY-Www>/
//       ├── orders.json
//       ├── attendance.json
//       ├── analytics.json
//       └── backup-metadata.json
// =============================================================================

import { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Orders, Attendance, Branches, MenuItems } from "./dynamodb";

const region = process.env.AWS_REGION || "ap-south-2";
const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const BACKUP_BUCKET_NAME = process.env.BACKUP_S3_BUCKET_NAME || "manohaa-hotel-backups";

export interface WeekRange {
  weekString: string; // e.g. "2026-W38"
  startDate: string;  // YYYY-MM-DD (Monday 00:00:00)
  endDate: string;    // YYYY-MM-DD (Sunday 23:59:59)
  startIso: string;
  endIso: string;
}

/**
 * Calculates the ISO-8601 week string and date range for the previous week
 * relative to the given reference date (defaults to now).
 * In ISO 8601, weeks run from Monday to Sunday.
 */
export function getPreviousWeekRange(referenceDate: Date = new Date()): WeekRange {
  // 1. Identify current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const current = new Date(referenceDate);
  const day = current.getUTCDay();
  // Distance back to the most recent Monday (1)
  const diffToCurrentMonday = (day + 6) % 7;

  // Previous week's Sunday is 1 day before current Monday
  const prevSunday = new Date(current);
  prevSunday.setUTCDate(current.getUTCDate() - diffToCurrentMonday - 1);
  prevSunday.setUTCHours(23, 59, 59, 999);

  // Previous week's Monday is 6 days before previous Sunday
  const prevMonday = new Date(prevSunday);
  prevMonday.setUTCDate(prevSunday.getUTCDate() - 6);
  prevMonday.setUTCHours(0, 0, 0, 0);

  // 2. Compute ISO-8601 Week Number (based on Thursday of that week)
  const targetThursday = new Date(prevMonday);
  targetThursday.setUTCDate(prevMonday.getUTCDate() + 3);
  const firstThursdayOfYear = new Date(Date.UTC(targetThursday.getUTCFullYear(), 0, 4));
  firstThursdayOfYear.setUTCDate(firstThursdayOfYear.getUTCDate() - ((firstThursdayOfYear.getUTCDay() + 6) % 7) + 3);

  const weekDiffMs = targetThursday.getTime() - firstThursdayOfYear.getTime();
  const weekNum = 1 + Math.round(weekDiffMs / (7 * 86400000));
  const year = targetThursday.getUTCFullYear();
  const weekString = `${year}-W${String(weekNum).padStart(2, "0")}`;

  const startDate = prevMonday.toISOString().split("T")[0];
  const endDate = prevSunday.toISOString().split("T")[0];

  return {
    weekString,
    startDate,
    endDate,
    startIso: prevMonday.toISOString(),
    endIso: prevSunday.toISOString(),
  };
}

/**
 * Computes weekly sales analytics and KPI metrics using the project's
 * standard enterprise reporting logic.
 */
export function computeWeeklyAnalytics(
  orders: any[],
  ledgerEntries: any[],
  attendance: any[],
  branches: any[],
  dishes: any[]
) {
  const dishMap = new Map(dishes.map((d) => [d.id, d]));
  const branchMap = new Map(branches.map((b) => [b.id, b]));

  let totalRevenue = 0;
  const statusCounts: Record<string, number> = { completed: 0, pending: 0, in_progress: 0, cancelled: 0 };
  const diningTypeCounts: Record<string, number> = {};
  const dailyDistribution: Record<string, { revenue: number; orders: number }> = {};
  const branchBreakdown: Record<string, { branch_name: string; revenue: number; orders: number; royalty_pct: number; royalty_due: number }> = {};
  const itemSales: Record<string, { name: string; quantity: number; revenue: number; is_veg?: boolean }> = {};

  // 1. Process Order Headers
  for (const order of orders) {
    const rev = Number(order.total_amount || 0);
    totalRevenue += rev;

    const st = (order.status || "completed").toLowerCase();
    statusCounts[st] = (statusCounts[st] || 0) + 1;

    const dt = order.table_number ? order.table_number.split("|")[0].trim() : "Dine-In";
    diningTypeCounts[dt] = (diningTypeCounts[dt] || 0) + 1;

    // Daily distribution (YYYY-MM-DD)
    const dateKey = (order.created_at || "").split("T")[0] || "unknown";
    if (!dailyDistribution[dateKey]) {
      dailyDistribution[dateKey] = { revenue: 0, orders: 0 };
    }
    dailyDistribution[dateKey].revenue += rev;
    dailyDistribution[dateKey].orders += 1;

    // Branch breakdown
    const bId = order.branch_id || "branch-hyderabad-hq";
    const branchInfo = branchMap.get(bId);
    const bName = order.branch_name || branchInfo?.name || "Hyderabad Highway HQ";
    const isHQ = bId === "branch-hyderabad-hq" || branchInfo?.code === "HYD-01";
    const rPct = isHQ ? 0 : Number(branchInfo?.royalty_pct ?? 10);

    if (!branchBreakdown[bId]) {
      branchBreakdown[bId] = {
        branch_name: bName,
        revenue: 0,
        orders: 0,
        royalty_pct: rPct,
        royalty_due: 0,
      };
    }
    branchBreakdown[bId].revenue += rev;
    branchBreakdown[bId].orders += 1;
    branchBreakdown[bId].royalty_due = branchBreakdown[bId].revenue * (rPct / 100);
  }

  // 2. Process Ledger Entries for Item-Level Intelligence
  for (const entry of ledgerEntries) {
    const dish = dishMap.get(entry.menu_item_id);
    const itemName = dish?.name || "Special Selection";
    const qty = Number(entry.quantity || 1);
    const price = Number(entry.total_price || 0);

    if (!itemSales[itemName]) {
      itemSales[itemName] = {
        name: itemName,
        quantity: 0,
        revenue: 0,
        is_veg: dish?.is_veg,
      };
    }
    itemSales[itemName].quantity += qty;
    itemSales[itemName].revenue += price;
  }

  // Sort top items by quantity sold
  const topSellingDishes = Object.values(itemSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 15);

  // 3. Process Attendance Metrics
  const staffSet = new Set<string>();
  const attendanceActions: Record<string, number> = { clock_in: 0, clock_out: 0 };
  for (const att of attendance) {
    if (att.staff_id) staffSet.add(att.staff_id);
    const act = att.action || "clock_in";
    attendanceActions[act] = (attendanceActions[act] || 0) + 1;
  }

  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
  const totalRoyaltyDue = Object.values(branchBreakdown).reduce((sum, b) => sum + b.royalty_due, 0);

  return {
    summary: {
      total_revenue: totalRevenue,
      total_orders: orderCount,
      avg_order_value: avgOrderValue,
      total_items_sold: ledgerEntries.reduce((s, e) => s + Number(e.quantity || 1), 0),
      total_royalty_due: totalRoyaltyDue,
      active_branches_count: Object.keys(branchBreakdown).length,
    },
    orders_by_status: statusCounts,
    orders_by_type: diningTypeCounts,
    daily_breakdown: dailyDistribution,
    branch_breakdown: branchBreakdown,
    top_selling_dishes: topSellingDishes,
    attendance_summary: {
      total_records: attendance.length,
      unique_staff_active: staffSet.size,
      clock_ins: attendanceActions.clock_in || 0,
      clock_outs: attendanceActions.clock_out || 0,
    },
    generated_at: new Date().toISOString(),
  };
}

export interface BackupExecutionOptions {
  weekString?: string;
  startDate?: string;
  endDate?: string;
  force?: boolean;
  triggeredBy?: string;
}

export interface BackupExecutionResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  week: string;
  date_range: { start: string; end: string };
  s3_bucket: string;
  s3_prefix: string;
  files: string[];
  counts: {
    orders: number;
    ledger_items: number;
    attendance_records: number;
  };
  total_revenue: number;
  timestamp: string;
  duration_ms: number;
}

/**
 * Main Backup Orchestrator:
 * Extracts DynamoDB weekly data, computes analytics, generates the 4 archive JSON files,
 * and uploads them to the designated S3 bucket with AES256 encryption.
 */
export async function executeWeeklyBackup(
  options: BackupExecutionOptions = {}
): Promise<BackupExecutionResult> {
  const startTime = Date.now();
  const bucket = BACKUP_BUCKET_NAME;

  // 1. Resolve target week and date range
  let weekString = options.weekString;
  let startDate = options.startDate;
  let endDate = options.endDate;

  if (!weekString || !startDate || !endDate) {
    const calculated = getPreviousWeekRange();
    weekString = weekString || calculated.weekString;
    startDate = startDate || calculated.startDate;
    endDate = endDate || calculated.endDate;
  }

  const s3Prefix = `${weekString}/`;

  console.log(`[Weekly Backup] Initiating archive for ${weekString} (${startDate} to ${endDate})`);
  console.log(`[Weekly Backup] Target S3 Bucket: ${bucket}, Prefix: ${s3Prefix}`);

  // 2. Idempotency Check: Avoid duplicating if already successfully backed up
  if (!options.force) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: `${s3Prefix}backup-metadata.json`,
        })
      );
      console.log(`[Weekly Backup] Backup for ${weekString} already exists. Skipping.`);
      return {
        success: true,
        skipped: true,
        reason: `Archive for ${weekString} already exists in S3. Pass force=true to overwrite.`,
        week: weekString,
        date_range: { start: startDate, end: endDate },
        s3_bucket: bucket,
        s3_prefix: s3Prefix,
        files: ["orders.json", "attendance.json", "analytics.json", "backup-metadata.json"],
        counts: { orders: 0, ledger_items: 0, attendance_records: 0 },
        total_revenue: 0,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      };
    } catch (headErr: any) {
      // 404/NotFound is expected when no backup exists yet
      if (headErr.name !== "NotFound" && headErr.$metadata?.httpStatusCode !== 404) {
        console.warn(`[Weekly Backup] HeadObject check warning:`, headErr.message);
      }
    }
  }

  // 3. Query ONLY the targeted date range from DynamoDB (No full table scan)
  console.log(`[Weekly Backup] Querying DynamoDB for date range ${startDate} to ${endDate}...`);
  const [orders, ledgerEntries, attendanceEntries, branches, dishes] = await Promise.all([
    Orders.queryOrdersByDateRange(startDate, endDate),
    Orders.queryByDateRange(startDate, endDate),
    Attendance.queryByDateRange(startDate, endDate),
    Branches.list(),
    MenuItems.listAll(),
  ]);

  console.log(
    `[Weekly Backup] Retrieved: ${orders.length} orders, ${ledgerEntries.length} ledger items, ${attendanceEntries.length} attendance records`
  );

  // 4. Attach nested ledger items to each order for complete historical fidelity
  const ledgerByOrder = new Map<string, any[]>();
  for (const entry of ledgerEntries) {
    if (entry.order_id) {
      if (!ledgerByOrder.has(entry.order_id)) {
        ledgerByOrder.set(entry.order_id, []);
      }
      ledgerByOrder.get(entry.order_id)!.push(entry);
    }
  }

  const enrichedOrders = orders.map((order) => ({
    ...order,
    items: ledgerByOrder.get(order.id) || ledgerByOrder.get(order.client_order_id) || [],
  }));

  // 5. Compute Weekly Analytics
  const analytics = computeWeeklyAnalytics(orders, ledgerEntries, attendanceEntries, branches, dishes);

  // 6. Build Metadata Record
  const nowIso = new Date().toISOString();
  const metadata = {
    backup_id: `backup-${weekString}-${Date.now()}`,
    week: weekString,
    date_range: {
      start: startDate,
      end: endDate,
    },
    timestamp: nowIso,
    triggered_by: options.triggeredBy || "scheduled_cron",
    environment: process.env.NODE_ENV || "production",
    counts: {
      orders: orders.length,
      ledger_items: ledgerEntries.length,
      attendance_records: attendanceEntries.length,
    },
    financials: {
      total_revenue: analytics.summary.total_revenue,
      avg_order_value: analytics.summary.avg_order_value,
      total_royalty_due: analytics.summary.total_royalty_due,
    },
    status: "success",
    files: ["orders.json", "attendance.json", "analytics.json", "backup-metadata.json"],
  };

  // 7. Upload to Dedicated S3 Backup Bucket with Server-Side Encryption
  const uploadFile = async (fileName: string, data: any) => {
    const key = `${s3Prefix}${fileName}`;
    const body = Buffer.from(JSON.stringify(data, null, 2), "utf-8");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        ServerSideEncryption: "AES256",
        Metadata: {
          "x-manohaa-backup-week": weekString,
          "x-manohaa-backup-timestamp": nowIso,
        },
      })
    );
    console.log(`[Weekly Backup] Uploaded s3://${bucket}/${key} (${body.length} bytes)`);
  };

  try {
    await Promise.all([
      uploadFile("orders.json", enrichedOrders),
      uploadFile("attendance.json", attendanceEntries),
      uploadFile("analytics.json", analytics),
      uploadFile("backup-metadata.json", metadata),
    ]);
  } catch (uploadError: any) {
    console.error(`[Weekly Backup] S3 Upload Failure:`, uploadError);
    // Attempt to log failure metadata to S3 if possible
    try {
      await uploadFile("backup-metadata.json", {
        ...metadata,
        status: "failed",
        error: uploadError.message,
      });
    } catch (_) {}
    throw uploadError;
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Weekly Backup] ✅ Successfully completed archive for ${weekString} in ${durationMs}ms`);

  return {
    success: true,
    week: weekString,
    date_range: { start: startDate, end: endDate },
    s3_bucket: bucket,
    s3_prefix: s3Prefix,
    files: ["orders.json", "attendance.json", "analytics.json", "backup-metadata.json"],
    counts: {
      orders: orders.length,
      ledger_items: ledgerEntries.length,
      attendance_records: attendanceEntries.length,
    },
    total_revenue: analytics.summary.total_revenue,
    timestamp: nowIso,
    duration_ms: durationMs,
  };
}

/**
 * Lists past weekly archives available in the S3 backup bucket.
 */
export async function listHistoricalBackups(): Promise<any[]> {
  const bucket = BACKUP_BUCKET_NAME;
  try {
    const res = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Delimiter: "/",
        MaxKeys: 100,
      })
    );

    const prefixes = (res.CommonPrefixes || []).map((p) => p.Prefix?.replace(/\/$/, "") || "").filter(Boolean);
    return prefixes.sort().reverse();
  } catch (e: any) {
    console.warn(`[Weekly Backup] Failed to list archives:`, e.message);
    return [];
  }
}
