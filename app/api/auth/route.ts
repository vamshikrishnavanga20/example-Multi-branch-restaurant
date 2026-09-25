import { NextResponse } from "next/server";
import { signIn, signInBranch, signInWithPasscode, signOut, verifySession } from "@/lib/aws/auth";

import { Branches } from "@/lib/aws/dynamodb";

// POST: Login — supports Super Admin (email/password) and Branch Manager (branch_id/password via AWS Cognito)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Mode 1: Branch Manager Login (branch_id or branch_code + password via AWS Cognito)
    if ((body.branch_id || body.branch_code) && body.password && !body.email) {
      const identifier = (body.branch_id || body.branch_code).trim();
      const result = await signInBranch(identifier, body.password);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Invalid branch credentials." }, { status: 401 });
      }
      return NextResponse.json({
        success: true,
        role: result.role,
        branch_id: result.branch_id,
        branch_name: result.branch_name,
      });
    }

    // Mode 2: Legacy Passcode Support (for backward compatibility)
    if (body.passcode) {
      let branchId = body.branch_id;
      if (!branchId) {
        const allBranches = await Branches.list();
        const matched = allBranches.find(b =>
          b.owner_passcode === body.passcode ||
          b.manager_passcode === body.passcode ||
          b.waiter_passcode === body.passcode ||
          b.chef_passcode === body.passcode
        );
        if (matched) {
          branchId = matched.id;
        } else {
          return NextResponse.json({ error: "Invalid passcode." }, { status: 401 });
        }
      }

      const result = await signInBranch(branchId, body.passcode);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      return NextResponse.json({
        success: true,
        role: result.role,
        branch_id: result.branch_id,
        branch_name: result.branch_name,
      });
    }

    // Mode 3: Super Admin Login (email + password)
    if (body.email && body.password) {
      const result = await signIn(body.email, body.password);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 401 });
      }
      return NextResponse.json({
        success: true,
        role: result.role,
        branch_id: result.branch_id,
        branch_name: "All Branches",
      });
    }

    return NextResponse.json(
      { error: "Provide either {email, password} for Super Admin or {branch_id, password} for Branch Manager." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Auth Login Error:", error);
    return NextResponse.json({ error: "Authentication failed." }, { status: 500 });
  }
}

// DELETE: Logout
export async function DELETE() {
  try {
    await signOut();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Auth Logout Error:", error);
    return NextResponse.json({ error: "Logout failed." }, { status: 500 });
  }
}

// GET: Check session status + return role/branch context
export async function GET() {
  try {
    const { authenticated, user } = await verifySession();
    if (!authenticated || !user) {
      return NextResponse.json({ authenticated: false, user: null });
    }
    return NextResponse.json({
      authenticated: true,
      user: {
        role: user.role || "admin",
        branch_id: user.branch_id || "ALL",
        branch_name: user.branch_name || "All Branches",
        email: user.sub,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
