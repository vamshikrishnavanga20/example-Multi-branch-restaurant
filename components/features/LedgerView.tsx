'use client';

import { useState, useMemo, useEffect } from "react";
import { 
  Search, Plus, Loader2, Send, Wifi, WifiOff, RefreshCw, 
  CheckCircle2, Clock, Printer, Store, Utensils, AlertTriangle, Layers, ChefHat
} from "lucide-react";
import { Dish, Category, LedgerEntry, Branch, RestaurantTable, KOTPrintTicket } from "@/types";
import { inr, getDescendantIds, getCategoryPath } from "@/lib/utils";
import { PageHead, Glass } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";
import KOTThermalInvoice from "./KOTThermalInvoice";
import {
  isOnline as checkIsOnline,
  queueOfflineOrder,
  getQueueCount,
  syncOfflineQueue,
  subscribeToSyncStatus,
  cacheMenuCatalog,
  getCachedMenuCatalog,
} from "@/lib/offline-sync";

interface LedgerViewProps {
  dishes?: Dish[];
  categories?: Category[];
  ledger?: LedgerEntry[];
  setLedger?: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  branches?: Branch[];
  selectedBranch?: string;
  onSelectBranch?: (branchId: string) => void;
  initialTableNumber?: string;
}

export default function LedgerView({ 
  dishes = [], 
  categories = [], 
  ledger = [], 
  setLedger,
  branches = [],
  selectedBranch = "ALL",
  initialTableNumber,
}: LedgerViewProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const toast = useToast();

  // POS Ticket & Ordering State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const [cart, setCart] = useState<{ dish: Dish; qty: number; notes?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Operational Context (Tables & Dining Types)
  const [tableNumber, setTableNumber] = useState(initialTableNumber || "T-01");
  const [orderType, setOrderType] = useState<"dine-in" | "takeaway" | "delivery">("dine-in");
  const [orderNotes, setOrderNotes] = useState("");
  const [activeBranchId, setActiveBranchId] = useState<string>(
    selectedBranch !== "ALL" ? selectedBranch : (branches[0]?.id || "branch-hyderabad-hq")
  );

  // Tables from API
  const [branchTables, setBranchTables] = useState<RestaurantTable[]>([]);

  // KOT Modal & Thermal Ticket State
  const [activeKOTModal, setActiveKOTModal] = useState<KOTPrintTicket | null>(null);
  const [lastCompletedKOT, setLastCompletedKOT] = useState<KOTPrintTicket | null>(null);

  // Offline Engine State
  const [online, setOnline] = useState(true);
  const [queuedOrdersCount, setQueuedOrdersCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Keep offline menu catalog cached
  useEffect(() => {
    if (dishes.length > 0 && categories.length > 0) {
      cacheMenuCatalog(categories, dishes);
    }
  }, [dishes, categories]);

  // Subscribe to network & queue status
  useEffect(() => {
    const unsubscribe = subscribeToSyncStatus((count, isNetOnline) => {
      setQueuedOrdersCount(count);
      setOnline(isNetOnline);
    });
    return unsubscribe;
  }, []);

  // Update active branch if prop changes
  useEffect(() => {
    if (selectedBranch && selectedBranch !== "ALL") {
      setActiveBranchId(selectedBranch);
    } else if (branches.length > 0 && !activeBranchId) {
      setActiveBranchId(branches[0].id);
    }
  }, [selectedBranch, branches]);

  // Synchronize initialTableNumber if passed from Floor Plan
  useEffect(() => {
    if (initialTableNumber) {
      setTableNumber(initialTableNumber);
      setOrderType("dine-in");
    }
  }, [initialTableNumber]);

  // Fetch branch tables for visual quick selection
  useEffect(() => {
    if (!activeBranchId) return;
    fetch(`/api/tables?branch_id=${activeBranchId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBranchTables(data);
      })
      .catch((err) => console.warn("Failed to load tables in POS:", err));
  }, [activeBranchId]);

  // Effective dishes: fallback to cached catalog if initial load happened while offline
  const effectiveDishes = useMemo(() => {
    if (dishes.length > 0) return dishes;
    const cached = getCachedMenuCatalog();
    return cached?.dishes || [];
  }, [dishes]);

  const effectiveCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    const cached = getCachedMenuCatalog();
    return cached?.categories || [];
  }, [categories]);

  const validCategoryIds = useMemo(() => {
    if (selectedCat === "all") return null;
    return getDescendantIds(selectedCat, effectiveCategories);
  }, [selectedCat, effectiveCategories]);

  const filteredDishes = useMemo(() => {
    return effectiveDishes.filter((d: Dish) => {
      if (!d.available) return false;
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.desc && d.desc.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = validCategoryIds ? validCategoryIds.includes(d.category_id) : true;
      return matchesSearch && matchesCat;
    });
  }, [effectiveDishes, searchQuery, validCategoryIds]);

  const currentTotal = cart.reduce((acc, item) => acc + item.dish.price * item.qty, 0);

  const activeBranchObject = useMemo(() => {
    return (
      branches.find((b) => b.id === activeBranchId) || {
        id: activeBranchId || "branch-hyderabad-hq",
        name: "Hyderabad Highway HQ",
      }
    );
  }, [branches, activeBranchId]);

  const addToTicket = (dish: Dish) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.dish.id === dish.id);
      if (exists) {
        return prev.map((i) => (i.dish.id === dish.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { dish, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.dish.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  // Manual Trigger for Syncing Offline Queue
  const handleManualSync = async () => {
    if (isSyncing || queuedOrdersCount === 0) return;
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      if (result.synced > 0) {
        toast.success("Offline Queue Synced", `Successfully uploaded ${result.synced} offline order(s) to cloud.`);
      }
      if (result.errors.length > 0) {
        toast.error("Partial Sync Error", `${result.errors.length} order(s) could not sync yet.`);
      }
    } catch (err: any) {
      toast.error("Sync Error", err?.message || "Failed to sync offline queue.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Order Fulfillment (Online direct POST + Automatic Offline Queue fallback)
  const syncLedger = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const client_order_id = `pos-order-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const formattedTable = `${tableNumber.trim() || 'Walk-in'} | ${orderType}${orderNotes.trim() ? ` | NOTE:${orderNotes.trim()}` : ''}`;
    const targetBranchId = activeBranchId || "branch-hyderabad-hq";
    const targetBranchName = activeBranchObject.name || "Hyderabad Highway HQ";

    const payload = {
      client_order_id,
      items: cart.map((item) => ({
        menu_item_id: item.dish.id,
        quantity: item.qty,
        unit_price: item.dish.price,
        subtotal: item.dish.price * item.qty,
        notes: item.notes || "",
        item_notes: item.notes || "",
      })),
      table_number: formattedTable,
      order_type: orderType,
      notes: orderNotes.trim(),
      branch_id: targetBranchId,
      branch_name: targetBranchName,
      total_amount: currentTotal,
    };

    // If already known offline, queue locally immediately
    if (!online || !checkIsOnline()) {
      queueOfflineOrder({
        client_order_id,
        items: cart.map((item) => ({
          menu_item_id: item.dish.id,
          name: item.dish.name,
          quantity: item.qty,
          price: item.dish.price,
          notes: item.notes,
        })),
        table_number: formattedTable,
        order_type: orderType,
        notes: orderNotes.trim(),
        branch_id: targetBranchId,
        branch_name: targetBranchName,
        total_amount: currentTotal,
      });

      // Optimistic visual addition to ledger
      if (setLedger) {
        const optimisticEntries: LedgerEntry[] = cart.map((item, idx) => ({
          id: `offline-${client_order_id}-${idx}`,
          menu_item_id: item.dish.id,
          quantity: item.qty,
          total_price: item.dish.price * item.qty,
          created_at: new Date().toISOString(),
          status: "pending (offline)",
          table_number: formattedTable,
          branch_id: targetBranchId,
          branch_name: targetBranchName,
          order_id: client_order_id,
          menu_items: item.dish,
        }));
        setLedger((prev) => [...optimisticEntries, ...prev]);
      }

      const offlineKot: KOTPrintTicket = {
        kot_number: client_order_id.slice(-4).toUpperCase(),
        order_id: client_order_id,
        round_number: 1,
        table_number: tableNumber,
        order_type: orderType,
        branch_name: targetBranchName,
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
        items: cart.map(i => ({
          name: i.dish.name,
          quantity: i.qty,
          notes: i.notes || '',
        })),
        order_notes: orderNotes.trim() || undefined,
      };
      setLastCompletedKOT(offlineKot);
      setActiveKOTModal(offlineKot);

      toast.warning(
        "Saved to Offline Queue",
        `Order queued locally (${cart.length} items). It will automatically sync to cloud when Internet reconnects.`
      );

      setCart([]);
      setOrderNotes("");
      setLoading(false);
      return;
    }

    // Attempt direct cloud upload
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Order fulfillment failed.");
      }

      // Update optimistic state with server transactions
      if (setLedger && data.transactions && Array.isArray(data.transactions)) {
        setLedger((prev: LedgerEntry[]) => [...data.transactions, ...prev]);
      }

      const onlineKot: KOTPrintTicket = {
        kot_number: (data.order_id || client_order_id).slice(-4).toUpperCase(),
        order_id: data.order_id || client_order_id,
        round_number: 1,
        table_number: tableNumber,
        order_type: orderType,
        branch_name: targetBranchName,
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
        items: cart.map(i => ({
          name: i.dish.name,
          quantity: i.qty,
          notes: i.notes || '',
        })),
        order_notes: orderNotes.trim() || undefined,
      };
      setLastCompletedKOT(onlineKot);
      setActiveKOTModal(onlineKot);

      toast.success(
        "Order Processed",
        `Successfully logged ${cart.length} item(s) for ${tableNumber} totaling ${inr(data.total_amount || currentTotal)}.`
      );

      setCart([]);
      setOrderNotes("");
    } catch (err: any) {
      console.warn("[Web POS] Direct sync failed, falling back to offline queue:", err);

      // Network drop fallback: safely queue locally
      queueOfflineOrder({
        client_order_id,
        items: cart.map((item) => ({
          menu_item_id: item.dish.id,
          name: item.dish.name,
          quantity: item.qty,
          price: item.dish.price,
          notes: item.notes,
        })),
        table_number: formattedTable,
        order_type: orderType,
        notes: orderNotes.trim(),
        branch_id: targetBranchId,
        branch_name: targetBranchName,
        total_amount: currentTotal,
      });

      const fallbackKot: KOTPrintTicket = {
        kot_number: client_order_id.slice(-4).toUpperCase(),
        order_id: client_order_id,
        round_number: 1,
        table_number: tableNumber,
        order_type: orderType,
        branch_name: targetBranchName,
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
        items: cart.map(i => ({
          name: i.dish.name,
          quantity: i.qty,
          notes: i.notes || '',
        })),
        order_notes: orderNotes.trim() || undefined,
      };
      setLastCompletedKOT(fallbackKot);
      setActiveKOTModal(fallbackKot);

      toast.warning(
        "Network Failed — Order Queued",
        "Connection interrupted. Order was securely saved locally and will auto-sync when online."
      );

      setCart([]);
      setOrderNotes("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-10 space-y-4">
      {/* OFFLINE STATUS & SYNC BANNER */}
      <div className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
        !online
          ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
          : queuedOrdersCount > 0
            ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
            : isLight
              ? "bg-slate-100/80 border-slate-200 text-slate-700"
              : "bg-white/[0.02] border-white/5 text-gray-300"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${!online ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">
                {!online ? "Offline POS Mode Active" : "Cloud Terminal Connected"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-extrabold ${
                !online ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500"
              }`}>
                {!online ? "Local Storage" : "Live DynamoDB"}
              </span>
            </div>
            <p className="text-[11px] opacity-80 mt-0.5">
              {!online 
                ? "Orders are safely stored in browser storage and will auto-push once connectivity resumes." 
                : "Authoritative pricing and instant kitchen ticket broadcast enabled."}
            </p>
          </div>
        </div>

        {queuedOrdersCount > 0 && (
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-lg">
              {queuedOrdersCount} Offline Ticket(s) Pending
            </span>
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !online}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                online
                  ? "bg-amber-500 text-black hover:bg-amber-400 shadow-xs"
                  : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Cloud"}</span>
            </button>
          </div>
        )}
      </div>

      <PageHead eyebrow="Point of Sale" title="Operations Ledger & Order Punch" />

      {/* POS SPLIT VIEW */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT: MENU CATALOG & DISH SELECTION */}
        <Glass className="p-6 flex flex-col h-[740px]">
          <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
            <div className="relative flex-1">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? "text-slate-400" : "text-gray-500"}`} />
              <input 
                type="text" 
                placeholder="Search dish name or description..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className={`w-full rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none transition-colors border ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:bg-white" 
                    : "bg-black/40 border-white/10 text-white focus:border-[#D4AF37]"
                }`} 
              />
            </div>
            <select 
              className={`rounded-xl px-3 py-2.5 text-xs outline-none sm:w-1/3 shrink-0 border ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-900" 
                  : "bg-black/40 border-white/10 text-white"
              }`} 
              value={selectedCat} 
              onChange={e => setSelectedCat(e.target.value)}
            >
              <option value="all" className={isLight ? "bg-white text-slate-900" : "bg-[#121214] text-white"}>All Categories</option>
              {effectiveCategories.map((c: any) => (
                <option key={c.id} value={c.id} className={isLight ? "bg-white text-slate-900" : "bg-[#121214] text-white"}>
                  {getCategoryPath(c.id, effectiveCategories)}
                </option>
              ))}
            </select>
          </div>

          {/* DISH GRID */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 content-start">
            {filteredDishes.length === 0 ? (
              <div className="col-span-full text-center py-16 opacity-60">
                <Utensils className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                <p className="text-xs">No matching dishes available.</p>
              </div>
            ) : filteredDishes.map((d: Dish) => (
              <button 
                key={d.id} 
                onClick={() => addToTicket(d)} 
                className={`rounded-xl p-3 text-left transition-all flex flex-col justify-between h-24 group relative overflow-hidden border cursor-pointer ${
                  isLight 
                    ? "bg-slate-50/80 border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 shadow-2xs" 
                    : "bg-white/[0.03] border-white/10 hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10"
                }`}
              >
                <div className="z-10 pr-5">
                  <div className="flex items-center gap-1.5">
                    {d.is_veg !== undefined && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${d.is_veg ? "bg-emerald-500" : "bg-rose-500"}`} />
                    )}
                    <span className={`font-semibold text-xs line-clamp-1 ${
                      isLight ? "text-slate-900 group-hover:text-amber-800" : "text-white group-hover:text-[#D4AF37]"
                    }`}>
                      {d.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{d.desc || "Prepared fresh to order"}</p>
                </div>
                <div className="z-10 flex items-center justify-between w-full mt-1">
                  <span className="font-serif text-sm font-bold" style={{ color: themeConfig.primary }}>
                    {inr(d.price)}
                  </span>
                  <div 
                    style={{ color: themeConfig.primary }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-amber-500/10 p-1 rounded-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Glass>

        {/* RIGHT: TICKET BUILDER & ATTRIBUTION */}
        <Glass className="p-6 flex flex-col h-[740px]">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
            <div>
              <h2 className={`font-serif text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                Live Order Slip
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                <Store className="w-3 h-3 text-amber-500" />
                <span>{activeBranchObject.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastCompletedKOT && (
                <button
                  type="button"
                  onClick={() => setActiveKOTModal(lastCompletedKOT)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[11px] font-bold transition-all cursor-pointer"
                  title="Reprint / View Last KOT Ticket"
                >
                  <Printer className="w-3 h-3" />
                  <span>KOT #{lastCompletedKOT.kot_number}</span>
                </button>
              )}
              <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 font-extrabold">
                {cart.reduce((s, i) => s + i.qty, 0)} Items
              </span>
            </div>
          </div>

          {/* QUICK TABLE SELECTOR STRIP */}
          {branchTables.length > 0 && (
            <div className="pt-2 shrink-0">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                <span>Select Dining Table</span>
                <span className="text-gray-400 font-normal">Direct floor allocation</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                {branchTables.map((t) => {
                  const isSelected = tableNumber === t.table_number;
                  const isVacant = t.status === "vacant";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTableNumber(t.table_number);
                        setOrderType("dine-in");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-amber-500 text-black border-amber-500 font-black shadow-sm"
                          : isVacant
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isVacant ? "bg-emerald-400" : "bg-amber-400"}`} />
                      <span>{t.table_number}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TABLE & DINING SELECTION */}
          <div className="grid grid-cols-2 gap-2.5 my-3 shrink-0">
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">
                Table / Identifier
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. Table 4, Counter"
                className={`w-full rounded-xl px-3 py-1.5 text-xs border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-black/40 border-white/10 text-white"
                }`}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">
                Dining Type
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className={`w-full rounded-xl px-2.5 py-1.5 text-xs border outline-none font-bold ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-black/40 border-white/10 text-white"
                }`}
              >
                <option value="dine-in">Dine-In</option>
                <option value="takeaway">Takeaway / Parcel</option>
                <option value="delivery">Highway Delivery</option>
              </select>
            </div>
          </div>

          {/* TICKET ITEMS LIST */}
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1 my-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-10">
                <Utensils className="w-8 h-8 mb-2 text-gray-400" />
                <p className="text-xs">Slip is currently empty.</p>
                <p className="text-[11px] mt-1 text-gray-400">Click dishes on the left to add items.</p>
              </div>
            ) : cart.map((item, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-center p-2.5 rounded-xl border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.02] border-white/5"
                }`}
              >
                <div className="flex-1 pr-3">
                  <p className={`font-semibold text-xs line-clamp-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                    {item.dish.name}
                  </p>
                  <p className={`text-[10px] ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                    {inr(item.dish.price)} each
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className={`flex items-center rounded-lg border ${
                    isLight ? "bg-white border-slate-200 shadow-2xs" : "bg-black/40 border-white/10"
                  }`}>
                    <button 
                      onClick={() => updateQty(item.dish.id, -1)} 
                      className="px-2 py-0.5 text-xs font-bold text-gray-400 hover:text-white"
                    >
                      -
                    </button>
                    <span className="text-xs font-mono font-bold w-4 text-center">
                      {item.qty}
                    </span>
                    <button 
                      onClick={() => updateQty(item.dish.id, 1)} 
                      style={{ color: themeConfig.primary }}
                      className="px-2 py-0.5 text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                  <p className="font-serif text-xs w-14 text-right font-bold" style={{ color: themeConfig.primary }}>
                    {inr(item.dish.price * item.qty)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* KITCHEN SPECIAL INSTRUCTION */}
          <div className="mt-2 shrink-0">
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Special instructions (e.g. Less spicy, extra onions)..."
              className={`w-full rounded-xl px-3 py-1.5 text-xs border outline-none ${
                isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-black/30 border-white/10 text-white"
              }`}
            />
          </div>
          
          {/* TOTAL & PROCESS BUTTON */}
          <div className={`pt-3 border-t mt-3 shrink-0 ${isLight ? "border-slate-200" : "border-white/10"}`}>
            <div className="flex justify-between items-center mb-3">
              <span className={`uppercase tracking-wider text-[11px] font-bold ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                Total Payable
              </span>
              <span className="font-serif text-2xl font-bold" style={{ color: themeConfig.primary }}>
                {inr(currentTotal)}
              </span>
            </div>
            <button 
              onClick={syncLedger} 
              disabled={cart.length === 0 || loading} 
              style={{ backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent }}
              className="w-full rounded-xl py-3 text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{online ? "Send Order to Kitchen" : "Queue Offline Order"}</span>
                </>
              )}
            </button>
          </div>
        </Glass>
      </div>

      {/* KOT Thermal Print Slip Modal */}
      {activeKOTModal && (
        <KOTThermalInvoice
          ticket={activeKOTModal}
          onClose={() => setActiveKOTModal(null)}
          branchId={activeBranchId}
        />
      )}
    </div>
  );
}