// =============================================================================
// RBAC — Role-Based Access Control Helpers
// =============================================================================
// Role hierarchy:
//   super_admin (5) → full cross-branch access
//   owner        (4) → full access within their branch
//   manager      (3) → operational access within branch (no branch settings)
//   waiter       (2) → POS/order-only within branch
//   chef         (1) → kitchen display read-only within branch
// =============================================================================

import { JWTPayload } from "jose";
import { verifySession } from "@/lib/aws/auth";
import { NextResponse } from "next/server";

export type UserRole = "super_admin" | "owner" | "manager" | "waiter" | "chef";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 5,
  owner: 4,
  manager: 3,
  waiter: 2,
  chef: 1,
};

export interface SessionUser {
  role: UserRole;
  branch_id: string; // "ALL" for super_admin
  branch_name?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Extract session user from the request JWT
// ---------------------------------------------------------------------------
export async function getSessionUser(): Promise<{ user: SessionUser | null; authenticated: boolean }> {
  const { authenticated, user } = await verifySession();
  if (!authenticated || !user) return { user: null, authenticated: false };

  const role = (user.role as UserRole) || "manager";
  const branch_id = (user.branch_id as string) || (role === "super_admin" ? "ALL" : "unknown");

  return {
    authenticated: true,
    user: {
      role,
      branch_id,
      branch_name: user.branch_name as string | undefined,
      email: user.sub as string | undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Role check — returns error response if insufficient
// ---------------------------------------------------------------------------
export function requireRole(user: SessionUser | null, minRole: UserRole): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
  }
  if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minRole]) {
    return NextResponse.json(
      { error: `Forbidden. Requires at least '${minRole}' role. Your role: '${user.role}'.` },
      { status: 403 }
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Branch check — ensures the user can only access their own branch
// (super_admin bypasses this check)
// ---------------------------------------------------------------------------
export function requireBranch(user: SessionUser | null, requestedBranchId?: string): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  // Super admin can access any branch
  if (user.role === "super_admin") return null;
  // If a specific branch is requested, ensure it matches the user's branch
  if (requestedBranchId && requestedBranchId !== user.branch_id) {
    return NextResponse.json(
      { error: `Forbidden. You can only access branch '${user.branch_id}'.` },
      { status: 403 }
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Combined auth + role guard — returns user or sends error response
// ---------------------------------------------------------------------------
export async function authGuard(
  minRole: UserRole
): Promise<{ user: SessionUser; error: null } | { user: null; error: NextResponse }> {
  const { user, authenticated } = await getSessionUser();
  if (!authenticated || !user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  const roleError = requireRole(user, minRole);
  if (roleError) return { user: null, error: roleError };
  return { user, error: null };
}

// ---------------------------------------------------------------------------
// Helper: is super admin?
// ---------------------------------------------------------------------------
export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.role === "super_admin";
}

// ---------------------------------------------------------------------------
// Helper: get effective branch ID for a user
// Super admin gets "ALL", branch users get their own branch
// ---------------------------------------------------------------------------
export function getEffectiveBranchId(user: SessionUser | null, overrideBranchId?: string): string {
  if (!user) return "ALL";
  if (user.role === "super_admin") return overrideBranchId || "ALL";
  return user.branch_id;
}
