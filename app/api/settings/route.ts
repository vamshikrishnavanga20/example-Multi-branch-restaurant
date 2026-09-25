import { NextResponse } from "next/server";
import { SystemSettings } from "@/lib/aws/dynamodb";
import { authGuard } from "@/lib/aws/rbac";

// GET: Read system settings (any authenticated user can read — branch admins need to know if menu is enabled)
export async function GET() {
  try {
    const settings = await SystemSettings.get();
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ allow_branch_menu_management: false });
  }
}

// PUT: Update system settings — super admin only
export async function PUT(req: Request) {
  try {
    const { user, error } = await authGuard("super_admin");
    if (error) return error;

    const body = await req.json();
    const updated = await SystemSettings.update({
      allow_branch_menu_management: !!body.allow_branch_menu_management,
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return PUT(req);
}

