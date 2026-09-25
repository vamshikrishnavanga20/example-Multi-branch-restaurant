import { NextResponse } from "next/server";
import { Staff, RealtimeEvents } from "@/lib/aws/dynamodb";
import { verifySession } from "@/lib/aws/auth";

// GET: List staff roster for a branch (or all branches for super admin)
export async function GET(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    let branchId = url.searchParams.get("branch_id");

    // Enforce branch isolation for non-super admins
    const userBranchId = typeof user?.branch_id === "string" ? user.branch_id : undefined;
    if (user?.role !== "super_admin" && userBranchId && userBranchId !== "ALL") {
      branchId = userBranchId;
    }

    const roster = await Staff.listByBranch(branchId || undefined);
    return NextResponse.json(roster);
  } catch (error: any) {
    console.error("Staff GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch staff roster." }, { status: 500 });
  }
}

// POST: Add new staff member to a branch
export async function POST(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { name, role, department, phone, branch_id, branch_name } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "Name and Role are required." }, { status: 400 });
    }

    let targetBranchId = branch_id;
    if (user?.role !== "super_admin" && user?.branch_id && user.branch_id !== "ALL") {
      targetBranchId = user.branch_id;
    }

    if (!targetBranchId || targetBranchId === "ALL") {
      return NextResponse.json({ error: "A valid branch must be selected for staff." }, { status: 400 });
    }

    const member = await Staff.create({
      name: name.trim(),
      role: role.trim(),
      department: department?.trim() || "Operations",
      branch_id: targetBranchId,
      branch_name: branch_name || user?.branch_name || "",
      phone: phone?.trim() || "",
      status: "active",
    });

    RealtimeEvents.emit({
      type: "STAFF_UPDATED",
      data: member,
      branch_id: targetBranchId,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    console.error("Staff POST Error:", error);
    return NextResponse.json({ error: "Failed to add staff member." }, { status: 500 });
  }
}

// PUT: Update staff member details or role
export async function PUT(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { id, branch_id, name, role, department, phone, status, branch_name } = body;

    if (!id || !branch_id) {
      return NextResponse.json({ error: "id and branch_id are required." }, { status: 400 });
    }

    if (user?.role !== "super_admin" && user?.branch_id && user.branch_id !== branch_id) {
      return NextResponse.json({ error: "Forbidden: You cannot modify staff from another branch." }, { status: 403 });
    }

    const updated = await Staff.update(id, branch_id, {
      name,
      role,
      department,
      phone,
      status,
      branch_name,
    });

    if (!updated) {
      return NextResponse.json({ error: "Staff member not found or no updates provided." }, { status: 404 });
    }

    RealtimeEvents.emit({
      type: "STAFF_UPDATED",
      data: updated,
      branch_id,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Staff PUT Error:", error);
    return NextResponse.json({ error: "Failed to update staff member." }, { status: 500 });
  }
}

// DELETE: Remove staff member from a branch
export async function DELETE(req: Request) {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const branch_id = url.searchParams.get("branch_id");

    if (!id || !branch_id) {
      return NextResponse.json({ error: "id and branch_id are required parameters." }, { status: 400 });
    }

    if (user?.role !== "super_admin" && user?.branch_id && user.branch_id !== branch_id) {
      return NextResponse.json({ error: "Forbidden: You cannot delete staff from another branch." }, { status: 403 });
    }

    await Staff.delete(id, branch_id);

    RealtimeEvents.emit({
      type: "STAFF_DELETED",
      data: { id, branch_id },
      branch_id,
    });

    return NextResponse.json({ success: true, id, branch_id });
  } catch (error: any) {
    console.error("Staff DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete staff member." }, { status: 500 });
  }
}
