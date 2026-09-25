import {
  LayoutDashboard,
  FolderTree,
  UtensilsCrossed,
  NotebookPen,
  MessageSquareQuote,
  Sparkles,
  LineChart,
  History,
  UserCheck,
} from "lucide-react";

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  manager_name: string;
  manager_email: string;
  password?: string; // Branch manager password (used for Cognito / DynamoDB)
  owner_passcode?: string;
  manager_passcode?: string;
  waiter_passcode?: string;
  chef_passcode?: string;
  chef_whatsapp_number?: string;
  gstin?: string;
  fssai_license?: string;
  royalty_pct?: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export type Category = { id: string; name: string; img?: string | null; parent_id?: string | null; sort_order?: number | null; };
export type Dish = { 
  id: string; 
  name: string; 
  desc: string; 
  price: number; 
  img: string; 
  available: boolean; 
  category_id: string; 
  popular: boolean; 
  is_veg: boolean; 
  dietary_tags: string[]; 
  branch_id?: string;
  branch_availability?: { [branchId: string]: boolean };
};
export type LedgerEntry = { 
  id: string; 
  menu_item_id: string; 
  quantity: number; 
  total_price: number; 
  created_at: string; 
  menu_items?: Dish;
  order_id?: string | null;
  status?: string | null;
  table_number?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
};
export type Review = { id: string; customer_name: string; rating: number; comment: string; is_published: boolean; created_at: string; branch_id?: string | null; };

export interface OrderItemDetail {
  ledger_id: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  total_price: number;
  is_veg?: boolean;
  img?: string;
  dietary_tags?: string[];
  category_id?: string;
  notes?: string;
  round_number?: number;
  status?: 'ordered' | 'kot_sent' | 'served' | 'cancelled' | string;
}

export interface OrderGroup {
  order_id: string;
  is_legacy?: boolean;
  created_at: string;
  raw_table_string?: string;
  table_number?: string;
  order_type: 'dine-in' | 'takeaway' | 'delivery' | 'walk-in' | string;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | string;
  items: OrderItemDetail[];
  total_amount: number;
  total_quantity: number;
  branch_id?: string | null;
  branch_name?: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  branch_id: string;
  branch_name: string;
  phone?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface CalendarDayConfig {
  date: string; // YYYY-MM-DD
  is_working_day: boolean;
  reason?: string;
  updated_at: string;
  updated_by?: string;
}

export interface StaffAttendanceEntry {
  id: string;
  staff_id: string;
  staff_name: string;
  action: 'clock_in' | 'clock_out';
  timestamp: string;
  notes?: string;
  branch_id?: string | null;
  branch_name?: string | null;
}

export const NAV = [
  { id: "overview", label: "Live Overview", icon: LayoutDashboard },
  { id: "orders", label: "Order History", icon: History },
  { id: "analytics", label: "Stats Engine", icon: LineChart },
  { id: "structure", label: "Menu Structure", icon: FolderTree },
  { id: "menu", label: "Menu Management", icon: UtensilsCrossed },
  { id: "ledger", label: "Point of Sale", icon: NotebookPen },
  { id: "reviews", label: "Customer Reviews", icon: MessageSquareQuote },
  { id: "ai", label: "AI Analytics", icon: Sparkles },
  { id: "attendance", label: "Staff Attendance", icon: UserCheck },
] as const;

export type ViewId = (typeof NAV)[number]["id"];

export type TableStatus = 'vacant' | 'seated' | 'kot_sent' | 'billed' | 'dirty';

export interface RestaurantTable {
  id: string;
  table_number: string;
  section: string;
  branch_id: string;
  branch_name?: string;
  capacity: number;
  status: TableStatus;
  active_order_id?: string | null;
  waiter_name?: string | null;
  seated_at?: string | null;
  covers?: number;
  created_at: string;
}

export interface GSTInvoiceBreakdown {
  invoice_number: string;
  order_id: string;
  date: string;
  time: string;
  table_number: string;
  order_type: string;
  subtotal: number;
  cgst_pct: number;
  cgst_amount: number;
  sgst_pct: number;
  sgst_amount: number;
  packaging_charge?: number;
  round_off: number;
  grand_total: number;
  gstin: string;
  fssai: string;
  sac_code: string;
}

export interface KOTPrintTicket {
  kot_number: string;
  order_id: string;
  round_number: number;
  table_number: string;
  section?: string;
  order_type: string;
  branch_name: string;
  timestamp: string;
  server_name?: string;
  items: {
    name: string;
    quantity: number;
    notes?: string;
    category?: string;
  }[];
  order_notes?: string;
}