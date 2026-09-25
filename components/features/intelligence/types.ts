import { ReactNode } from "react";

export interface DishItem {
  id: string;
  name: string;
  price?: number;
}

export interface LedgerEntry {
  id?: string;
  order_id?: string | null;
  transaction_id?: string;
  invoice_id?: string;
  menu_item_id: string;
  quantity?: number;
  total_price?: number;
  created_at: string;
  menu_items?: {
    name: string;
  };
}

export interface IntelligenceViewProps {
  dishes?: DishItem[];
  ledger?: LedgerEntry[];
}

export type DateFilter = "today" | "7d" | "30d" | "custom";
export type ActiveTab = "overview" | "expert" | "assistant";

export type ChatDish = {
  name: string;
  quantity: number;
  revenue: string;
  share?: number;
};

export type ChatKpi = {
  label: string;
  value: string;
  note?: string;
};

export type ChatTableColumn = {
  key: string;
  label: string;
  type?: "text" | "number" | "currency";
};

export type ChatTable = {
  title?: string;
  columns: ChatTableColumn[];
  rows: Record<string, unknown>[];
};

export type ChatData = {
  title?: string;
  subtitle?: string;
  answer?: string;
  sourceNote?: string;
  kpis?: ChatKpi[];
  topDishes?: ChatDish[];
  insights?: string[];
  recommendations?: string[];
};

export type WorkspaceMessage = {
  role: "user" | "assistant";
  content: string;
  data?: ChatData;
  responseType?: "text" | "table";
  table?: ChatTable;
  summary?: {
    totalDishes?: number;
    totalUnits?: number;
    totalRevenue?: number;
    topDish?: string | null;
  };
};

export type ExpertReport = {
  summary: string[];
  whatChanged: string[];
  attention: string[];
  recommendations: string[];
};

export type DishAggregate = {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
};

export type CoreMetrics = {
  grossRevenue: number;
  totalOrders: number;
  totalUnits: number;
  bestSeller: DishAggregate | null;
  averageOrderValue: number;
  unitsPerOrder: number;
  orderCountEstimated: boolean;
};
