"use client";

import { useState } from "react";
import { User, Sparkles, Volume2, VolumeX } from "lucide-react";
import { WorkspaceMessage } from "../types";
import { speechService } from "@/lib/speech";
import { inr } from "@/lib/utils";
import { useTheme } from "@/lib/theme-context";
import StructuredTable from "./StructuredTable";

export default function ChatBubble({ message }: { message: WorkspaceMessage }) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.role === "user";

  const handleSpeak = () => {
    if (isSpeaking) {
      speechService.stop();
      setIsSpeaking(false);
    } else {
      speechService.speak(message.content, () => setIsSpeaking(false));
      setIsSpeaking(true);
    }
  };

  return (
    <div className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div 
          style={{ borderColor: themeConfig.border, backgroundColor: themeConfig.light, color: themeConfig.primary }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
        >
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div className={`max-w-[88%] sm:max-w-[78%] space-y-3 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-sm leading-relaxed shadow-md transition-all ${
            isUser
              ? isLight
                ? "bg-amber-100/80 border border-amber-300 text-amber-950 font-medium rounded-tr-sm"
                : "bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-white rounded-tr-sm"
              : isLight
                ? "bg-slate-100/90 border border-slate-200 text-slate-800 rounded-tl-sm shadow-xs"
                : "bg-white/[0.04] border border-white/10 text-gray-200 rounded-tl-sm backdrop-blur-md"
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>

          {!isUser && message.content && (
            <div className={`mt-3 flex items-center justify-between border-t pt-2 ${
              isLight ? "border-slate-200/80" : "border-white/5"
            }`}>
              <button
                onClick={handleSpeak}
                className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                  isLight ? "text-slate-600 hover:text-amber-800" : "text-gray-400 hover:text-[#D4AF37]"
                }`}
                title={isSpeaking ? "Stop voice" : "Read aloud"}
              >
                {isSpeaking ? <VolumeX className="h-3.5 w-3.5 text-red-500" /> : <Volume2 className="h-3.5 w-3.5" />}
                <span>{isSpeaking ? "Stop" : "Listen"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Structured Summary KPIs if provided */}
        {message.summary && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {message.summary.totalRevenue != null && (
              <div className={`rounded-xl border p-2.5 transition-all ${
                isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-white/[0.02] backdrop-blur-sm"
              }`}>
                <span className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                  Total Revenue
                </span>
                <span className={`font-serif text-sm font-bold ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                  {inr(message.summary.totalRevenue)}
                </span>
              </div>
            )}
            {message.summary.totalUnits != null && (
              <div className={`rounded-xl border p-2.5 transition-all ${
                isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-white/[0.02] backdrop-blur-sm"
              }`}>
                <span className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                  Total Units
                </span>
                <span className={`font-serif text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                  {message.summary.totalUnits}
                </span>
              </div>
            )}
            {message.summary.topDish && (
              <div className={`col-span-2 sm:col-span-1 rounded-xl border p-2.5 transition-all ${
                isLight ? "border-slate-200 bg-white shadow-xs" : "border-white/5 bg-white/[0.02] backdrop-blur-sm"
              }`}>
                <span className={`block text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                  Top Dish
                </span>
                <span 
                  style={{ color: themeConfig.primary }}
                  className="truncate block font-serif text-sm font-bold"
                >
                  {message.summary.topDish}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Structured Table if available */}
        {message.table && <StructuredTable table={message.table} />}
      </div>

      {isUser && (
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
          isLight ? "border-slate-200 bg-slate-100 text-slate-600" : "border-white/10 bg-white/5 text-gray-400"
        }`}>
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
