'use client';

import { useState, useMemo } from "react";
import {
  Building2, Plus, MapPin, Phone, Mail, KeyRound, Check, X,
  TrendingUp, Shield, Sparkles, AlertCircle, Edit2, ExternalLink,
  DollarSign, ReceiptText, Users, ChefHat, ShoppingBag, Eye, EyeOff
} from "lucide-react";
import { Branch, LedgerEntry } from "@/types";
import { inr } from "@/lib/utils";
import { Glass, PageHead } from "@/components/ui/Primitives";
import { useTheme } from "@/lib/theme-context";
import { useToast, useConfirm } from "@/components/ui/LuxuryNotifications";

interface BranchesViewProps {
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  ledger: LedgerEntry[];
  selectedBranch: string;
  onSelectBranch: (branchId: string) => void;
}

export default function BranchesView({
  branches = [],
  setBranches,
  ledger = [],
  selectedBranch,
  onSelectBranch,
}: BranchesViewProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === 'light';
  const toast = useToast();
  const confirm = useConfirm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showPasscodes, setShowPasscodes] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    city: "",
    address: "",
    phone: "",
    manager_name: "",
    manager_email: "",
    password: "",
    owner_passcode: "9999",
    manager_passcode: "4040",
    waiter_passcode: "1111",
    chef_passcode: "2222",
    royalty_pct: "10",
  });

  // Calculate per-branch revenue and orders from the ledger
  const branchMetrics = useMemo(() => {
    const stats: Record<string, { revenue: number; orders: Set<string>; items: number }> = {};

    branches.forEach((b) => {
      stats[b.id] = { revenue: 0, orders: new Set(), items: 0 };
    });

    // Default fallback branch
    if (!stats["branch-hyderabad-hq"]) {
      stats["branch-hyderabad-hq"] = { revenue: 0, orders: new Set(), items: 0 };
    }

    ledger.forEach((entry: any) => {
      const bId = entry.branch_id || "branch-hyderabad-hq";
      if (!stats[bId]) {
        stats[bId] = { revenue: 0, orders: new Set(), items: 0 };
      }
      stats[bId].revenue += Number(entry.total_price ?? entry.total_amount ?? 0);
      stats[bId].items += Number(entry.quantity || 1);
      if (entry.order_id || entry.id) {
        stats[bId].orders.add(entry.order_id || entry.id);
      }
    });

    return stats;
  }, [branches, ledger]);

  // Overall enterprise totals
  const totalNetworkRevenue = useMemo(() => {
    return ledger.reduce((acc, c: any) => acc + Number(c.total_price ?? c.total_amount ?? 0), 0);
  }, [ledger]);

  const totalRoyaltyEstimated = useMemo(() => {
    return branches.reduce((acc, b) => {
      const isHQ = b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01';
      if (isHQ) return acc; // Corporate HQ does not pay royalty to itself
      const rev = branchMetrics[b.id]?.revenue || 0;
      const pct = b.royalty_pct ?? 10;
      return acc + (rev * pct) / 100;
    }, 0);
  }, [branches, branchMetrics]);

  const openAddModal = () => {
    setEditingBranch(null);
    setFormData({
      name: "",
      code: `FR-0${branches.length + 1}`,
      city: "",
      address: "",
      phone: "",
      manager_name: "",
      manager_email: "",
      password: "Manohaa@Branch2026!",
      owner_passcode: "9999",
      manager_passcode: "4040",
      waiter_passcode: "1111",
      chef_passcode: "2222",
      royalty_pct: "10",
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (b: Branch) => {
    setEditingBranch(b);
    setFormData({
      name: b.name,
      code: b.code,
      city: b.city || "",
      address: b.address || "",
      phone: b.phone || "",
      manager_name: b.manager_name || "",
      manager_email: b.manager_email || "",
      password: b.password || "",
      owner_passcode: b.owner_passcode || "9999",
      manager_passcode: b.manager_passcode || "4040",
      waiter_passcode: b.waiter_passcode || "1111",
      chef_passcode: b.chef_passcode || "2222",
      royalty_pct: String(b.royalty_pct ?? ((b.id === 'branch-hyderabad-hq' || b.code === 'HYD-01') ? 0 : 10)),
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Please provide a branch name.");
      return;
    }
    const isEdit = !!editingBranch;
    const confirmed = await confirm({
      title: isEdit ? `Save Changes to ${formData.name}?` : `Register New Franchise?`,
      description: isEdit
        ? `Confirm updating franchise configurations and manager credentials for "${formData.name}".`
        : `Confirm registering new franchise branch "${formData.name}" (${formData.code || 'Auto-Code'}) into the enterprise network.`,
      confirmText: isEdit ? "Save Branch Changes" : "Register Franchise",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingBranch) {
        // Update
        const res = await fetch("/api/branches", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingBranch.id,
            ...formData,
            royalty_pct: Number(formData.royalty_pct || 10),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update branch");
        setBranches((prev) => prev.map((b) => (b.id === editingBranch.id ? data.branch : b)));
      } else {
        // Create
        const res = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            royalty_pct: Number(formData.royalty_pct || 10),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create franchise branch");
        setBranches((prev) => [...prev, data.branch]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Operation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasscodeVisibility = (id: string) => {
    setShowPasscodes((p) => ({ ...p, [id]: !p[id] }));
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} pb-6`}>
        <div>
          <PageHead eyebrow="Enterprise Network • Multi-Branch Operations" title="Franchise & Branch Management" />
          <p className={`text-xs ${isLight ? 'text-slate-600 font-medium' : 'text-white/50'} mt-1`}>
            Decentralized restaurant franchises, manager passcodes, royalty governance, and location performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            style={{ backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:brightness-110 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Franchise</span>
          </button>
        </div>
      </div>

      {/* Enterprise KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Glass className="p-5 flex items-center justify-between">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Network Franchises</p>
            <h3 className="text-2xl font-black font-serif mt-1">{branches.length} <span className="text-xs font-sans font-normal text-emerald-500">Active</span></h3>
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-500/10 text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
        </Glass>

        <Glass className="p-5 flex items-center justify-between">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Combined Gross Revenue</p>
            <h3 className="text-2xl font-black font-serif mt-1" style={{ color: themeConfig.primary }}>{inr(totalNetworkRevenue)}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/10 text-amber-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </Glass>

        <Glass className="p-5 flex items-center justify-between">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Est. Royalty Share</p>
            <h3 className="text-2xl font-black font-serif mt-1 text-emerald-500">{inr(totalRoyaltyEstimated)}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </Glass>

        <Glass className="p-5 flex items-center justify-between">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-white/40'}`}>Current View Context</p>
            <h3 className="text-sm font-bold truncate mt-1">
              {selectedBranch === 'ALL' ? '🌐 All Branches (CEO)' : (branches.find(b => b.id === selectedBranch)?.name || 'Selected Branch')}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-purple-500/10 text-purple-400">
            <Shield className="w-6 h-6" />
          </div>
        </Glass>
      </div>

      {/* Franchise Branch Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {branches.map((branch) => {
          const stats = branchMetrics[branch.id] || { revenue: 0, orders: new Set(), items: 0 };
          const isCurrentActive = selectedBranch === branch.id;
          const showPins = showPasscodes[branch.id];

          return (
            <Glass
              key={branch.id}
              className={`p-6 relative overflow-hidden transition-all duration-300 border ${
                isCurrentActive
                  ? isLight ? 'border-amber-500 shadow-lg bg-amber-50/20' : 'border-amber-400/50 shadow-2xl bg-amber-500/[0.04]'
                  : isLight ? 'border-slate-200' : 'border-white/[0.06]'
              }`}
            >
              {/* Top Row: Name, Code, Badges */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
                    style={{ backgroundColor: themeConfig.light, borderColor: themeConfig.border, color: themeConfig.primary }}
                  >
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif font-bold text-lg truncate">{branch.name}</h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                        branch.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {branch.code || 'BRANCH'}
                      </span>
                    </div>
                    <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{branch.address || branch.city || 'Highway Road'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEditModal(branch)}
                    title="Edit Branch Settings"
                    className={`p-2 rounded-xl transition-colors ${
                      isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-white/50'
                    }`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className={`grid grid-cols-3 gap-3 p-3.5 rounded-2xl mb-4 border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/[0.05]'}`}>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Gross Sales</p>
                  <p className="font-serif font-bold text-sm mt-0.5" style={{ color: themeConfig.primary }}>{inr(stats.revenue)}</p>
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Orders Logged</p>
                  <p className="font-mono font-bold text-sm mt-0.5">{stats.orders.size}</p>
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Royalty Rate</p>
                  <p className="font-mono font-bold text-sm text-emerald-500 mt-0.5">
                    {branch.id === 'branch-hyderabad-hq' || branch.code === 'HYD-01' ? (
                      <span className="text-amber-500 text-xs font-bold">0% (HQ Flagship)</span>
                    ) : (
                      `${branch.royalty_pct ?? 10}%`
                    )}
                  </p>
                </div>
              </div>

              {/* Manager & Contact */}
              <div className="space-y-1.5 text-xs mb-4">
                <div className="flex items-center justify-between">
                  <span className={isLight ? 'text-slate-500' : 'text-white/40'}>Branch Manager:</span>
                  <span className="font-bold">{branch.manager_name || 'Assigned Manager'}</span>
                </div>
                {branch.phone && (
                  <div className="flex items-center justify-between">
                    <span className={isLight ? 'text-slate-500' : 'text-white/40'}>Direct Contact:</span>
                    <span className="font-mono text-xs font-semibold">{branch.phone}</span>
                  </div>
                )}
              </div>

              {/* Branch Manager Credentials Box (AWS Cognito) */}
              <div className={`p-3.5 rounded-2xl border mb-5 ${isLight ? 'bg-sky-50/50 border-sky-200/60' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${isLight ? 'text-sky-800' : 'text-sky-400'}`}>
                    <KeyRound className="w-3 h-3" />
                    <span>Manager Credentials · AWS Cognito</span>
                  </span>
                  <button
                    onClick={() => togglePasscodeVisibility(branch.id)}
                    className={`text-[11px] font-bold flex items-center gap-1 ${isLight ? 'text-slate-600 hover:text-black' : 'text-white/60 hover:text-white'}`}
                  >
                    {showPins ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPins ? 'Hide Password' : 'Show Password'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Branch ID / Code</p>
                    <p className="font-mono font-bold text-xs mt-0.5 text-sky-400 truncate" title={branch.id}>
                      {branch.code} <span className="text-[10px] text-gray-500 font-normal">({branch.id})</span>
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Manager Password</p>
                    <p className="font-mono font-bold text-xs mt-0.5 tracking-wider">
                      {showPins ? branch.password || 'Manohaa@2026!' : '••••••••'}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 px-0.5">
                  Controlled by Branch Manager. Waiter and Kitchen staff access is handled in the Mobile POS App.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectBranch(branch.id)}
                  style={isCurrentActive ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isCurrentActive
                      ? 'shadow-md'
                      : isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        : 'bg-white/5 hover:bg-white/10 text-white'
                  }`}
                >
                  {isCurrentActive ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                  <span>{isCurrentActive ? 'Viewing This Branch' : 'Inspect This Branch'}</span>
                </button>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* CREATE / EDIT FRANCHISE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`max-w-xl w-full rounded-3xl p-6 sm:p-8 border shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#121216] border-white/10 text-white'
          }`}>
            <button
              onClick={() => setModalOpen(false)}
              className={`absolute top-6 right-6 p-2 rounded-xl ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-white/40'}`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/40'}`}>
                {editingBranch ? 'Edit Franchise Configuration' : 'Expand Enterprise Network'}
              </span>
              <h3 className="text-xl font-serif font-bold mt-1">
                {editingBranch ? `Edit: ${editingBranch.name}` : 'Register New Franchise Branch'}
              </h3>
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-[11px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bodhgaya Heritage Plaza"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
                    Branch Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BDG-02"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-[11px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
                    City / Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bodhgaya"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
                    Franchise Royalty (%)
                    {editingBranch && (editingBranch.id === 'branch-hyderabad-hq' || editingBranch.code === 'HYD-01') && (
                      <span className="ml-2 text-[10px] text-amber-500 font-semibold normal-case">(Company Flagship: 0%)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="10"
                    value={formData.royalty_pct}
                    onChange={(e) => setFormData({ ...formData, royalty_pct: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
                  Full Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. NH 83 Main Temple Road, Bodhgaya"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-[11px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
                    Manager Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Verma"
                    value={formData.manager_name}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
                    Manager Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 00000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border outline-none ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Branch Manager Password Box (AWS Cognito) */}
              <div className={`p-4 rounded-2xl border ${isLight ? 'bg-sky-50/50 border-sky-200' : 'bg-white/[0.02] border-white/10'}`}>
                <p className={`text-[10px] font-extrabold uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${isLight ? 'text-sky-800' : 'text-sky-400'}`}>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Branch Manager Password (AWS Cognito)</span>
                </p>
                <p className={`text-[11px] mb-3 ${isLight ? 'text-slate-500' : 'text-white/40'}`}>
                  Used to authenticate the Branch Manager into this Web Admin Command Center. Waiter and Kitchen interfaces are separated on the upcoming Mobile POS App.
                </p>

                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1.5 ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                    Manager Password
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Manohaa@Branch2026!"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`w-full px-4 py-2.5 font-mono font-medium rounded-xl text-xs border outline-none ${
                      isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`}
                  />
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    Synchronized with AWS Cognito User Pool with secure DynamoDB backup.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent }}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Franchise...' : editingBranch ? 'Update Franchise' : 'Create Franchise Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
