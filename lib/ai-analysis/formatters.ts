import { ReportRow, TableColumn } from "./types";

const MAX_RESULT_LENGTH = 16000;

export const dishReportColumns: TableColumn[] = [
  { key: "Dish Name", label: "Dish Name", type: "text" },
  { key: "Units Sold", label: "Units Sold", type: "number" },
  { key: "Revenue", label: "Revenue", type: "currency" },
];

export function detectTableIntent(prompt: string): boolean {
  const text = prompt.toLowerCase().trim();
  const keywords = [
    "report",
    "breakdown",
    "dish performance",
    "dish report",
    "sales report",
    "sales breakdown",
    "top dishes",
    "top selling dishes",
    "best selling dishes",
    "best selling items",
    "items sold",
    "show me the dishes",
    "list the dishes",
    "all dishes",
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeReportRows(data: unknown[]): ReportRow[] {
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;

      const item = row as Record<string, unknown>;
      const dishName =
        item["Dish Name"] ??
        item["dish_name"] ??
        item["name"] ??
        item["dish"] ??
        "Unknown Item";

      const rawUnits =
        item["Units Sold"] ??
        item["units_sold"] ??
        item["quantity"] ??
        item["units"] ??
        0;

      const rawRevenue =
        item["Revenue"] ??
        item["revenue"] ??
        item["total_price"] ??
        item["sales"] ??
        0;

      return {
        "Dish Name": String(dishName),
        "Units Sold": toNumber(rawUnits),
        Revenue: toNumber(rawRevenue),
      };
    })
    .filter((row): row is ReportRow => row !== null);
}

export function safeStringify(value: unknown): string {
  let result: string;
  try {
    result = JSON.stringify(value) ?? "[]";
  } catch {
    result = "[]";
  }

  if (result.length > MAX_RESULT_LENGTH) {
    return result.slice(0, MAX_RESULT_LENGTH) + "...[TRUNCATED]";
  }
  return result;
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
