import { NextResponse } from "next/server";
import { Branches, RealtimeEvents } from "@/lib/aws/dynamodb";
import { getSessionUser, isSuperAdmin } from "@/lib/aws/rbac";
import { createOrUpdateBranchCognitoUser } from "@/lib/aws/cognito";

// GET: List branches
// - Super admin → all branches
// - Branch role → only their own branch
// - Unauthenticated → all branches (needed for login page branch selector)
export async function GET(req: Request) {
  try {
    const branches = await Branches.list();
    const { user } = await getSessionUser();
    const isAdmin = isSuperAdmin(user);

    // 1. Super Admin: full visibility with password masked for security
    if (isAdmin) {
      const sanitized = branches.map((b) => {
        const { password, ...rest } = b;
        return {
          ...rest,
          has_password: Boolean(password),
        };
      });
      return NextResponse.json(sanitized);
    }

    // 2. Branch manager / staff session: scoped to user's assigned branch only
    if (user && !isAdmin) {
      const myBranch = branches.find(b => b.id === user.branch_id);
      if (!myBranch) return NextResponse.json([]);
      const { password, owner_passcode, ...rest } = myBranch;
      return NextResponse.json([rest]);
    }

    // 3. Unauthenticated (Mobile app login / public directory):
    // NEVER expose root passwords or master owner passcodes!
    const publicDirectory = branches.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      city: b.city,
      address: b.address,
      phone: b.phone,
      manager_name: b.manager_name,
      status: b.status,
      created_at: b.created_at,
      waiter_passcode: b.waiter_passcode,
      chef_passcode: b.chef_passcode,
      manager_passcode: b.manager_passcode,
    }));

    return NextResponse.json(publicDirectory);
  } catch (error: any) {
    console.error("Branches GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch branches." }, { status: 500 });
  }
}

// POST: Create a new franchise / branch — super admin only
export async function POST(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user || !isSuperAdmin(user)) {
      return NextResponse.json({ error: "Forbidden. Super admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const {
      name, code, city, address, phone,
      manager_name, manager_email, password,
      owner_passcode, manager_passcode, waiter_passcode, chef_passcode,
      royalty_pct, status,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Branch name is required." }, { status: 400 });
    }

    const branchPassword = password?.trim() || `Manohaa@${(code || 'Branch').replace(/[^a-zA-Z0-9]/g, '')}2026!`;

    const newBranch = await Branches.put({
      name: name.trim(),
      code: code?.trim(),
      city: city?.trim() || "Hyderabad",
      address: address?.trim() || "",
      phone: phone?.trim() || "",
      manager_name: manager_name?.trim() || "Branch Manager",
      manager_email: manager_email?.trim() || "",
      password: branchPassword,
      owner_passcode: owner_passcode?.trim() || "9999",
      manager_passcode: manager_passcode?.trim() || "4040",
      waiter_passcode: waiter_passcode?.trim() || "1111",
      chef_passcode: chef_passcode?.trim() || "2222",
      royalty_pct: Number(royalty_pct ?? 10),
      status: status || "active",
    });

    // Sync to AWS Cognito if configured
    createOrUpdateBranchCognitoUser({
      branchId: newBranch.id,
      branchCode: newBranch.code,
      managerEmail: newBranch.manager_email,
      password: branchPassword,
    }).catch(err => console.warn("Cognito branch sync notice:", err));

    RealtimeEvents.emit({ type: "branch_update", data: newBranch });
    return NextResponse.json({ success: true, branch: newBranch }, { status: 201 });
  } catch (error: any) {
    console.error("Branches POST Error:", error);
    return NextResponse.json({ error: "Failed to create branch." }, { status: 500 });
  }
}

// PUT: Update an existing branch — super admin or branch manager
export async function PUT(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Branch ID is required." }, { status: 400 });
    }

    // Branch manager can only update their own branch
    if (!isSuperAdmin(user) && user.branch_id !== id) {
      return NextResponse.json({ error: "Forbidden. You can only update your own branch." }, { status: 403 });
    }
    // Non-super admins cannot change financial settings
    if (!isSuperAdmin(user)) {
      delete updates.owner_passcode;
      delete updates.manager_passcode;
      delete updates.waiter_passcode;
      delete updates.chef_passcode;
      delete updates.royalty_pct;
      delete updates.status;
    }

    const updated = await Branches.update(id, updates);
    if (!updated) {
      return NextResponse.json({ error: "Branch not found or update failed." }, { status: 404 });
    }

    // If password was updated, sync to AWS Cognito
    if (updates.password) {
      createOrUpdateBranchCognitoUser({
        branchId: updated.id,
        branchCode: updated.code,
        managerEmail: updated.manager_email,
        password: updates.password,
      }).catch(err => console.warn("Cognito branch update notice:", err));
    }

    RealtimeEvents.emit({ type: "branch_update", data: updated });
    return NextResponse.json({ success: true, branch: updated });
  } catch (error: any) {
    console.error("Branches PUT Error:", error);
    return NextResponse.json({ error: "Failed to update branch." }, { status: 500 });
  }
}

// DELETE: Delete a branch — super admin only
export async function DELETE(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user || !isSuperAdmin(user)) {
      return NextResponse.json({ error: "Forbidden. Super admin access required." }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Branch ID required." }, { status: 400 });

    await Branches.delete(id);
    RealtimeEvents.emit({ type: "branch_update", data: { deleted: true, id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Branches DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete branch." }, { status: 500 });
  }
}
