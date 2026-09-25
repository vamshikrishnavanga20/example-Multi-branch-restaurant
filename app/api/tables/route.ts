import { NextResponse } from "next/server";
import { Tables, RealtimeEvents, DEFAULT_BRANCH } from "@/lib/aws/dynamodb";
import { getSessionUser, isSuperAdmin } from "@/lib/aws/rbac";

// GET: Fetch tables for a given branch
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestedBranch = url.searchParams.get("branch_id");

    const { user } = await getSessionUser();
    // Scope branch for non-super admins
    const branchId = user && !isSuperAdmin(user)
      ? user.branch_id
      : (requestedBranch || DEFAULT_BRANCH.id);

    const tables = await Tables.listByBranch(branchId);
    return NextResponse.json(tables);
  } catch (error: any) {
    console.error("Tables GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch tables." }, { status: 500 });
  }
}

// POST: Add new table to branch layout
export async function POST(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { table_number, section, capacity, branch_id, branch_name } = body;

    if (!table_number) {
      return NextResponse.json({ error: "Table number is required." }, { status: 400 });
    }

    const targetBranch = user && !isSuperAdmin(user) ? user.branch_id : (branch_id || DEFAULT_BRANCH.id);

    const newTable = await Tables.put({
      table_number: table_number.trim(),
      section: section?.trim() || "Main AC Hall",
      branch_id: targetBranch,
      branch_name: branch_name || user?.branch_name,
      capacity: Number(capacity || 4),
      status: "vacant",
    });

    RealtimeEvents.emit({
      type: "table_update",
      branch_id: targetBranch,
      data: newTable,
    });

    return NextResponse.json(newTable, { status: 201 });
  } catch (error: any) {
    console.error("Tables POST Error:", error);
    return NextResponse.json({ error: "Failed to create table." }, { status: 500 });
  }
}

// PUT: Update table status or seated state
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, branch_id, status, active_order_id, waiter_name, covers } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }

    const { user } = await getSessionUser();
    const targetBranch = user && !isSuperAdmin(user) ? user.branch_id : (branch_id || DEFAULT_BRANCH.id);

    const updated = await Tables.updateStatus(id, targetBranch, status, {
      active_order_id,
      waiter_name,
      covers,
    });

    if (!updated) {
      return NextResponse.json({ error: "Table not found." }, { status: 404 });
    }

    RealtimeEvents.emit({
      type: "table_update",
      branch_id: targetBranch,
      data: updated,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Tables PUT Error:", error);
    return NextResponse.json({ error: "Failed to update table status." }, { status: 500 });
  }
}

// DELETE: Remove table from layout
export async function DELETE(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id, branch_id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const targetBranch = user && !isSuperAdmin(user) ? user.branch_id : (branch_id || DEFAULT_BRANCH.id);

    await Tables.delete(id, targetBranch);

    RealtimeEvents.emit({
      type: "table_update",
      branch_id: targetBranch,
      data: { id, deleted: true },
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("Tables DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete table." }, { status: 500 });
  }
}
