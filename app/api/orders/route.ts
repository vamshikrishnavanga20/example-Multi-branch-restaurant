import { NextResponse } from "next/server";
import { Orders, MenuItems, RealtimeEvents } from "@/lib/aws/dynamodb";
import { getSessionUser, isSuperAdmin } from "@/lib/aws/rbac";
import { DEFAULT_BRANCH } from "@/lib/aws/dynamodb";

interface CartItem {
  menu_item_id: string;
  quantity: number;
  notes?: string;
  item_notes?: string;
}

interface ProcessedItem extends CartItem {
  unit_price: number;
  subtotal: number;
  notes?: string;
  item_notes?: string;
}

// GET: Kitchen view (tickets) or Operations Ledger (format=ledger)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit")) || 300;
    const format = url.searchParams.get("format");
    const requestedBranchId = url.searchParams.get("branch_id");

    // Scope by session: branch users only see their own branch
    const { user } = await getSessionUser();
    const branchId = user && !isSuperAdmin(user)
      ? user.branch_id  // enforce branch isolation
      : (requestedBranchId || undefined); // super admin can filter or see all

    const [ledgerEntries, allDishes] = await Promise.all([
      Orders.listRecentLedger(limit, branchId),
      MenuItems.listAll(),
    ]);

    const dishMap = new Map(allDishes.map((d) => [d.id, d]));

    // If caller requests raw ledger format (used by Admin Command Center, POS ledger, analytics)
    if (format === "ledger") {
      const enrichedLedger = ledgerEntries.map((entry) => ({
        ...entry,
        menu_items: dishMap.get(entry.menu_item_id) || undefined,
      }));
      return NextResponse.json(enrichedLedger);
    }

    // Default: Return grouped order tickets (used by kitchen display and mobile app)
    const ticketMap = new Map<string, any>();

    for (const entry of ledgerEntries) {
      const groupKey = entry.order_id || entry.created_at;
      const dish = dishMap.get(entry.menu_item_id);

      // Parse order-level special instruction
      let ticketNote = entry.order_notes || "";
      if (!ticketNote && entry.table_number && entry.table_number.includes("NOTE:")) {
        const parts = entry.table_number.split(" | ");
        for (const p of parts) {
          if (p.startsWith("NOTE:")) ticketNote = p.substring(5).trim();
        }
      }

      if (!ticketMap.has(groupKey)) {
        ticketMap.set(groupKey, {
          order_id: entry.order_id || groupKey,
          client_order_id: entry.order_id || groupKey,
          table_number: entry.table_number || "Walk-in",
          branch_id: entry.branch_id || "branch-hyderabad-hq",
          branch_name: entry.branch_name || "Hyderabad Highway HQ",
          status: entry.status || "pending",
          created_at: entry.created_at,
          notes: ticketNote,
          total_amount: 0,
          total_price: 0,
          quantity: 0,
          items: [],
        });
      }

      const ticket = ticketMap.get(groupKey)!;
      if (!ticket.notes && ticketNote) {
        ticket.notes = ticketNote;
      }
      const itemPrice = entry.total_price || 0;
      const itemQty = entry.quantity || 1;

      ticket.total_amount += itemPrice;
      ticket.total_price += itemPrice;
      ticket.quantity += itemQty;

      ticket.items.push({
        id: entry.id,
        menu_item_id: entry.menu_item_id,
        name: dish?.name || "Dish",
        quantity: itemQty,
        price: (itemPrice && itemQty) ? (itemPrice / itemQty) : (dish?.price || 0),
        notes: entry.item_notes || entry.notes || "",
      });

      if (entry.status === "pending" || entry.status === "in_progress") {
        ticket.status = entry.status;
      }
    }

    const tickets = Array.from(ticketMap.values());
    return NextResponse.json(tickets);
  } catch (error: any) {
    console.error("Orders GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}

// POST: Waiter submits an order
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { client_order_id, items, table_number, order_type, notes, status, branch_id, branch_name } = body as {
      client_order_id: string;
      items: CartItem[];
      table_number?: string;
      order_type?: string;
      notes?: string;
      status?: string;
      branch_id?: string;
      branch_name?: string;
    };

    if (!client_order_id || !items || items.length === 0) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    // Fetch authoritative prices from DynamoDB
    const itemIds = items.map((item) => item.menu_item_id);
    const menuItemsData = await MenuItems.getByIds(itemIds);

    if (menuItemsData.length !== itemIds.length) {
      return NextResponse.json({ error: "One or more items not found." }, { status: 400 });
    }

    // Server-Side Math
    let totalAmount = 0;
    const orderItemsData: ProcessedItem[] = items.map((item) => {
      const dbItem = menuItemsData.find((m) => m.id === item.menu_item_id);
      if (!dbItem) throw new Error(`Invalid item ID: ${item.menu_item_id}`);

      const subtotal = dbItem.price * item.quantity;
      totalAmount += subtotal;

      const itemNote = item.notes || item.item_notes || "";

      return {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: dbItem.price,
        subtotal,
        notes: itemNote,
        item_notes: itemNote,
      };
    });

    let formattedTable = table_number || "Walk-in";
    if (order_type && !formattedTable.includes(order_type)) {
      formattedTable = `${formattedTable} | ${order_type}`;
    }
    if (notes?.trim() && !formattedTable.includes(`NOTE:${notes.trim()}`)) {
      formattedTable = `${formattedTable} | NOTE:${notes.trim()}`;
    }

    const orderStatus = status || "pending";

    // Extract branch from JWT (prevents client-side branch spoofing)
    const { user } = await getSessionUser();
    const effectiveBranchId = user && !isSuperAdmin(user)
      ? user.branch_id  // lock to JWT branch
      : (branch_id || DEFAULT_BRANCH.id); // super admin: use provided or default
    const effectiveBranchName = user && !isSuperAdmin(user)
      ? (user.branch_name || DEFAULT_BRANCH.name)
      : (branch_name || DEFAULT_BRANCH.name);

    // Atomic Database Write
    const { orderId, ledgerEntries, isReplay } = await Orders.createOrder({
      client_order_id,
      items: orderItemsData,
      total_amount: totalAmount,
      table_number: formattedTable,
      notes: notes?.trim() || "",
      status: orderStatus,
      branch_id: effectiveBranchId,
      branch_name: effectiveBranchName,
    });

    const enrichedEntries = ledgerEntries.map((entry: any) => {
      const dish = menuItemsData.find((m) => m.id === entry.menu_item_id);
      return { ...entry, menu_items: dish || undefined };
    });

    // Realtime Event: Emit only if not an idempotent replay (prevents double kitchen alerts on network reconnect)
    if (!isReplay) {
      RealtimeEvents.emit({
        type: "order_created",
        branch_id: effectiveBranchId,
        data: {
          order_id: orderId,
          client_order_id,
          total_amount: totalAmount,
          items: enrichedEntries,
          table_number: formattedTable,
          notes: notes?.trim() || "",
          status: orderStatus,
          branch_id: effectiveBranchId,
          branch_name: effectiveBranchName,
        },
      });

      RealtimeEvents.emit({
        type: "order_update",
        branch_id: effectiveBranchId,
        data: {
          order_id: orderId,
          client_order_id,
          total_amount: totalAmount,
          notes: notes?.trim() || "",
          status: orderStatus,
          branch_id: effectiveBranchId,
          branch_name: effectiveBranchName,
        },
      });
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      total_amount: totalAmount,
      transactions: enrichedEntries,
      is_replay: !!isReplay,
    });
  } catch (error: any) {
    console.error("Order Transaction Error:", error);
    return NextResponse.json({ error: "Transaction failed." }, { status: 500 });
  }
}

// PUT: Update order status (e.g. pending -> in_progress -> completed -> cancelled)
export async function PUT(req: Request) {
  try {
    const { order_id, status } = await req.json();
    if (!order_id || !status) {
      return NextResponse.json({ error: "order_id and status are required." }, { status: 400 });
    }

    await (Orders as any).updateOrderStatus(order_id, status);

    RealtimeEvents.emit({
      type: "order_updated",
      data: { order_id, status },
    });

    return NextResponse.json({ success: true, order_id, status });
  } catch (error: any) {
    console.error("Orders PUT Error:", error);
    return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
  }
}
