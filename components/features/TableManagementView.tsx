'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, Users, Clock, CheckCircle2, AlertCircle, Plus, 
  RotateCw, RefreshCcw, Sparkles, Filter, ChevronRight, DollarSign,
  Coffee, ShieldCheck, Flame, Receipt, X, ArrowUpRight, ChefHat
} from 'lucide-react';
import { RestaurantTable, TableStatus, Branch, LedgerEntry } from '@/types';
import { inr } from '@/lib/utils';
import { PageHead, Glass } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/LuxuryNotifications';
import { useTheme } from '@/lib/theme-context';

interface TableManagementViewProps {
  branches?: Branch[];
  selectedBranch?: string;
  onSelectBranch?: (branchId: string) => void;
  isSuperAdmin?: boolean;
  ledger?: LedgerEntry[];
  onOpenPos?: (tableNumber: string, branchId: string) => void;
}

const STATUS_CONFIG: Record<TableStatus, {
  label: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  glow: string;
  borderColor: string;
}> = {
  vacant: {
    label: 'Vacant',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    glow: 'shadow-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  seated: {
    label: 'Seated',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    dotColor: 'bg-amber-400',
    glow: 'shadow-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  kot_sent: {
    label: 'Cooking (KOT)',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-400',
    dotColor: 'bg-orange-500',
    glow: 'shadow-orange-500/15',
    borderColor: 'border-orange-500/40',
  },
  billed: {
    label: 'Billed',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-400',
    dotColor: 'bg-sky-400',
    glow: 'shadow-sky-500/10',
    borderColor: 'border-sky-500/30',
  },
  dirty: {
    label: 'Sanitizing',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-400',
    dotColor: 'bg-purple-400',
    glow: 'shadow-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
};

export default function TableManagementView({
  branches = [],
  selectedBranch = 'ALL',
  onSelectBranch,
  isSuperAdmin = true,
  ledger = [],
  onOpenPos,
}: TableManagementViewProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === 'light';
  const toast = useToast();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Add Table Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTableNum, setNewTableNum] = useState('');
  const [newSection, setNewSection] = useState('Main AC Hall');
  const [newCapacity, setNewCapacity] = useState('4');
  const [isCreating, setIsCreating] = useState(false);

  // Seat Table Quick Modal
  const [seatingTable, setSeatingTable] = useState<RestaurantTable | null>(null);
  const [seatCovers, setSeatCovers] = useState('2');
  const [seatWaiter, setSeatWaiter] = useState('');
  const [isSeating, setIsSeating] = useState(false);

  const effectiveBranchId = useMemo(() => {
    if (selectedBranch && selectedBranch !== 'ALL') return selectedBranch;
    return branches[0]?.id || 'branch-hyderabad-hq';
  }, [selectedBranch, branches]);

  const activeBranch = useMemo(() => {
    return branches.find((b) => b.id === effectiveBranchId) || {
      id: effectiveBranchId,
      name: 'Hyderabad Highway HQ',
    };
  }, [branches, effectiveBranchId]);

  // Fetch Tables
  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tables?branch_id=${effectiveBranchId}`);
      if (!res.ok) throw new Error('Failed to load table floor plan');
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error('Table Error', err.message || 'Could not fetch tables');
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, toast]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Unique Sections
  const sections = useMemo(() => {
    const list = Array.from(new Set(tables.map((t) => t.section || 'Main AC Hall')));
    return ['all', ...list];
  }, [tables]);

  // Active Order Amount Lookup for each Table
  const tableRevenueMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!ledger || ledger.length === 0) return map;

    ledger.forEach((entry) => {
      if (!entry.table_number) return;
      const raw = entry.table_number.split('|')[0].trim().toUpperCase();
      const current = map.get(raw) || 0;
      map.set(raw, current + (entry.total_price || 0));
    });
    return map;
  }, [ledger]);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchSection = selectedSection === 'all' || t.section === selectedSection;
      const matchStatus = selectedStatus === 'all' || t.status === selectedStatus;
      return matchSection && matchStatus;
    });
  }, [tables, selectedSection, selectedStatus]);

  // Telemetry KPIs
  const stats = useMemo(() => {
    const total = tables.length;
    const occupied = tables.filter((t) => t.status === 'seated' || t.status === 'kot_sent' || t.status === 'billed').length;
    const vacant = tables.filter((t) => t.status === 'vacant').length;
    const totalCovers = tables.reduce((acc, t) => acc + (t.status !== 'vacant' ? (t.covers || 0) : 0), 0);
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    let liveRevenue = 0;
    tables.forEach((t) => {
      if (t.status !== 'vacant') {
        liveRevenue += tableRevenueMap.get(t.table_number.toUpperCase()) || 0;
      }
    });

    return { total, occupied, vacant, totalCovers, occupancyRate, liveRevenue };
  }, [tables, tableRevenueMap]);

  // Update Table Status
  const handleUpdateStatus = async (
    table: RestaurantTable,
    newStatus: TableStatus,
    extra?: { covers?: number; waiter_name?: string; active_order_id?: string | null }
  ) => {
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: table.id,
          branch_id: effectiveBranchId,
          status: newStatus,
          ...extra,
        }),
      });

      if (!res.ok) throw new Error('Status update failed');
      const updated = await res.json();

      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(`Table ${table.table_number}`, `Marked as ${STATUS_CONFIG[newStatus].label}`);
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Could not update status');
    }
  };

  // Seat Guests Modal Submit
  const handleSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatingTable) return;
    setIsSeating(true);
    try {
      await handleUpdateStatus(seatingTable, 'seated', {
        covers: Number(seatCovers) || 2,
        waiter_name: seatWaiter.trim() || undefined,
      });
      setSeatingTable(null);
      setSeatWaiter('');
      setSeatCovers('2');
    } finally {
      setIsSeating(false);
    }
  };

  // Add Table Modal Submit
  const handleAddTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: newTableNum.trim().toUpperCase(),
          section: newSection.trim() || 'Main AC Hall',
          capacity: Number(newCapacity) || 4,
          branch_id: effectiveBranchId,
          branch_name: activeBranch.name,
        }),
      });

      if (!res.ok) throw new Error('Failed to create table');
      const created = await res.json();

      setTables((prev) => [...prev, created].sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true })));
      setIsAddModalOpen(false);
      setNewTableNum('');
      toast.success('Table Added', `Created ${created.table_number} in ${created.section}`);
    } catch (err: any) {
      toast.error('Creation Failed', err.message || 'Could not create table');
    } finally {
      setIsCreating(false);
    }
  };

  // Elapsed Time Calculator
  const getElapsedMinutes = (seatedAt?: string | null) => {
    if (!seatedAt) return null;
    try {
      const diff = Math.floor((Date.now() - new Date(seatedAt).getTime()) / 60000);
      return diff >= 0 ? diff : 0;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl sm:text-3xl font-serif font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Floor Plan & Table Command
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE TELEMETRY
            </span>
          </div>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
            Real-time table turnover, covers occupancy, and dining flow for{' '}
            <span className="font-semibold text-amber-500">{activeBranch.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchTables()}
            className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
              isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
            title="Refresh Table State"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Glass className="p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Total Tables</span>
          <span className="text-2xl font-black font-mono text-white mt-1">{stats.total}</span>
        </Glass>

        <Glass className="p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Available</span>
          <span className="text-2xl font-black font-mono text-emerald-400 mt-1">{stats.vacant}</span>
        </Glass>

        <Glass className="p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Occupied</span>
          <span className="text-2xl font-black font-mono text-amber-400 mt-1">{stats.occupied}</span>
        </Glass>

        <Glass className="p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">Active Covers</span>
          <div className="flex items-center gap-1.5 mt-1">
            <Users className="w-4 h-4 text-sky-400" />
            <span className="text-2xl font-black font-mono text-sky-400">{stats.totalCovers}</span>
          </div>
        </Glass>

        <Glass className="p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">Occupancy</span>
          <span className="text-2xl font-black font-mono text-purple-400 mt-1">{stats.occupancyRate}%</span>
        </Glass>

        <Glass className="p-4 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Active Bill</span>
          <span className="text-xl font-black font-mono text-emerald-300 mt-1 truncate">
            {inr(stats.liveRevenue)}
          </span>
        </Glass>
      </div>

      {/* Filter Tabs Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {sections.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSection(sec)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedSection === sec
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                  : isLight
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {sec === 'all' ? 'All Floor Areas' : sec}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {['all', 'vacant', 'seated', 'kot_sent', 'billed', 'dirty'].map((st) => {
            const isSelected = selectedStatus === st;
            return (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  isSelected
                    ? 'bg-white text-black font-bold'
                    : isLight
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {st === 'all' ? 'All Statuses' : STATUS_CONFIG[st as TableStatus]?.label || st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tables Grid */}
      {loading && tables.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <RotateCw className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : filteredTables.length === 0 ? (
        <Glass className="p-12 text-center rounded-3xl">
          <Utensils className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Tables Match Filter</h3>
          <p className="text-xs text-gray-400 mt-1">Try switching floor section or reset the status filter.</p>
        </Glass>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredTables.map((table) => {
            const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.vacant;
            const elapsed = getElapsedMinutes(table.seated_at);
            const liveBill = tableRevenueMap.get(table.table_number.toUpperCase()) || 0;

            return (
              <Glass
                key={table.id}
                className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between hover:border-amber-500/40 ${config.borderColor} ${config.glow}`}
              >
                {/* Status Glow Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${config.dotColor}`} />

                {/* Top Row: Table # and Status Pill */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black font-mono tracking-tight text-white">
                          {table.table_number}
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                          ({table.capacity}p)
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold truncate max-w-[130px]">
                        {table.section}
                      </p>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${config.badgeBg} ${config.badgeText}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${table.status !== 'vacant' ? 'animate-pulse' : ''}`} />
                      {config.label}
                    </span>
                  </div>

                  {/* Middle Info: Seated Time & Waiter */}
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-xs">
                    {table.status !== 'vacant' ? (
                      <>
                        <div className="flex items-center justify-between text-gray-300">
                          <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Duration</span>
                          </span>
                          <span className="font-mono text-xs font-semibold text-amber-400">
                            {elapsed !== null ? `${elapsed} min` : 'Active'}
                          </span>
                        </div>

                        {table.covers && (
                          <div className="flex items-center justify-between text-gray-300">
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <Users className="w-3.5 h-3.5" />
                              <span>Covers</span>
                            </span>
                            <span className="font-mono text-xs font-semibold">
                              {table.covers} guests
                            </span>
                          </div>
                        )}

                        {liveBill > 0 && (
                          <div className="flex items-center justify-between text-gray-300 pt-0.5">
                            <span className="text-[11px] text-gray-400">Live Bill</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {inr(liveBill)}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-[11px] text-gray-400 italic py-1">
                        Table ready for next guest party.
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Contextual Action Buttons */}
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-1.5">
                  {table.status === 'vacant' && (
                    <button
                      onClick={() => setSeatingTable(table)}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Seat Guests</span>
                    </button>
                  )}

                  {(table.status === 'seated' || table.status === 'kot_sent') && (
                    <>
                      <button
                        onClick={() => {
                          if (onOpenPos) {
                            onOpenPos(table.table_number, table.branch_id);
                          } else {
                            toast.info('POS Terminal', `Order for ${table.table_number}`);
                          }
                        }}
                        className="flex-1 py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] transition-all flex items-center justify-center gap-1 shadow-sm"
                        title="Punch Order in POS"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        <span>Order POS</span>
                      </button>

                      <button
                        onClick={() => handleUpdateStatus(table, 'billed')}
                        className="py-2 px-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-bold text-[11px] transition-all"
                        title="Print Bill"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {table.status === 'billed' && (
                    <button
                      onClick={() => handleUpdateStatus(table, 'dirty')}
                      className="w-full py-2 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>Guests Left &gt; Bus Table</span>
                    </button>
                  )}

                  {table.status === 'dirty' && (
                    <button
                      onClick={() => handleUpdateStatus(table, 'vacant')}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sanitized & Ready</span>
                    </button>
                  )}
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {/* Seat Table Modal */}
      {seatingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#18181b] border border-white/10 rounded-2xl p-6 shadow-2xl text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Seat Guests &gt; {seatingTable.table_number}</h3>
              </div>
              <button onClick={() => setSeatingTable(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSeatSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Number of Covers (Guests)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['1', '2', '4', '6'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSeatCovers(num)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        seatCovers === num
                          ? 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {num} {num === '1' ? 'Guest' : 'Guests'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Assign Waiter / Captain (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh"
                  value={seatWaiter}
                  onChange={(e) => setSeatWaiter(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSeatingTable(null)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSeating}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  {isSeating ? 'Seating...' : 'Confirm Seated'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#18181b] border border-white/10 rounded-2xl p-6 shadow-2xl text-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Add Restaurant Table</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTableSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Table Identifier
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-09, D-05, VIP-01"
                  value={newTableNum}
                  onChange={(e) => setNewTableNum(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Floor Section / Area
                </label>
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="w-full bg-[#202024] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Main AC Hall">Main AC Hall</option>
                  <option value="Highway Deck">Highway Deck (Open Air)</option>
                  <option value="Family Dining">Family Dining</option>
                  <option value="Counter & Bar">Counter & Bar</option>
                  <option value="VIP Lounge">VIP Lounge</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Guest Seating Capacity
                </label>
                <select
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(e.target.value)}
                  className="w-full bg-[#202024] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="2">2 Covers (Cozy)</option>
                  <option value="4">4 Covers (Standard)</option>
                  <option value="6">6 Covers (Family)</option>
                  <option value="8">8 Covers (Large Group)</option>
                  <option value="12">12 Covers (Banquet)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md shadow-amber-500/20"
                >
                  {isCreating ? 'Adding...' : 'Add Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
