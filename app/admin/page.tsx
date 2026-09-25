'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, Layers, UtensilsCrossed, ShoppingCart, 
  MessageSquare, Menu as MenuIcon, X, LogOut, AlertTriangle, 
  RefreshCcw, Clock, Loader2, Crown, Sparkles, Settings as SettingsIcon,
  ReceiptText, UserCheck, Building2, ChevronDown, Utensils
} from 'lucide-react';
import { Category, Dish, LedgerEntry, Review, Branch } from "@/types";
import { Glass, inputCls } from "@/components/ui/Primitives";
import { useTheme } from "@/lib/theme-context";

// Feature Views
import OverviewView from "@/components/features/OverviewView";
import StructureView from "@/components/features/StructureView";
import MenuView from "@/components/features/MenuView";
import LedgerView from "@/components/features/LedgerView";
import OrdersHistoryView from "@/components/features/OrdersHistoryView";
import TableManagementView from "@/components/features/TableManagementView";
import ReviewsView from "@/components/features/ReviewsView";
import IntelligenceView from "@/components/features/IntelligenceView";
import SettingsView from "@/components/features/SettingsView";
import AttendanceView from "@/components/features/AttendanceView";
import BranchesView from "@/components/features/BranchesView";
import SuperAdminView from "@/components/features/SuperAdminView";

// ENTERPRISE NAVIGATION IA
const NAVIGATION = [
  {
    group: 'Analytics',
    items: [
      { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
    ]
  },
  {
    group: 'Operations',
    items: [
      { id: 'tables', label: 'Floor Plan & Tables', icon: Utensils },
      { id: 'orders', label: 'Order History', icon: ReceiptText },
      { id: 'ledger', label: 'Point of Sale', icon: ShoppingCart },
      { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
      { id: 'attendance', label: 'Staff Attendance', icon: UserCheck },
    ]
  },
  {
    group: 'Enterprise',
    items: [
      { id: 'superadmin', label: 'Super Admin Hub', icon: Crown },
      { id: 'branches', label: 'Franchise Network', icon: Building2 },
    ]
  },
  {
    group: 'Intelligence',
    items: [
      { id: 'reviews', label: 'Customer Feedback', icon: MessageSquare },
      { id: 'intelligence', label: 'AI Deep Analysis', icon: Sparkles },
    ]
  },
  {
    group: 'Settings',
    items: [
      { id: 'structure', label: 'Menu Structure', icon: Layers },
      { id: 'settings', label: 'System & Themes', icon: SettingsIcon },
    ]
  }
];

export default function AdminCommandCenter() {
  const router = useRouter();
  const { mode, toggleMode, palette, themeConfig } = useTheme();
  const isLight = mode === "light";

  const [view, setView] = useState<string>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [activePosTable, setActivePosTable] = useState<string | null>(null);

  // Role-based access
  const [sessionRole, setSessionRole] = useState<string>('super_admin');
  const [sessionBranchId, setSessionBranchId] = useState<string>('ALL');
  const [sessionBranchName, setSessionBranchName] = useState<string>('All Branches');
  const [allowBranchMenu, setAllowBranchMenu] = useState<boolean>(false);
  const isSuperAdmin = sessionRole === 'super_admin';

  // Build role-aware navigation
  const visibleNavigation = NAVIGATION.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Menu & Structure: visible to all if super admin, OR if branch menu management is enabled (and role >= manager)
      if (item.id === 'menu' || item.id === 'structure') {
        return isSuperAdmin || allowBranchMenu;
      }
      // Super Admin Hub & Franchise Network: super admin only
      if (item.id === 'branches' || item.id === 'superadmin') return isSuperAdmin;
      // Analytics & AI: manager and above
      if (item.id === 'analytics' || item.id === 'intelligence') {
        return isSuperAdmin || ['owner', 'manager'].includes(sessionRole);
      }
      // Everything else visible
      return true;
    })
  })).filter(group => group.items.length > 0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch session role and system settings on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/auth').then(r => r.json()).catch(() => ({ user: null })),
      fetch('/api/settings').then(r => r.json()).catch(() => ({ allow_branch_menu_management: false })),
    ]).then(([authData, settingsData]) => {
      if (authData.user) {
        setSessionRole(authData.user.role || 'super_admin');
        setSessionBranchId(authData.user.branch_id || 'ALL');
        setSessionBranchName(authData.user.branch_name || 'All Branches');
        // For branch users, pre-set their branch filter
        if (authData.user.branch_id && authData.user.branch_id !== 'ALL') {
          setSelectedBranch(authData.user.branch_id);
        }
      }
      setAllowBranchMenu(!!settingsData.allow_branch_menu_management);
    });
  }, []);

  const fetchGlobalTelemetry = async (isSilentSync = false) => {
    try {
      if (!isSilentSync) setStatus('loading');
      setErrorMessage(null);
      
      const [catsRes, itemsRes, ledgerRes, revsRes, branchesRes] = await Promise.all([
        fetch('/api/categories').then(r => r.json()).catch(() => []),
        fetch('/api/menu').then(r => r.json()).catch(() => []),
        fetch('/api/orders?format=ledger').then(r => r.json()).catch(() => []),
        fetch('/api/reviews').then(r => r.json()).catch(() => []),
        fetch('/api/branches').then(r => r.json()).catch(() => []),
      ]);

      setCategories(Array.isArray(catsRes) ? catsRes : []);
      setDishes(Array.isArray(itemsRes) ? itemsRes : []);
      setLedger(Array.isArray(ledgerRes) ? ledgerRes : []);
      setReviews(Array.isArray(revsRes) ? revsRes : []);
      setBranches(Array.isArray(branchesRes) ? branchesRes : []);
      
      if (!isSilentSync) setStatus('success');
    } catch (err: any) {
      console.error("Telemetry Sync Failed:", err);
      if (!isSilentSync) {
        setErrorMessage(err.message || "Unable to establish secure connection to the database.");
        setStatus('error');
      }
    }
  };

  useEffect(() => {
    fetchGlobalTelemetry(false);

    // Real-time updates via Server-Sent Events (SSE) with fine-grained delta mutations
    let eventSource: EventSource | null = null;
    const handlePushUpdate = () => fetchGlobalTelemetry(true);

    const handleOrderCreated = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        const newItems = payload.items || (payload.data && payload.data.items);
        if (newItems && Array.isArray(newItems) && newItems.length > 0) {
          setLedger((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const filteredNew = newItems.filter((i: any) => !existingIds.has(i.id));
            if (filteredNew.length === 0) return prev;
            return [...filteredNew, ...prev];
          });
          return;
        }
      } catch {}
      fetchGlobalTelemetry(true);
    };

    const handleOrderUpdated = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        const targetOrderId = payload.order_id || (payload.data && payload.data.order_id);
        const targetStatus = payload.status || (payload.data && payload.data.status);
        const matchedIds: string[] = payload.matched_order_ids || (payload.data && payload.data.matched_order_ids) || [];

        if (targetOrderId && targetStatus) {
          const cleanTarget = String(targetOrderId).replace(/^#/, '').toLowerCase().trim();
          const targetSet = new Set<string>([
            cleanTarget,
            String(targetOrderId).toLowerCase().trim(),
            ...matchedIds.map((id: string) => String(id).replace(/^#/, '').toLowerCase().trim()),
            ...matchedIds.map((id: string) => String(id).toLowerCase().trim()),
          ].filter(Boolean));

          setLedger((prev) =>
            prev.map((entry) => {
              const entryOrder = (entry.order_id || '').replace(/^#/, '').toLowerCase().trim();
              const entryClient = ((entry as any).client_order_id || '').replace(/^#/, '').toLowerCase().trim();
              const entryId = (entry.id || '').replace(/^#/, '').toLowerCase().trim();

              if (
                targetSet.has(entryOrder) ||
                targetSet.has(entryClient) ||
                targetSet.has(entryId)
              ) {
                return { ...entry, status: targetStatus };
              }
              return entry;
            })
          );
        }
      } catch (err) {
        console.warn("handleOrderUpdated parse error:", err);
      }
      // Always trigger fresh telemetry sync for authoritative numbers across all KPIs
      fetchGlobalTelemetry(true);
    };

    try {
      eventSource = new EventSource('/api/realtime');
      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'order_created') {
            handleOrderCreated(e);
          } else if (payload.type === 'order_updated' || payload.type === 'order_update') {
            handleOrderUpdated(e);
          } else if ([
            'menu_update',
            'category_update',
            'review_update',
            'branch_update'
          ].includes(payload.type)) {
            fetchGlobalTelemetry(true);
          }
        } catch (parseErr) {}
      };

      eventSource.addEventListener('order_created', handleOrderCreated as EventListener);
      eventSource.addEventListener('order_updated', handleOrderUpdated as EventListener);
      eventSource.addEventListener('order_update', handleOrderUpdated as EventListener);
      eventSource.addEventListener('menu_update', handlePushUpdate);
      eventSource.addEventListener('category_update', handlePushUpdate);
      eventSource.addEventListener('review_update', handlePushUpdate);
      eventSource.addEventListener('branch_update', handlePushUpdate);
    } catch (sseErr) {
      console.warn("SSE not available, relying on manual refresh:", sseErr);
    }

    // Polling fallback every 60 seconds for background safety
    const pollInterval = setInterval(() => {
      fetchGlobalTelemetry(true);
    }, 60000);
    
    return () => { 
      if (eventSource) {
        eventSource.removeEventListener('order_created', handleOrderCreated as EventListener);
        eventSource.removeEventListener('order_updated', handleOrderUpdated as EventListener);
        eventSource.removeEventListener('order_update', handleOrderUpdated as EventListener);
        eventSource.removeEventListener('menu_update', handlePushUpdate);
        eventSource.removeEventListener('category_update', handlePushUpdate);
        eventSource.removeEventListener('review_update', handlePushUpdate);
        eventSource.removeEventListener('branch_update', handlePushUpdate);
        eventSource.close();
      }
      clearInterval(pollInterval);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (e) {}
    router.push('/login');
    router.refresh();
  };

  const DashboardSkeleton = () => (
    <div className="w-full h-full space-y-6 animate-pulse p-2">
      <div className="w-48 h-8 bg-white/5 rounded-lg mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/5" />)}
      </div>
      <div className="h-[400px] bg-white/5 rounded-2xl border border-white/5 mt-6" />
    </div>
  );

  return (
    <div className={`min-h-screen ${mode === 'light' ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#09090B] text-white'} flex font-sans transition-colors duration-250`}>
      
      {/* ENTERPRISE COLLAPSIBLE SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${mode === 'light' ? 'bg-white border-slate-200' : 'bg-[#09090B] border-white/5'} border-r flex flex-col transition-all duration-300 ${desktopCollapsed ? 'w-20' : 'w-64'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        <div className={`h-16 flex items-center justify-between px-4 border-b ${mode === 'light' ? 'border-slate-100 bg-slate-50/70' : 'border-white/5 bg-[#121214]/50'} overflow-hidden`}>
          <div className="flex items-center gap-3 min-w-max">
            <div 
              className="w-8 h-8 shrink-0 rounded-lg border flex items-center justify-center transition-colors"
              style={{ backgroundColor: themeConfig.light, borderColor: themeConfig.border, color: themeConfig.primary }}
            >
              <Crown className="w-4 h-4" />
            </div>
            {!desktopCollapsed && <span className={`font-serif text-lg font-black tracking-wide truncate ${mode === 'light' ? 'text-slate-900' : 'text-white'}`}>Example Project</span>}
          </div>
          <div className="flex items-center">
            <button onClick={() => setDesktopCollapsed(!desktopCollapsed)} className={`hidden lg:flex p-1.5 rounded-lg ${mode === 'light' ? 'text-slate-500 hover:text-black hover:bg-slate-100' : 'text-gray-500 hover:text-white hover:bg-white/5'} transition-colors`}>
              <MenuIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setSidebarOpen(false)} className={`lg:hidden p-1.5 rounded-lg ${mode === 'light' ? 'text-slate-500 hover:text-black' : 'text-gray-500 hover:text-white'} transition-colors`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar overflow-x-hidden">
          {visibleNavigation.map((navGroup) => (
            <div key={navGroup.group}>
              {!desktopCollapsed ? (
                <p className={`px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] mb-3 ${mode === 'light' ? 'text-slate-400' : 'text-gray-500'}`}>{navGroup.group}</p>
              ) : (
                <div className={`w-full h-px ${mode === 'light' ? 'bg-slate-100' : 'bg-white/5'} mb-3 my-2`} />
              )}
              <div className="space-y-1">
                {navGroup.items.map(item => {
                  const Icon = item.icon;
                  const isActive = view === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setView(item.id); setSidebarOpen(false); }}
                      title={desktopCollapsed ? item.label : undefined}
                      style={isActive ? { backgroundColor: themeConfig.light, color: themeConfig.primary } : {}}
                      className={`w-full flex items-center ${desktopCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                        isActive 
                          ? 'font-extrabold shadow-sm' 
                          : mode === 'light'
                            ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}
                    >
                      <Icon 
                        className={`w-5 h-5 shrink-0`} 
                        style={isActive ? { color: themeConfig.primary } : {}}
                      />
                      {!desktopCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`p-4 border-t ${mode === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center ${desktopCollapsed ? 'justify-center' : 'justify-center gap-2'} px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-colors`}
            title="Lock Terminal"
          >
            <LogOut className="w-4 h-4 shrink-0" /> {!desktopCollapsed && "Lock Terminal"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${desktopCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        
        <header className={`h-16 shrink-0 ${mode === 'light' ? 'bg-white/85 border-slate-200' : 'bg-[#09090B]/80 border-white/5'} backdrop-blur-xl border-b px-4 sm:px-8 flex items-center justify-between z-30 transition-colors`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => setSidebarOpen(true)} className={`lg:hidden p-2 rounded-xl ${mode === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-gray-400'} hover:text-white`}>
              <MenuIcon className="w-5 h-5" />
            </button>

            {/* Enterprise Branch Selector — Super Admin only */}
            {isSuperAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                  selectedBranch === "ALL"
                    ? mode === "light"
                      ? "bg-slate-100/80 border-slate-300 text-slate-800 hover:bg-slate-200"
                      : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
                    : mode === "light"
                      ? "bg-amber-50 border-amber-300 text-amber-900 shadow-sm"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10"
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 ${selectedBranch === "ALL" ? "text-slate-400" : "text-amber-400"}`} />
                <span className="max-w-[140px] sm:max-w-[200px] truncate font-semibold">
                  {selectedBranch === "ALL" ? "All Franchises (Group HQ)" : branches.find(b => b.id === selectedBranch)?.name || "Selected Branch"}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                  selectedBranch === "ALL" 
                    ? "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-gray-400" 
                    : "bg-amber-500/20 text-amber-500"
                }`}>
                  {selectedBranch === "ALL" ? "ENTERPRISE" : "BRANCH"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${branchDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {branchDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBranchDropdownOpen(false)} />
                  <div className={`absolute left-0 mt-2 w-72 rounded-2xl p-2 shadow-2xl border z-50 animate-in fade-in zoom-in-95 duration-150 ${
                    mode === 'light' ? 'bg-white border-slate-200 text-slate-800 shadow-slate-200/80' : 'bg-[#121214] border-white/10 text-gray-200 shadow-black/90'
                  }`}>
                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Scope Franchise Telemetry
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBranch("ALL");
                        setBranchDropdownOpen(false);
                      }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        selectedBranch === "ALL"
                          ? "bg-amber-500 text-black font-bold"
                          : mode === 'light' ? "hover:bg-slate-100 text-slate-700" : "hover:bg-white/5 text-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span>All Branches (Combined)</span>
                      </div>
                      <span className="text-[10px] opacity-75">{branches.length} locations</span>
                    </button>

                    <div className={`my-2 border-t ${mode === 'light' ? 'border-slate-100' : 'border-white/5'}`} />

                    <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                      {branches.map((b) => {
                        const isSelected = selectedBranch === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSelectedBranch(b.id);
                              setBranchDropdownOpen(false);
                            }}
                            className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                              isSelected
                                ? "bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30"
                                : mode === 'light' ? "hover:bg-slate-100 text-slate-700" : "hover:bg-white/5 text-gray-300"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="truncate font-medium">{b.name}</p>
                              <p className="text-[10px] text-gray-400">{b.city || "Branch Location"}</p>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                              b.status === 'active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 bg-white/5'
                            }`}>
                              {b.status || 'active'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={`mt-2 pt-2 border-t ${mode === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setView("branches");
                          setBranchDropdownOpen(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl text-center text-xs font-bold text-amber-500 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>Manage Franchise Network</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            )} {/* end isSuperAdmin branch selector */}

            {/* Branch User Context Badge */}
            {!isSuperAdmin && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                mode === 'light' ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              }`}>
                <Building2 className={`w-3.5 h-3.5 shrink-0 text-sky-400`} />
                <span className="font-semibold truncate max-w-[160px]">{sessionBranchName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                  mode === 'light' ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-400'
                }`}>{sessionRole.toUpperCase()}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${mode === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>
              <Clock className="w-4 h-4" />
              <span className="text-xs font-mono font-medium">{currentTime}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative">
          {status === 'loading' && <DashboardSkeleton />}

          {status === 'error' && (
            <div className="h-full flex items-center justify-center">
              <div className={`max-w-md w-full ${mode === 'light' ? 'bg-white border-red-200 shadow-lg' : 'bg-[#121214] border-red-500/20'} border rounded-3xl p-8 text-center shadow-2xl`}>
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-8 h-8 text-red-500" /></div>
                <h2 className={`text-xl font-serif mb-2 ${mode === 'light' ? 'text-slate-900' : 'text-white'}`}>Telemetry Offline</h2>
                <p className={`text-sm mb-8 leading-relaxed ${mode === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>{errorMessage}</p>
                <button onClick={() => fetchGlobalTelemetry(false)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full mx-auto"><RefreshCcw className="w-4 h-4" /> Attempt Reconnect</button>
              </div>
            </div>
          )}

          {status === 'success' && (
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full max-w-7xl mx-auto">
                {view === "overview" && (
                  <OverviewView 
                    dishes={dishes} 
                    ledger={ledger} 
                    categories={categories}
                    branches={branches}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                    isSuperAdmin={isSuperAdmin}
                  />
                )}
                {view === "tables" && (
                  <TableManagementView
                    branches={branches}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                    isSuperAdmin={isSuperAdmin}
                    ledger={ledger}
                    onOpenPos={(tblNum, brId) => {
                      setActivePosTable(tblNum);
                      if (brId) setSelectedBranch(brId);
                      setView("ledger");
                    }}
                  />
                )}
                {view === "orders" && (
                  <OrdersHistoryView 
                    dishes={dishes} 
                    categories={categories} 
                    ledger={ledger} 
                    setLedger={setLedger} 
                    branches={branches}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                    isSuperAdmin={isSuperAdmin}
                  />
                )}
                {view === "attendance" && (
                  <AttendanceView 
                    branches={branches}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                    isSuperAdmin={isSuperAdmin}
                    sessionRole={sessionRole}
                    sessionBranchId={sessionBranchId}
                  />
                )}
                {view === "structure" && <StructureView categories={categories} setCategories={setCategories} dishes={dishes} />}
                {view === "menu" && (
                  <MenuView 
                    dishes={dishes} 
                    categories={categories} 
                    setDishes={setDishes}
                    branches={branches}
                    selectedBranch={selectedBranch}
                  />
                )}
                {view === "ledger" && (
                  <LedgerView 
                    dishes={dishes} 
                    categories={categories} 
                    ledger={ledger} 
                    setLedger={setLedger}
                    branches={branches}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                    initialTableNumber={activePosTable || undefined}
                  />
                )}
                {view === "branches" && (
                  <BranchesView 
                    branches={branches} 
                    setBranches={setBranches} 
                    ledger={ledger} 
                    selectedBranch={selectedBranch} 
                    onSelectBranch={setSelectedBranch} 
                  />
                )}
                {view === "superadmin" && isSuperAdmin && (
                  <SuperAdminView
                    branches={branches}
                    ledger={ledger}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                  />
                )}
                {view === "reviews" && <ReviewsView reviews={reviews} setReviews={setReviews} />}
                {view === "settings" && <SettingsView />}
              </motion.div>
            </AnimatePresence>
          )}

        </main>
      </div>
    </div>
  );
}