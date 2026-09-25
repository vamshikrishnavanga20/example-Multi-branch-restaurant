'use client';

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Calendar, Clock, ReceiptText, Filter, CheckCircle2, 
  AlertCircle, XCircle, ChefHat, Sliders, Download, RefreshCw, 
  Copy, Check, Printer, ChevronRight, ShoppingBag, Utensils, 
  Layers, Tag, Info, Eye, X, ArrowUpRight, ArrowDownRight,
  TrendingUp, IndianRupee, Store, ListFilter
} from "lucide-react";
import { Dish, Category, LedgerEntry, OrderGroup, OrderItemDetail, Branch } from "@/types";
import { inr } from "@/lib/utils";
import { PageHead, Glass, StatCard } from "@/components/ui/Primitives";
import { useToast, useConfirm } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";

type TimePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';
type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
type ViewMode = 'timeline' | 'cards' | 'table';

interface OrdersHistoryViewProps {
  dishes?: Dish[];
  categories?: Category[];
  ledger?: LedgerEntry[];
  setLedger?: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  branches?: Branch[];
  selectedBranch?: string;
  onSelectBranch?: (branchId: string) => void;
  isSuperAdmin?: boolean;
}

// Parse raw table_number string e.g. "Walk-in | dine-in | 1 | NOTE:Make it spicy"
function parseTableString(raw?: string | null) {
  if (!raw) return { type: 'Dine-In', table: 'Walk-In', notes: '' };
  
  const parts = raw.split('|').map(p => p.trim());
  let type = 'Dine-In';
  let table = 'Walk-In';
  let notes = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('note:')) {
      notes = part.replace(/^note:\s*/i, '').trim();
    } else if (lower.includes('dine-in') || lower === 'dinein') {
      type = 'Dine-In';
    } else if (lower.includes('takeaway') || lower.includes('take-out') || lower === 'parcel') {
      type = 'Takeaway';
    } else if (lower.includes('delivery')) {
      type = 'Delivery';
    } else if (/^\d+$/.test(part)) {
      table = `Table ${part}`;
    } else if (lower.startsWith('table')) {
      table = part;
    } else if (lower !== 'walk-in' && !notes) {
      table = part;
    }
  }

  return { type, table, notes };
}

// Format readable relative time (e.g. "12m ago", "Today at 2:30 PM")
function formatOrderTime(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

  let relative = '';
  if (diffMinutes < 1) relative = 'Just now';
  else if (diffMinutes < 60) relative = `${diffMinutes}m ago`;
  else if (diffHours < 24 && date.getDate() === now.getDate()) relative = `Today at ${timeStr}`;
  else if (diffDays === 1) relative = `Yesterday at ${timeStr}`;
  else relative = `${dateStr}, ${timeStr}`;

  return { timeStr, dateStr, relative, full: `${dateStr} • ${timeStr}` };
}

// Slider tick horizons
const SLIDER_STEPS = [
  { days: 0, label: 'Today' },
  { days: 1, label: 'Yesterday' },
  { days: 3, label: '3 Days' },
  { days: 7, label: '7 Days' },
  { days: 14, label: '14 Days' },
  { days: 30, label: '30 Days' },
  { days: 90, label: '90 Days' },
  { days: 999, label: 'All' },
];

export default function OrdersHistoryView({
  dishes = [],
  categories = [],
  ledger = [],
  setLedger,
  branches = [],
  selectedBranch = "ALL",
  onSelectBranch,
  isSuperAdmin = true,
}: OrdersHistoryViewProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === 'light';
  const toast = useToast();
  const confirm = useConfirm();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [timePreset, setTimePreset] = useState<TimePreset>('all');
  const [sliderIndex, setSliderIndex] = useState<number>(7); // Default to 'All'
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  // Selected Order Drawer / Modal State
  const [selectedOrder, setSelectedOrder] = useState<OrderGroup | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Group raw ledger entries into unified Orders
  const groupedOrders: OrderGroup[] = useMemo(() => {
    if (!ledger || ledger.length === 0) return [];

    const orderMap = new Map<string, {
      order_id: string;
      is_legacy: boolean;
      created_at: string;
      raw_table_string?: string;
      status: string;
      items: OrderItemDetail[];
      total_amount: number;
      total_quantity: number;
      branch_id?: string | null;
      branch_name?: string | null;
    }>();

    // Secondary bucket for legacy entries without order_id (clustered by ~5s timestamp + table_number)
    const legacyClusters: {
      clusterKey: string;
      created_at: string;
      table_number?: string;
      order_id: string;
      branch_id?: string | null;
      branch_name?: string | null;
      entries: LedgerEntry[];
    }[] = [];

    // Sort entries newest first
    const sorted = [...ledger].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const entry of sorted) {
      if (entry.order_id && entry.order_id.trim() !== '') {
        const orderId = entry.order_id.trim();
        const dishInfo = entry.menu_items || dishes.find(d => d.id === entry.menu_item_id);
        const itemDetail: OrderItemDetail = {
          ledger_id: entry.id,
          menu_item_id: entry.menu_item_id,
          name: dishInfo?.name || 'Special Item',
          price: entry.total_price / (entry.quantity || 1),
          quantity: entry.quantity || 1,
          total_price: entry.total_price || 0,
          is_veg: dishInfo?.is_veg,
          img: dishInfo?.img,
          dietary_tags: dishInfo?.dietary_tags,
          category_id: dishInfo?.category_id,
        };

        if (orderMap.has(orderId)) {
          const group = orderMap.get(orderId)!;
          group.items.push(itemDetail);
          group.total_amount += itemDetail.total_price;
          group.total_quantity += itemDetail.quantity;
          // Upgrade status if pending is present
          if (entry.status && entry.status === 'pending') group.status = 'pending';
          if (!group.raw_table_string && entry.table_number) group.raw_table_string = entry.table_number;
          if (!group.branch_id && entry.branch_id) group.branch_id = entry.branch_id;
          if (!group.branch_name && entry.branch_name) group.branch_name = entry.branch_name;
        } else {
          orderMap.set(orderId, {
            order_id: orderId,
            is_legacy: false,
            created_at: entry.created_at,
            raw_table_string: entry.table_number || undefined,
            status: entry.status || 'completed',
            items: [itemDetail],
            total_amount: itemDetail.total_price,
            total_quantity: itemDetail.quantity,
            branch_id: entry.branch_id || null,
            branch_name: entry.branch_name || null,
          });
        }
      } else {
        // Legacy entry without order_id: cluster by timestamp (within 5 seconds) and table_number
        const entryTime = new Date(entry.created_at).getTime();
        const entryTable = entry.table_number || '';
        
        let matchedCluster = legacyClusters.find(c => {
          const clusterTime = new Date(c.created_at).getTime();
          const timeDiff = Math.abs(entryTime - clusterTime);
          return timeDiff <= 5000 && (c.table_number || '') === entryTable;
        });

        if (matchedCluster) {
          matchedCluster.entries.push(entry);
          if (!matchedCluster.branch_id && entry.branch_id) matchedCluster.branch_id = entry.branch_id;
          if (!matchedCluster.branch_name && entry.branch_name) matchedCluster.branch_name = entry.branch_name;
        } else {
          const pseudoId = `LEGACY-${entry.id.substring(0, 8).toUpperCase()}`;
          legacyClusters.push({
            clusterKey: `${entry.created_at}_${entryTable}`,
            created_at: entry.created_at,
            table_number: entry.table_number || undefined,
            order_id: pseudoId,
            branch_id: entry.branch_id || null,
            branch_name: entry.branch_name || null,
            entries: [entry]
          });
        }
      }
    }

    // Convert legacy clusters into OrderGroups
    for (const cluster of legacyClusters) {
      let totalAmount = 0;
      let totalQty = 0;
      let worstStatus = 'completed';

      const items: OrderItemDetail[] = cluster.entries.map(e => {
        const dishInfo = e.menu_items || dishes.find(d => d.id === e.menu_item_id);
        const qty = e.quantity || 1;
        const total = e.total_price || 0;
        totalAmount += total;
        totalQty += qty;
        if (e.status === 'pending') worstStatus = 'pending';
        else if (e.status === 'in_progress' && worstStatus !== 'pending') worstStatus = 'in_progress';

        return {
          ledger_id: e.id,
          menu_item_id: e.menu_item_id,
          name: dishInfo?.name || 'Chef Selection',
          price: total / qty,
          quantity: qty,
          total_price: total,
          is_veg: dishInfo?.is_veg,
          img: dishInfo?.img,
          dietary_tags: dishInfo?.dietary_tags,
          category_id: dishInfo?.category_id,
        };
      });

      orderMap.set(cluster.order_id, {
        order_id: cluster.order_id,
        is_legacy: true,
        created_at: cluster.created_at,
        raw_table_string: cluster.table_number,
        status: worstStatus,
        items,
        total_amount: totalAmount,
        total_quantity: totalQty,
        branch_id: cluster.branch_id || null,
        branch_name: cluster.branch_name || null,
      });
    }

    // Convert map to array and parse table strings
    const ordersArray: OrderGroup[] = Array.from(orderMap.values()).map(o => {
      const parsed = parseTableString(o.raw_table_string);
      const bId = o.branch_id || "branch-hyderabad-hq";
      const matchedBranch = branches.find(b => b.id === bId);
      const bName = o.branch_name || matchedBranch?.name || "Hyderabad Highway HQ";

      return {
        order_id: o.order_id,
        is_legacy: o.is_legacy,
        created_at: o.created_at,
        raw_table_string: o.raw_table_string,
        table_number: parsed.table,
        order_type: parsed.type,
        notes: parsed.notes,
        status: o.status,
        items: o.items,
        total_amount: o.total_amount,
        total_quantity: o.total_quantity,
        branch_id: bId,
        branch_name: bName,
      };
    });

    return ordersArray.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [ledger, dishes, branches]);

  // 2. Branch Scoped Orders (if selectedBranch is set and not 'ALL')
  const branchScopedOrders = useMemo(() => {
    if (!selectedBranch || selectedBranch === "ALL") return groupedOrders;
    return groupedOrders.filter(order => {
      const bId = order.branch_id || "branch-hyderabad-hq";
      return bId === selectedBranch;
    });
  }, [groupedOrders, selectedBranch]);

  // 3. Filter Orders based on Time Horizon, Search Query, and Status Filter
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const endOfYesterday = startOfToday - 1;

    return branchScopedOrders.filter(order => {
      const orderTime = new Date(order.created_at).getTime();

      // Temporal Horizon Check
      if (timePreset === 'today') {
        if (orderTime < startOfToday) return false;
      } else if (timePreset === 'yesterday') {
        if (orderTime < startOfYesterday || orderTime > endOfYesterday) return false;
      } else if (timePreset === '7d') {
        if (orderTime < now.getTime() - (7 * 86400000)) return false;
      } else if (timePreset === '30d') {
        if (orderTime < now.getTime() - (30 * 86400000)) return false;
      } else if (timePreset === 'custom') {
        if (customFrom) {
          const fromTime = new Date(customFrom).setHours(0, 0, 0, 0);
          if (orderTime < fromTime) return false;
        }
        if (customTo) {
          const toTime = new Date(customTo).setHours(23, 59, 59, 999);
          if (orderTime > toTime) return false;
        }
      }

      // Status Check
      if (statusFilter !== 'all') {
        if (order.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      // Universal Search Check (Order ID, Item Name, Table, Notes, Branch Name)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.order_id.toLowerCase().includes(q);
        const matchesTable = (order.table_number || '').toLowerCase().includes(q);
        const matchesNotes = (order.notes || '').toLowerCase().includes(q);
        const matchesType = (order.order_type || '').toLowerCase().includes(q);
        const matchesBranch = (order.branch_name || '').toLowerCase().includes(q);
        const matchesItems = order.items.some(item => item.name.toLowerCase().includes(q));

        if (!matchesId && !matchesTable && !matchesNotes && !matchesType && !matchesItems && !matchesBranch) {
          return false;
        }
      }

      return true;
    });
  }, [branchScopedOrders, timePreset, customFrom, customTo, statusFilter, searchQuery]);

  // Performance Optimization: Client-side list pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Auto-reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, timePreset, customFrom, customTo, statusFilter, sliderIndex, selectedBranch]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Aggregate Metrics for currently filtered orders
  const metrics = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalItems = filteredOrders.reduce((sum, o) => sum + o.total_quantity, 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const pendingOrders = filteredOrders.filter(o => o.status === 'pending').length;
    const inProgressOrders = filteredOrders.filter(o => o.status === 'in_progress').length;

    return { totalOrders, totalRevenue, totalItems, avgOrderValue, pendingOrders, inProgressOrders };
  }, [filteredOrders]);

  // Status pill counts (reflecting active branch scope)
  const statusCounts = useMemo(() => {
    const counts = { all: branchScopedOrders.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const o of branchScopedOrders) {
      const s = o.status.toLowerCase();
      if (s === 'pending') counts.pending++;
      else if (s === 'in_progress') counts.in_progress++;
      else if (s === 'completed') counts.completed++;
      else if (s === 'cancelled') counts.cancelled++;
    }
    return counts;
  }, [branchScopedOrders]);

  // Handle Slider Change
  const handleSliderChange = (idx: number) => {
    setSliderIndex(idx);
    const step = SLIDER_STEPS[idx];
    if (step.days === 999) {
      setTimePreset('all');
    } else if (step.days === 0) {
      setTimePreset('today');
    } else if (step.days === 1) {
      setTimePreset('yesterday');
    } else if (step.days === 7) {
      setTimePreset('7d');
    } else if (step.days === 30) {
      setTimePreset('30d');
    } else {
      // Custom date range backwards from today
      const end = new Date();
      const start = new Date(end.getTime() - (step.days * 86400000));
      setCustomFrom(start.toISOString().split('T')[0]);
      setCustomTo(end.toISOString().split('T')[0]);
      setTimePreset('custom');
    }
  };

  // Synchronize Preset selection to Slider
  const selectPreset = (preset: TimePreset) => {
    setTimePreset(preset);
    if (preset === 'today') setSliderIndex(0);
    else if (preset === 'yesterday') setSliderIndex(1);
    else if (preset === '7d') setSliderIndex(3);
    else if (preset === '30d') setSliderIndex(5);
    else if (preset === 'all') setSliderIndex(7);
  };

  // Copy Order ID
  const copyOrderId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("Copied to Clipboard", `Order ID ${id} copied.`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Update order status directly in DynamoDB with confirmation
  const updateOrderStatus = async (order: OrderGroup, newStatus: string) => {
    const isCancel = newStatus === 'cancelled';
    const statusLabel = newStatus.replace('_', ' ').toUpperCase();
    const confirmed = await confirm({
      title: isCancel ? `Cancel Order #${order.order_id.slice(-6)}?` : `Change Status to ${statusLabel}`,
      description: isCancel
        ? `Are you sure you want to cancel Order #${order.order_id.slice(-6)}? This will void all items in this ticket.`
        : `Update Order #${order.order_id.slice(-6)} (${order.table_number || 'Walk-In'}) to status "${statusLabel}"?`,
      confirmText: isCancel ? "Confirm Cancellation" : `Mark as ${statusLabel}`,
      cancelText: "Keep Current Status",
      variant: isCancel ? "danger" : "default",
    });

    if (!confirmed) return;

    setIsUpdatingStatus(true);
    try {
      const itemLedgerIds = order.items.map(i => i.ledger_id);
      
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.order_id, status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update order status");
      }

      // Optimistic update locally
      if (setLedger) {
        setLedger(prev => prev.map(entry => {
          if (itemLedgerIds.includes(entry.id)) {
            return { ...entry, status: newStatus };
          }
          return entry;
        }));
      }

      if (selectedOrder && selectedOrder.order_id === order.order_id) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }

      toast.success("Order Updated", `Order status changed to ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      console.error("Status Update Failed:", err);
      toast.error("Update Failed", err.message || "Could not update status in Supabase.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Print Receipt / Indian GST Tax Invoice (80mm / 58mm Thermal Printer Ready)
  const printReceipt = (order: OrderGroup) => {
    const printWindow = window.open('', '_blank', 'width=450,height=750');
    if (!printWindow) return;

    const timeInfo = formatOrderTime(order.created_at);
    const branchObj = branches.find(b => b.id === order.branch_id) || {
      name: order.branch_name || "S4 MANOHAA FOOD PLAZA",
      address: "NH 44 Highway Express, Hyderabad",
      phone: "+91 98765 43210",
      city: "Hyderabad",
      code: "HYD-01",
    };

    // Indian GST Calculation (5% GST under Restaurant Scheme: 2.5% CGST + 2.5% SGST)
    const grossAmount = Number(order.total_amount) || 0;
    const taxableValue = Math.round((grossAmount / 1.05) * 100) / 100;
    const totalGst = Math.round((grossAmount - taxableValue) * 100) / 100;
    const cgst = Math.round((totalGst / 2) * 100) / 100;
    const sgst = Math.round((totalGst - cgst) * 100) / 100;
    const invoiceNo = `INV-${branchObj.code || 'HYD'}-${order.created_at ? order.created_at.slice(0, 10).replace(/-/g, '') : '2026'}-${order.order_id.slice(-5).toUpperCase()}`;

    const itemsHtml = order.items.map((item, idx) => `
      <tr style="border-bottom: 1px dotted #ccc;">
        <td style="padding: 4px 0; font-size: 11px;">${idx + 1}. ${item.name}${item.notes ? `<br><i style="color:#666;font-size:10px;">Note: ${item.notes}</i>` : ''}</td>
        <td style="padding: 4px 0; text-align: center; font-size: 11px;">${item.quantity}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px;">₹${(item.price || 0).toFixed(2)}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px; font-weight: bold;">₹${(item.total_price || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GST Tax Invoice - ${invoiceNo}</title>
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 76mm; 
              margin: 0 auto; 
              padding: 6px; 
              color: #000; 
              background: #fff;
              font-size: 11px;
              line-height: 1.35;
            }
            .center { text-align: center; }
            .brand-name { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 2px; }
            .sub-brand { font-size: 10px; font-weight: bold; margin-bottom: 4px; }
            .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-bottom: 2px double #000; margin: 6px 0; }
            .meta-table { width: 100%; font-size: 10px; margin-bottom: 4px; }
            .meta-table td { padding: 1px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            .items-table th { border-bottom: 1px dashed #000; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
            .tax-summary { width: 100%; font-size: 11px; margin-top: 4px; }
            .tax-summary td { padding: 2px 0; }
            .grand-total { font-size: 14px; font-weight: 900; }
            .footer { text-align: center; font-size: 9px; margin-top: 10px; line-height: 1.3; }
            @media print {
              body { width: 100%; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="brand-name">${branchObj.name.toUpperCase()}</div>
            <div class="sub-brand">Highway Culinary Retreat & Fine Expressway Dining</div>
            <div style="font-size: 9.5px;">${branchObj.address}</div>
            <div style="font-size: 9.5px;">Phone: ${branchObj.phone}</div>
            <div class="divider"></div>
            <div style="font-weight: 900; font-size: 11px; letter-spacing: 1px;">TAX INVOICE (GST)</div>
            <div style="font-size: 9px; color: #333;">(Issued under Section 31 of CGST Act, 2017)</div>
          </div>

          <div class="divider"></div>

          <table class="meta-table">
            <tr>
              <td><b>Invoice No:</b> ${invoiceNo}</td>
              <td style="text-align: right;"><b>Date:</b> ${timeInfo.dateStr}</td>
            </tr>
            <tr>
              <td><b>Order ID:</b> #${order.order_id.slice(-6)}</td>
              <td style="text-align: right;"><b>Time:</b> ${timeInfo.timeStr}</td>
            </tr>
            <tr>
              <td><b>Table/Mode:</b> ${order.order_type} (${order.table_number || 'Walk-In'})</td>
              <td style="text-align: right;"><b>SAC:</b> 996331</td>
            </tr>
            <tr>
              <td colspan="2"><b>GSTIN:</b> 36AAACU9402L1ZQ &nbsp;|&nbsp; <b>FSSAI:</b> 13624011000492</td>
            </tr>
            ${order.notes ? `<tr><td colspan="2" style="color: #c00;"><b>Note:</b> ${order.notes}</td></tr>` : ''}
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left; width: 45%;">Item</th>
                <th style="text-align: center; width: 15%;">Qty</th>
                <th style="text-align: right; width: 20%;">Rate</th>
                <th style="text-align: right; width: 20%;">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="divider"></div>

          <table class="tax-summary">
            <tr>
              <td>Taxable Value (Food & Bev):</td>
              <td style="text-align: right;">₹${taxableValue.toFixed(2)}</td>
            </tr>
            <tr>
              <td>CGST @ 2.50%:</td>
              <td style="text-align: right;">₹${cgst.toFixed(2)}</td>
            </tr>
            <tr>
              <td>SGST @ 2.50%:</td>
              <td style="text-align: right;">₹${sgst.toFixed(2)}</td>
            </tr>
            <tr class="double-divider">
              <td colspan="2"></td>
            </tr>
            <tr class="grand-total">
              <td>NET PAYABLE:</td>
              <td style="text-align: right;">₹${grossAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="font-size: 10px; color: #555;">Payment Mode:</td>
              <td style="text-align: right; font-size: 10px; font-weight: bold;">UPI / CASH / CARD</td>
            </tr>
            <tr>
              <td style="font-size: 10px; color: #555;">Status:</td>
              <td style="text-align: right; font-size: 10px; font-weight: bold;">${order.status.toUpperCase()}</td>
            </tr>
          </table>

          <div class="divider"></div>

          <div class="footer">
            <div>★ Thank You For Visiting S4 Manohaa! ★</div>
            <div>Enjoy your journey & drive safely!</div>
            <div style="margin-top: 4px; font-size: 8px; color: #666;">
              FSSAI Lic. 13624011000492 • GST Composition Scheme
            </div>
            <div style="font-size: 8px; color: #888;">Computer generated statutory bill. No signature required.</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 750);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Dedicated Kitchen Order Ticket (KOT) Thermal Printer
  const printKOTSlip = (order: OrderGroup) => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      toast.error("Printer Error", "Please allow pop-ups to print thermal KOT tickets.");
      return;
    }

    const branchObj = branches.find(b => b.id === (order.branch_id || selectedBranch)) || {
      name: "S4 Manohaa Food Plaza",
      code: "HYD",
    };

    const itemsHtml = order.items.map((item) => `
      <div style="border-bottom: 1px dotted #888; padding: 4px 0;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
          <span>[ ${item.quantity} ] ${item.name.toUpperCase()}</span>
        </div>
        ${item.notes ? `<div style="font-size: 10px; color: #b00; font-weight: bold; margin-left: 20px;">>> NOTE: ${item.notes.toUpperCase()}</div>` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>KOT Ticket - #${order.order_id.slice(-6)}</title>
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            body { font-family: 'Courier New', Courier, monospace; width: 74mm; margin: 0 auto; padding: 4px; color: #000; font-size: 11px; }
            .center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-bottom: 2px solid #000; margin: 6px 0; }
            @media print { body { width: 100%; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin: 0; font-size: 15px; font-weight: 900;">*** KITCHEN ORDER TICKET ***</h2>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${branchObj.name.toUpperCase()}</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-top: 4px;">
              <span>KOT: #${order.order_id.slice(-6).toUpperCase()}</span>
              <span>ROUND 1</span>
            </div>
          </div>

          <div class="double-divider"></div>

          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold;">
            <span>TABLE: ${(order.table_number || 'WALK-IN').toUpperCase()}</span>
            <span>${order.order_type.toUpperCase()}</span>
          </div>
          <div style="font-size: 10px; color: #444; margin-top: 2px;">
            TIME: ${new Date(order.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
          </div>

          ${order.notes ? `
            <div style="border: 2px solid #000; padding: 4px; margin: 6px 0; text-align: center;">
              <span style="font-weight: 900; font-size: 10px; color: #b00; display: block;">*** CHEF INSTRUCTION ***</span>
              <span style="font-weight: bold; font-size: 11px;">${order.notes.toUpperCase()}</span>
            </div>
          ` : ''}

          <div class="divider"></div>
          <div style="font-weight: 900; font-size: 11px; margin-bottom: 4px;">ITEMS TO PREPARE:</div>
          <div>${itemsHtml}</div>

          <div class="double-divider"></div>
          <div class="center" style="font-size: 10px; font-weight: bold;">
            TOTAL DISHES: ${order.total_quantity}
            <div style="font-size: 8px; margin-top: 4px;">--- END OF KOT ---</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 750);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export filtered orders as JSON / CSV
  const exportOrders = () => {
    const csvRows = [
      ['Order ID', 'Branch', 'Date', 'Time', 'Order Type', 'Table', 'Status', 'Items Count', 'Total Amount', 'Notes', 'Item List']
    ];

    for (const o of filteredOrders) {
      const t = formatOrderTime(o.created_at);
      const itemList = o.items.map(i => `${i.quantity}x ${i.name}`).join('; ');
      csvRows.push([
        `"${o.order_id}"`,
        `"${(o.branch_name || 'Hyderabad Highway HQ').replace(/"/g, '""')}"`,
        `"${t.dateStr}"`,
        `"${t.timeStr}"`,
        `"${o.order_type}"`,
        `"${o.table_number}"`,
        `"${o.status}"`,
        String(o.total_quantity),
        String(o.total_amount),
        `"${(o.notes || '').replace(/"/g, '""')}"`,
        `"${itemList.replace(/"/g, '""')}"`
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `example-project-orders-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Export Complete", `Downloaded ${filteredOrders.length} orders to CSV.`);
  };

  // Get status color tokens
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400',
        dot: 'bg-amber-400 animate-pulse',
        label: 'Pending Queue',
        icon: Clock
      };
    }
    if (s === 'in_progress') {
      return {
        bg: 'bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400',
        dot: 'bg-blue-400 animate-pulse',
        label: 'Kitchen Prep',
        icon: ChefHat
      };
    }
    if (s === 'cancelled') {
      return {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400',
        dot: 'bg-rose-400',
        label: 'Cancelled',
        icon: XCircle
      };
    }
    return {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-400',
      label: 'Fulfilled',
      icon: CheckCircle2
    };
  };

  return (
    <div className="pb-16 space-y-8 max-w-7xl mx-auto">
      {/* HEADER WITH TITLE & ACTION PILLS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHead 
          eyebrow="Supabase Telemetry & Point of Sale" 
          title="Order History & Timeline" 
        />
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportOrders}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
              isLight 
                ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs" 
                : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          {/* VIEW SWITCHER */}
          <div className={`flex items-center p-1 rounded-xl border ${
            isLight ? "bg-slate-100 border-slate-200" : "bg-black/40 border-white/10"
          }`}>
            <button
              onClick={() => setViewMode('timeline')}
              title="Timeline Stream"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'timeline'
                  ? isLight ? "bg-white text-slate-900 shadow-sm" : "bg-white/15 text-white"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-gray-400 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              title="Card Grid"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? isLight ? "bg-white text-slate-900 shadow-sm" : "bg-white/15 text-white"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-gray-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Dense Table"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? isLight ? "bg-white text-slate-900 shadow-sm" : "bg-white/15 text-white"
                  : isLight ? "text-slate-500 hover:text-slate-900" : "text-gray-400 hover:text-white"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Franchise Scope Alert Banner (when filtered to specific branch) */}
      {selectedBranch && selectedBranch !== "ALL" && (
        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-sm' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold">
                Scoped to Franchise: <span className="font-extrabold underline">{branches.find((b: any) => b.id === selectedBranch)?.name || selectedBranch}</span>
              </p>
              <p className={`text-[11px] ${isLight ? 'text-amber-800/70' : 'text-amber-300/60'}`}>
                Order history, live metrics, and receipts reflect this branch location only.
              </p>
            </div>
          </div>
          {onSelectBranch && isSuperAdmin ? (
            <button
              onClick={() => onSelectBranch("ALL")}
              className="text-xs font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 transition-colors cursor-pointer shrink-0"
            >
              Reset to All Branches
            </button>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 shrink-0">
              Branch Manager View
            </span>
          )}
        </div>
      )}

      {/* TOP SEARCH BAR & COMPREHENSIVE FILTER CONTROLS */}
      <Glass className="p-6 space-y-6">
        {/* 1. Universal Search Input */}
        <div className="relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isLight ? "text-slate-400" : "text-gray-400"}`} />
          <input 
            type="text"
            placeholder="Search by Order ID (e.g. #ORD-...), dish name (e.g. Biryani, Afghani), table number, or chef notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full rounded-2xl py-3.5 pl-12 pr-10 outline-none text-sm font-medium transition-colors border ${
              isLight 
                ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:bg-white" 
                : "bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37]"
            }`}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 2. Date Range Horizon Presets & Custom Slider */}
        <div className="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Presets Pills */}
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-[var(--text-muted)] mr-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Horizon:
              </span>
              {(['today', 'yesterday', '7d', '30d', 'all', 'custom'] as TimePreset[]).map(preset => {
                const isActive = timePreset === preset;
                const labels: Record<TimePreset, string> = {
                  today: "Today",
                  yesterday: "Yesterday",
                  '7d': "This Week (7D)",
                  '30d': "Past Month",
                  all: "All Time",
                  custom: "Custom Range"
                };

                return (
                  <button
                    key={preset}
                    onClick={() => selectPreset(preset)}
                    style={isActive ? { backgroundColor: themeConfig.light, borderColor: themeConfig.border, color: themeConfig.primary } : {}}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isActive 
                        ? "shadow-2xs font-extrabold" 
                        : isLight 
                          ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900" 
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {labels[preset]}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Pickers (Shown if 'custom' is active) */}
            {timePreset === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--text-muted)] font-medium">From:</span>
                  <input 
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className={`text-xs rounded-xl px-3 py-1.5 border outline-none ${
                      isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-black/40 border-white/10 text-white"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--text-muted)] font-medium">To:</span>
                  <input 
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className={`text-xs rounded-xl px-3 py-1.5 border outline-none ${
                      isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-black/40 border-white/10 text-white"
                    }`}
                  />
                </div>
                {(customFrom || customTo) && (
                  <button 
                    onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                    className="p-1.5 text-xs text-rose-500 hover:underline font-bold"
                  >
                    Clear
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {/* Interactive Horizon Slider (Allows scrubbing through timeframes) */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] mb-2">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" /> Timeline Scrubber:
              </span>
              <span className="font-mono text-[var(--accent)]">
                Selected Window: {SLIDER_STEPS[sliderIndex].label}
              </span>
            </div>
            <div className="relative flex items-center">
              <input 
                type="range"
                min={0}
                max={SLIDER_STEPS.length - 1}
                step={1}
                value={sliderIndex}
                onChange={e => handleSliderChange(parseInt(e.target.value, 10))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-white/10 accent-[var(--accent)]"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1.5 px-0.5">
              {SLIDER_STEPS.map((s, idx) => (
                <button 
                  key={idx} 
                  onClick={() => handleSliderChange(idx)}
                  className={`hover:text-[var(--text-primary)] transition-colors ${
                    sliderIndex === idx ? "font-bold text-[var(--accent)] underline" : ""
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Status Filter Chips */}
          <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-[var(--text-muted)] mr-1 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {(['all', 'pending', 'in_progress', 'completed', 'cancelled'] as StatusFilter[]).map(status => {
              const isActive = statusFilter === status;
              const count = statusCounts[status];

              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isActive 
                      ? isLight ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-white text-black"
                      : isLight ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? "bg-white/20 text-white dark:bg-black/20 dark:text-black" : "bg-black/10 dark:bg-white/10"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </Glass>

      {/* METRIC SUMMARY STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          icon={ReceiptText} 
          label="Total Orders" 
          value={metrics.totalOrders.toLocaleString()} 
          delta={{ percent: metrics.totalOrders, isPositive: true, label: "Filtered count" }}
          accent="gold"
        />
        <StatCard 
          icon={IndianRupee} 
          label="Period Revenue" 
          value={inr(metrics.totalRevenue)} 
          delta={{ percent: metrics.avgOrderValue, isPositive: true, label: `Avg ${inr(metrics.avgOrderValue)}/ord` }}
          accent="emerald"
        />
        <StatCard 
          icon={ShoppingBag} 
          label="Dishes Served" 
          value={metrics.totalItems.toLocaleString()} 
          delta={{ percent: metrics.totalOrders > 0 ? +(metrics.totalItems / metrics.totalOrders).toFixed(1) : 0, isPositive: true, label: "Avg items/order" }}
          accent="purple"
        />
        <StatCard 
          icon={Clock} 
          label="Pending Queue" 
          value={metrics.pendingOrders.toString()} 
          delta={{ percent: metrics.pendingOrders, isPositive: metrics.pendingOrders === 0, label: "Needs attention" }}
          accent="blue"
        />
        <StatCard 
          icon={ChefHat} 
          label="Kitchen In-Prep" 
          value={metrics.inProgressOrders.toString()} 
          delta={{ percent: metrics.inProgressOrders, isPositive: true, label: "Currently cooking" }}
          accent="gold"
        />
      </div>

      {/* ZERO RESULTS FALLBACK */}
      {filteredOrders.length === 0 && (
        <Glass className="p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <ReceiptText className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">No Orders Found</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1 max-w-md">
              No orders matched your current search and timeline filters. Try expanding your date horizon or clearing the search query.
            </p>
          </div>
          <button
            onClick={() => { setSearchQuery(''); setTimePreset('all'); setStatusFilter('all'); setSliderIndex(7); }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[var(--accent)] text-[var(--bg-card)] hover:opacity-90 transition-opacity"
          >
            Reset All Filters
          </button>
        </Glass>
      )}

      {/* VIEW 1: TIMELINE STREAM VIEW */}
      {viewMode === 'timeline' && filteredOrders.length > 0 && (
        <div className="relative pl-6 sm:pl-10 space-y-8 before:absolute before:left-3 sm:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[var(--accent)] before:via-white/20 before:to-transparent">
          {paginatedOrders.map((order, orderIdx) => {
            const timeInfo = formatOrderTime(order.created_at);
            const badge = getStatusBadge(order.status);
            const BadgeIcon = badge.icon;

            return (
              <motion.div 
                key={order.order_id || orderIdx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(orderIdx * 0.03, 0.5) }}
                className="relative group"
              >
                {/* Timeline node */}
                <div 
                  className={`absolute -left-6 sm:-left-10 top-5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 duration-200 z-10 ${
                    isLight ? "bg-white border-slate-300 shadow-sm" : "bg-[#09090B] border-white/20"
                  }`}
                  style={{ borderColor: order.status === 'pending' ? '#F59E0B' : order.status === 'in_progress' ? '#3B82F6' : themeConfig.primary }}
                >
                  <div className={`w-2 h-2 rounded-full ${badge.dot}`} />
                </div>

                {/* Order Timeline Card */}
                <Glass 
                  className="p-5 sm:p-6 transition-all hover:border-[var(--accent)] cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div onClick={() => setSelectedOrder(order)}>
                    {/* Header Row: Order ID, Badges, Timestamp & Price */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
                      <div className="flex items-center flex-wrap gap-2.5">
                        <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border bg-black/5 dark:bg-white/5 border-[var(--border-subtle)] flex items-center gap-1.5 text-[var(--text-primary)]">
                          <span>#{order.order_id}</span>
                          <button 
                            onClick={(e) => copyOrderId(order.order_id, e)}
                            className="p-0.5 rounded hover:bg-white/20 text-[var(--text-muted)] hover:text-white"
                            title="Copy Order ID"
                          >
                            {copiedId === order.order_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </span>

                        {/* Branch badge / selector button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectBranch && order.branch_id) {
                              onSelectBranch(order.branch_id);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            selectedBranch === order.branch_id
                              ? "bg-amber-500/20 border-amber-500/60 text-amber-600 dark:text-amber-400 font-extrabold shadow-2xs"
                              : isLight
                                ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40"
                          }`}
                          title={`Scope telemetry to ${order.branch_name || 'this branch'}`}
                        >
                          <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{order.branch_name || 'Hyderabad Highway HQ'}</span>
                        </button>

                        {order.is_legacy && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Legacy Batch
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.bg}`}>
                          <BadgeIcon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>

                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[var(--text-secondary)]">
                          {order.order_type} • {order.table_number}
                        </span>

                        {order.notes && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 truncate max-w-xs">
                            Note: {order.notes}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[11px] font-mono text-[var(--text-muted)]">{timeInfo.relative}</p>
                          <p className="text-xs font-medium text-[var(--text-secondary)]">{timeInfo.dateStr}</p>
                        </div>
                        <p className="font-serif text-2xl font-bold text-[var(--accent)] tabular-nums">
                          {inr(order.total_amount)}
                        </p>
                      </div>
                    </div>

                    {/* Order Progress Timeline Stepper */}
                    <div className="py-4">
                      <div className="flex items-center justify-between max-w-lg text-[11px] font-bold text-[var(--text-muted)]">
                        <div className="flex items-center gap-1.5 text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ticket Logged</span>
                        </div>
                        <div className={`h-0.5 flex-1 mx-3 rounded ${
                          order.status === 'in_progress' || order.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                        }`} />
                        <div className={`flex items-center gap-1.5 ${
                          order.status === 'in_progress' || order.status === 'completed' ? 'text-blue-400 font-extrabold' : 'text-[var(--text-muted)]'
                        }`}>
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>Kitchen Prep</span>
                        </div>
                        <div className={`h-0.5 flex-1 mx-3 rounded ${
                          order.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                        }`} />
                        <div className={`flex items-center gap-1.5 ${
                          order.status === 'completed' ? 'text-emerald-400 font-extrabold' : 'text-[var(--text-muted)]'
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Dispatched</span>
                        </div>
                      </div>
                    </div>

                    {/* Itemized Dish Badges Preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2">
                      {order.items.map((item, itemIdx) => (
                        <div 
                          key={item.ledger_id || itemIdx}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                            isLight ? "bg-slate-50 border-slate-200/80" : "bg-black/30 border-white/5"
                          }`}
                        >
                          {item.img ? (
                            <img 
                              src={item.img} 
                              alt={item.name} 
                              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                              <Utensils className="w-4 h-4" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {item.is_veg !== undefined && (
                                <span 
                                  className={`w-2.5 h-2.5 rounded-sm border shrink-0 flex items-center justify-center ${
                                    item.is_veg ? "border-emerald-500" : "border-rose-500"
                                  }`}
                                  title={item.is_veg ? "Vegetarian" : "Non-Vegetarian"}
                                >
                                  <span className={`w-1 h-1 rounded-full ${item.is_veg ? "bg-emerald-500" : "bg-rose-500"}`} />
                                </span>
                              )}
                              <p className="text-xs font-bold text-[var(--text-primary)] truncate">{item.name}</p>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] font-mono">
                              <span className="font-extrabold text-[var(--accent)]">{item.quantity}×</span> {inr(item.price)} = {inr(item.total_price)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                      <span className="text-[var(--text-muted)] font-medium">
                        {order.total_quantity} item(s) in this order
                      </span>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); printReceipt(order); }}
                          className={`p-1.5 rounded-lg border flex items-center gap-1 font-bold ${
                            isLight ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100" : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                          }`}
                          title="Print Thermal Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[11px]">Print Slip</span>
                        </button>
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="flex items-center gap-1 font-bold text-[var(--accent)] hover:underline text-[11px]"
                        >
                          <span>Full Breakdown</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Glass>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: CARD GRID VIEW */}
      {viewMode === 'cards' && filteredOrders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedOrders.map((order, orderIdx) => {
            const timeInfo = formatOrderTime(order.created_at);
            const badge = getStatusBadge(order.status);
            const BadgeIcon = badge.icon;

            return (
              <Glass 
                key={order.order_id || orderIdx}
                className="p-5 flex flex-col justify-between hover:border-[var(--accent)] transition-all cursor-pointer group"
              >
                <div onClick={() => setSelectedOrder(order)}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-[var(--accent)]">
                      #{order.order_id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectBranch && order.branch_id) {
                            onSelectBranch(order.branch_id);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                          selectedBranch === order.branch_id
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-600 dark:text-amber-400 font-extrabold"
                            : isLight
                              ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                        }`}
                        title={`Scope to ${order.branch_name || 'this branch'}`}
                      >
                        <Store className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate max-w-[110px]">{order.branch_name || 'Hyderabad Highway HQ'}</span>
                      </button>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}>
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <p className="font-serif text-2xl font-bold text-[var(--text-primary)]">
                      {inr(order.total_amount)}
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {timeInfo.relative}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">
                    {order.order_type} • {order.table_number}
                  </p>

                  <div className="space-y-1.5 py-2 border-y border-[var(--border-subtle)] max-h-40 overflow-y-auto custom-scrollbar">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="truncate pr-2 text-[var(--text-primary)] font-medium">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="font-mono text-[var(--text-muted)] shrink-0">
                          {inr(item.total_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {order.total_quantity} item(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => printReceipt(order)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white"
                      title="Print Slip"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="font-bold text-[var(--accent)] hover:underline flex items-center gap-0.5"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {/* VIEW 3: DENSE EXECUTIVE TABLE VIEW */}
      {viewMode === 'table' && filteredOrders.length > 0 && (
        <Glass className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase text-[10px] tracking-wider border-b ${
                isLight ? "bg-slate-50 text-slate-500 border-slate-200" : "bg-white/[0.02] text-gray-400 border-white/5"
              }`}>
                <tr>
                  <th className="py-3.5 px-4 font-bold">Order ID</th>
                  <th className="py-3.5 px-4 font-bold">Branch</th>
                  <th className="py-3.5 px-4 font-bold">Time & Date</th>
                  <th className="py-3.5 px-4 font-bold">Dining Info</th>
                  <th className="py-3.5 px-4 font-bold">Items Summary</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Total Amount</th>
                  <th className="py-3.5 px-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {paginatedOrders.map((order, orderIdx) => {
                  const timeInfo = formatOrderTime(order.created_at);
                  const badge = getStatusBadge(order.status);
                  const BadgeIcon = badge.icon;

                  return (
                    <tr 
                      key={order.order_id || orderIdx}
                      className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${
                        isLight ? "hover:bg-slate-50" : ""
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[var(--accent)] whitespace-nowrap">
                        #{order.order_id}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectBranch && order.branch_id) {
                              onSelectBranch(order.branch_id);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            selectedBranch === order.branch_id
                              ? "bg-amber-500/20 border-amber-500/60 text-amber-600 dark:text-amber-400 font-extrabold"
                              : isLight
                                ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                          }`}
                          title={`Scope telemetry to ${order.branch_name || 'this branch'}`}
                        >
                          <Store className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{order.branch_name || 'Hyderabad Highway HQ'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-[var(--text-primary)]">{timeInfo.relative}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono">{timeInfo.timeStr}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-[var(--text-primary)]">{order.order_type}</span>
                        <div className="text-[11px] text-[var(--text-muted)]">{order.table_number}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate">
                        <span className="font-medium text-[var(--text-primary)]">
                          {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-serif font-bold text-sm text-right text-[var(--text-primary)] whitespace-nowrap">
                        {inr(order.total_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                          className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                          title="Inspect Order"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Glass>
      )}

      {/* PAGINATION CONTROL STRIP (Performance Optimization) */}
      {filteredOrders.length > 0 && (
        <Glass className="p-3.5 my-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <span>
              Showing <span className="font-bold text-[var(--text-primary)]">{(currentPage - 1) * pageSize + 1}</span> to{" "}
              <span className="font-bold text-[var(--text-primary)]">
                {Math.min(currentPage * pageSize, filteredOrders.length)}
              </span>{" "}
              of <span className="font-bold text-[var(--text-primary)]">{filteredOrders.length.toLocaleString()}</span> orders
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-muted)] text-[11px] font-medium">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={`rounded-lg px-2 py-1 border text-xs font-bold outline-none cursor-pointer ${
                  isLight ? "bg-white border-slate-200 text-slate-900" : "bg-white/5 border-white/10 text-white"
                }`}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page Navigation Buttons */}
            <div className="flex items-center gap-1 font-bold">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/10"
                title="First Page"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/10"
              >
                Prev
              </button>
              <span className="px-2.5 py-1 font-mono text-[var(--accent)] font-extrabold">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/10"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/10"
                title="Last Page"
              >
                »
              </button>
            </div>
          </div>
        </Glass>
      )}

      {/* DETAIL DRAWER / RECEIPT MODAL */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-over Drawer Panel */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className={`relative z-10 w-full max-w-xl h-full shadow-2xl flex flex-col border-l ${
                isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#0E0E12] border-white/10 text-white"
              }`}
            >
              {/* Drawer Header */}
              <div className={`p-6 border-b flex items-center justify-between ${
                isLight ? "border-slate-100 bg-slate-50/60" : "border-white/5 bg-white/[0.02]"
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-xl font-bold">Order Breakdown</h3>
                    <button 
                      onClick={() => copyOrderId(selectedOrder.order_id)}
                      className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                      title="Copy Order ID"
                    >
                      {copiedId === selectedOrder.order_id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-[var(--accent)] mt-0.5">
                    #{selectedOrder.order_id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => printReceipt(selectedOrder)}
                    className="p-2 rounded-xl border border-[var(--border-subtle)] hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
                    title="Print Receipt"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                  <button 
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {/* Meta Strip */}
                <div className={`p-4 rounded-2xl border grid grid-cols-2 gap-4 ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/5"
                }`}>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                      Placed At
                    </span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {formatOrderTime(selectedOrder.created_at).full}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                      Dining Type & Table
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {selectedOrder.order_type} • {selectedOrder.table_number}
                    </span>
                  </div>

                  {/* Branch Location Meta */}
                  <div className="col-span-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                        Branch Location
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Store className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {selectedOrder.branch_name || 'Hyderabad Highway HQ'}
                        </span>
                      </div>
                    </div>
                    {onSelectBranch && selectedOrder.branch_id && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectBranch(selectedOrder.branch_id!);
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          selectedBranch === selectedOrder.branch_id
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-500 dark:text-amber-400 font-extrabold"
                            : isLight
                              ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
                        }`}
                      >
                        {selectedBranch === selectedOrder.branch_id ? "Active Scope" : "Scope to this Branch"}
                      </button>
                    )}
                  </div>

                  {selectedOrder.notes && (
                    <div className="col-span-2 pt-2 border-t border-[var(--border-subtle)]">
                      <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider block">
                        Chef / Kitchen Instructions
                      </span>
                      <p className="text-xs font-semibold text-rose-400 mt-0.5">
                        {selectedOrder.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status Switcher Bar */}
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-extrabold text-[var(--text-muted)] mb-2 block">
                    Manage Order Status:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'pending', label: 'Pending', icon: Clock, color: 'border-amber-500/50 text-amber-500' },
                      { key: 'in_progress', label: 'In Prep', icon: ChefHat, color: 'border-blue-500/50 text-blue-500' },
                      { key: 'completed', label: 'Fulfilled', icon: CheckCircle2, color: 'border-emerald-500/50 text-emerald-500' },
                      { key: 'cancelled', label: 'Cancel', icon: XCircle, color: 'border-rose-500/50 text-rose-500' },
                    ].map(st => {
                      const isCurrent = selectedOrder.status.toLowerCase() === st.key;
                      const Icon = st.icon;

                      return (
                        <button
                          key={st.key}
                          disabled={isUpdatingStatus}
                          onClick={() => updateOrderStatus(selectedOrder, st.key)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50 ${
                            isCurrent 
                              ? isLight ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-white border-white text-black shadow-md"
                              : `${st.color} hover:bg-white/5`
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Itemized Receipt Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-[var(--text-muted)]">
                      Ordered Dishes ({selectedOrder.items.length})
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      Total items: {selectedOrder.total_quantity}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedOrder.items.map((item, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-2xl border ${
                          isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.03] border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          {item.img ? (
                            <img src={item.img} alt={item.name} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/10" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
                              <Utensils className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {item.is_veg !== undefined && (
                                <span className={`w-2.5 h-2.5 rounded-sm border shrink-0 flex items-center justify-center ${
                                  item.is_veg ? "border-emerald-500" : "border-rose-500"
                                }`}>
                                  <span className={`w-1 h-1 rounded-full ${item.is_veg ? "bg-emerald-500" : "bg-rose-500"}`} />
                                </span>
                              )}
                              <p className="font-bold text-sm text-[var(--text-primary)] truncate">{item.name}</p>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                              {inr(item.price)} each • Quantity: <span className="font-bold text-[var(--accent)]">{item.quantity}</span>
                            </p>
                          </div>
                        </div>

                        <span className="font-serif text-base font-bold text-[var(--text-primary)] tabular-nums shrink-0">
                          {inr(item.total_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Drawer Footer: Grand Total */}
              <div className={`p-6 border-t ${
                isLight ? "border-slate-200 bg-slate-50/80" : "border-white/10 bg-[#0B0B0E]"
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-[var(--text-muted)]">
                    Grand Total Due
                  </span>
                  <span className="font-serif text-3xl font-bold text-[var(--accent)] tabular-nums">
                    {inr(selectedOrder.total_amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => printReceipt(selectedOrder)}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-[var(--accent)] text-[var(--bg-card)] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Tax Invoice</span>
                  </button>
                  <button 
                    onClick={() => printKOTSlip(selectedOrder)}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-2xs' 
                        : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                    }`}
                  >
                    <ChefHat className="w-4 h-4 text-amber-400" />
                    <span>Print KOT Slip</span>
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
