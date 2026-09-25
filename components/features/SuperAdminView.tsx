'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, TrendingUp, TrendingDown, Users, ShoppingBag, DollarSign,
  Activity, BarChart3, ArrowUpRight, ArrowDownRight, Globe, Zap,
  CheckCircle2, AlertCircle, XCircle, Clock, Star, Crown, Target,
  RefreshCcw, ChevronDown, Eye, ShieldCheck, Database, CloudDownload
} from 'lucide-react';
import { PageHead, Glass } from '@/components/ui/Primitives';
import { useTheme } from '@/lib/theme-context';

interface BranchKPI {
  id: string;
  name: string;
  city: string;
  code: string;
  status: 'active' | 'inactive';
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  royaltyAmount: number;
  royaltyPct: number;
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
  lastActivity?: string;
}

interface RecentActivity {
  type: string;
  branch_id: string;
  branch_name: string;
  amount?: number;
  table?: string;
  time: string;
}

export default function SuperAdminView({
  branches,
  ledger,
  selectedBranch,
  onSelectBranch,
}: {
  branches: any[];
  ledger: any[];
  selectedBranch: string;
  onSelectBranch: (id: string) => void;
}) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === 'light';
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'activity'>('overview');
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const handleManualBackup = async () => {
    try {
      setIsBackingUp(true);
      setBackupMessage(null);
      const res = await fetch('/api/cron/weekly-backup?force=true', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBackupMessage(`Archived week ${data.week} (${data.counts?.orders || 0} orders, ${data.counts?.attendance_records || 0} staff logs) to s3://${data.s3_bucket}/${data.s3_prefix}`);
      } else {
        setBackupMessage(`Backup notice: ${data.error || data.reason || 'Failed'}`);
      }
    } catch (err: any) {
      setBackupMessage(`Error: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Compute per-branch KPIs from ledger data
  const branchKPIs = useMemo((): BranchKPI[] => {
    return branches.map(branch => {
      const branchLedger = ledger.filter(e =>
        (e.branch_id || 'branch-hyderabad-hq') === branch.id
      );
      const activeBranchLedger = branchLedger.filter(e => e.status !== 'cancelled');
      const revenue = activeBranchLedger.reduce((s: number, e: any) => s + (e.total_price || 0), 0);
      const orderIds = new Set(activeBranchLedger.map((e: any) => e.order_id || e.id));
      const orderCount = orderIds.size;
      const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
      const isHQ = branch.id === 'branch-hyderabad-hq' || branch.code === 'HYD-01';
      const royaltyPct = isHQ ? 0 : (branch.royalty_pct ?? 10);
      const royaltyAmount = isHQ ? 0 : revenue * (royaltyPct / 100);

      // Simple trend simulation based on order density
      const recent = activeBranchLedger.filter((e: any) => {
        const d = new Date(e.created_at);
        return d > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      });
      const older = activeBranchLedger.filter((e: any) => {
        const d = new Date(e.created_at);
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const cutoff2 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        return d >= cutoff2 && d < cutoff;
      });
      const recentRev = recent.reduce((s: number, e: any) => s + (e.total_price || 0), 0);
      const olderRev = older.reduce((s: number, e: any) => s + (e.total_price || 0), 0);
      const trendPct = olderRev > 0 ? ((recentRev - olderRev) / olderRev) * 100 : 0;
      const trend: 'up' | 'down' | 'flat' = trendPct > 2 ? 'up' : trendPct < -2 ? 'down' : 'flat';

      const lastEntry = branchLedger[0];

      return {
        id: branch.id,
        name: branch.name,
        city: branch.city || '',
        code: branch.code || '',
        status: branch.status || 'active',
        revenue,
        orderCount,
        avgOrderValue,
        royaltyAmount,
        royaltyPct,
        trend,
        trendPct: Math.abs(trendPct),
        lastActivity: lastEntry?.created_at,
      };
    });
  }, [branches, ledger]);

  // Group activity by branch
  useEffect(() => {
    const activity: RecentActivity[] = ledger
      .slice(0, 50)
      .map((e: any) => ({
        type: 'order',
        branch_id: e.branch_id || 'branch-hyderabad-hq',
        branch_name: e.branch_name || 'HQ',
        amount: e.total_price,
        table: e.table_number,
        time: e.created_at,
      }))
      .sort((a: RecentActivity, b: RecentActivity) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setRecentActivity(activity.slice(0, 25));
  }, [ledger]);

  const totalRevenue = branchKPIs.reduce((s, b) => s + b.revenue, 0);
  const totalOrders = branchKPIs.reduce((s, b) => s + b.orderCount, 0);
  const totalRoyalty = branchKPIs.reduce((s, b) => s + b.royaltyAmount, 0);
  const activeBranches = branchKPIs.filter(b => b.status === 'active').length;
  const hqKPI = branchKPIs.find(b => b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01');
  const hqRevenue = hqKPI ? hqKPI.revenue : 0;
  const hqShare = totalRevenue > 0 ? Math.round((hqRevenue / totalRevenue) * 100) : 0;
  const topBranch = branchKPIs.reduce((top, b) => b.revenue > (top?.revenue || 0) ? b : top, branchKPIs[0]);

  const fmt = (n: number) => n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n.toFixed(0)}`;

  const fmtTime = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const TABS = [
    { id: 'overview', label: 'KPI Overview', icon: BarChart3 },
    { id: 'branches', label: 'Branch Matrix', icon: Building2 },
    { id: 'activity', label: 'Live Feed', icon: Activity },
  ] as const;

  return (
    <div className="space-y-8 pb-24">

      {/* Page Header */}
      <div className={`border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} pb-6 flex items-start justify-between flex-wrap gap-4`}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: themeConfig.light }}
            >
              <Crown className="w-4 h-4" style={{ color: themeConfig.primary }} />
            </div>
            <PageHead eyebrow="Super Admin" title="Command Center" />
          </div>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/50'} ml-12`}>
            Real-time cross-branch analytics, revenue matrix, and franchise health monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${
            isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {activeBranches} Active
          </span>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
            isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-white/5 text-gray-400 border border-white/10'
          }`}>
            {branches.length} Total Branches
          </span>
        </div>
      </div>

      {/* Enterprise KPI Hero Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            label: 'Combined Revenue',
            value: fmt(totalRevenue),
            sub: 'All branches combined',
            icon: DollarSign,
            color: themeConfig.primary,
            bg: themeConfig.light,
          },
          {
            label: "Owner's HQ Revenue",
            value: fmt(hqRevenue),
            sub: `Hyderabad HQ (${hqShare}% share)`,
            icon: Building2,
            color: '#10B981',
            bg: 'rgba(16,185,129,0.1)',
          },
          {
            label: 'Total Orders',
            value: totalOrders.toLocaleString(),
            sub: `Across ${activeBranches} active branches`,
            icon: ShoppingBag,
            color: '#3b82f6',
            bg: 'rgba(59,130,246,0.1)',
          },
          {
            label: 'Royalty Collected',
            value: fmt(totalRoyalty),
            sub: 'Franchise royalties due',
            icon: Target,
            color: '#a855f7',
            bg: 'rgba(168,85,247,0.1)',
          },
          {
            label: 'Top Branch',
            value: topBranch?.name?.split(' ')[0] || '—',
            sub: topBranch ? `${fmt(topBranch.revenue)} revenue` : 'No data',
            icon: Star,
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Glass className={`p-5 border-[var(--border-card)] hover:border-[var(--text-muted)] transition-all group`}>
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: kpi.bg }}
                >
                  <kpi.icon className="w-4.5 h-4.5" style={{ color: kpi.color }} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-transparent group-hover:text-[var(--text-muted)] transition-colors" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">{kpi.label}</p>
                <p className="text-2xl font-black text-[var(--text-primary)] font-mono tracking-tight">{kpi.value}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">{kpi.sub}</p>
              </div>
            </Glass>
          </motion.div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className={`flex gap-1 p-1 rounded-2xl border w-fit ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.06]'}`}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={isActive ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive ? 'shadow-md' : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* KPI OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Revenue Comparison Bar Chart */}
            <Glass className="p-7 border-[var(--border-card)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" style={{ color: themeConfig.primary }} />
                    Revenue Distribution
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Cumulative revenue by franchise branch</p>
                </div>
                <span className="text-xs font-mono font-bold text-[var(--text-muted)]">Total: {fmt(totalRevenue)}</span>
              </div>

              <div className="space-y-4">
                {branchKPIs
                  .filter(b => b.status === 'active')
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((branch, i) => {
                    const pct = totalRevenue > 0 ? (branch.revenue / totalRevenue) * 100 : 0;
                    return (
                      <div key={branch.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold font-mono w-5 text-center ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                              #{i + 1}
                            </span>
                            <span className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[160px]">{branch.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-gray-400'}`}>
                              {branch.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{fmt(branch.revenue)}</span>
                            <div className={`flex items-center gap-1 text-[11px] font-bold ${
                              branch.trend === 'up' ? 'text-emerald-500' : branch.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {branch.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : branch.trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
                              {branch.trendPct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className={`w-full h-2.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{
                              background: i === 0
                                ? `linear-gradient(90deg, ${themeConfig.primary}, ${themeConfig.primary}cc)`
                                : i === 1
                                  ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                                  : 'linear-gradient(90deg, #6b7280, #9ca3af)',
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                          <span>{pct.toFixed(1)}% of total</span>
                          <span>·</span>
                          <span>{branch.orderCount} orders</span>
                          <span>·</span>
                          <span>Avg {fmt(branch.avgOrderValue)}/order</span>
                          <span>·</span>
                          <span className="text-amber-500">
                            {branch.id === 'branch-hyderabad-hq' || branch.code === 'HYD-01' ? 'Company HQ (0% Royalty)' : `Royalty ${fmt(branch.royaltyAmount)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Glass>

            {/* Royalty Ledger */}
            <Glass className="p-7 border-[var(--border-card)]">
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 mb-5">
                <Target className="w-4 h-4 text-amber-500" />
                Royalty Ledger
              </h3>
              <div className={`rounded-2xl overflow-hidden border ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}>
                      {['Branch', 'City', 'Revenue', 'Rate', 'Royalty Due', 'Status'].map(h => (
                        <th key={h} className={`px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branchKPIs.map((b, i) => (
                      <tr
                        key={b.id}
                        className={`border-t transition-colors ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}
                      >
                        <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{b.name}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{b.city || '—'}</td>
                        <td className="px-4 py-3 font-mono font-bold" style={{ color: themeConfig.primary }}>{fmt(b.revenue)}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01' ? (
                            <span className="text-amber-500 font-semibold">0% (HQ Owned)</span>
                          ) : (
                            `${b.royaltyPct}%`
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-amber-500">
                          {b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01' ? (
                            <span className="text-[var(--text-muted)] font-normal text-[11px]">₹0 (HQ Flagship)</span>
                          ) : (
                            fmt(b.royaltyAmount)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            b.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className={`border-t-2 font-bold ${isLight ? 'border-slate-300 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                      <td className="px-4 py-3 text-[var(--text-primary)]" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-3 font-mono" style={{ color: themeConfig.primary }}>{fmt(totalRevenue)}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">—</td>
                      <td className="px-4 py-3 font-mono text-amber-500">{fmt(totalRoyalty)}</td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </Glass>

            {/* Weekly S3 Automated Backup & Archive Governance Card */}
            <Glass className="p-7 border-[var(--border-card)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                      Weekly Business Archive Pipeline
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase font-bold">
                        AWS S3 · Active
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Extracts previous week's orders, itemized ledger, attendance, and sales analytics from DynamoDB into an encrypted, versioned Amazon S3 archive.
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-[var(--text-muted)] font-mono">
                      <span className="flex items-center gap-1">
                        <Database className="w-3.5 h-3.5 text-amber-500" />
                        Target: <strong className="text-[var(--text-secondary)]">s3://manohaa-hotel-backups/</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        Schedule: <strong className="text-[var(--text-secondary)]">Mondays 02:00 UTC (0 2 * * 1)</strong>
                      </span>
                      <span className="text-emerald-500 font-semibold">
                        AES-256 Encrypted · Glacier 90D Policy
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isBackingUp}
                    onClick={handleManualBackup}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer disabled:opacity-50 shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: themeConfig.primary,
                      color: themeConfig.textOnAccent,
                      borderColor: themeConfig.primary,
                    }}
                  >
                    {isBackingUp ? (
                      <>
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Archiving to S3...</span>
                      </>
                    ) : (
                      <>
                        <CloudDownload className="w-3.5 h-3.5" />
                        <span>Trigger Backup Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {backupMessage && (
                <div className={`mt-4 p-3 rounded-xl text-xs font-mono border ${
                  backupMessage.startsWith('Error') 
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {backupMessage}
                </div>
              )}
            </Glass>
          </motion.div>
        )}

        {/* BRANCH MATRIX TAB */}
        {activeTab === 'branches' && (
          <motion.div
            key="branches"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {branchKPIs.map((branch, i) => (
              <motion.div
                key={branch.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
              >
                <Glass className={`p-6 border-[var(--border-card)] transition-all hover:shadow-xl cursor-pointer group ${
                  selectedBranch === branch.id ? 'ring-2' : ''
                }`}
                  style={selectedBranch === branch.id ? { ringColor: themeConfig.primary } as any : {}}
                  onClick={() => onSelectBranch(branch.id)}
                >
                  {/* Branch Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black"
                        style={{ backgroundColor: themeConfig.light, color: themeConfig.primary }}
                      >
                        {branch.code?.slice(0, 3) || branch.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--text-primary)] truncate max-w-[140px] group-hover:max-w-none transition-all">{branch.name}</h4>
                        <p className="text-xs text-[var(--text-muted)]">{branch.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {branch.status === 'active'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <XCircle className="w-4 h-4 text-red-400" />
                      }
                      <span className={`text-[10px] font-bold uppercase ${branch.status === 'active' ? 'text-emerald-500' : 'text-red-400'}`}>
                        {branch.status}
                      </span>
                    </div>
                  </div>

                  {/* Revenue & Orders */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${isLight ? 'bg-slate-50' : 'bg-black/20'}`}>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Revenue</p>
                      <p className="text-lg font-black font-mono text-[var(--text-primary)] mt-0.5">{fmt(branch.revenue)}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${isLight ? 'bg-slate-50' : 'bg-black/20'}`}>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Orders</p>
                      <p className="text-lg font-black font-mono text-[var(--text-primary)] mt-0.5">{branch.orderCount}</p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Avg: <span className="font-bold text-[var(--text-secondary)]">{fmt(branch.avgOrderValue)}</span></span>
                    <span className="text-amber-500 font-bold">
                      {branch.id === 'branch-hyderabad-hq' || branch.code === 'HYD-01' ? 'HQ: ₹0' : `Royalty: ${fmt(branch.royaltyAmount)}`}
                    </span>
                    <div className={`flex items-center gap-1 font-bold ${
                      branch.trend === 'up' ? 'text-emerald-500' : branch.trend === 'down' ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      {branch.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : branch.trend === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                      {branch.trendPct > 0 ? `${branch.trendPct.toFixed(1)}%` : 'Flat'}
                    </div>
                  </div>

                  {branch.lastActivity && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-3 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last activity: {fmtTime(branch.lastActivity)}
                    </p>
                  )}
                </Glass>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* LIVE ACTIVITY FEED TAB */}
        {activeTab === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Glass className="p-7 border-[var(--border-card)]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Cross-Branch Activity Feed
                </h3>
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>

              {recentActivity.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No activity yet. Orders will appear here as they come in.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((activity, i) => (
                    <motion.div
                      key={`${activity.branch_id}-${activity.time}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-colors ${
                        isLight ? 'bg-white border-slate-100 hover:bg-slate-50' : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black"
                        style={{ backgroundColor: themeConfig.light, color: themeConfig.primary }}
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {activity.table || 'New Order'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {activity.branch_name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {activity.amount != null && (
                          <p className="text-sm font-bold font-mono" style={{ color: themeConfig.primary }}>
                            {fmt(activity.amount)}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--text-muted)]">{fmtTime(activity.time)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
