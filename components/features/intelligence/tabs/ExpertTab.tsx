"use client";

import { CheckCircle2, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { ExpertReport } from "../types";
import { useTheme } from "@/lib/theme-context";

interface ExpertTabProps {
  report: ExpertReport | null;
  timeframeLabel: string;
}

export default function ExpertTab({ report, timeframeLabel }: ExpertTabProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";

  if (!report) {
    return (
      <div className={`flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border p-8 text-center transition-all ${
        isLight ? "bg-white border-slate-200 shadow-sm" : "border-white/5 bg-white/[0.015] backdrop-blur-md"
      }`}>
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
        <h3 className={`font-serif text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
          No Report Generated
        </h3>
        <p className={`mt-1 max-w-sm text-xs ${isLight ? "text-slate-500" : "text-gray-400"}`}>
          There are not enough transactions in {timeframeLabel} to produce an executive report. Try broadening the timeframe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`flex items-center justify-between border-b ${isLight ? "border-slate-200" : "border-white/5"} pb-4`}>
        <div>
          <h3 className={`font-serif text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
            Operational Intelligence Brief
          </h3>
          <p className={`text-xs mt-1 ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
            Autonomous audit and executive synthesis for {timeframeLabel}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Quadrant 1: Executive Summary */}
        <div className="space-y-3">
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
            <CheckCircle2 className="h-4 w-4" />
            <span>Executive Performance Summary</span>
          </div>
          <div className={`min-h-[140px] rounded-2xl border p-5 transition-all ${
            isLight ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]" : "border-white/5 bg-white/[0.018] shadow-lg backdrop-blur-xl"
          }`}>
            {report.summary.length ? (
              <div className="space-y-2.5">
                {report.summary.map((item, idx) => (
                  <p key={idx} className={`flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isLight ? "bg-emerald-600" : "bg-emerald-400"}`} />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className={`text-xs italic ${isLight ? "text-slate-400" : "text-gray-500"}`}>No summary points generated.</p>
            )}
          </div>
        </div>

        {/* Quadrant 2: What Changed */}
        <div className="space-y-3">
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isLight ? "text-blue-700" : "text-blue-400"}`}>
            <TrendingUp className="h-4 w-4" />
            <span>Operational Movement & Velocity</span>
          </div>
          <div className={`min-h-[140px] rounded-2xl border p-5 transition-all ${
            isLight ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]" : "border-white/5 bg-white/[0.018] shadow-lg backdrop-blur-xl"
          }`}>
            {report.whatChanged.length ? (
              <div className="space-y-2.5">
                {report.whatChanged.map((item, idx) => (
                  <p key={idx} className={`flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isLight ? "bg-blue-600" : "bg-blue-400"}`} />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className={`text-xs italic ${isLight ? "text-slate-400" : "text-gray-500"}`}>Sales patterns remained consistent with baseline.</p>
            )}
          </div>
        </div>

        {/* Quadrant 3: Items Requiring Attention */}
        <div className="space-y-3">
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isLight ? "text-amber-700" : "text-amber-400"}`}>
            <AlertTriangle className="h-4 w-4" />
            <span>Items Requiring Attention</span>
          </div>
          <div className={`min-h-[140px] rounded-2xl border p-5 transition-all ${
            isLight ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]" : "border-white/5 bg-white/[0.018] shadow-lg backdrop-blur-xl"
          }`}>
            {report.attention.length ? (
              <div className="space-y-2.5">
                {report.attention.map((item, idx) => (
                  <p key={idx} className={`flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isLight ? "bg-amber-600" : "bg-amber-400"}`} />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className={`text-xs italic ${isLight ? "text-slate-400" : "text-gray-500"}`}>No anomalies or margin leaks detected in this period.</p>
            )}
          </div>
        </div>

        {/* Quadrant 4: Strategic Recommendations */}
        <div className="space-y-3">
          <div 
            style={{ color: themeConfig.primary }}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <Lightbulb className="h-4 w-4" />
            <span>Actionable Growth Recommendations</span>
          </div>
          <div className={`min-h-[140px] rounded-2xl border p-5 transition-all ${
            isLight ? "bg-white border-slate-200 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)]" : "border-white/5 bg-white/[0.018] shadow-lg backdrop-blur-xl"
          }`}>
            {report.recommendations.length ? (
              <div className="space-y-2.5">
                {report.recommendations.map((item, idx) => (
                  <p key={idx} className={`flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: themeConfig.primary }} />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className={`text-xs italic ${isLight ? "text-slate-400" : "text-gray-500"}`}>Maintain current promotional rhythm.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
