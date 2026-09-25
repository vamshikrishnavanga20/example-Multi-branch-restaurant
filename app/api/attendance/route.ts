import { NextResponse } from "next/server";
import { Attendance, RealtimeEvents } from "@/lib/aws/dynamodb";
import { verifySession } from "@/lib/aws/auth";

// GET: Fetch attendance logs for a given date or date range with branch isolation
export async function GET(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const startDate = url.searchParams.get("start_date") || url.searchParams.get("startDate");
    const endDate = url.searchParams.get("end_date") || url.searchParams.get("endDate");
    const staffId = url.searchParams.get("staff_id");
    
    // Branch scoping
    let branchId = url.searchParams.get("branch_id");
    const userBranchId = typeof user?.branch_id === "string" ? user.branch_id : undefined;
    if (user?.role !== "super_admin" && userBranchId && userBranchId !== "ALL") {
      branchId = userBranchId;
    }

    // 1. Staff-specific queries
    if (staffId && (!startDate || !endDate)) {
      const logs = await Attendance.listByStaff(staffId, startDate || undefined, endDate || undefined);
      return NextResponse.json(logs);
    }

    // 2. Date-to-date range query
    if (startDate && endDate) {
      const logs = await Attendance.queryByDateRange(startDate, endDate, branchId || undefined, staffId || undefined);
      return NextResponse.json(logs);
    }

    // 3. Single-day query
    const targetDate = date || new Date().toISOString().split("T")[0];
    const logs = await Attendance.listByDate(targetDate, branchId || undefined);
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("Attendance GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance." }, { status: 500 });
  }
}

// POST: Clock In or Clock Out (Terminal & Admin)
export async function POST(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { staff_id, staff_name, action, notes, branch_id, branch_name } = await req.json();

    if (!staff_id || !staff_name || !action) {
      return NextResponse.json({ error: "staff_id, staff_name, and action are required." }, { status: 400 });
    }

    if (action !== "clock_in" && action !== "clock_out") {
      return NextResponse.json({ error: "Action must be 'clock_in' or 'clock_out'." }, { status: 400 });
    }

    const targetBranchId = branch_id || (user?.branch_id !== "ALL" ? user?.branch_id : undefined);
    const targetBranchName = branch_name || user?.branch_name;

    let entry;
    if (action === "clock_in") {
      entry = await Attendance.clockIn({
        staff_id,
        staff_name,
        notes,
        branch_id: targetBranchId,
        branch_name: targetBranchName,
      });
    } else {
      entry = await Attendance.clockOut({
        staff_id,
        staff_name,
        notes,
        branch_id: targetBranchId,
        branch_name: targetBranchName,
      });
    }

    // Notify realtime listeners
    RealtimeEvents.emit({
      type: "ATTENDANCE_RECORDED",
      data: entry,
      branch_id: targetBranchId,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    console.error("Attendance POST Error:", error);
    return NextResponse.json({ error: "Failed to record attendance." }, { status: 500 });
  }
}
