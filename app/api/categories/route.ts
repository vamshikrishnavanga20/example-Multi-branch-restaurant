import { NextResponse } from "next/server";
import { Categories, SystemSettings } from "@/lib/aws/dynamodb";
import { getSessionUser, isSuperAdmin, ROLE_HIERARCHY } from "@/lib/aws/rbac";

// Helper: check if user can write to categories/structure
async function canWriteMenu(role: string, isSuperAdminUser: boolean): Promise<boolean> {
  if (isSuperAdminUser) return true;
  if (ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] >= ROLE_HIERARCHY.manager) {
    const settings = await SystemSettings.get();
    return settings.allow_branch_menu_management;
  }
  return false;
}

// GET: Fetch all categories (Public — needed for menu display and POS)
export async function GET() {
  try {
    const categories = await Categories.list();
    return NextResponse.json(categories);
  } catch (error: any) {
    console.error("Categories GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch categories." }, { status: 500 });
  }
}

// POST: Add new category (super admin, or branch manager if setting enabled)
export async function POST(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const allowed = await canWriteMenu(user.role, isSuperAdmin(user));
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden. Category management is restricted to super admin." }, { status: 403 });
    }

    const { name, parent_id, img, sort_order } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }

    const category = await Categories.put({ name: name.trim(), parent_id, img, sort_order });
    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error("Categories POST Error:", error);
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}

// PUT: Update category
export async function PUT(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const allowed = await canWriteMenu(user.role, isSuperAdmin(user));
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden. Category management is restricted to super admin." }, { status: 403 });
    }

    const { id, name, parent_id, img, sort_order } = await req.json();
    if (!id) return NextResponse.json({ error: "Category ID is required." }, { status: 400 });

    const updated = await Categories.update(id, { name, parent_id, img, sort_order });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Categories PUT Error:", error);
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

// DELETE: Remove category
export async function DELETE(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const allowed = await canWriteMenu(user.role, isSuperAdmin(user));
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden. Category management is restricted to super admin." }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Category ID is required." }, { status: 400 });

    await Categories.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Categories DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
