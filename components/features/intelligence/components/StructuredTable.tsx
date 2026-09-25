"use client";

import { useState } from "react";
import { Download, ArrowUpDown } from "lucide-react";
import { ChatTable } from "../types";
import { inr } from "@/lib/utils";
import { exportTableToCsv } from "../utils/export-utils";
import { useTheme } from "@/lib/theme-context";

export default function StructuredTable({ table }: { table: ChatTable }) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const title = table.title || "Dish Performance";
  const columns = table.columns;
  const rows = [...table.rows];

  if (sortKey) {
    rows.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA ?? "").localeCompare(String(valB ?? ""))
        : String(valB ?? "").localeCompare(String(valA ?? ""));
    });
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border transition-all ${
      isLight ? "border-slate-200 bg-white shadow-md" : "border-white/10 bg-black/40 shadow-xl backdrop-blur-md"
    }`}>
      <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
        isLight ? "border-slate-200 bg-slate-50/70" : "border-white/10"
      }`}>
        <h4 
          style={{ color: themeConfig.primary }}
          className="font-serif text-sm font-bold tracking-wide"
        >
          {title}
        </h4>
        <button
          onClick={() => exportTableToCsv(title, columns, rows)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
            isLight
              ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:border-slate-300"
              : "border-white/10 bg-white/5 text-gray-300 hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
          }`}
          title="Download as CSV"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className={`w-full text-left text-xs ${isLight ? "text-slate-800" : "text-gray-300"}`}>
          <thead className={`border-b text-[10px] uppercase tracking-wider ${
            isLight ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/10 bg-white/[0.03] text-gray-400"
          }`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`cursor-pointer px-5 py-3 font-bold transition-colors ${
                    isLight ? "hover:text-slate-950" : "hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isLight ? "divide-y divide-slate-200" : "divide-y divide-white/5"}>
            {rows.map((row, idx) => (
              <tr key={idx} className={`transition-colors ${isLight ? "hover:bg-slate-50/80" : "hover:bg-white/[0.02]"}`}>
                {columns.map((col) => {
                  const val = row[col.key];
                  return (
                    <td key={col.key} className="whitespace-nowrap px-5 py-3">
                      {col.type === "currency" ? (
                        <span className={`font-bold ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                          {inr(typeof val === "number" ? val : Number(val) || 0)}
                        </span>
                      ) : col.type === "number" ? (
                        <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{String(val ?? 0)}</span>
                      ) : (
                        <span className={isLight ? "text-slate-800 font-medium" : "text-gray-200"}>{String(val ?? "—")}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
