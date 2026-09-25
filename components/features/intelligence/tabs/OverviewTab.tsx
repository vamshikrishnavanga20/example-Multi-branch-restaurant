"use client";

import { motion } from "framer-motion";
import { IndianRupee, ShoppingBag, Utensils, Award, TrendingUp, AlertCircle } from "lucide-react";
import { CoreMetrics, DishAggregate } from "../types";
import { inr } from "@/lib/utils";
import { useTheme } from "@/lib/theme-context";

interface OverviewTabProps {
  metrics: CoreMetrics;
  dishBreakdown: DishAggregate[];
  timeframeLabel: string;
}

export default function OverviewTab({ metrics, dishBreakdown, timeframeLabel }: OverviewTabProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const topDishes = dishBreakdown.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          whileHover={{ y: -3 }}
          className={`rounded-2xl border p-5 transition-all ${
            isLight
              ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]"
              : "border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-md"
          }`}
        >
          <div className={`flex items-center justify-between ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider">Gross Revenue</span>
            <div className={`rounded-xl border p-2 ${
              isLight ? "border-emerald-500/30 bg-emerald-50 text-emerald-600" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }`}>
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <p className={`mt-4 font-serif text-3xl font-bold tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {inr(metrics.grossRevenue)}
          </p>
          <span className={`mt-1 block text-xs ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
            {timeframeLabel}
          </span>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className={`rounded-2xl border p-5 transition-all ${
            isLight
              ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]"
              : "border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-md"
          }`}
        >
          <div className={`flex items-center justify-between ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
            <div 
              style={{ borderColor: themeConfig.border, backgroundColor: themeConfig.light, color: themeConfig.primary }}
              className="rounded-xl border p-2"
            >
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <p className={`mt-4 font-serif text-3xl font-bold tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {metrics.totalOrders}
          </p>
          <div className={`mt-1 flex items-center gap-1 text-xs ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
            {metrics.orderCountEstimated && <AlertCircle className="h-3 w-3 text-amber-500" />}
            <span>{metrics.orderCountEstimated ? "Estimated tickets" : "Verified orders"}</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className={`rounded-2xl border p-5 transition-all ${
            isLight
              ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]"
              : "border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-md"
          }`}
        >
          <div className={`flex items-center justify-between ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider">Avg Order Value</span>
            <div className={`rounded-xl border p-2 ${
              isLight ? "border-blue-500/30 bg-blue-50 text-blue-600" : "border-blue-500/30 bg-blue-500/10 text-blue-400"
            }`}>
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className={`mt-4 font-serif text-3xl font-bold tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {inr(Math.round(metrics.averageOrderValue))}
          </p>
          <span className={`mt-1 block text-xs ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
            {metrics.unitsPerOrder.toFixed(1)} plates / ticket
          </span>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className={`rounded-2xl border p-5 transition-all ${
            isLight
              ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]"
              : "border-white/5 bg-white/[0.02] shadow-lg backdrop-blur-md"
          }`}
        >
          <div className={`flex items-center justify-between ${isLight ? "text-slate-600" : "text-gray-400"}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider">Signature Champion</span>
            <div className={`rounded-xl border p-2 ${
              isLight ? "border-purple-500/30 bg-purple-50 text-purple-600" : "border-purple-500/30 bg-purple-500/10 text-purple-400"
            }`}>
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p 
            style={{ color: themeConfig.primary }}
            className="mt-4 truncate font-serif text-xl font-bold tracking-tight"
          >
            {metrics.bestSeller ? metrics.bestSeller.name : "—"}
          </p>
          <span className={`mt-1 block text-xs ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
            {metrics.bestSeller ? `${metrics.bestSeller.quantity} plates ordered` : "No sales in range"}
          </span>
        </motion.div>
      </div>

      {/* Top Dishes Ranking Breakdown */}
      <div className={`rounded-2xl border p-6 transition-all ${
        isLight
          ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]"
          : "border-white/5 bg-white/[0.02] shadow-xl backdrop-blur-md"
      }`}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className={`font-serif text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
              Top Revenue Contributors
            </h3>
            <p className={`text-xs mt-0.5 ${isLight ? "text-slate-500" : "text-gray-400"}`}>
              Top-performing menu offerings for {timeframeLabel}
            </p>
          </div>
          <Utensils className="h-5 w-5 opacity-70" style={{ color: themeConfig.primary }} />
        </div>

        {topDishes.length === 0 ? (
          <div className={`py-12 text-center text-sm ${isLight ? "text-slate-500" : "text-gray-500"}`}>
            No transactions found for this timeframe. Select another range to review data.
          </div>
        ) : (
          <div className="space-y-4">
            {topDishes.map((dish, idx) => {
              const share = metrics.grossRevenue > 0 ? (dish.revenue / metrics.grossRevenue) * 100 : 0;
              return (
                <div 
                  key={dish.id} 
                  className={`group rounded-xl border p-4 transition-all ${
                    isLight
                      ? "bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300"
                      : "border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                        isLight 
                          ? "bg-white border-slate-200 text-amber-700 shadow-2xs" 
                          : "border-white/10 bg-white/5 text-[#D4AF37]"
                      }`}>
                        #{idx + 1}
                      </span>
                      <div>
                        <p className={`font-medium text-sm transition-colors ${
                          isLight ? "text-slate-900 group-hover:text-amber-700 font-semibold" : "text-white group-hover:text-[#D4AF37]"
                        }`}>
                          {dish.name}
                        </p>
                        <span className={`text-xs ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
                          {dish.quantity} units sold
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-serif font-bold text-sm ${isLight ? "text-emerald-600" : "text-emerald-400"}`}>
                        {inr(dish.revenue)}
                      </p>
                      <span className={`text-[11px] font-mono ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                        {share.toFixed(1)}% share
                      </span>
                    </div>
                  </div>
                  <div className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${isLight ? "bg-slate-200" : "bg-white/5"}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${share}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-emerald-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
