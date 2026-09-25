"use client";

import { useState, useMemo, useRef } from "react";
import { Sparkles, LayoutDashboard, FileText, MessageSquare, Calendar } from "lucide-react";
import {
  IntelligenceViewProps,
  DateFilter,
  ActiveTab,
  WorkspaceMessage,
  ExpertReport,
  DishAggregate,
  CoreMetrics,
} from "./intelligence/types";
import {
  localDateString,
  startOfLocalDay,
  endOfLocalDay,
  getRangeStart,
  isValidDateString,
} from "./intelligence/utils/date-utils";
import OverviewTab from "./intelligence/tabs/OverviewTab";
import ExpertTab from "./intelligence/tabs/ExpertTab";
import AssistantTab from "./intelligence/tabs/AssistantTab";
import { speechService } from "@/lib/speech";
import { inr } from "@/lib/utils";
import { useTheme } from "@/lib/theme-context";

const DATE_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "custom", label: "Custom" },
];

export default function IntelligenceView({ dishes = [], ledger = [] }: IntelligenceViewProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30d");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return localDateString(d);
  });
  const [endDate, setEndDate] = useState(() => localDateString(new Date()));

  // AI Workspace / Chat state
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [workspaceMessages, setWorkspaceMessages] = useState<WorkspaceMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to AI Deep Analysis. Ask about revenue, top dishes, or ask for a full dish performance report. I will ground my answers strictly in your live database records for the selected timeframe.",
    },
  ]);
  const [isWorkspaceThinking, setIsWorkspaceThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [expertReport, setExpertReport] = useState<ExpertReport | null>(null);

  // Timeframe description label
  const timeframeLabel = useMemo(() => {
    if (dateFilter === "today") return "Today";
    if (dateFilter === "7d") return "Last 7 Days";
    if (dateFilter === "30d") return "Last 30 Days";
    return `${startDate} to ${endDate}`;
  }, [dateFilter, startDate, endDate]);

  // Filter ledger entries by selected timeframe
  const filteredLedger = useMemo(() => {
    let rangeStart: Date;
    let rangeEnd: Date;

    if (dateFilter === "custom") {
      if (!isValidDateString(startDate) || !isValidDateString(endDate)) return [];
      const [sy, sm, sd] = startDate.split("-").map(Number);
      const [ey, em, ed] = endDate.split("-").map(Number);
      rangeStart = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      rangeEnd = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    } else {
      rangeStart = getRangeStart(dateFilter);
      rangeEnd = endOfLocalDay(new Date());
    }

    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();

    return ledger.filter((entry: any) => {
      if (!entry.created_at) return false;
      const t = new Date(entry.created_at).getTime();
      return Number.isFinite(t) && t >= startMs && t <= endMs;
    });
  }, [ledger, dateFilter, startDate, endDate]);

  // Aggregate dish breakdown
  const dishBreakdown: DishAggregate[] = useMemo(() => {
    const map: Record<string, DishAggregate> = {};

    for (const entry of filteredLedger) {
      const id = String(entry.menu_item_id ?? "unknown");
      const name =
        entry.menu_items?.name || dishes.find((d) => d.id === id)?.name || "Unassigned Item";

      if (!map[id]) {
        map[id] = { id, name, quantity: 0, revenue: 0 };
      }

      const qty = Number(entry.quantity);
      const revenue = Number(entry.total_price);
      map[id].quantity += Number.isFinite(qty) ? Math.max(0, qty) : 1;
      map[id].revenue += Number.isFinite(revenue) ? Math.max(0, revenue) : 0;
    }

    return Object.values(map).sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
  }, [filteredLedger, dishes]);

  // Compute Core Metrics
  const metrics: CoreMetrics = useMemo(() => {
    const grossRevenue = dishBreakdown.reduce((sum, d) => sum + d.revenue, 0);
    const totalUnits = dishBreakdown.reduce((sum, d) => sum + d.quantity, 0);
    const distinctOrders = new Set(
      filteredLedger.map((e: any) => e.order_id || e.id).filter(Boolean)
    );
    const totalOrders = distinctOrders.size > 0 ? distinctOrders.size : filteredLedger.length;
    const bestSeller =
      dishBreakdown.length > 0
        ? [...dishBreakdown].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)[0]
        : null;
    const averageOrderValue = totalOrders > 0 ? grossRevenue / totalOrders : 0;
    const unitsPerOrder = totalOrders > 0 ? totalUnits / totalOrders : 0;

    return {
      grossRevenue,
      totalUnits,
      totalOrders,
      averageOrderValue,
      unitsPerOrder,
      bestSeller,
      orderCountEstimated: false,
    };
  }, [dishBreakdown, filteredLedger]);

  const handleSendPrompt = async (promptToSend: string) => {
    if (!promptToSend.trim()) return;

    const userMessage: WorkspaceMessage = { role: "user", content: promptToSend };
    setWorkspaceMessages((prev) => [...prev, userMessage]);
    setWorkspaceInput("");
    setIsWorkspaceThinking(true);

    try {
      const res = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: promptToSend,
          timeframe: dateFilter,
          history: workspaceMessages.slice(-6),
        }),
      });

      const data = await res.json();
      const assistantMessage: WorkspaceMessage = {
        role: "assistant",
        content: data.reply || "Analysis complete.",
        data: data.data,
      };

      setWorkspaceMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setWorkspaceMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered a communication error. Please try again.",
        },
      ]);
    } finally {
      setIsWorkspaceThinking(false);
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      speechService.stop();
      setIsListening(false);
    } else {
      speechService.listen(
        (transcript: string) => {
          setWorkspaceInput(transcript);
        },
        () => setIsListening(false)
      );
      setIsListening(true);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Date Ribbon */}
      <div className={`flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between ${
        isLight ? "border-slate-200" : "border-white/5"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ backgroundColor: themeConfig.light, borderColor: themeConfig.border, color: themeConfig.primary }}>
              <Sparkles className="h-4 w-4" />
            </span>
            <h1 className={`font-serif text-2xl font-black tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
              AI Operations Intelligence
            </h1>
          </div>
          <p className={`mt-1 text-xs ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
            Executive analytics, dish engineering, and natural language business insights.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setDateFilter(opt.id)}
              style={dateFilter === opt.id ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                dateFilter === opt.id
                  ? "shadow-sm"
                  : isLight
                  ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  : "border border-white/5 bg-white/[0.02] text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className={`flex items-center gap-2 border-b pb-1 ${isLight ? "border-slate-200" : "border-white/5"}`}>
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "overview"
              ? isLight ? "border-slate-900 text-slate-900" : "border-white text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("assistant")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "assistant"
              ? isLight ? "border-slate-900 text-slate-900" : "border-white text-white"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          AI Analyst Chat
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "overview" && (
        <OverviewTab
          metrics={metrics}
          dishBreakdown={dishBreakdown}
          timeframeLabel={timeframeLabel}
        />
      )}

      {activeTab === "assistant" && (
        <AssistantTab
          messages={workspaceMessages}
          input={workspaceInput}
          setInput={setWorkspaceInput}
          isThinking={isWorkspaceThinking}
          isListening={isListening}
          onToggleListening={handleToggleListening}
          onSubmit={(e) => {
            e?.preventDefault();
            handleSendPrompt(workspaceInput);
          }}
          timeframeLabel={timeframeLabel}
          onQuickPrompt={(prompt) => handleSendPrompt(prompt)}
        />
      )}
    </div>
  );
}