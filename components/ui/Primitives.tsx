import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme-context";
import Odometer from "@/components/ui/Odometer";

export { Odometer };

export const inputCls = "w-full rounded-2xl border border-[var(--border-card)] bg-[var(--input-bg)] px-4 py-3 font-sans text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]";

export function Glass({ 
  className = "", 
  style, 
  children, 
  onClick,
  ...props 
}: { 
  className?: string; 
  style?: React.CSSProperties; 
  children: ReactNode; 
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      onClick={onClick} 
      style={style} 
      className={`rounded-[1.75rem] border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-primary)] backdrop-blur-md shadow-sm transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.68rem] uppercase tracking-[0.2em] text-[var(--text-muted)] font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
        on ? "border-emerald-500/40 bg-emerald-500/25" : "border-rose-500/40 bg-rose-500/20"
      }`}
    >
      <motion.span 
        layout 
        transition={{ type: "spring", stiffness: 500, damping: 34 }} 
        className={`absolute top-[3px] h-[18px] w-[18px] rounded-full ${
          on ? "left-[23px] bg-emerald-400" : "left-[3px] bg-rose-400"
        }`} 
      />
    </button>
  );
}

export interface StatCardDelta {
  percent: number;
  isPositive: boolean;
  label?: string;
}

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  delta,
  sparkline,
  accent = "gold"
}: { 
  icon: any; 
  label: string; 
  value: string; 
  delta?: string | StatCardDelta;
  sparkline?: number[];
  accent?: "gold" | "emerald" | "blue" | "purple";
}) {
  const { themeConfig } = useTheme();

  const accentColors = {
    gold: { 
      style: { color: themeConfig.primary, backgroundColor: themeConfig.light, borderColor: themeConfig.border },
      bgStyle: { backgroundColor: themeConfig.primary },
      stroke: themeConfig.primary 
    },
    emerald: { 
      style: { color: "#10B981", backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.25)" },
      bgStyle: { backgroundColor: "#10B981" },
      stroke: "#10B981" 
    },
    blue: { 
      style: { color: "#38BDF8", backgroundColor: "rgba(56, 189, 248, 0.1)", borderColor: "rgba(56, 189, 248, 0.25)" },
      bgStyle: { backgroundColor: "#38BDF8" },
      stroke: "#38BDF8" 
    },
    purple: { 
      style: { color: "#A855F7", backgroundColor: "rgba(168, 85, 247, 0.1)", borderColor: "rgba(168, 85, 247, 0.25)" },
      bgStyle: { backgroundColor: "#A855F7" },
      stroke: "#A855F7" 
    }
  };
  const theme = accentColors[accent] || accentColors.gold;

  const sparklineData = sparkline && sparkline.length >= 2 ? (() => {
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const pts = sparkline.map((val, idx) => {
      const x = (idx / (sparkline.length - 1)) * 100;
      const y = 26 - ((val - min) / range) * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePath = `M ${pts.join(" L ")}`;
    const areaPath = `M 0,28 L ${pts.join(" L ")} L 100,28 Z`;
    return { linePath, areaPath };
  })() : null;

  const gradId = `grad-${label.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
      <Glass className="p-5 flex flex-col h-full justify-between relative overflow-hidden group hover:border-[var(--accent)] transition-all">
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity" style={theme.bgStyle} />
        
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.68rem] uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold">{label}</p>
            <div className="p-2 rounded-xl border transition-transform group-hover:scale-110 duration-200" style={theme.style}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <p className="font-serif text-3xl font-bold text-[var(--text-primary)] tracking-tight tabular-nums">
            <Odometer value={value} />
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-1.5 min-w-0">
            {typeof delta === "object" ? (
              <>
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight font-mono ${
                  delta.isPositive 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25' 
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                }`}>
                  {delta.isPositive ? '▲ +' : '▼ -'}{delta.percent}%
                </span>
                {delta.label && <span className="text-[0.68rem] text-[var(--text-secondary)] font-medium truncate">{delta.label}</span>}
              </>
            ) : delta ? (
              <span className="text-[0.72rem] text-emerald-600 dark:text-emerald-400 font-bold">{delta}</span>
            ) : null}
          </div>

          {sparklineData && (
            <div className="w-16 h-7 shrink-0 relative overflow-hidden" title="Trajectory">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 28" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.stroke} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={theme.stroke} stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={sparklineData.areaPath} fill={`url(#${gradId})`} />
                <path d={sparklineData.linePath} fill="none" stroke={theme.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </Glass>
    </motion.div>
  );
}

export function PageHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mb-8 shrink-0">
      <p className="text-[0.68rem] uppercase tracking-[0.35em] text-[var(--accent)] font-bold">{eyebrow}</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-[2.7rem] text-[var(--text-primary)]">{title}</h1>
    </header>
  );
}