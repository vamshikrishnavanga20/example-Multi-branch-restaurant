'use client';

import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine, LineChart, Line, Legend, PieChart, Pie, Cell
} from "recharts";
import {
  IndianRupee, ShoppingCart, Users, TrendingUp, Activity, BarChart2, Wallet, Target, Filter, Check, Calendar,
  Star, HelpCircle, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, Sparkles, Building2
} from "lucide-react";
import { Dish } from "@/types";
import { inr, CHART_COLORS } from "@/lib/utils";
import { Glass, StatCard, PageHead, Odometer } from "@/components/ui/Primitives";
import { useTheme } from "@/lib/theme-context";

type TimeframeOption = 'today' | '7d' | '30d' | 'custom';
type TabOption = 'revenue' | 'dishes' | 'engineering' | 'franchises';
type QuadrantFilter = 'all' | 'star' | 'plowhorse' | 'puzzle' | 'dog';

const QUADRANT_CONFIG = {
  star: {
    label: "Stars",
    icon: Star,
    color: "#10B981",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    textColor: "text-emerald-400",
    tagline: "High Volume • High Profit",
    recommendation: "Crown Jewels: Maintain strict recipe consistency and feature as signature highway recommendations."
  },
  plowhorse: {
    label: "Plowhorses",
    icon: Activity,
    color: "#3B82F6",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    textColor: "text-blue-400",
    tagline: "High Volume • Modest Margin",
    recommendation: "Volume Drivers: Consider +5-8% price revision or recipe cost re-engineering to capture margin."
  },
  puzzle: {
    label: "Puzzles",
    icon: HelpCircle,
    color: "#F59E0B",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    textColor: "text-amber-400",
    tagline: "Low Volume • High Profit",
    recommendation: "Untapped Potential: Coach waitstaff on proactive verbal upselling and feature in combo bundles."
  },
  dog: {
    label: "Dogs",
    icon: AlertTriangle,
    color: "#EF4444",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    textColor: "text-rose-400",
    tagline: "Low Volume • Low Profit",
    recommendation: "Audit Candidates: Review prep spoilage, rotate into seasonal specials, or replace with high-margin items."
  }
};

export default function OverviewView({
  dishes = [],
  ledger = [],
  categories = [],
  branches = [],
  selectedBranch = "ALL",
  onSelectBranch,
  isSuperAdmin = true,
}: any) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === 'light';
  const [activeTab, setActiveTab] = useState<TabOption>('revenue');

  // Temporal Horizon State
  const [timeframe, setTimeframe] = useState<TimeframeOption>('today');
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Executive Perspectives
  const [financialMode, setFinancialMode] = useState<'gross' | 'net'>('gross');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [revChartPerspective, setRevChartPerspective] = useState<'timeline' | 'branches'>('timeline');

  // Dish Deep Dive State
  const [dChartMode, setDChartMode] = useState<'revenue' | 'volume'>('revenue');
  const [dActiveCat, setDActiveCat] = useState<string>("top");
  const [dSelectedDishes, setDSelectedDishes] = useState<string[]>([]);

  // Menu Engineering Interactive Filter
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantFilter>('all');

  // 1. Current Period Filter (with multi-branch scoping)
  const filteredLedger = useMemo(() => {
    const safeLedger = ledger || [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return safeLedger.filter((entry: any) => {
      if (!entry?.created_at) return false;
      if (entry.status === 'cancelled') return false; // Strictly exclude cancelled orders from active business revenue

      // Scoped branch filter
      if (selectedBranch && selectedBranch !== "ALL") {
        const entryBranch = entry.branch_id || "branch-hyderabad-hq";
        if (entryBranch !== selectedBranch) return false;
      }

      const t = new Date(entry.created_at).getTime();
      if (timeframe === 'today') return t >= startOfToday;
      if (timeframe === '7d') return t >= now.getTime() - (7 * 86400000);
      if (timeframe === '30d') return t >= now.getTime() - (30 * 86400000);
      if (timeframe === 'custom' && customStart && customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        return t >= new Date(customStart).getTime() && t <= end.getTime();
      }
      return true;
    });
  }, [ledger, timeframe, customStart, customEnd, selectedBranch]);

  // 2. In-Memory Prior Equivalent Period Filter (Zero Database Calls)
  const priorLedger = useMemo(() => {
    const safeLedger = ledger || [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return safeLedger.filter((entry: any) => {
      if (!entry?.created_at) return false;
      if (entry.status === 'cancelled') return false; // Exclude cancelled orders from baseline comparisons

      // Scoped branch filter
      if (selectedBranch && selectedBranch !== "ALL") {
        const entryBranch = entry.branch_id || "branch-hyderabad-hq";
        if (entryBranch !== selectedBranch) return false;
      }

      const t = new Date(entry.created_at).getTime();

      if (timeframe === 'today') {
        return t >= startOfToday - 86400000 && t < startOfToday;
      }
      if (timeframe === '7d') {
        const currentStart = now.getTime() - (7 * 86400000);
        const priorStart = now.getTime() - (14 * 86400000);
        return t >= priorStart && t < currentStart;
      }
      if (timeframe === '30d') {
        const currentStart = now.getTime() - (30 * 86400000);
        const priorStart = now.getTime() - (60 * 86400000);
        return t >= priorStart && t < currentStart;
      }
      if (timeframe === 'custom' && customStart && customEnd) {
        const start = new Date(customStart).getTime();
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        const span = Math.max(end.getTime() - start, 86400000);
        return t >= (start - span) && t < start;
      }
      return false;
    });
  }, [ledger, timeframe, customStart, customEnd, selectedBranch]);

  // Enterprise Cross-Branch Performance & Top/Least Selling Dish Analysis
  const branchDishAnalysis = useMemo(() => {
    const map: Record<string, Record<string, { id: string; name: string; volume: number; revenue: number }>> = {};

    branches.forEach((b: any) => {
      map[b.id] = {};
    });
    if (!map["branch-hyderabad-hq"]) map["branch-hyderabad-hq"] = {};

    const activeLedger = (ledger || []).filter((entry: any) => entry.status !== 'cancelled');
    activeLedger.forEach((entry: any) => {
      const bId = entry.branch_id || "branch-hyderabad-hq";
      if (!map[bId]) map[bId] = {};

      if (Array.isArray(entry.items) && entry.items.length > 0) {
        entry.items.forEach((item: any) => {
          const id = item.menu_item_id || item.id;
          if (!id) return;
          if (!map[bId][id]) {
            map[bId][id] = { id, name: item.name || dishes.find((d: any) => d.id === id)?.name || "Dish", volume: 0, revenue: 0 };
          }
          map[bId][id].volume += Number(item.quantity || 1);
          map[bId][id].revenue += Number(item.price ? item.price * (item.quantity || 1) : (item.total_price || 0));
        });
      } else if (entry.menu_item_id) {
        const id = entry.menu_item_id;
        if (!map[bId][id]) {
          map[bId][id] = { id, name: entry.menu_items?.name || dishes.find((d: any) => d.id === id)?.name || "Dish", volume: 0, revenue: 0 };
        }
        map[bId][id].volume += Number(entry.quantity || 1);
        map[bId][id].revenue += Number(entry.total_price || 0);
      }
    });

    const activeBranches = branches.length > 0 ? branches : [{ id: "branch-hyderabad-hq", name: "Hyderabad Highway HQ", city: "Hyderabad" }];

    return activeBranches.map((b: any) => {
      const dishList = Object.values(map[b.id] || {}).sort((x, y) => y.volume - x.volume);
      const topDish = dishList.length > 0 ? dishList[0] : null;
      const leastDish = dishList.length > 1 ? dishList[dishList.length - 1] : null;
      const totalRev = dishList.reduce((s, d) => s + d.revenue, 0);
      const totalVol = dishList.reduce((s, d) => s + d.volume, 0);

      return {
        ...b,
        topDish,
        leastDish,
        totalRevenue: totalRev,
        totalVolume: totalVol,
      };
    }).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
  }, [branches, ledger, dishes]);

  // Global HQ: Multi-Branch Revenue Breakdown & Combined Network Aggregates
  const branchRevenueSummary = useMemo(() => {
    const safeLedger = ledger || [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Temporal Filter
    const timeFiltered = safeLedger.filter((entry: any) => {
      if (!entry?.created_at) return false;
      if (entry.status === 'cancelled') return false; // Exclude cancelled orders from franchise revenue
      const t = new Date(entry.created_at).getTime();
      if (timeframe === 'today') return t >= startOfToday;
      if (timeframe === '7d') return t >= now.getTime() - (7 * 86400000);
      if (timeframe === '30d') return t >= now.getTime() - (30 * 86400000);
      if (timeframe === 'custom' && customStart && customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        return t >= new Date(customStart).getTime() && t <= end.getTime();
      }
      return true;
    });

    const branchMap: Record<string, {
      id: string;
      name: string;
      code: string;
      city: string;
      grossRevenue: number;
      netMargin: number;
      orderCount: number;
      itemVolume: number;
      ordersSet: Set<string>;
    }> = {};

    (branches || []).forEach((b: any) => {
      branchMap[b.id] = {
        id: b.id,
        name: b.name || b.id,
        code: b.code || b.name?.slice(0, 3).toUpperCase() || 'BR',
        city: b.city || 'Headquarters',
        grossRevenue: 0,
        netMargin: 0,
        orderCount: 0,
        itemVolume: 0,
        ordersSet: new Set(),
      };
    });

    if (!branchMap["branch-hyderabad-hq"]) {
      branchMap["branch-hyderabad-hq"] = {
        id: "branch-hyderabad-hq",
        name: "Hyderabad Highway HQ",
        code: "HYD-01",
        city: "Hyderabad",
        grossRevenue: 0,
        netMargin: 0,
        orderCount: 0,
        itemVolume: 0,
        ordersSet: new Set(),
      };
    }

    timeFiltered.forEach((entry: any) => {
      const bId = entry.branch_id || "branch-hyderabad-hq";
      if (!branchMap[bId]) {
        branchMap[bId] = {
          id: bId,
          name: entry.branch_name || bId,
          code: bId.slice(0, 6).toUpperCase(),
          city: "Location",
          grossRevenue: 0,
          netMargin: 0,
          orderCount: 0,
          itemVolume: 0,
          ordersSet: new Set(),
        };
      }

      const gross = Number(entry.total_price ?? entry.total_amount ?? 0);
      const net = Number(entry.net_profit ?? gross);
      const qty = Number(entry.quantity || 1);
      const orderKey = entry.order_id || entry.client_order_id || entry.id;

      branchMap[bId].grossRevenue += gross;
      branchMap[bId].netMargin += net;
      branchMap[bId].itemVolume += qty;
      if (orderKey) branchMap[bId].ordersSet.add(orderKey);
    });

    const branchList = Object.values(branchMap).map((b) => ({
      ...b,
      orderCount: b.ordersSet.size > 0 ? b.ordersSet.size : Math.round(b.itemVolume > 0 ? b.itemVolume / 2 : 0),
    }));

    const totalNetworkGross = branchList.reduce((acc, b) => acc + b.grossRevenue, 0);
    const totalNetworkNet = branchList.reduce((acc, b) => acc + b.netMargin, 0);
    const totalNetworkOrders = branchList.reduce((acc, b) => acc + b.orderCount, 0);
    const totalNetworkVolume = branchList.reduce((acc, b) => acc + b.itemVolume, 0);

    const enrichedBranches = branchList.map((b) => ({
      ...b,
      revenueShare: totalNetworkGross > 0 ? Math.round((b.grossRevenue / totalNetworkGross) * 100) : 0,
    })).sort((a, b) => b.grossRevenue - a.grossRevenue);

    const hqBranch = enrichedBranches.find((b: any) => b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01') || {
      id: 'branch-hyderabad-hq',
      name: 'Hyderabad Highway HQ',
      code: 'HYD-01',
      city: 'Hyderabad',
      grossRevenue: 0,
      netMargin: 0,
      orderCount: 0,
      itemVolume: 0,
      revenueShare: 0,
    };

    return {
      branches: enrichedBranches,
      hqBranch,
      hqGross: hqBranch.grossRevenue,
      hqNet: hqBranch.netMargin,
      hqOrders: hqBranch.orderCount,
      hqShare: hqBranch.revenueShare,
      combinedGross: totalNetworkGross,
      combinedNet: totalNetworkNet,
      combinedOrders: totalNetworkOrders,
      combinedVolume: totalNetworkVolume,
      activeBranchCount: enrichedBranches.length,
    };
  }, [ledger, branches, timeframe, customStart, customEnd]);

  // Branch comparison chart data for visual bar breakdown
  const branchComparisonChartData = useMemo(() => {
    return branchRevenueSummary.branches.map(b => ({
      name: b.code || b.name,
      fullName: b.name,
      city: b.city,
      Metric: financialMode === 'gross' ? b.grossRevenue : b.netMargin,
      Orders: b.orderCount,
      Share: b.revenueShare,
    }));
  }, [branchRevenueSummary, financialMode]);

  // 3. Current & Prior Period KPI Computations
  const kpis = useMemo(() => {
    const valid = filteredLedger.filter((c: any) => c.status !== 'cancelled');
    const uniqueOrders = new Set(valid.map((c: any) => c.order_id || c.client_order_id || c.id)).size;
    return {
      gross: valid.reduce((acc: number, c: any) => acc + Number(c.total_price ?? c.total_amount ?? 0), 0),
      net: valid.reduce((acc: number, c: any) => acc + Number(c.net_profit ?? c.total_price ?? c.total_amount ?? 0), 0),
      volume: valid.reduce((acc: number, c: any) => {
        if (c.quantity !== undefined && c.quantity !== null && !Array.isArray(c.items)) return acc + Number(c.quantity);
        if (Array.isArray(c.items) && c.items.length > 0) {
          return acc + c.items.reduce((s: number, i: any) => s + Number(i.quantity || 1), 0);
        }
        return acc + Number(c.quantity || 1);
      }, 0),
      orders: uniqueOrders > 0 ? uniqueOrders : valid.length
    };
  }, [filteredLedger]);

  const priorKpis = useMemo(() => {
    const valid = priorLedger.filter((c: any) => c.status !== 'cancelled');
    const uniqueOrders = new Set(valid.map((c: any) => c.order_id || c.client_order_id || c.id)).size;
    const gross = valid.reduce((acc: number, c: any) => acc + Number(c.total_price ?? c.total_amount ?? 0), 0);
    const net = valid.reduce((acc: number, c: any) => acc + Number(c.net_profit ?? c.total_price ?? c.total_amount ?? 0), 0);
    const volume = valid.reduce((acc: number, c: any) => {
      if (c.quantity !== undefined && c.quantity !== null && !Array.isArray(c.items)) return acc + Number(c.quantity);
      if (Array.isArray(c.items) && c.items.length > 0) {
        return acc + c.items.reduce((s: number, i: any) => s + Number(i.quantity || 1), 0);
      }
      return acc + Number(c.quantity || 1);
    }, 0);
    const orders = uniqueOrders > 0 ? uniqueOrders : valid.length;
    const metric = financialMode === 'gross' ? gross : net;
    const avgTicket = orders > 0 ? Math.round(metric / orders) : 0;
    return { gross, net, volume, orders, metric, avgTicket };
  }, [priorLedger, financialMode]);

  const displayMetric = financialMode === 'gross' ? kpis.gross : kpis.net;
  const avgTicket = kpis.orders > 0 ? Math.round(displayMetric / kpis.orders) : 0;

  // Comparison Label
  const deltaLabel = useMemo(() => {
    if (timeframe === 'today') return "vs. yesterday";
    if (timeframe === '7d') return "vs. prev 7d";
    if (timeframe === '30d') return "vs. prev 30d";
    return "vs. prev period";
  }, [timeframe]);

  // Helper for computing delta badges
  const computeDelta = (curr: number, prev: number) => {
    if (prev === 0) {
      if (curr === 0) return { percent: 0, isPositive: true, label: deltaLabel };
      return { percent: 100, isPositive: true, label: deltaLabel };
    }
    const diff = curr - prev;
    const pct = Math.round((diff / prev) * 1000) / 10;
    return {
      percent: Math.abs(pct),
      isPositive: pct >= 0,
      label: deltaLabel
    };
  };

  const revenueDelta = computeDelta(displayMetric, priorKpis.metric);
  const ordersDelta = computeDelta(kpis.orders, priorKpis.orders);
  const volumeDelta = computeDelta(kpis.volume, priorKpis.volume);
  const ticketDelta = computeDelta(avgTicket, priorKpis.avgTicket);

  // 4. Bulletproof Zero-Filled Timeline Generator with Sparkline Vectors
  const revenueTimeline = useMemo(() => {
    const bucket: Record<string, { label: string; Metric: number; orders: number; volume: number; sortIdx: number }> = {};
    let sortIndex = 0;

    if (timeframe === 'today') {
      for (let h = 6; h <= 23; h++) {
        const key = `${h.toString().padStart(2, '0')}:00`;
        bucket[key] = { label: key, Metric: 0, orders: 0, volume: 0, sortIdx: sortIndex++ };
      }
    } else if (timeframe === '7d' || timeframe === '30d') {
      const days = timeframe === '7d' ? 6 : 29;
      for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, Metric: 0, orders: 0, volume: 0, sortIdx: sortIndex++ };
      }
    } else if (timeframe === 'custom' && customStart && customEnd) {
      let curr = new Date(customStart);
      const end = new Date(customEnd);
      while (curr <= end) {
        const key = curr.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, Metric: 0, orders: 0, volume: 0, sortIdx: sortIndex++ };
        curr.setDate(curr.getDate() + 1);
      }
    }

    filteredLedger.forEach((entry: any) => {
      const d = new Date(entry.created_at);
      const key = timeframe === 'today'
        ? `${d.getHours().toString().padStart(2, '0')}:00`
        : d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });

      if (bucket[key]) {
        const rev = Number(entry.total_price ?? entry.total_amount ?? 0);
        const profit = Number(entry.net_profit ?? rev);
        const vol = entry.quantity !== undefined && entry.quantity !== null && !Array.isArray(entry.items)
          ? Number(entry.quantity)
          : (Array.isArray(entry.items) && entry.items.length > 0 ? entry.items.reduce((s: number, i: any) => s + Number(i.quantity || 1), 0) : Number(entry.quantity || 1));

        bucket[key].Metric += financialMode === 'gross' ? rev : profit;
        bucket[key].orders += 1;
        bucket[key].volume += vol;
      }
    });

    return Object.values(bucket).sort((a, b) => a.sortIdx - b.sortIdx);
  }, [filteredLedger, timeframe, financialMode, customStart, customEnd]);

  // Sparkline arrays
  const sparklineRevenue = useMemo(() => revenueTimeline.map(b => b.Metric), [revenueTimeline]);
  const sparklineOrders = useMemo(() => revenueTimeline.map(b => b.orders), [revenueTimeline]);
  const sparklineVolume = useMemo(() => revenueTimeline.map(b => b.volume), [revenueTimeline]);
  const sparklineAvgTicket = useMemo(() => revenueTimeline.map(b => b.orders > 0 ? Math.round(b.Metric / b.orders) : 0), [revenueTimeline]);

  // 5. BCG Menu Engineering Matrix Data Aggregator
  const bcgMatrixData = useMemo(() => {
    const stats: Record<string, {
      id: string;
      name: string;
      categoryId?: string;
      volume: number;
      profit: number;
      gross: number;
    }> = {};

    const addItemStat = (id: string, name: string, categoryId: string | undefined, qty: number, grossVal: number, profitVal: number) => {
      if (!id) return;
      if (!stats[id]) {
        stats[id] = {
          id,
          name: name || (dishes.find((d: any) => d.id === id)?.name) || 'Unknown Item',
          categoryId: categoryId || (dishes || []).find((d: any) => d.id === id)?.category_id,
          volume: 0,
          profit: 0,
          gross: 0
        };
      }
      stats[id].volume += qty;
      stats[id].profit += profitVal;
      stats[id].gross += grossVal;
    };

    filteredLedger.forEach((entry: any) => {
      if (Array.isArray(entry.items) && entry.items.length > 0) {
        entry.items.forEach((item: any) => {
          const itemId = item.menu_item_id || item.id;
          const qty = Number(item.quantity || 1);
          const grossVal = Number(item.price ? item.price * qty : (item.total_price || 0));
          const profitVal = Number(item.net_profit ?? grossVal);
          addItemStat(itemId, item.name, item.category_id, qty, grossVal, profitVal);
        });
      } else if (entry.menu_item_id) {
        const qty = Number(entry.quantity || 1);
        const grossVal = Number(entry.total_price ?? entry.total_amount ?? 0);
        const profitVal = Number(entry.net_profit ?? grossVal);
        const name = entry.menu_items?.name || (dishes.find((d: any) => d.id === entry.menu_item_id)?.name);
        const categoryId = entry.menu_items?.category_id || (dishes.find((d: any) => d.id === entry.menu_item_id)?.category_id);
        addItemStat(entry.menu_item_id, name, categoryId, qty, grossVal, profitVal);
      }
    });

    const data = Object.values(stats);
    const avgVolume = data.length ? Math.round(data.reduce((acc, curr) => acc + curr.volume, 0) / data.length) : 0;
    const avgProfit = data.length ? Math.round(data.reduce((acc, curr) => acc + curr.profit, 0) / data.length) : 0;

    return { data, avgVolume, avgProfit };
  }, [filteredLedger, dishes]);

  // Classify each dish into BCG quadrants
  const classifiedDishes = useMemo(() => {
    const { data, avgVolume, avgProfit } = bcgMatrixData;
    return data.map(item => {
      const isHighVolume = item.volume >= avgVolume;
      const isHighProfit = item.profit >= avgProfit;

      let quadrant: 'star' | 'plowhorse' | 'puzzle' | 'dog';
      if (isHighVolume && isHighProfit) quadrant = 'star';
      else if (isHighVolume && !isHighProfit) quadrant = 'plowhorse';
      else if (!isHighVolume && isHighProfit) quadrant = 'puzzle';
      else quadrant = 'dog';

      const marginPercent = item.gross > 0 ? Math.round((item.profit / item.gross) * 100) : 0;

      return {
        ...item,
        quadrant,
        marginPercent
      };
    });
  }, [bcgMatrixData]);

  // Quadrant breakdown statistics
  const quadrantStats = useMemo(() => {
    const counts = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
    const revenue = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };

    classifiedDishes.forEach(d => {
      counts[d.quadrant] += 1;
      revenue[d.quadrant] += d.gross;
    });

    return { counts, revenue };
  }, [classifiedDishes]);

  // Filtered dishes for the BCG table based on active quadrant filter
  const displayedBcgDishes = useMemo(() => {
    if (selectedQuadrant === 'all') return classifiedDishes;
    return classifiedDishes.filter(d => d.quadrant === selectedQuadrant);
  }, [classifiedDishes, selectedQuadrant]);

  // Top dishes for quick selection
  const top5Dishes = useMemo(() => {
    return [...bcgMatrixData.data]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map(item => (dishes || []).find((d: any) => d.name === item.name || d.id === item.id))
      .filter(Boolean) as Dish[];
  }, [bcgMatrixData.data, dishes]);

  const displayedDishes = dActiveCat === "top" ? top5Dishes : (dishes || []).filter((d: any) => d.category_id === dActiveCat);

  // 6. Dish Specific Comparative Timeline
  const dishTimeline = useMemo(() => {
    const bucket: Record<string, any> = {};
    let sortIndex = 0;

    if (timeframe === 'today') {
      for (let h = 6; h <= 23; h++) {
        const key = `${h.toString().padStart(2, '0')}:00`;
        bucket[key] = { label: key, sortIdx: sortIndex++ };
        dSelectedDishes.forEach(id => { const d = dishes.find((ds: any) => ds.id === id); if (d) bucket[key][d.name] = 0; });
      }
    } else if (timeframe === '7d' || timeframe === '30d') {
      const days = timeframe === '7d' ? 6 : 29;
      for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, sortIdx: sortIndex++ };
        dSelectedDishes.forEach(id => { const dish = dishes.find((ds: any) => ds.id === id); if (dish) bucket[key][dish.name] = 0; });
      }
    } else if (timeframe === 'custom' && customStart && customEnd) {
      let curr = new Date(customStart);
      const end = new Date(customEnd);
      while (curr <= end) {
        const key = curr.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, sortIdx: sortIndex++ };
        dSelectedDishes.forEach(id => { const dish = dishes.find((ds: any) => ds.id === id); if (dish) bucket[key][dish.name] = 0; });
        curr.setDate(curr.getDate() + 1);
      }
    }

    filteredLedger.forEach((entry: any) => {
      const d = new Date(entry.created_at);
      const key = timeframe === 'today' ? `${d.getHours().toString().padStart(2, '0')}:00` : d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });

      if (!bucket[key]) return;

      if (Array.isArray(entry.items) && entry.items.length > 0) {
        entry.items.forEach((item: any) => {
          const itemId = item.menu_item_id || item.id;
          if (dSelectedDishes.includes(itemId)) {
            const dishName = item.name || dishes.find((ds: any) => ds.id === itemId)?.name || "Unknown";
            const qty = Number(item.quantity || 1);
            const val = dChartMode === 'revenue' ? Number(item.price ? item.price * qty : (item.total_price || 0)) : qty;
            bucket[key][dishName] = (bucket[key][dishName] || 0) + val;
          }
        });
      } else if (entry.menu_item_id && dSelectedDishes.includes(entry.menu_item_id)) {
        const dishName = entry.menu_items?.name || dishes.find((item: any) => item.id === entry.menu_item_id)?.name || "Unknown";
        const val = dChartMode === 'revenue'
          ? (financialMode === 'gross' ? Number(entry.total_price ?? entry.total_amount ?? 0) : Number(entry.net_profit ?? entry.total_price ?? entry.total_amount ?? 0))
          : Number(entry.quantity || 1);
        bucket[key][dishName] = (bucket[key][dishName] || 0) + val;
      }
    });

    return Object.values(bucket).sort((a: any, b: any) => a.sortIdx - b.sortIdx);
  }, [filteredLedger, timeframe, dSelectedDishes, dChartMode, dishes, financialMode, customStart, customEnd]);

  // 7. Category Distribution
  const categoryDistribution = useMemo(() => {
    const stats: Record<string, { name: string, value: number }> = {};
    bcgMatrixData.data.forEach(item => {
      const catId = item.categoryId || 'unknown';
      const catName = categories.find((c: any) => c.id === catId)?.name || 'Chef Specials';
      if (!stats[catId]) stats[catId] = { name: catName, value: 0 };
      stats[catId].value += financialMode === 'gross' ? item.gross : item.profit;
    });
    return Object.values(stats).sort((a, b) => b.value - a.value);
  }, [bcgMatrixData, categories, financialMode]);

  // 8. Item Velocity with Relative Volume Share
  const itemVelocity = useMemo(() => {
    const sorted = [...bcgMatrixData.data].sort((a, b) => b.volume - a.volume).slice(0, 10);
    const maxVolume = sorted.length > 0 ? sorted[0].volume : 1;
    return sorted.map(item => ({
      ...item,
      relativeShare: Math.min(100, Math.round((item.volume / maxVolume) * 100))
    }));
  }, [bcgMatrixData]);

  // Custom Luxury Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`${isLight ? 'bg-white border-slate-200 shadow-2xl' : 'bg-[#101014]/95 border-white/10 shadow-2xl'} backdrop-blur-xl border p-3.5 rounded-2xl min-w-[160px] z-50`}>
          <p className={`${isLight ? 'text-slate-400 border-slate-100' : 'text-white/40 border-white/[0.08]'} text-[10px] font-bold uppercase tracking-widest mb-2 border-b pb-1.5`}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 py-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className={`${isLight ? 'text-slate-700' : 'text-white/80'} text-xs font-medium truncate`}>{entry.name}</span>
              </div>
              <span className={`${isLight ? 'text-slate-900' : 'text-white'} font-mono font-bold text-xs shrink-0`}>
                {activeTab === 'dishes' ? (dChartMode === 'revenue' ? inr(entry.value) : `${entry.value} units`) : inr(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-16">

      {/* Executive Command Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} pb-6`}>
        <div>
          <PageHead eyebrow="Executive Suite • Telemetry" title="Operations Command Center" />
          <p className={`text-xs ${isLight ? 'text-slate-600 font-medium' : 'text-white/50'} mt-1`}>Real-time financial performance, item velocity, and strategic menu engineering matrix.</p>
        </div>

        {/* Real-time sync badge (indicates connection to waiter app) */}
        <div className={`flex items-center gap-2 self-start md:self-center px-3 py-1.5 rounded-full ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/[0.03] border-white/[0.08]'}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className={`text-[11px] font-medium ${isLight ? 'text-slate-700' : 'text-white/70'}`}>Terminal Connected</span>
        </div>
      </div>

      {/* Active Branch Scoped Banner */}
      {selectedBranch && selectedBranch !== "ALL" && (
        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-sm' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold">
                Scoped to Franchise: <span className="font-extrabold underline">{branches.find((b: any) => b.id === selectedBranch)?.name || selectedBranch}</span>
              </p>
              <p className={`text-[11px] ${isLight ? 'text-amber-800/70' : 'text-amber-300/60'}`}>All KPIs, item sales, and financial trajectories reflect this branch location only.</p>
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

      {/* Executive KPI Grid with Dynamic Period Deltas & Inline Sparklines */}
      <div className={`grid gap-4 ${selectedBranch === 'ALL' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        <StatCard
          icon={financialMode === 'gross' ? IndianRupee : Wallet}
          label={
            selectedBranch === "ALL"
              ? (financialMode === 'gross' ? "🌐 All Branches Combined Revenue" : "🌐 Combined Net Margin")
              : (financialMode === 'gross' ? "Gross Branch Revenue" : "Net Branch Margin")
          }
          value={inr(displayMetric)}
          delta={revenueDelta}
          sparkline={sparklineRevenue}
          accent="gold"
        />

        {selectedBranch === "ALL" ? (
          <StatCard
            icon={Building2}
            label={financialMode === 'gross' ? "🏛️ Owner's HQ Revenue" : "🏛️ HQ Net Margin"}
            value={inr(financialMode === 'gross' ? branchRevenueSummary.hqGross : branchRevenueSummary.hqNet)}
            delta={{ percent: branchRevenueSummary.hqShare, isPositive: true, label: `${branchRevenueSummary.hqShare}% of network` }}
            sparkline={sparklineRevenue}
            accent="emerald"
          />
        ) : (
          <StatCard
            icon={Building2}
            label="Owner's HQ Benchmark"
            value={inr(financialMode === 'gross' ? branchRevenueSummary.hqGross : branchRevenueSummary.hqNet)}
            delta={{ percent: branchRevenueSummary.hqShare, isPositive: true, label: `HQ Share ${branchRevenueSummary.hqShare}%` }}
            sparkline={sparklineRevenue}
            accent="blue"
          />
        )}

        <StatCard
          icon={ShoppingCart}
          label={selectedBranch === "ALL" ? "Combined Network Orders" : "Orders Fulfilled"}
          value={(selectedBranch === "ALL" ? branchRevenueSummary.combinedOrders : kpis.orders).toLocaleString()}
          delta={ordersDelta}
          sparkline={sparklineOrders}
          accent="blue"
        />
        <StatCard
          icon={Users}
          label={selectedBranch === "ALL" ? "Combined Items Sold" : "Items Sold"}
          value={kpis.volume.toLocaleString()}
          delta={volumeDelta}
          sparkline={sparklineVolume}
          accent="purple"
        />
        <StatCard
          icon={TrendingUp}
          label="Average Ticket"
          value={inr(avgTicket)}
          delta={ticketDelta}
          sparkline={sparklineAvgTicket}
          accent="gold"
        />
      </div>

      {/* GLOBAL HQ MULTI-BRANCH REVENUE COMMAND CENTER */}
      {isSuperAdmin && (
        <Glass className="p-6 shadow-2xl relative overflow-hidden">
          {/* Subtle gold decorative glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} pb-4`}>
            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: themeConfig.light, color: themeConfig.primary, borderColor: themeConfig.border }}
                className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm"
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-serif text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Global HQ Multi-Branch Revenue Matrix
                  </h3>
                  <span className="text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Telemetry
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/50'} mt-0.5`}>
                  Consolidated revenue stream and live financial contribution across all {branchRevenueSummary.activeBranchCount} franchise locations • {timeframe === 'today' ? 'Today' : timeframe === '7d' ? 'Last 7 Days' : timeframe === '30d' ? 'Last 30 Days' : 'Custom Range'}
                </p>
              </div>
            </div>

            {/* Quick Scope Toggle Buttons */}
            {onSelectBranch && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onSelectBranch("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    selectedBranch === "ALL"
                      ? 'bg-amber-500 text-black border-amber-500 shadow-md font-extrabold'
                      : isLight ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100' : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                  }`}
                >
                  🌐 Combined Network (<Odometer value={inr(financialMode === 'gross' ? branchRevenueSummary.combinedGross : branchRevenueSummary.combinedNet)} />)
                </button>
              </div>
            )}
          </div>

          {/* Network-wide Headline Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className={`p-4 rounded-2xl border ${isLight ? 'bg-amber-50/60 border-amber-200/80' : 'bg-amber-500/10 border-amber-500/20'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-amber-800' : 'text-amber-300/80'}`}>
                🌐 Combined Network Revenue
              </span>
              <p className={`text-xl lg:text-2xl font-black font-mono mt-1 ${isLight ? 'text-amber-950' : 'text-amber-300'}`}>
                <Odometer value={inr(financialMode === 'gross' ? branchRevenueSummary.combinedGross : branchRevenueSummary.combinedNet)} />
              </p>
              <span className={`text-[10px] ${isLight ? 'text-amber-700' : 'text-amber-400/60'} mt-0.5 block`}>
                All {branchRevenueSummary.activeBranchCount} locations combined
              </span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? 'bg-emerald-50/60 border-emerald-200/80' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-emerald-800' : 'text-emerald-300/80'}`}>
                🏛️ Owner's HQ Revenue
              </span>
              <p className={`text-xl lg:text-2xl font-black font-mono mt-1 ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                <Odometer value={inr(financialMode === 'gross' ? branchRevenueSummary.hqGross : branchRevenueSummary.hqNet)} />
              </p>
              <span className={`text-[10px] ${isLight ? 'text-emerald-700' : 'text-emerald-400/60'} mt-0.5 block`}>
                Hyderabad Highway HQ • {branchRevenueSummary.hqShare}% share
              </span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? 'bg-blue-50/60 border-blue-200/80' : 'bg-blue-500/10 border-blue-500/20'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-blue-800' : 'text-blue-300/80'}`}>
                🛍️ Total Network Orders
              </span>
              <p className={`text-xl lg:text-2xl font-black font-mono mt-1 ${isLight ? 'text-blue-950' : 'text-blue-300'}`}>
                <Odometer value={branchRevenueSummary.combinedOrders.toLocaleString()} />
              </p>
              <span className={`text-[10px] ${isLight ? 'text-blue-700' : 'text-blue-400/60'} mt-0.5 block`}>
                Across all branch terminals
              </span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? 'bg-indigo-50/60 border-indigo-200/80' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-indigo-800' : 'text-indigo-300/80'}`}>
                📦 Total Items Dispensed
              </span>
              <p className={`text-xl lg:text-2xl font-black font-mono mt-1 ${isLight ? 'text-indigo-950' : 'text-indigo-300'}`}>
                <Odometer value={branchRevenueSummary.combinedVolume.toLocaleString()} />
              </p>
              <span className={`text-[10px] ${isLight ? 'text-indigo-700' : 'text-indigo-400/60'} mt-0.5 block`}>
                Dishes prepared in kitchens
              </span>
            </div>

            <div className={`p-4 rounded-2xl border ${isLight ? 'bg-purple-50/60 border-purple-200/80' : 'bg-purple-500/10 border-purple-200/20'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-purple-800' : 'text-purple-300/80'}`}>
                🏢 Active Franchises
              </span>
              <p className={`text-xl lg:text-2xl font-black font-mono mt-1 ${isLight ? 'text-purple-950' : 'text-purple-300'}`}>
                <Odometer value={branchRevenueSummary.activeBranchCount} /> Outlets
              </p>
              <span className={`text-[10px] ${isLight ? 'text-purple-700' : 'text-purple-400/60'} mt-0.5 block`}>
                Operational network status
              </span>
            </div>
          </div>

          {/* Branch Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchRevenueSummary.branches.map((b, idx) => {
              const isSelected = selectedBranch === b.id;
              const isHq = b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01';
              const rankEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "📍";

              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border transition-all relative ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-lg ring-1 ring-amber-500/40'
                      : isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      : 'bg-black/40 border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{rankEmoji}</span>
                        <p className={`font-bold text-sm truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {b.name}
                        </p>
                      </div>
                      <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-white/40'} ml-5 truncate`}>
                        {b.city} • <span className="font-mono font-bold text-amber-500">{b.code}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {isHq ? (
                        <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                          🏛️ OWNER'S HQ
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                          🏪 FRANCHISE
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        {b.revenueShare}% Share
                      </span>
                    </div>
                  </div>

                  {/* Revenue Figure */}
                  <div className="mb-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {financialMode === 'gross' ? 'Gross Branch Revenue' : 'Net Branch Margin'}
                    </p>
                    <p className={`text-xl font-black font-mono mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      <Odometer value={inr(financialMode === 'gross' ? b.grossRevenue : b.netMargin)} />
                    </p>
                    <div className="flex items-center justify-between text-xs mt-1 text-slate-400 font-mono">
                      <span><Odometer value={b.orderCount} /> orders</span>
                      <span><Odometer value={b.itemVolume} /> items sold</span>
                    </div>
                  </div>

                  {/* Visual Contribution Bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={isLight ? 'text-slate-500' : 'text-white/40'}>Contribution to Network</span>
                      <span className="font-mono font-bold text-amber-400">{b.revenueShare}%</span>
                    </div>
                    <div className={`w-full ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'} rounded-full h-2 overflow-hidden`}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          background: 'linear-gradient(to right, #D4AF37, #10B981)',
                          width: `${Math.max(b.revenueShare, 2)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  {onSelectBranch && (
                    <button
                      onClick={() => onSelectBranch(isSelected ? 'ALL' : b.id)}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-black border-amber-500 font-extrabold'
                          : isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                      }`}
                    >
                      {isSelected ? '✓ Viewing This Branch Only' : `Scope Telemetry to ${b.code}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Glass>
      )}

      {/* Main Analytical Stage */}
      <Glass className="p-6 shadow-2xl flex flex-col">

        {/* Streamlined Executive Command Toolbar */}
        <div className={`flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-6 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.06]'} pb-5 shrink-0`}>

          {/* View Mode Navigation Pills */}
          <div className={`flex items-center rounded-2xl p-1 shadow-inner border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'}`}>
            <button
              onClick={() => setActiveTab('revenue')}
              style={activeTab === 'revenue' ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent, boxShadow: `0 4px 14px ${themeConfig.glow}` } : {}}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${activeTab === 'revenue' ? 'shadow-md font-bold' : isLight ? 'text-slate-600 hover:text-black' : 'text-white/60 hover:text-white'}`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Revenue Dynamics</span>
            </button>
            <button
              onClick={() => setActiveTab('dishes')}
              style={activeTab === 'dishes' ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent, boxShadow: `0 4px 14px ${themeConfig.glow}` } : {}}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${activeTab === 'dishes' ? 'shadow-md font-bold' : isLight ? 'text-slate-600 hover:text-black' : 'text-white/60 hover:text-white'}`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Item Diagnostics</span>
            </button>
            <button
              onClick={() => setActiveTab('engineering')}
              style={activeTab === 'engineering' ? { backgroundColor: '#6366F1', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)' } : {}}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${activeTab === 'engineering' ? 'shadow-md font-bold' : isLight ? 'text-slate-600 hover:text-black' : 'text-white/60 hover:text-white'}`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Menu Matrix (BCG)</span>
            </button>
            <button
              onClick={() => setActiveTab('franchises')}
              style={activeTab === 'franchises' ? { backgroundColor: '#10B981', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' } : {}}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${activeTab === 'franchises' ? 'shadow-md font-bold' : isLight ? 'text-slate-600 hover:text-black' : 'text-white/60 hover:text-white'}`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Franchise Telemetry</span>
            </button>
          </div>

          {/* Controls: Financial Mode, Temporal Horizon, Chart Type */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Financial Mode Segmented Slider */}
            <div className={`flex items-center rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'}`}>
              <button
                onClick={() => setFinancialMode('gross')}
                className={`px-3 py-1.5 text-[11px] font-bold tracking-tight rounded-lg transition-all ${financialMode === 'gross' ? isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/10 text-white shadow-sm' : isLight ? 'text-slate-500 hover:text-black' : 'text-white/40 hover:text-white'}`}
              >
                Gross
              </button>
              <button
                onClick={() => setFinancialMode('net')}
                className={`px-3 py-1.5 text-[11px] font-bold tracking-tight rounded-lg transition-all ${financialMode === 'net' ? 'bg-emerald-500/20 text-emerald-500 font-bold shadow-sm' : isLight ? 'text-slate-500 hover:text-emerald-600' : 'text-white/40 hover:text-white'}`}
              >
                Net Margin
              </button>
            </div>

            <div className={`w-px h-5 ${isLight ? 'bg-slate-200' : 'bg-white/[0.08]'} hidden lg:block`} />

            {/* Temporal Horizon Pills */}
            <div className={`flex items-center rounded-xl p-1 gap-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'}`}>
              {(['today', '7d', '30d', 'custom'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all ${timeframe === t ? isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/20 text-white shadow-sm' : isLight ? 'text-slate-500 hover:text-black' : 'text-white/40 hover:text-white'}`}
                >
                  {t === 'today' ? 'Today' : t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Custom Range Picker */}
            {timeframe === 'custom' && (
              <div
                style={{ borderColor: themeConfig.border }}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border ${isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black/40 text-white'}`}
              >
                <Calendar className="w-3.5 h-3.5" style={{ color: themeConfig.primary }} />
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className={`bg-transparent text-xs outline-none cursor-pointer ${isLight ? 'text-slate-800' : 'text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]'}`}
                />
                <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-400' : 'text-white/30'}`}>TO</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className={`bg-transparent text-xs outline-none cursor-pointer ${isLight ? 'text-slate-800' : 'text-white [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]'}`}
                />
              </div>
            )}

            {/* View Specific Controls */}
            {activeTab === 'revenue' && (
              <div className="flex items-center gap-2 flex-wrap">
                {selectedBranch === "ALL" && (
                  <div className={`flex rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'}`}>
                    <button
                      onClick={() => setRevChartPerspective('timeline')}
                      style={revChartPerspective === 'timeline' ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${revChartPerspective === 'timeline' ? 'font-extrabold shadow-sm' : isLight ? 'text-slate-500 hover:text-black' : 'text-white/40 hover:text-white'}`}
                    >
                      📈 Trajectory
                    </button>
                    <button
                      onClick={() => setRevChartPerspective('branches')}
                      style={revChartPerspective === 'branches' ? { backgroundColor: '#10B981', color: '#FFFFFF' } : {}}
                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${revChartPerspective === 'branches' ? 'font-extrabold shadow-sm' : isLight ? 'text-slate-500 hover:text-black' : 'text-white/40 hover:text-white'}`}
                    >
                      🏢 Branches
                    </button>
                  </div>
                )}

                {revChartPerspective === 'timeline' && (
                  <div className={`flex rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'}`}>
                    <button
                      onClick={() => setChartType('area')}
                      title="Area Trajectory"
                      style={chartType === 'area' ? { backgroundColor: themeConfig.light, color: themeConfig.primary } : {}}
                      className={`p-1.5 rounded-lg transition-colors ${chartType === 'area' ? '' : isLight ? 'text-slate-400 hover:text-black' : 'text-white/40 hover:text-white'}`}
                    >
                      <Activity className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setChartType('bar')}
                      title="Bar Distribution"
                      style={chartType === 'bar' ? { backgroundColor: themeConfig.light, color: themeConfig.primary } : {}}
                      className={`p-1.5 rounded-lg transition-colors ${chartType === 'bar' ? '' : isLight ? 'text-slate-400 hover:text-black' : 'text-white/40 hover:text-white'}`}
                    >
                      <BarChart2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'dishes' && (
              <div className={`flex rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'}`}>
                <button
                  onClick={() => setDChartMode('revenue')}
                  style={dChartMode === 'revenue' ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${dChartMode === 'revenue' ? 'font-extrabold shadow-sm' : isLight ? 'text-slate-500 hover:text-black' : 'text-white/40 hover:text-white'}`}
                >
                  ₹ Revenue
                </button>
                <button
                  onClick={() => setDChartMode('volume')}
                  style={dChartMode === 'volume' ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${dChartMode === 'volume' ? 'font-extrabold shadow-sm' : isLight ? 'text-slate-500 hover:text-black' : 'text-white/40 hover:text-white'}`}
                >
                  Units
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Stage Canvas */}
        <div className="w-full h-[400px] relative">

          {/* TAB 1: REVENUE DYNAMICS */}
          {activeTab === 'revenue' && (
            revChartPerspective === 'branches' && selectedBranch === "ALL" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchComparisonChartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'} />
                  <XAxis dataKey="name" stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tick={{ fontSize: 11, fill: isLight ? '#334155' : '#888', fontWeight: 700 }} axisLine={false} dy={10} />
                  <YAxis stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tickFormatter={v => `₹${v}`} tick={{ fontSize: 10, fill: isLight ? '#334155' : '#888', fontWeight: 600 }} axisLine={false} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className={`${isLight ? 'bg-white border-slate-200' : 'bg-[#101014] border-white/10'} border p-3.5 rounded-2xl shadow-2xl z-50`}>
                            <p className="text-xs font-extrabold text-amber-500 uppercase">{d.fullName}</p>
                            <p className="text-[10px] text-slate-400">{d.city} • {d.name}</p>
                            <p className="text-sm font-mono font-black mt-2">{inr(d.Metric)}</p>
                            <p className="text-[11px] font-mono text-emerald-400 mt-0.5">{d.Orders} orders ({d.Share}% network share)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="Metric" radius={[8, 8, 0, 0]} maxBarSize={60}>
                    {branchComparisonChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#D4AF37', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={revenueTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={financialMode === 'gross' ? themeConfig.primary : '#10B981'} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={financialMode === 'gross' ? themeConfig.primary : '#10B981'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'} />
                  <XAxis dataKey="label" stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tick={{ fontSize: 10, fill: isLight ? '#334155' : '#888', fontWeight: 600 }} axisLine={false} dy={10} />
                  <YAxis stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tickFormatter={v => `₹${v}`} tick={{ fontSize: 10, fill: isLight ? '#334155' : '#888', fontWeight: 600 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                  <Area
                    type="monotone"
                    dataKey="Metric"
                    stroke={financialMode === 'gross' ? themeConfig.primary : '#10B981'}
                    strokeWidth={3}
                    fill="url(#colorMetric)"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    isAnimationActive={true}
                  />
                </AreaChart>
              ) : (
                <BarChart data={revenueTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'} />
                  <XAxis dataKey="label" stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tick={{ fontSize: 10, fill: isLight ? '#334155' : '#888', fontWeight: 600 }} axisLine={false} dy={10} />
                  <YAxis stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tickFormatter={v => `₹${v}`} tick={{ fontSize: 10, fill: isLight ? '#334155' : '#888', fontWeight: 600 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)' }} />
                  <Bar
                    dataKey="Metric"
                    fill={financialMode === 'gross' ? themeConfig.primary : '#10B981'}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                    isAnimationActive={true}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
            )
          )}

          {/* TAB 2: ITEM DIAGNOSTICS */}
          {activeTab === 'dishes' && (
            <div className="h-full flex flex-col">
              <div className={`${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101014] border-white/[0.08]'} border rounded-2xl p-4 mb-4 shadow-inner shrink-0`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-white/40'} shrink-0`}>Category Filter:</span>
                  <select
                    value={dActiveCat}
                    onChange={(e) => setDActiveCat(e.target.value)}
                    className={`${isLight ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : 'bg-black/60 border-white/10 text-white'} border text-xs font-bold rounded-xl px-4 py-2 outline-none cursor-pointer min-w-[200px]`}
                  >
                    <option value="top">🔥 Top Trending Items</option>
                    {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'} sm:ml-auto`}>Click items below to compare their trajectory:</span>
                </div>
                <div className={`pt-3 mt-3 border-t ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
                  <div className="flex flex-wrap gap-2">
                    {displayedDishes.map((d: any) => (
                      <button
                        key={d.id}
                        onClick={() => setDSelectedDishes(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])}
                        style={dSelectedDishes.includes(d.id) ? { backgroundColor: themeConfig.light, borderColor: themeConfig.primary, color: themeConfig.primary } : {}}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${dSelectedDishes.includes(d.id) ? 'shadow-sm' : isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-black/40 border-white/10 text-white/50 hover:text-white'}`}
                      >
                        {d.name} {dSelectedDishes.includes(d.id) && <Check className="w-3 h-3" style={{ color: themeConfig.primary }} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[240px]">
                {dSelectedDishes.length === 0 ? (
                  <div className={`h-full flex flex-col items-center justify-center ${isLight ? 'text-slate-400 border-slate-200 bg-slate-50/50' : 'text-white/40 border-white/10 bg-white/[0.02]'} text-sm gap-2 border border-dashed rounded-2xl`}>
                    <Filter className="w-8 h-8 opacity-30 mb-1" />
                    <span>Select menu items above to plot their sales trajectories side-by-side.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dishTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'} />
                      <XAxis dataKey="label" stroke={isLight ? '#cbd5e1' : '#555'} tickLine={false} tick={{ fontSize: 10, fill: isLight ? '#64748b' : '#888' }} axisLine={false} dy={10} />
                      <YAxis stroke={isLight ? '#cbd5e1' : '#555'} tickLine={false} tickFormatter={v => dChartMode === 'revenue' ? `₹${v}` : `${v}`} tick={{ fontSize: 10, fill: isLight ? '#64748b' : '#888' }} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      {dSelectedDishes.map((id, index) => {
                        const dish = dishes.find((d: any) => d.id === id);
                        if (!dish) return null;
                        return (
                          <Line
                            key={id}
                            type="monotone"
                            dataKey={dish.name}
                            stroke={CHART_COLORS[index % CHART_COLORS.length]}
                            strokeWidth={3}
                            dot={{ r: 0 }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            isAnimationActive={true}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BCG MENU ENGINEERING MATRIX */}
          {activeTab === 'engineering' && (
            bcgMatrixData.data.length === 0 ? (
              <div className={`h-full flex flex-col items-center justify-center ${isLight ? 'text-slate-400' : 'text-white/40'} text-sm`}>
                No transaction data available in the current timeframe to calculate menu quadrant coordinates.
              </div>
            ) : (
              <div className="relative w-full h-full pb-4">
                {/* Visual Quadrant Watermarks */}
                <div className={`absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2 ${isLight ? 'opacity-[0.06]' : 'opacity-[0.04]'}`}>
                  <div className={`border-r border-b ${isLight ? 'border-slate-300' : 'border-white'} p-4 font-black text-3xl text-amber-500 flex items-end justify-end`}>PUZZLES</div>
                  <div className={`border-b ${isLight ? 'border-slate-300' : 'border-white'} p-4 font-black text-3xl text-emerald-500 flex items-end justify-start`}>STARS</div>
                  <div className={`border-r ${isLight ? 'border-slate-300' : 'border-white'} p-4 font-black text-3xl text-rose-500 flex items-start justify-end`}>DOGS</div>
                  <div className="p-4 font-black text-3xl text-blue-500 flex items-start justify-start">PLOWHORSES</div>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'} />
                    <XAxis
                      type="number"
                      dataKey="volume"
                      name="Volume Sold"
                      stroke={isLight ? '#cbd5e1' : '#888'}
                      tick={{ fontSize: 10, fill: isLight ? '#64748b' : '#888' }}
                      axisLine={false}
                      label={{ value: 'VOLUME SOLD (UNITS) →', position: 'bottom', fill: isLight ? '#475569' : '#666', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="profit"
                      name="Net Profit"
                      stroke={isLight ? '#cbd5e1' : '#888'}
                      tickFormatter={v => `₹${v}`}
                      tick={{ fontSize: 10, fill: isLight ? '#64748b' : '#888' }}
                      axisLine={false}
                      label={{ value: 'NET PROFIT (₹) →', angle: -90, position: 'left', fill: isLight ? '#475569' : '#666', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <ZAxis range={[120, 320]} />
                    <Tooltip content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        const qInfo = QUADRANT_CONFIG[d.quadrant as keyof typeof QUADRANT_CONFIG];
                        return (
                          <div className={`${isLight ? 'bg-white border-slate-200 shadow-2xl text-slate-900' : 'bg-[#101014]/95 border-white/10 shadow-2xl text-white'} backdrop-blur-xl border p-4 rounded-2xl min-w-[200px] z-50`}>
                            <div className={`flex items-center justify-between gap-2 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.08]'} pb-2 mb-2`}>
                              <p className="font-bold text-sm">{d.name}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${qInfo.bgColor} ${qInfo.textColor}`}>
                                {qInfo.label}
                              </span>
                            </div>
                            <div className="space-y-1 text-xs">
                              <p className={`${isLight ? 'text-slate-500' : 'text-white/60'} flex justify-between`}>Volume: <span className="font-mono font-bold">{d.volume} units</span></p>
                              <p className={`${isLight ? 'text-slate-500' : 'text-white/60'} flex justify-between`}>Net Profit: <span className="text-emerald-500 font-mono font-bold">{inr(d.profit)}</span></p>
                              <p className={`${isLight ? 'text-slate-500' : 'text-white/60'} flex justify-between`}>Margin: <span className="font-mono font-bold">{d.marginPercent}%</span></p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }} cursor={{ strokeDasharray: '3 3' }} />
                    <ReferenceLine x={bcgMatrixData.avgVolume} stroke={isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)'} strokeDasharray="3 3" />
                    <ReferenceLine y={bcgMatrixData.avgProfit} stroke={isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)'} strokeDasharray="3 3" />
                    <Scatter
                      name="Menu Items"
                      data={classifiedDishes}
                      fill="#818CF8"
                      isAnimationActive={true}
                    >
                      {classifiedDishes.map((entry, index) => {
                        const qInfo = QUADRANT_CONFIG[entry.quadrant];
                        const isFiltered = selectedQuadrant === 'all' || selectedQuadrant === entry.quadrant;
                        const fill = isFiltered ? qInfo.color : isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)";
                        const opacity = isFiltered ? 0.9 : 0.2;
                        return (
                          <circle
                            key={index}
                            cx="0"
                            cy="0"
                            r={isFiltered ? 7 : 4}
                            fill={fill}
                            fillOpacity={opacity}
                            stroke={fill}
                            strokeWidth={isFiltered ? 2 : 1}
                            style={{ transition: 'all 0.2s ease-in-out' }}
                          />
                        );
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          {/* TAB 4: FRANCHISE TELEMETRY & CROSS-BRANCH PERFORMANCE */}
          {activeTab === 'franchises' && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex-1 min-h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchDishAnalysis} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'} />
                    <XAxis dataKey="name" stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tick={{ fontSize: 11, fill: isLight ? '#334155' : '#888', fontWeight: 600 }} axisLine={false} />
                    <YAxis stroke={isLight ? '#94a3b8' : '#555'} tickLine={false} tickFormatter={v => `₹${v}`} tick={{ fontSize: 10, fill: isLight ? '#334155' : '#888', fontWeight: 600 }} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="totalRevenue" name="Gross Revenue" fill={themeConfig.primary} radius={[8, 8, 0, 0]} maxBarSize={64} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Actionable Franchise Dish Intelligence (Visible only in Franchises tab) */}
        {activeTab === 'franchises' && (
          <div className={`mt-8 pt-6 border-t ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} space-y-6`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className={`text-sm font-serif font-bold ${isLight ? 'text-slate-900' : 'text-white'} flex items-center gap-2`}>
                  <Sparkles className="w-4 h-4" style={{ color: themeConfig.primary }} />
                  Franchise Dish Intelligence (Top & Least Selling by Branch)
                </h4>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                  Cross-location recipe velocity: identify top revenue drivers and slow-moving dishes at each location.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branchDishAnalysis.map((b: any) => (
                <div
                  key={b.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    selectedBranch === b.id
                      ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-500/10'
                      : isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h5 className="font-serif font-bold text-sm">{b.name}</h5>
                      <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-white/40'}`}>{b.city || 'Highway'}</span>
                    </div>
                    <span className="font-serif font-bold text-xs" style={{ color: themeConfig.primary }}>{inr(b.totalRevenue)}</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${isLight ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'}`}>
                      <div className="min-w-0">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">👑 Top Selling Dish</p>
                        <p className="font-bold truncate mt-0.5">{b.topDish?.name || 'No orders yet'}</p>
                      </div>
                      {b.topDish && (
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold">{b.topDish.volume} units</p>
                          <p className="text-[10px] opacity-75">{inr(b.topDish.revenue)}</p>
                        </div>
                      )}
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${isLight ? 'bg-rose-50/60 border-rose-200/80 text-rose-900' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                      <div className="min-w-0">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">📉 Least Selling Dish</p>
                        <p className="font-bold truncate mt-0.5">{b.leastDish?.name || 'No orders yet'}</p>
                      </div>
                      {b.leastDish && (
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold">{b.leastDish.volume} units</p>
                          <p className="text-[10px] opacity-75">{inr(b.leastDish.revenue)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {onSelectBranch && (
                    <button
                      onClick={() => onSelectBranch(selectedBranch === b.id ? 'ALL' : b.id)}
                      className={`w-full mt-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        selectedBranch === b.id
                          ? 'bg-amber-500 text-black border-amber-500'
                          : isLight ? 'bg-white hover:bg-slate-100 border-slate-200' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                      }`}
                    >
                      {selectedBranch === b.id ? '✓ Currently Viewing' : `Scope Telemetry to ${b.code || b.name}`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actionable Quadrant Cards & Filter (Visible only when in Matrix tab) */}
        {activeTab === 'engineering' && bcgMatrixData.data.length > 0 && (
          <div className={`mt-8 pt-6 border-t ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} space-y-6`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className={`text-sm font-serif font-bold ${isLight ? 'text-slate-900' : 'text-white'} flex items-center gap-2`}>
                  <Sparkles className="w-4 h-4" style={{ color: themeConfig.primary }} />
                  Executive Strategic Directives
                </h4>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Select a quadrant below to filter dish-level operational actions:</p>
              </div>

              <button
                onClick={() => setSelectedQuadrant('all')}
                className={`text-xs px-3 py-1 rounded-lg border transition-all ${selectedQuadrant === 'all' ? isLight ? 'bg-slate-900 text-white font-bold' : 'bg-white/20 border-white/30 text-white font-bold' : isLight ? 'border-slate-200 text-slate-500 hover:text-black' : 'border-white/10 text-white/40 hover:text-white'}`}
              >
                Show All Quadrants ({classifiedDishes.length})
              </button>
            </div>

            {/* 4 Quadrant Interactive Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(QUADRANT_CONFIG) as (keyof typeof QUADRANT_CONFIG)[]).map(qKey => {
                const config = QUADRANT_CONFIG[qKey];
                const Icon = config.icon;
                const count = quadrantStats.counts[qKey];
                const rev = quadrantStats.revenue[qKey];
                const isSelected = selectedQuadrant === qKey;

                return (
                  <div
                    key={qKey}
                    onClick={() => setSelectedQuadrant(isSelected ? 'all' : qKey)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? `${config.bgColor} ${config.borderColor} ring-1 ring-${config.color}` : isLight ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm' : 'bg-black/30 border-white/[0.08] hover:border-white/20'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${config.textColor}`} />
                        <span className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>{config.label}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor}`}>
                        {count} items
                      </span>
                    </div>
                    <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-white/40'} uppercase tracking-wider mb-2`}>{config.tagline}</p>
                    <p className={`text-xs ${isLight ? 'text-slate-800' : 'text-white/80'} font-mono font-bold mb-3`}>{inr(rev)} generated</p>
                    <p className={`text-[11px] ${isLight ? 'text-slate-600 border-slate-100' : 'text-white/60 border-white/[0.06]'} leading-relaxed border-t pt-2`}>
                      {config.recommendation}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Classified Dishes Recommendation Table */}
            <div className={`overflow-x-auto rounded-2xl border ${isLight ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.08] bg-black/30'}`}>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className={`border-b ${isLight ? 'border-slate-200 text-slate-400 bg-slate-50' : 'border-white/[0.08] text-white/40 bg-white/[0.02]'} text-[10px] uppercase tracking-widest font-bold`}>
                    <th className="py-3 px-4">Menu Item</th>
                    <th className="py-3 px-3">Quadrant</th>
                    <th className="py-3 px-3 text-right">Volume</th>
                    <th className="py-3 px-3 text-right">Net Profit</th>
                    <th className="py-3 px-3 text-right">Margin</th>
                    <th className="py-3 px-4">Operational Directive</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                  {displayedBcgDishes.map((item) => {
                    const qInfo = QUADRANT_CONFIG[item.quadrant];
                    return (
                      <tr key={item.id} className={`${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'} transition-colors`}>
                        <td className={`py-3 px-4 text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.name}</td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${qInfo.bgColor} ${qInfo.textColor}`}>
                            {qInfo.label}
                          </span>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono text-xs ${isLight ? 'text-slate-700' : 'text-white/80'}`}>{item.volume} units</td>
                        <td className="py-3 px-3 text-right font-mono text-xs font-bold text-emerald-500">{inr(item.profit)}</td>
                        <td className={`py-3 px-3 text-right font-mono text-xs ${isLight ? 'text-slate-600' : 'text-white/70'}`}>{item.marginPercent}%</td>
                        <td className={`py-3 px-4 text-[11px] ${isLight ? 'text-slate-600' : 'text-white/60'} max-w-xs`}>{qInfo.recommendation}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </Glass>

      {/* Analytics Secondary Rows: Item Velocity & Category Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ITEM VELOCITY (Top Movers) */}
        <Glass className="p-6 col-span-1 lg:col-span-2 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div>
              <h3 className={`font-serif text-lg ${isLight ? 'text-slate-900' : 'text-white'} font-medium`}>Inventory Velocity</h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Top velocity items and relative order share.</p>
            </div>
            <div
              style={{ color: themeConfig.primary, backgroundColor: themeConfig.light, borderColor: themeConfig.border }}
              className="p-2 rounded-xl border"
            >
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar">
            {itemVelocity.length === 0 ? (
              <div className={`h-full flex items-center justify-center ${isLight ? 'text-slate-400' : 'text-white/40'} text-sm`}>
                No orders recorded for the selected timeframe.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className={`border-b ${isLight ? 'border-slate-200 text-slate-400' : 'border-white/[0.08] text-white/40'} text-[10px] uppercase tracking-widest font-extrabold`}>
                    <th className="pb-3 pl-2 w-16">Rank</th>
                    <th className="pb-3">Menu Item</th>
                    <th className="pb-3 w-40">Velocity Share</th>
                    <th className="pb-3 text-right">Units</th>
                    <th className="pb-3 text-right">{financialMode === 'gross' ? 'Gross Revenue' : 'Net Margin'}</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                  {itemVelocity.map((item, idx) => (
                    <tr key={item.id} className={`${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'} transition-colors group`}>
                      <td className={`py-3.5 pl-2 font-mono text-xs ${isLight ? 'text-slate-500' : 'text-white/40'} font-bold`}>
                        {idx === 0 ? <span className="text-amber-500">🥇 #1</span> :
                          idx === 1 ? <span className="text-slate-400">🥈 #2</span> :
                            idx === 2 ? <span className="text-amber-700">🥉 #3</span> :
                              `#${idx + 1}`}
                      </td>
                      <td className={`py-3.5 text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'} flex items-center gap-2`}>
                        {item.name}
                        {idx === 0 && (
                          <span
                            style={{ backgroundColor: themeConfig.light, color: themeConfig.primary, borderColor: themeConfig.border }}
                            className="border text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold"
                          >
                            Top
                          </span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <div className={`w-full ${isLight ? 'bg-slate-100' : 'bg-white/[0.05]'} rounded-full h-1.5 overflow-hidden`}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              background: `linear-gradient(to right, ${themeConfig.primary}, ${themeConfig.light})`,
                              width: `${item.relativeShare}%`
                            }}
                          />
                        </div>
                      </td>
                      <td className={`py-3.5 text-right text-xs ${isLight ? 'text-slate-700' : 'text-white/80'} font-mono font-medium`}>{item.volume}</td>
                      <td className="py-3.5 text-right text-sm font-bold font-mono text-emerald-500">
                        {inr(financialMode === 'gross' ? item.gross : item.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Glass>

        {/* CATEGORY DISTRIBUTION (Donut Chart) */}
        <Glass className="p-6 col-span-1 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h3 className={`font-serif text-lg ${isLight ? 'text-slate-900' : 'text-white'} font-medium`}>Category Split</h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Revenue distribution by department.</p>
            </div>
            <div className={`p-2 rounded-xl border ${isLight ? 'bg-sky-50 border-sky-100 text-sky-600' : 'bg-white/[0.03] border-white/[0.06] text-sky-400'}`}>
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 w-full relative min-h-[220px]">
            {categoryDistribution.length === 0 ? (
              <div className={`absolute inset-0 flex items-center justify-center ${isLight ? 'text-slate-400' : 'text-white/40'} text-sm`}>
                No categorical sales recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isLight ? '#ffffff' : '#101014',
                      borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
                      borderRadius: '1rem',
                      color: isLight ? '#0f172a' : '#fff',
                      backdropFilter: 'blur(16px)',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                    itemStyle={{ color: isLight ? '#0f172a' : '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: any) => [inr(Number(value)), 'Revenue']}
                  />
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Minimal Luxury Legend */}
          <div className={`shrink-0 space-y-2 mt-4 max-h-[120px] overflow-y-auto custom-scrollbar pr-2 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'} pt-3`}>
            {categoryDistribution.map((cat, idx) => (
              <div key={cat.name} className="flex items-center justify-between text-xs py-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  <span className={`${isLight ? 'text-slate-700' : 'text-white/70'} font-medium truncate max-w-[110px]`} title={cat.name}>{cat.name}</span>
                </div>
                <span className={`${isLight ? 'text-slate-900' : 'text-white'} font-mono font-bold`}>{inr(cat.value)}</span>
              </div>
            ))}
          </div>
        </Glass>

      </div>
    </div>
  );
}