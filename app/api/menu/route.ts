import { NextResponse } from "next/server";
import { MenuItems, SystemSettings } from "@/lib/aws/dynamodb";
import { getSessionUser, isSuperAdmin, ROLE_HIERARCHY } from "@/lib/aws/rbac";

// Helper: check if user can write to menu
// Super admin: always yes. Branch role: only if allow_branch_menu_management is ON.
async function canWriteMenu(role: string, isSuperAdminUser: boolean): Promise<boolean> {
  if (isSuperAdminUser) return true;
  // Branch managers and above CAN write if the setting is enabled
  if (ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] >= ROLE_HIERARCHY.manager) {
    const settings = await SystemSettings.get();
    return settings.allow_branch_menu_management;
  }
  return false;
}

// GET: Fetch menu items (Public — optionally scoped by branch_id)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const available = url.searchParams.get("available");
    const branchId = url.searchParams.get("branch_id");

    let items = available === "true"
      ? await MenuItems.listAvailable()
      : await MenuItems.listAll();

    // Apply branch-level 86'd / sold-out overrides if branch is specified
    if (branchId && branchId !== "ALL") {
      items = items.map((dish: any) => {
        const branchOverride = dish.branch_availability?.[branchId];
        return {
          ...dish,
          available: branchOverride !== undefined ? branchOverride : dish.available,
        };
      });
      if (available === "true") {
        items = items.filter((d) => d.available);
      }
    }

    return NextResponse.json(items);
  } catch (error: any) {
    console.error("Menu GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch menu items." }, { status: 500 });
  }
}

// POST: Add new dish
export async function POST(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const allowed = await canWriteMenu(user.role, isSuperAdmin(user));
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden. Menu management is restricted to super admin." }, { status: 403 });
    }

    const body = await req.json();
    const { name, desc, price, img, category_id, popular, is_veg, dietary_tags } = body;

    if (!name || !price || !category_id) {
      return NextResponse.json({ error: "Name, price, and category are required." }, { status: 400 });
    }

    const dish = await MenuItems.put({
      name, desc: desc || "", price: Number(price), img: img || "",
      category_id, popular: !!popular, is_veg: is_veg !== false,
      dietary_tags: dietary_tags || [], available: true,
    });

    return NextResponse.json(dish, { status: 201 });
  } catch (error: any) {
    console.error("Menu POST Error:", error);
    return NextResponse.json({ error: "Failed to create dish." }, { status: 500 });
  }
}

// PUT: Update dish or toggle branch-specific 86 / sold-out status
export async function PUT(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await req.json();
    const { id, branch_id, branch_available, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Dish ID is required." }, { status: 400 });

    // Branch-level 86 status toggle: Allowed for branch staff on their own branch or super admin
    if (branch_id && branch_available !== undefined) {
      const targetBranch = isSuperAdmin(user) ? branch_id : user.branch_id;
      const updated = await MenuItems.setBranchAvailability(id, targetBranch, !!branch_available);
      return NextResponse.json(updated);
    }

    // Global dish modifications: Restricted by RBAC and system settings
    const allowed = await canWriteMenu(user.role, isSuperAdmin(user));
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden. Global menu modifications are restricted." }, { status: 403 });
    }

    const updated = await MenuItems.update(id, updates);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Menu PUT Error:", error);
    return NextResponse.json({ error: "Failed to update dish." }, { status: 500 });
  }
}

// DELETE: Remove dish
export async function DELETE(req: Request) {
  try {
    const { user } = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const allowed = await canWriteMenu(user.role, isSuperAdmin(user));
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden. Menu management is restricted to super admin." }, { status: 403 });
    }

    // Support both query param (?id=xxx) and JSON body ({ id: "xxx" })
    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) return NextResponse.json({ error: "Dish ID is required." }, { status: 400 });

    await MenuItems.delete(id);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("Menu DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete dish." }, { status: 500 });
  }
}
