// =============================================================================
// AWS DynamoDB Document Client & Typed Helpers
// =============================================================================
// This replaces lib/supabase.ts as the primary data access layer.
// Uses DynamoDB single-table design for optimal cost and performance.
// 
// DynamoDB Table: "ManohaaHotel"
// Partition Key: PK (String)
// Sort Key: SK (String)
// GSI1: GSI1PK (String) / GSI1SK (String)
// =============================================================================

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { TableStatus } from "@/types";
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DYNAMODB_TABLE_NAME } from "./config";

// ---------------------------------------------------------------------------
// Client Configuration
// ---------------------------------------------------------------------------
const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE = DYNAMODB_TABLE_NAME;

// ---------------------------------------------------------------------------
// Helper: Generate UUID
// ---------------------------------------------------------------------------
function uuid(): string {
  return crypto.randomUUID();
}

function isoNow(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// BRANCHES & FRANCHISES
// PK = "BRANCH"  |  SK = "BRANCH#<id>"
// ---------------------------------------------------------------------------
export const DEFAULT_BRANCH = {
  id: "branch-hyderabad-hq",
  name: "Hyderabad Highway HQ",
  code: "HYD-01",
  city: "Hyderabad",
  address: "NH 44 Highway Express, Hyderabad",
  phone: "+91 98765 43210",
  manager_name: "Srinivas Rao",
  manager_email: "hyderabad@s4manohaa.com",
  password: process.env.HYD_BRANCH_PASSWORD || "Manohaa@Hyd2026!",
  owner_passcode: "9999",
  manager_passcode: "4040",
  waiter_passcode: "1111",
  chef_passcode: "2222",
  chef_whatsapp_number: process.env.CHEF_WHATSAPP_NUMBER || "+919876543210",
  gstin: "36AAAAA0000A1Z5",
  fssai_license: "13624014000123",
  royalty_pct: 0,
  status: "active" as const,
  created_at: "2026-01-01T00:00:00.000Z",
};

export const Branches = {
  async list(): Promise<any[]> {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": "BRANCH" },
        })
      );
      const items = (result.Items || []).map(toBranchShape);
      if (items.length === 0) {
        await this.put(DEFAULT_BRANCH);
        return [DEFAULT_BRANCH];
      }
      return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch (e) {
      console.warn("Branches list fallback to default branch:", e);
      return [DEFAULT_BRANCH];
    }
  },

  async get(id: string) {
    if (!id || id === DEFAULT_BRANCH.id) {
      const res = await docClient.send(
        new GetCommand({ TableName: TABLE, Key: { PK: "BRANCH", SK: `BRANCH#${DEFAULT_BRANCH.id}` } })
      );
      return res.Item ? toBranchShape(res.Item) : DEFAULT_BRANCH;
    }
    const result = await docClient.send(
      new GetCommand({ TableName: TABLE, Key: { PK: "BRANCH", SK: `BRANCH#${id}` } })
    );
    return result.Item ? toBranchShape(result.Item) : null;
  },

  async put(data: {
    id?: string;
    name: string;
    code?: string;
    city?: string;
    address?: string;
    phone?: string;
    manager_name?: string;
    manager_email?: string;
    password?: string;
    owner_passcode?: string;
    manager_passcode?: string;
    waiter_passcode?: string;
    chef_passcode?: string;
    chef_whatsapp_number?: string;
    gstin?: string;
    fssai_license?: string;
    royalty_pct?: number;
    status?: 'active' | 'inactive';
  }) {
    const id = data.id || `branch-${(data.name || 'franchise').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uuid().slice(0, 4)}`;
    const now = isoNow();
    const item = {
      PK: "BRANCH",
      SK: `BRANCH#${id}`,
      id,
      name: data.name,
      code: data.code || `FR-${id.slice(-4).toUpperCase()}`,
      city: data.city || "Hyderabad",
      address: data.address || "",
      phone: data.phone || "",
      manager_name: data.manager_name || "Branch Manager",
      manager_email: data.manager_email || `${id}@s4manohaa.com`,
      password: data.password || (id === DEFAULT_BRANCH.id ? (process.env.HYD_BRANCH_PASSWORD || "Manohaa@Hyd2026!") : "Manohaa@Branch2026!"),
      owner_passcode: data.owner_passcode || "9999",
      manager_passcode: data.manager_passcode || "4040",
      waiter_passcode: data.waiter_passcode || "1111",
      chef_passcode: data.chef_passcode || "2222",
      chef_whatsapp_number: data.chef_whatsapp_number || (id === DEFAULT_BRANCH.id ? (process.env.CHEF_WHATSAPP_NUMBER || "+919876543210") : ""),
      gstin: data.gstin || "36AAAAA0000A1Z5",
      fssai_license: data.fssai_license || "13624014000123",
      royalty_pct: Number(data.royalty_pct ?? 10),
      status: data.status || "active",
      created_at: now,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toBranchShape(item);
  },

  async update(id: string, data: Partial<{
    name: string;
    code: string;
    city: string;
    address: string;
    phone: string;
    manager_name: string;
    manager_email: string;
    password: string;
    owner_passcode: string;
    manager_passcode: string;
    waiter_passcode: string;
    chef_passcode: string;
    chef_whatsapp_number: string;
    gstin: string;
    fssai_license: string;
    royalty_pct: number;
    status: 'active' | 'inactive';
  }>) {
    const expressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      names[`#${key}`] = key;
      expressions.push(`#${key} = :${key}`);
      values[`:${key}`] = val;
    }

    if (expressions.length === 0) return null;

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "BRANCH", SK: `BRANCH#${id}` },
        UpdateExpression: `SET ${expressions.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes ? toBranchShape(result.Attributes) : null;
  },

  async delete(id: string) {
    await docClient.send(
      new DeleteCommand({ TableName: TABLE, Key: { PK: "BRANCH", SK: `BRANCH#${id}` } })
    );
  },
};

function toBranchShape(item: Record<string, any>) {
  const isHyd = item.id === DEFAULT_BRANCH.id || item.code === "HYD-01";
  const defaultPassword = isHyd ? (process.env.HYD_BRANCH_PASSWORD || "Manohaa@Hyd2026!") : (process.env.BDG_BRANCH_PASSWORD || "Manohaa@Bdg2026!");
  return {
    id: item.id,
    name: item.name || "Unnamed Branch",
    code: item.code || "FR-01",
    city: item.city || "",
    address: item.address || "",
    phone: item.phone || "",
    manager_name: item.manager_name || "",
    manager_email: item.manager_email || "",
    password: item.password || defaultPassword,
    owner_passcode: item.owner_passcode || "9999",
    manager_passcode: item.manager_passcode || "4040",
    waiter_passcode: item.waiter_passcode || "1111",
    chef_passcode: item.chef_passcode || "2222",
    chef_whatsapp_number: item.chef_whatsapp_number || (isHyd ? process.env.CHEF_WHATSAPP_NUMBER : ""),
    gstin: item.gstin || "36AAAAA0000A1Z5",
    fssai_license: item.fssai_license || "13624014000123",
    royalty_pct: Number(item.royalty_pct ?? (isHyd ? 0 : 10)),
    status: (item.status || "active") as "active" | "inactive",
    created_at: item.created_at || "",
  };
}

// ---------------------------------------------------------------------------
// SYSTEM SETTINGS
// PK = "SYSTEM_CONFIG"  |  SK = "SETTINGS"
// Stores global flags like allow_branch_menu_management
// ---------------------------------------------------------------------------
export interface SystemSettingsShape {
  allow_branch_menu_management: boolean;
}

export const SystemSettings = {
  async get(): Promise<SystemSettingsShape> {
    try {
      const result = await docClient.send(
        new GetCommand({ TableName: TABLE, Key: { PK: "SYSTEM_CONFIG", SK: "SETTINGS" } })
      );
      if (!result.Item) {
        return { allow_branch_menu_management: false };
      }
      return {
        allow_branch_menu_management: !!result.Item.allow_branch_menu_management,
      };
    } catch {
      return { allow_branch_menu_management: false };
    }
  },

  async update(data: Partial<SystemSettingsShape>): Promise<SystemSettingsShape> {
    const current = await this.get();
    const merged = { ...current, ...data };
    await docClient.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: "SYSTEM_CONFIG",
          SK: "SETTINGS",
          ...merged,
          updated_at: isoNow(),
        },
      })
    );
    return merged;
  },
};

// ---------------------------------------------------------------------------
// CATEGORIES
// PK = "CAT"  |  SK = "CAT#<id>"
// ---------------------------------------------------------------------------
export const Categories = {
  async list() {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "CAT" },
      })
    );
    return (result.Items || []).map(toCategoryShape).sort((a, b) => {
      const orderA = a.sort_order ?? 9999;
      const orderB = b.sort_order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  },

  async get(id: string) {
    if (!id) return null;
    const cleanId = id.startsWith("CAT#") ? id.replace("CAT#", "") : id;
    const result = await docClient.send(
      new GetCommand({ TableName: TABLE, Key: { PK: "CAT", SK: `CAT#${cleanId}` } })
    );
    return result.Item ? toCategoryShape(result.Item) : null;
  },

  async put(data: { name: string; parent_id?: string | null; img?: string | null; sort_order?: number | null }) {
    const id = uuid();
    const item = {
      PK: "CAT",
      SK: `CAT#${id}`,
      id,
      name: data.name,
      parent_id: data.parent_id || null,
      img: data.img || null,
      sort_order: data.sort_order ?? 1,
      created_at: isoNow(),
      updated_at: isoNow(),
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toCategoryShape(item);
  },

  async update(id: string, data: { name?: string; parent_id?: string | null; img?: string | null; sort_order?: number | null }) {
    const cleanId = id.startsWith("CAT#") ? id.replace("CAT#", "") : id;
    
    // Check if item exists to handle resilient upsert
    const existing = await this.get(cleanId);

    const setExpressions: string[] = ["#id = :id", "#updated_at = :updated_at"];
    const removeExpressions: string[] = [];
    const names: Record<string, string> = {
      "#id": "id",
      "#updated_at": "updated_at",
    };
    const values: Record<string, any> = {
      ":id": cleanId,
      ":updated_at": isoNow(),
    };

    if (!existing) {
      names["#created_at"] = "created_at";
      setExpressions.push("#created_at = :created_at");
      values[":created_at"] = isoNow();
    }

    if (data.name !== undefined) {
      names["#name"] = "name";
      setExpressions.push("#name = :name");
      values[":name"] = data.name;
    }

    if (data.parent_id !== undefined) {
      if (data.parent_id === null || data.parent_id === "" || data.parent_id === "null") {
        names["#parent_id"] = "parent_id";
        removeExpressions.push("#parent_id");
      } else {
        names["#parent_id"] = "parent_id";
        setExpressions.push("#parent_id = :parent_id");
        values[":parent_id"] = data.parent_id;
      }
    }

    if (data.img !== undefined) {
      if (data.img === null || data.img === "") {
        names["#img"] = "img";
        removeExpressions.push("#img");
      } else {
        names["#img"] = "img";
        setExpressions.push("#img = :img");
        values[":img"] = data.img;
      }
    }

    if (data.sort_order !== undefined) {
      if (data.sort_order === null) {
        names["#sort_order"] = "sort_order";
        removeExpressions.push("#sort_order");
      } else {
        names["#sort_order"] = "sort_order";
        setExpressions.push("#sort_order = :sort_order");
        values[":sort_order"] = Number(data.sort_order);
      }
    }

    let updateExpression = "";
    if (setExpressions.length > 0) {
      updateExpression += `SET ${setExpressions.join(", ")}`;
    }
    if (removeExpressions.length > 0) {
      if (updateExpression) updateExpression += " ";
      updateExpression += `REMOVE ${removeExpressions.join(", ")}`;
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "CAT", SK: `CAT#${cleanId}` },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes ? toCategoryShape(result.Attributes) : null;
  },

  async batchReorder(items: { id: string; sort_order: number; parent_id?: string | null }[]) {
    // Process reordering updates in parallel
    const updates = items.map((item) =>
      this.update(item.id, {
        sort_order: item.sort_order,
        ...(item.parent_id !== undefined ? { parent_id: item.parent_id } : {}),
      })
    );
    await Promise.all(updates);
    return this.list();
  },

  async delete(id: string) {
    const cleanId = id.startsWith("CAT#") ? id.replace("CAT#", "") : id;
    await docClient.send(
      new DeleteCommand({ TableName: TABLE, Key: { PK: "CAT", SK: `CAT#${cleanId}` } })
    );
  },
};

function toCategoryShape(item: Record<string, any>) {
  return {
    id: item.id || (typeof item.SK === "string" ? item.SK.replace("CAT#", "") : ""),
    name: item.name || "",
    parent_id: item.parent_id || null,
    img: item.img || null,
    sort_order: item.sort_order != null ? Number(item.sort_order) : null,
    created_at: item.created_at || "",
  };
}

// ---------------------------------------------------------------------------
// MENU ITEMS (Dishes)
// PK = "MENU"  |  SK = "DISH#<id>"
// GSI1PK = "CATMENU#<category_id>"  |  GSI1SK = "<created_at>"
// ---------------------------------------------------------------------------
export const MenuItems = {
  async listAll() {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "MENU" },
      })
    );
    return (result.Items || []).map(toDishShape).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  },

  async listAvailable() {
    const all = await this.listAll();
    return all.filter((d) => d.available);
  },

  async get(id: string) {
    const result = await docClient.send(
      new GetCommand({ TableName: TABLE, Key: { PK: "MENU", SK: `DISH#${id}` } })
    );
    return result.Item ? toDishShape(result.Item) : null;
  },

  async put(data: {
    name: string; desc: string; price: number; img: string; category_id: string;
    popular?: boolean; is_veg?: boolean; dietary_tags?: string[]; available?: boolean;
    branch_availability?: { [branchId: string]: boolean };
  }) {
    const id = uuid();
    const now = isoNow();
    const item = {
      PK: "MENU",
      SK: `DISH#${id}`,
      GSI1PK: `CATMENU#${data.category_id}`,
      GSI1SK: now,
      id,
      name: data.name,
      desc: data.desc,
      price: data.price,
      img: data.img,
      category_id: data.category_id,
      popular: data.popular ?? false,
      is_veg: data.is_veg ?? true,
      dietary_tags: data.dietary_tags || [],
      available: data.available ?? true,
      branch_availability: data.branch_availability || {},
      created_at: now,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toDishShape(item);
  },

  async update(id: string, data: Partial<{
    name: string; desc: string; price: number; img: string; category_id: string;
    popular: boolean; is_veg: boolean; dietary_tags: string[]; available: boolean;
    branch_availability: { [branchId: string]: boolean };
  }>) {
    const expressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};

    for (const [key, val] of Object.entries(data)) {
      if (val === undefined) continue;
      names[`#${key}`] = key;
      expressions.push(`#${key} = :${key}`);
      values[`:${key}`] = val;
    }
    if (data.category_id) {
      expressions.push("GSI1PK = :gsi1pk");
      values[":gsi1pk"] = `CATMENU#${data.category_id}`;
    }

    if (expressions.length === 0) return null;

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "MENU", SK: `DISH#${id}` },
        UpdateExpression: `SET ${expressions.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes ? toDishShape(result.Attributes) : null;
  },

  async setBranchAvailability(dishId: string, branchId: string, available: boolean) {
    const dish = await this.get(dishId);
    if (!dish) return null;
    const branchAvailability = { ...(dish.branch_availability || {}), [branchId]: available };
    return this.update(dishId, { branch_availability: branchAvailability } as any);
  },

  async delete(id: string) {
    const cleanId = id.startsWith("DISH#") ? id.replace("DISH#", "") : id;
    await docClient.send(
      new DeleteCommand({ TableName: TABLE, Key: { PK: "MENU", SK: `DISH#${cleanId}` } })
    );
  },

  async getByIds(ids: string[]) {
    const items = await Promise.all(
      ids.map((id) => this.get(id))
    );
    return items.filter(Boolean) as ReturnType<typeof toDishShape>[];
  },
};

function toDishShape(item: Record<string, any>) {
  return {
    id: item.id,
    name: item.name,
    desc: item.desc || "",
    price: Number(item.price) || 0,
    img: item.img || "",
    category_id: item.category_id || "",
    popular: !!item.popular,
    is_veg: item.is_veg !== false,
    dietary_tags: item.dietary_tags || [],
    available: item.available !== false,
    branch_availability: item.branch_availability || {},
    created_at: item.created_at || "",
  };
}

// ---------------------------------------------------------------------------
// ORDERS & LEDGER ENTRIES
// Orders:   PK = "ORDER"  |  SK = "ORD#<date>#<order_id>"
// Ledger:   PK = "LEDGER" |  SK = "LED#<date>#<entry_id>"
// GSI1PK = "ORDDATE#<YYYY-MM-DD>"  |  GSI1SK = "<timestamp>"
// ---------------------------------------------------------------------------
export const Orders = {
  async createOrder(data: {
    client_order_id: string;
    items: {
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      notes?: string;
      item_notes?: string;
    }[];
    total_amount: number;
    table_number?: string;
    notes?: string;
    status?: string;
    branch_id?: string;
    branch_name?: string;
  }) {
    // 0. Idempotency Check: Prevent duplicate order ingestion on network retry / offline queue replay
    if (data.client_order_id) {
      try {
        const idempResult = await docClient.send(
          new GetCommand({
            TableName: TABLE,
            Key: { PK: "IDEMPOTENCY", SK: `IDEMP#${data.client_order_id}` },
          })
        );
        if (idempResult.Item) {
          return {
            orderId: idempResult.Item.order_id,
            ledgerEntries: idempResult.Item.ledger_entries || [],
            isReplay: true,
          };
        }
      } catch (err) {
        console.warn("Idempotency lookup warning (proceeding with normal write):", err);
      }
    }

    const orderId = uuid();
    const now = isoNow();
    const dateKey = now.split("T")[0]; // YYYY-MM-DD
    const branchId = data.branch_id || DEFAULT_BRANCH.id;
    const branchName = data.branch_name || DEFAULT_BRANCH.name;

    // 1. Write Order Header
    const orderItem = {
      PK: "ORDER",
      SK: `ORD#${dateKey}#${orderId}`,
      GSI1PK: `ORDDATE#${dateKey}`,
      GSI1SK: now,
      id: orderId,
      client_order_id: data.client_order_id,
      total_amount: data.total_amount,
      table_number: data.table_number || "Walk-in | Web POS",
      notes: data.notes || "",
      status: data.status || "completed",
      branch_id: branchId,
      branch_name: branchName,
      created_at: now,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: orderItem }));

    // 2. Write Ledger Entries (one per line item)
    const ledgerEntries = data.items.map((item) => {
      const entryId = uuid();
      const itemNote = item.notes || item.item_notes || "";
      return {
        PK: "LEDGER",
        SK: `LED#${dateKey}#${entryId}`,
        GSI1PK: `LEDDATE#${dateKey}`,
        GSI1SK: now,
        id: entryId,
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        total_price: item.subtotal,
        status: data.status || "completed",
        table_number: data.table_number || "Walk-in | Web POS",
        branch_id: branchId,
        branch_name: branchName,
        notes: itemNote,
        item_notes: itemNote,
        created_at: now,
      };
    });

    // Batch write ledger entries (max 25 per batch)
    for (let i = 0; i < ledgerEntries.length; i += 25) {
      const batch = ledgerEntries.slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE]: batch.map((entry) => ({
              PutRequest: { Item: entry },
            })),
          },
        })
      );
    }

    const mappedEntries = ledgerEntries.map(toLedgerShape);

    // 3. Save Idempotency Record (TTL: 7 days)
    if (data.client_order_id) {
      try {
        await docClient.send(
          new PutCommand({
            TableName: TABLE,
            Item: {
              PK: "IDEMPOTENCY",
              SK: `IDEMP#${data.client_order_id}`,
              order_id: orderId,
              total_amount: data.total_amount,
              ledger_entries: mappedEntries,
              created_at: now,
              ttl: Math.floor(Date.now() / 1000) + 7 * 86400,
            },
          })
        );
      } catch (err) {
        console.warn("Failed to store idempotency record:", err);
      }
    }

    // 4. Auto-advance table status if table_number matches a table in this branch
    if (data.table_number) {
      try {
        const rawTable = data.table_number.split("|")[0].trim();
        const branchTables = await Tables.listByBranch(branchId);
        const matched = branchTables.find(
          (t) => t.table_number.toLowerCase() === rawTable.toLowerCase() ||
                 rawTable.toLowerCase().startsWith(t.table_number.toLowerCase())
        );
        if (matched) {
          await Tables.updateStatus(matched.id, branchId, "kot_sent", {
            active_order_id: orderId,
          });
        }
      } catch (tableErr) {
        console.warn("Table auto-status update warning:", tableErr);
      }
    }

    return { orderId, ledgerEntries: mappedEntries, isReplay: false };
  },

  async queryByDateRange(startDate: string, endDate: string) {
    // Query ledger entries within a date range
    const allEntries: any[] = [];

    // We scan LEDGER items filtering by created_at range
    let lastKey: any;
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":pk": "LEDGER",
            ":start": `LED#${startDate}`,
            ":end": `LED#${endDate}~`, // ~ is after Z in ASCII, ensures full day coverage
          },
          ExclusiveStartKey: lastKey,
        })
      );
      allEntries.push(...(result.Items || []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return allEntries.map(toLedgerShape);
  },

  async queryOrdersByDateRange(startDate: string, endDate: string) {
    const allOrders: any[] = [];
    let lastKey: any;
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":pk": "ORDER",
            ":start": `ORD#${startDate}`,
            ":end": `ORD#${endDate}~`,
          },
          ExclusiveStartKey: lastKey,
        })
      );
      allOrders.push(...(result.Items || []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return allOrders.map(toOrderShape);
  },

  async listRecentLedger(limit: number = 3000, branchId?: string) {
    // For the admin panel: get all ledger entries (most recent first)
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "LEDGER" },
        ScanIndexForward: false, // Descending (newest first due to SK containing date)
        Limit: limit,
      })
    );
    const all = (result.Items || []).map(toLedgerShape);
    if (branchId && branchId !== "ALL") {
      return all.filter((entry) => (entry.branch_id || DEFAULT_BRANCH.id) === branchId);
    }
    return all;
  },

  async updateLedgerStatus(id: string, dateKey: string, status: string) {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "LEDGER", SK: `LED#${dateKey}#${id}` },
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": status },
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes ? toLedgerShape(result.Attributes) : null;
  },

  async updateOrderStatus(orderId: string, status: string) {
    try {
      const cleanId = orderId ? orderId.replace(/^#/, '').trim() : '';
      const hashId = cleanId ? `#${cleanId}` : '';
      const candidateIds = new Set<string>([orderId, cleanId, hashId].filter(Boolean));

      // 1. Find the target order(s) by querying recent orders descending
      let matchedOrders: any[] = [];
      let orderLastKey: any;
      let orderPages = 0;
      do {
        const ordersResult = await docClient.send(
          new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: 'PK = :pk',
            ScanIndexForward: false, // Descending: newest orders first!
            ExclusiveStartKey: orderLastKey,
            Limit: 200,
          })
        );
        for (const order of (ordersResult.Items || [])) {
          const oId = order.id ? String(order.id).trim() : '';
          const oCleanId = oId.replace(/^#/, '');
          const oClient = order.client_order_id ? String(order.client_order_id).trim() : '';
          const oClientClean = oClient.replace(/^#/, '');

          if (
            candidateIds.has(oId) ||
            candidateIds.has(oCleanId) ||
            candidateIds.has(oClient) ||
            candidateIds.has(oClientClean)
          ) {
            matchedOrders.push(order);
            if (oId) candidateIds.add(oId);
            if (oCleanId) candidateIds.add(oCleanId);
            if (oClient) candidateIds.add(oClient);
            if (oClientClean) candidateIds.add(oClientClean);
          }
        }
        orderLastKey = ordersResult.LastEvaluatedKey;
        orderPages++;
      } while (orderLastKey && matchedOrders.length === 0 && orderPages < 10);

      // Update matched orders
      for (const order of matchedOrders) {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK: order.PK, SK: order.SK },
            UpdateExpression: 'SET #s = :s',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':s': status },
          })
        );

        // If cancelled, release associated table back to 'vacant'
        if (status === 'cancelled' && order.table_number) {
          try {
            const rawTable = order.table_number.split('|')[0].trim();
            const branchId = order.branch_id || DEFAULT_BRANCH.id;
            const branchTables = await Tables.listByBranch(branchId);
            const matchedTable = branchTables.find(
              (t) => t.table_number.toLowerCase() === rawTable.toLowerCase() ||
                     rawTable.toLowerCase().startsWith(t.table_number.toLowerCase())
            );
            if (matchedTable) {
              await Tables.updateStatus(matchedTable.id, branchId, 'vacant', {
                active_order_id: null,
              });
            }
          } catch (tableErr) {
            console.warn('Table auto-release on cancel warning:', tableErr);
          }
        }
      }

      // 2. Find and update all corresponding LEDGER entries (descending)
      let matchedLedgerItems: any[] = [];
      let ledgerLastKey: any;
      let ledgerPages = 0;
      do {
        const ledgerResult = await docClient.send(
          new QueryCommand({
            TableName: TABLE,
            KeyConditionExpression: 'PK = :pk',
            ScanIndexForward: false, // Descending: newest items first!
            ExclusiveStartKey: ledgerLastKey,
            Limit: 300,
          })
        );
        for (const item of (ledgerResult.Items || [])) {
          const itemOrderId = item.order_id ? String(item.order_id).trim() : '';
          const itemOrderIdClean = itemOrderId.replace(/^#/, '');
          const itemClientOrderId = item.client_order_id ? String(item.client_order_id).trim() : '';
          const itemClientClean = itemClientOrderId.replace(/^#/, '');
          const itemId = item.id ? String(item.id).trim() : '';
          const itemIdClean = itemId.replace(/^#/, '');

          if (
            candidateIds.has(itemOrderId) ||
            candidateIds.has(itemOrderIdClean) ||
            candidateIds.has(itemClientOrderId) ||
            candidateIds.has(itemClientClean) ||
            candidateIds.has(itemId) ||
            candidateIds.has(itemIdClean)
          ) {
            matchedLedgerItems.push(item);
          }
        }
        ledgerLastKey = ledgerResult.LastEvaluatedKey;
        ledgerPages++;
      } while (ledgerLastKey && matchedLedgerItems.length === 0 && ledgerPages < 10);

      // Update all matched ledger entries
      for (const item of matchedLedgerItems) {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK: item.PK, SK: item.SK },
            UpdateExpression: 'SET #s = :s',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':s': status },
          })
        );
      }

      return {
        success: true,
        order_id: orderId,
        status,
        matched_order_ids: Array.from(candidateIds),
        orders_updated: matchedOrders.length,
        ledger_entries_updated: matchedLedgerItems.length,
      };
    } catch (err) {
      console.warn('updateOrderStatus error:', err);
      return { success: false, order_id: orderId, status, error: String(err) };
    }
  },
};

function toLedgerShape(item: Record<string, any>) {
  return {
    id: item.id,
    menu_item_id: item.menu_item_id,
    quantity: Number(item.quantity) || 1,
    total_price: Number(item.total_price) || 0,
    created_at: item.created_at || "",
    order_id: item.order_id || null,
    status: item.status || null,
    table_number: item.table_number || null,
    branch_id: item.branch_id || DEFAULT_BRANCH.id,
    branch_name: item.branch_name || DEFAULT_BRANCH.name,
    notes: item.notes || item.item_notes || "",
    item_notes: item.item_notes || item.notes || "",
    order_notes: item.order_notes || "",
    menu_items: undefined as any, // Will be enriched by the API route
  };
}

function toOrderShape(item: Record<string, any>) {
  return {
    id: item.id,
    client_order_id: item.client_order_id,
    total_amount: Number(item.total_amount) || 0,
    table_number: item.table_number || "Walk-in",
    notes: item.notes || "",
    status: item.status || "completed",
    branch_id: item.branch_id || DEFAULT_BRANCH.id,
    branch_name: item.branch_name || DEFAULT_BRANCH.name,
    created_at: item.created_at || "",
  };
}

// ---------------------------------------------------------------------------
// REVIEWS
// PK = "REVIEW"  |  SK = "REV#<created_at>#<id>"
// ---------------------------------------------------------------------------
export const Reviews = {
  async listAll() {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "REVIEW" },
        ScanIndexForward: false,
      })
    );
    return (result.Items || []).map(toReviewShape);
  },

  async listPublished(limit: number = 20) {
    const all = await this.listAll();
    return all.filter((r) => r.is_published).slice(0, limit);
  },

  async put(data: { customer_name: string; rating: number; comment: string; is_published?: boolean; branch_id?: string; branch_name?: string }) {
    const id = uuid();
    const now = isoNow();
    const item = {
      PK: "REVIEW",
      SK: `REV#${now}#${id}`,
      id,
      customer_name: data.customer_name,
      rating: data.rating,
      comment: data.comment,
      is_published: data.is_published ?? false,
      branch_id: data.branch_id || DEFAULT_BRANCH.id,
      branch_name: data.branch_name || DEFAULT_BRANCH.name,
      created_at: now,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toReviewShape(item);
  },

  async updatePublished(id: string, sk: string, is_published: boolean) {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "REVIEW", SK: sk },
        UpdateExpression: "SET is_published = :p",
        ExpressionAttributeValues: { ":p": is_published },
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes ? toReviewShape(result.Attributes) : null;
  },

  async delete(sk: string) {
    await docClient.send(
      new DeleteCommand({ TableName: TABLE, Key: { PK: "REVIEW", SK: sk } })
    );
  },
};

function toReviewShape(item: Record<string, any>) {
  return {
    id: item.id,
    sk: item.SK, // Needed for update/delete operations
    customer_name: item.customer_name || "",
    rating: Number(item.rating) || 5,
    comment: item.comment || "",
    is_published: !!item.is_published,
    branch_id: item.branch_id || DEFAULT_BRANCH.id,
    branch_name: item.branch_name || DEFAULT_BRANCH.name,
    created_at: item.created_at || "",
  };
}

// ---------------------------------------------------------------------------
// STAFF ATTENDANCE
// PK = "ATTENDANCE"  |  SK = "ATT#<YYYY-MM-DD>#<timestamp>#<id>"
// GSI1PK = "STAFF#<staff_id>"  |  GSI1SK = "<timestamp>"
// ---------------------------------------------------------------------------
export const Attendance = {
  async clockIn(data: { staff_id: string; staff_name: string; notes?: string; branch_id?: string; branch_name?: string }) {
    const id = uuid();
    const now = isoNow();
    const dateKey = now.split("T")[0];
    const item = {
      PK: "ATTENDANCE",
      SK: `ATT#${dateKey}#${now}#${id}`,
      GSI1PK: `STAFF#${data.staff_id}`,
      GSI1SK: now,
      id,
      staff_id: data.staff_id,
      staff_name: data.staff_name,
      action: "clock_in",
      timestamp: now,
      notes: data.notes || "",
      branch_id: data.branch_id || DEFAULT_BRANCH.id,
      branch_name: data.branch_name || DEFAULT_BRANCH.name,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toAttendanceShape(item);
  },

  async clockOut(data: { staff_id: string; staff_name: string; notes?: string; branch_id?: string; branch_name?: string }) {
    const id = uuid();
    const now = isoNow();
    const dateKey = now.split("T")[0];
    const item = {
      PK: "ATTENDANCE",
      SK: `ATT#${dateKey}#${now}#${id}`,
      GSI1PK: `STAFF#${data.staff_id}`,
      GSI1SK: now,
      id,
      staff_id: data.staff_id,
      staff_name: data.staff_name,
      action: "clock_out",
      timestamp: now,
      notes: data.notes || "",
      branch_id: data.branch_id || DEFAULT_BRANCH.id,
      branch_name: data.branch_name || DEFAULT_BRANCH.name,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toAttendanceShape(item);
  },

  async listByDate(date: string, branchId?: string) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": "ATTENDANCE",
          ":sk": `ATT#${date}`,
        },
      })
    );
    let items = (result.Items || []).map(toAttendanceShape);
    if (branchId && branchId !== "ALL") {
      items = items.filter(i => i.branch_id === branchId);
    }
    return items;
  },

  async queryByDateRange(startDate: string, endDate: string, branchId?: string, staffId?: string) {
    const allAttendance: any[] = [];
    let lastKey: any;
    do {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":pk": "ATTENDANCE",
            ":start": `ATT#${startDate}`,
            ":end": `ATT#${endDate}~`,
          },
          ExclusiveStartKey: lastKey,
        })
      );
      allAttendance.push(...(result.Items || []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    let list = allAttendance.map(toAttendanceShape);
    if (branchId && branchId !== "ALL") {
      list = list.filter(i => i.branch_id === branchId);
    }
    if (staffId) {
      list = list.filter(i => i.staff_id === staffId);
    }
    return list;
  },

  async listByStaff(staffId: string, startDate?: string, endDate?: string) {
    const params: any = {
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `STAFF#${staffId}` },
    };

    if (startDate && endDate) {
      params.KeyConditionExpression += " AND GSI1SK BETWEEN :start AND :end";
      params.ExpressionAttributeValues[":start"] = startDate;
      params.ExpressionAttributeValues[":end"] = endDate + "~";
    }

    const result = await docClient.send(new QueryCommand(params));
    return (result.Items || []).map(toAttendanceShape);
  },
};

function toAttendanceShape(item: Record<string, any>) {
  return {
    id: item.id,
    staff_id: item.staff_id,
    staff_name: item.staff_name,
    action: item.action as "clock_in" | "clock_out",
    timestamp: item.timestamp || item.created_at || "",
    notes: item.notes || "",
    branch_id: item.branch_id || DEFAULT_BRANCH.id,
    branch_name: item.branch_name || DEFAULT_BRANCH.name,
  };
}

// ---------------------------------------------------------------------------
// STAFF ROSTER & MANAGEMENT
// PK = "STAFF"  |  SK = "STAFF#<branch_id>#<id>"
// ---------------------------------------------------------------------------
export const DEFAULT_STAFF_MEMBERS: Array<{
  id: string;
  name: string;
  role: string;
  department: string;
  branch_id: string;
  branch_name: string;
  status: "active" | "inactive";
  phone: string;
}> = [
  // Hyderabad HQ
  { id: "staff-hyd-001", name: "Chef Ramesh Kumar", role: "Head Chef", department: "Kitchen", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 11223" },
  { id: "staff-hyd-002", name: "Anand Verma", role: "Sous Chef", department: "Kitchen", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 22334" },
  { id: "staff-hyd-003", name: "Kavita Reddy", role: "Floor Manager", department: "Operations", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 33445" },
  { id: "staff-hyd-004", name: "Suresh Gowda", role: "Captain", department: "Front Office", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 44556" },
  { id: "staff-hyd-005", name: "Praveen Teja", role: "Senior Waiter", department: "Service", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 55667" },
  { id: "staff-hyd-006", name: "Mahesh Babu", role: "Waiter", department: "Service", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 66778" },
  { id: "staff-hyd-007", name: "Gopal Rao", role: "Kitchen Assistant", department: "Kitchen", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 77889" },
  { id: "staff-hyd-008", name: "Sunita Devi", role: "Steward", department: "Housekeeping", branch_id: "branch-hyderabad-hq", branch_name: "Hyderabad Highway HQ", status: "active", phone: "+91 98480 88990" },
  
  // Bodhgaya Highway Express (Supports both ID variations)
  { id: "staff-bdg-001", name: "Chef Tashi Dorjee", role: "Head Chef", department: "Kitchen", branch_id: "branch-bodhgaya-highway-express-9cba", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 12345" },
  { id: "staff-bdg-002", name: "Vikram Verma", role: "Floor Manager", department: "Operations", branch_id: "branch-bodhgaya-highway-express-9cba", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 23456" },
  { id: "staff-bdg-003", name: "Sunil Paswan", role: "Captain", department: "Service", branch_id: "branch-bodhgaya-highway-express-9cba", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 34567" },
  { id: "staff-bdg-004", name: "Amit Kumar", role: "Waiter", department: "Service", branch_id: "branch-bodhgaya-highway-express-9cba", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 45678" },
  { id: "staff-bdg-005", name: "Raju Prasad", role: "Kitchen Assistant", department: "Kitchen", branch_id: "branch-bodhgaya-highway-express-9cba", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 56789" },
  { id: "staff-bdg-006", name: "Chef Tashi Dorjee", role: "Head Chef", department: "Kitchen", branch_id: "branch-bodhgaya-02", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 12345" },
  { id: "staff-bdg-007", name: "Vikram Verma", role: "Floor Manager", department: "Operations", branch_id: "branch-bodhgaya-02", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 23456" },
  { id: "staff-bdg-008", name: "Sunil Paswan", role: "Captain", department: "Service", branch_id: "branch-bodhgaya-02", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 34567" },
  { id: "staff-bdg-009", name: "Amit Kumar", role: "Waiter", department: "Service", branch_id: "branch-bodhgaya-02", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 45678" },
  { id: "staff-bdg-010", name: "Raju Prasad", role: "Kitchen Assistant", department: "Kitchen", branch_id: "branch-bodhgaya-02", branch_name: "Bodhgaya Highway Express", status: "active", phone: "+91 94310 56789" },
];

export const Staff = {
  async listByBranch(branchId?: string) {
    try {
      let params: any = {
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "STAFF" },
      };

      if (branchId && branchId !== "ALL") {
        params.KeyConditionExpression += " AND begins_with(SK, :skPrefix)";
        params.ExpressionAttributeValues[":skPrefix"] = `STAFF#${branchId}#`;
      }

      const result = await docClient.send(new QueryCommand(params));
      const items = (result.Items || []).map(toStaffShape);

      // If empty, auto-seed defaults into DynamoDB
      if (items.length === 0) {
        let toSeed: typeof DEFAULT_STAFF_MEMBERS = [];
        if (branchId && branchId !== "ALL") {
          toSeed = DEFAULT_STAFF_MEMBERS.filter(s => 
            s.branch_id === branchId || 
            (branchId.includes("bodhgaya") && s.branch_id.includes("bodhgaya")) ||
            (branchId.includes("hyderabad") && s.branch_id.includes("hyderabad"))
          ).map(s => ({
            ...s,
            branch_id: branchId,
          }));
        } else {
          toSeed = DEFAULT_STAFF_MEMBERS;
        }

        if (toSeed.length > 0) {
          for (const s of toSeed) {
            await Staff.create(s).catch(() => {});
          }
          return toSeed.map(s => ({
            ...s,
            status: s.status as "active" | "inactive",
            created_at: isoNow(),
          }));
        }
      }

      return items;
    } catch (err) {
      console.warn("DynamoDB Staff query warning, falling back to defaults:", err);
      if (branchId && branchId !== "ALL") {
        return DEFAULT_STAFF_MEMBERS.filter(s => 
          s.branch_id === branchId || 
          (branchId.includes("bodhgaya") && s.branch_id.includes("bodhgaya")) ||
          (branchId.includes("hyderabad") && s.branch_id.includes("hyderabad"))
        ).map(s => ({ ...s, branch_id: branchId }));
      }
      return DEFAULT_STAFF_MEMBERS;
    }
  },

  async create(data: {
    name: string;
    role: string;
    department?: string;
    branch_id: string;
    branch_name?: string;
    phone?: string;
    status?: "active" | "inactive";
    id?: string;
  }) {
    const id = data.id || `staff-${uuid().slice(0, 8)}`;
    const now = isoNow();
    const item = {
      PK: "STAFF",
      SK: `STAFF#${data.branch_id}#${id}`,
      id,
      name: data.name,
      role: data.role,
      department: data.department || "Operations",
      branch_id: data.branch_id,
      branch_name: data.branch_name || (data.branch_id === "branch-bodhgaya-02" ? "Bodhgaya Highway Express" : DEFAULT_BRANCH.name),
      phone: data.phone || "",
      status: data.status || "active",
      created_at: now,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toStaffShape(item);
  },

  async update(id: string, branchId: string, updates: Partial<{
    name: string;
    role: string;
    department: string;
    phone: string;
    status: "active" | "inactive";
    branch_name: string;
  }>) {
    const expressions: string[] = [];
    const values: Record<string, any> = {};
    const names: Record<string, string> = {};

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined) continue;
      names[`#${key}`] = key;
      expressions.push(`#${key} = :${key}`);
      values[`:${key}`] = val;
    }

    if (expressions.length === 0) return null;

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "STAFF", SK: `STAFF#${branchId}#${id}` },
        UpdateExpression: `SET ${expressions.join(", ")}`,
        ExpressionAttributeValues: values,
        ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes ? toStaffShape(result.Attributes) : null;
  },

  async delete(id: string, branchId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: "STAFF", SK: `STAFF#${branchId}#${id}` },
      })
    );
    return { success: true, id, branchId };
  },
};

function toStaffShape(item: Record<string, any>) {
  return {
    id: item.id,
    name: item.name,
    role: item.role,
    department: item.department || "Operations",
    branch_id: item.branch_id,
    branch_name: item.branch_name || "",
    phone: item.phone || "",
    status: (item.status as "active" | "inactive") || "active",
    created_at: item.created_at || "",
  };
}

// ---------------------------------------------------------------------------
// WORKING DAYS & HOLIDAYS CALENDAR (Super Admin Governance)
// PK = "CALENDAR"  |  SK = "DAY#<YYYY-MM-DD>"
// ---------------------------------------------------------------------------
export const WorkingDays = {
  async list(yearMonth?: string) {
    try {
      const params: any = {
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "CALENDAR" },
      };

      if (yearMonth) {
        params.KeyConditionExpression += " AND begins_with(SK, :skPrefix)";
        params.ExpressionAttributeValues[":skPrefix"] = `DAY#${yearMonth}`;
      }

      const result = await docClient.send(new QueryCommand(params));
      return (result.Items || []).map((item) => ({
        date: item.date,
        is_working_day: item.is_working_day ?? true,
        reason: item.reason || "",
        updated_at: item.updated_at || "",
        updated_by: item.updated_by || "Super Admin",
      }));
    } catch (err) {
      console.warn("WorkingDays list error:", err);
      return [];
    }
  },

  async setDay(date: string, isWorkingDay: boolean, reason?: string, updatedBy?: string) {
    const item = {
      PK: "CALENDAR",
      SK: `DAY#${date}`,
      date,
      is_working_day: isWorkingDay,
      reason: reason || "",
      updated_at: isoNow(),
      updated_by: updatedBy || "Super Admin",
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return {
      date: item.date,
      is_working_day: item.is_working_day,
      reason: item.reason,
      updated_at: item.updated_at,
      updated_by: item.updated_by,
    };
  },

  async setDaysBatch(items: Array<{ date: string; isWorkingDay: boolean; reason?: string; updatedBy?: string }>) {
    const results = await Promise.all(
      items.map(i => WorkingDays.setDay(i.date, i.isWorkingDay, i.reason, i.updatedBy))
    );
    return results;
  },

  async removeDayOverride(date: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: "CALENDAR", SK: `DAY#${date}` },
      })
    );
    return { success: true, date };
  },
};

// ---------------------------------------------------------------------------
// RESTAURANT TABLES & FLOOR PLAN
// PK = "TABLE"  |  SK = "TBL#<branch_id>#<id>"
// ---------------------------------------------------------------------------
export const DEFAULT_TABLES = [
  { id: "tbl-ac-01", table_number: "T-01", section: "Main AC Hall", capacity: 4, status: "vacant" as const },
  { id: "tbl-ac-02", table_number: "T-02", section: "Main AC Hall", capacity: 4, status: "vacant" as const },
  { id: "tbl-ac-03", table_number: "T-03", section: "Main AC Hall", capacity: 6, status: "vacant" as const },
  { id: "tbl-ac-04", table_number: "T-04", section: "Main AC Hall", capacity: 2, status: "vacant" as const },
  { id: "tbl-ac-05", table_number: "T-05", section: "Main AC Hall", capacity: 8, status: "vacant" as const },
  { id: "tbl-deck-01", table_number: "D-01", section: "Highway Deck", capacity: 4, status: "vacant" as const },
  { id: "tbl-deck-02", table_number: "D-02", section: "Highway Deck", capacity: 4, status: "vacant" as const },
  { id: "tbl-deck-03", table_number: "D-03", section: "Highway Deck", capacity: 6, status: "vacant" as const },
  { id: "tbl-exp-01", table_number: "Counter-1", section: "Takeaway & Express", capacity: 1, status: "vacant" as const },
  { id: "tbl-exp-02", table_number: "Drive-Thru", section: "Takeaway & Express", capacity: 1, status: "vacant" as const },
];

export const Tables = {
  async listByBranch(branchId: string = DEFAULT_BRANCH.id) {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": "TABLE",
            ":skPrefix": `TBL#${branchId}#`,
          },
        })
      );
      const items = (result.Items || []).map(toTableShape);

      // Auto-seed default tables if branch has none
      if (items.length === 0) {
        const seeded = [];
        for (const t of DEFAULT_TABLES) {
          const item = await Tables.put({
            ...t,
            branch_id: branchId,
          });
          seeded.push(item);
        }
        return seeded;
      }
      return items.sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }));
    } catch (err) {
      console.warn("Tables list error:", err);
      return DEFAULT_TABLES.map(t => ({ ...t, branch_id: branchId, created_at: isoNow() }));
    }
  },

  async put(data: {
    id?: string;
    table_number: string;
    section: string;
    branch_id: string;
    branch_name?: string;
    capacity?: number;
    status?: TableStatus;
    active_order_id?: string | null;
    waiter_name?: string | null;
    seated_at?: string | null;
    covers?: number;
  }) {
    const id = data.id || `tbl-${uuid().slice(0, 8)}`;
    const now = isoNow();
    const item = {
      PK: "TABLE",
      SK: `TBL#${data.branch_id}#${id}`,
      id,
      table_number: data.table_number,
      section: data.section || "Main AC Hall",
      branch_id: data.branch_id,
      branch_name: data.branch_name || "",
      capacity: Number(data.capacity || 4),
      status: data.status || "vacant",
      active_order_id: data.active_order_id || null,
      waiter_name: data.waiter_name || null,
      seated_at: data.seated_at || null,
      covers: data.covers || null,
      created_at: now,
    };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return toTableShape(item);
  },

  async updateStatus(
    id: string,
    branchId: string,
    status: TableStatus,
    extra?: { active_order_id?: string | null; waiter_name?: string | null; covers?: number }
  ) {
    const expressions = ["#s = :s"];
    const names: Record<string, string> = { "#s": "status" };
    const values: Record<string, any> = { ":s": status };

    if (status === "vacant") {
      expressions.push("active_order_id = :nullVal", "seated_at = :nullVal", "waiter_name = :nullVal", "covers = :nullVal");
      values[":nullVal"] = null;
    } else {
      if (status === "seated") {
        expressions.push("seated_at = :now");
        values[":now"] = isoNow();
      }
      if (extra?.active_order_id !== undefined) {
        expressions.push("active_order_id = :aoid");
        values[":aoid"] = extra.active_order_id;
      }
      if (extra?.waiter_name !== undefined) {
        expressions.push("waiter_name = :wname");
        values[":wname"] = extra.waiter_name;
      }
      if (extra?.covers !== undefined) {
        expressions.push("covers = :cov");
        values[":cov"] = extra.covers;
      }
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: "TABLE", SK: `TBL#${branchId}#${id}` },
        UpdateExpression: `SET ${expressions.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes ? toTableShape(result.Attributes) : null;
  },

  async delete(id: string, branchId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: "TABLE", SK: `TBL#${branchId}#${id}` },
      })
    );
    return { success: true, id, branchId };
  },
};

function toTableShape(item: Record<string, any>) {
  return {
    id: item.id,
    table_number: item.table_number || "T-01",
    section: item.section || "Main AC Hall",
    branch_id: item.branch_id || DEFAULT_BRANCH.id,
    branch_name: item.branch_name || "",
    capacity: Number(item.capacity || 4),
    status: (item.status as TableStatus) || "vacant",
    active_order_id: item.active_order_id || null,
    waiter_name: item.waiter_name || null,
    seated_at: item.seated_at || null,
    covers: item.covers ? Number(item.covers) : undefined,
    created_at: item.created_at || "",
  };
}

// ---------------------------------------------------------------------------
// REALTIME EVENT EMITTER (In-Process for SSE, branch-aware)
// ---------------------------------------------------------------------------
type Listener = (event: any) => void;
type BranchedListener = { fn: Listener; branchId?: string };
const listeners = new Set<BranchedListener>();

export const RealtimeEvents = {
  subscribe(listener: Listener, branchId?: string) {
    const entry: BranchedListener = { fn: listener, branchId };
    listeners.add(entry);
    return () => { listeners.delete(entry); };
  },

  emit(event: { type: string; data: any; branch_id?: string }) {
    listeners.forEach(({ fn, branchId }) => {
      // If listener has no branch filter (super admin) OR branch matches → deliver
      if (!branchId || !event.branch_id || branchId === event.branch_id) {
        try { fn(event); } catch {}
      }
    });
  },
};
