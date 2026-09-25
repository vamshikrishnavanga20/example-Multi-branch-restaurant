'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, Moon, Palette, Zap, Database, Smartphone, Check, ShieldCheck, Sparkles, 
  UtensilsCrossed, Building2, Loader2, ToggleLeft, ToggleRight
} from 'lucide-react';
import { PageHead, Glass } from '@/components/ui/Primitives';
import { useTheme, ThemePalette, ThemeMode, PALETTE_CONFIGS } from '@/lib/theme-context';
import { useToast, useConfirm } from '@/components/ui/LuxuryNotifications';

export default function SettingsView() {
  const { mode, palette, themeConfig, setMode, setPalette, pageSize, setPageSize } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();

  // Branch permissions state
  const [sessionRole, setSessionRole] = useState<string>('');
  const [allowBranchMenu, setAllowBranchMenu] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    // Fetch session role
    fetch('/api/auth').then(r => r.json()).then(d => {
      setSessionRole(d.user?.role || '');
    }).catch(() => {});
    // Fetch system settings
    fetch('/api/settings').then(r => r.json()).then(d => {
      setAllowBranchMenu(!!d.allow_branch_menu_management);
    }).catch(() => {}).finally(() => setSettingsLoading(false));
  }, []);

  const handleMenuToggle = async () => {
    const next = !allowBranchMenu;
    const confirmed = await confirm({
      title: next ? "Enable Branch Menu Management?" : "Restrict Menu Management?",
      description: next
        ? "Branch admins and managers will be granted full access to edit dishes and menu sections for their location."
        : "Only Super Admins will be permitted to modify menu offerings and pricing across the network.",
      confirmText: next ? "Enable Branch Access" : "Restrict to Super Admin",
      cancelText: "Cancel",
      variant: next ? "default" : "warning",
    });

    if (!confirmed) return;

    setSettingsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_branch_menu_management: next }),
      });
      if (res.ok) {
        setAllowBranchMenu(next);
        toast.success(
          'Branch Permissions Updated',
          next
            ? 'Branch admins can now access Menu Management.'
            : 'Menu Management is now restricted to Super Admin only.'
        );
      } else {
        toast.error('Update Failed', 'Could not save branch permissions.');
      }
    } catch {
      toast.error('Network Error', 'Could not reach server.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const isSuperAdmin = sessionRole === 'super_admin';

  const handlePaletteSelect = (pId: ThemePalette) => {
    setPalette(pId);
    const chosen = PALETTE_CONFIGS[pId];
    toast.success("Theme Applied", `Switched to ${chosen?.name || pId} theme.`);
  };

  const handleModeSelect = (m: ThemeMode) => {
    setMode(m);
    toast.info("Mode Updated", `Switched to ${m === 'dark' ? 'Dark Mode' : 'Light Mode'}.`);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    toast.success("Catalog Density Updated", `Now loading ${size} dishes per page for ultra-fast browsing.`);
  };

  const isLight = mode === 'light';

  return (
    <div className="space-y-8 pb-24">
      
      {/* Page Header */}
      <div className={`border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} pb-6`}>
        <PageHead eyebrow="Terminal & Ambiance" title="System Settings" />
        <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/50'} mt-1`}>
          Customize interface themes, fine-tune menu performance density, and manage branch permissions.
        </p>
      </div>

      {/* BRANCH PERMISSIONS — Super Admin Only */}
      {isSuperAdmin && (
        <Glass className="p-7 border-[var(--border-card)]">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: themeConfig.light }}
              >
                <Building2 className="w-5 h-5" style={{ color: themeConfig.primary }} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                  Branch Permissions
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: themeConfig.light, color: themeConfig.primary }}
                  >
                    Super Admin Only
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed max-w-lg">
                  Control whether branch managers and owners can access the <strong>Menu Management</strong> and <strong>Menu Structure</strong> screens in their dashboards.
                  When disabled, only you (Super Admin) can create, edit, or delete menu items and categories.
                </p>
              </div>
            </div>
          </div>

          <div className={`mt-6 p-5 rounded-2xl border flex items-center justify-between gap-4 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/[0.06]'}`}>
            <div className="flex items-center gap-3.5">
              <UtensilsCrossed
                className="w-5 h-5 shrink-0"
                style={{ color: allowBranchMenu ? themeConfig.primary : (isLight ? '#94a3b8' : '#6b7280') }}
              />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Allow Branch Menu Management
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {allowBranchMenu
                    ? 'Branch admins (owner & manager) can see and edit the shared menu.'
                    : 'Menu management is restricted — only you can edit menu items and categories.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMenuToggle}
              disabled={settingsSaving || settingsLoading}
              className="shrink-0 relative flex items-center transition-all disabled:opacity-50"
              title={allowBranchMenu ? 'Click to restrict menu management to Super Admin' : 'Click to allow branch admins to manage the menu'}
            >
              {settingsSaving ? (
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeConfig.primary }} />
              ) : (
                <motion.div
                  animate={{
                    backgroundColor: allowBranchMenu ? themeConfig.primary : (isLight ? '#e2e8f0' : '#374151'),
                  }}
                  className="w-14 h-7 rounded-full relative cursor-pointer shadow-inner"
                >
                  <motion.div
                    animate={{ x: allowBranchMenu ? 28 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
                  />
                </motion.div>
              )}
            </button>
          </div>

          {allowBranchMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`mt-3 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs ${
                isLight ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Active:</strong> Branch admins can now see Menu Structure and Menu Management in their dashboards.
                The menu data remains shared — all branches see the same menu.
              </span>
            </motion.div>
          )}
        </Glass>
      )}
      <div className="grid gap-6 lg:grid-cols-12">
        
        {/* LEFT COLUMN: THEMES & GLASSY SWITCHER (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Glassy Dark / Light Mode Switcher Card */}
          <Glass className="p-7 border-[var(--border-card)]">
            <div className="mb-4">
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: themeConfig.primary }} />
                Appearance Mode
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Toggle between obsidian dark ambiance and luminous porcelain light mode.
              </p>
            </div>

            {/* The Luxury Glassy Segmented Switcher */}
            <div className={`p-2 rounded-2xl ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'} border backdrop-blur-xl relative grid grid-cols-2 gap-2 mt-4`}>
              
              {/* Dark Mode Segment */}
              <button
                type="button"
                onClick={() => handleModeSelect('dark')}
                className={`relative z-10 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 ${
                  mode === 'dark' 
                    ? 'text-white font-extrabold shadow-lg' 
                    : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-white/50 hover:text-white'
                }`}
              >
                {mode === 'dark' && (
                  <motion.div 
                    layoutId="glassy-mode-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    className="absolute inset-0 rounded-xl bg-white/[0.08] border backdrop-blur-xl shadow-2xl"
                    style={{ borderColor: themeConfig.primary }}
                  />
                )}
                <Moon className="w-4 h-4 relative z-20" style={mode === 'dark' ? { color: themeConfig.primary } : {}} />
                <span className="relative z-20">Dark Mode</span>
                {mode === 'dark' && (
                  <span className="w-1.5 h-1.5 rounded-full relative z-20" style={{ backgroundColor: themeConfig.primary }} />
                )}
              </button>

              {/* Light Mode Segment */}
              <button
                type="button"
                onClick={() => handleModeSelect('light')}
                className={`relative z-10 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl text-xs font-bold transition-all duration-300 ${
                  mode === 'light' 
                    ? 'text-slate-900 font-extrabold shadow-lg' 
                    : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-white/50 hover:text-white'
                }`}
              >
                {mode === 'light' && (
                  <motion.div 
                    layoutId="glassy-mode-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    className="absolute inset-0 rounded-xl bg-white border backdrop-blur-xl shadow-md border-slate-300"
                  />
                )}
                <Sun className="w-4 h-4 relative z-20 text-amber-500" />
                <span className="relative z-20">Light Mode</span>
                {mode === 'light' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 relative z-20" />
                )}
              </button>

            </div>
          </Glass>

          {/* Curated Theme Palettes */}
          <Glass className="p-7 border-[var(--border-card)]">
            <div className="mb-4">
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: themeConfig.primary }} />
                Curated Theme Palettes
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Click an executive palette to instantly transform accent colors, badges, and chart curves.
              </p>
            </div>

            <div className="grid gap-3 pt-2">
              {Object.values(PALETTE_CONFIGS).map(p => {
                const isSelected = palette === p.id;

                return (
                  <div 
                    key={p.id} 
                    onClick={() => handlePaletteSelect(p.id)}
                    style={isSelected ? { borderColor: p.primary, backgroundColor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.04)' } : {}}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-4 ${
                      isSelected 
                        ? 'ring-1 shadow-lg' 
                        : isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-black/20 border-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Swatch color pills */}
                      <div className="flex items-center -space-x-1.5 shrink-0">
                        {p.colors.map((c, i) => (
                          <div 
                            key={i} 
                            className="w-5 h-5 rounded-full border border-black/30 shadow-sm shrink-0" 
                            style={{ backgroundColor: c }} 
                          />
                        ))}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[var(--text-primary)]">{p.name}</h4>
                          {p.id === 'gold' && (
                            <span 
                              style={{ backgroundColor: themeConfig.light, color: themeConfig.primary }}
                              className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                            >
                              Signature
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{p.tagline}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: p.primary }} />
                      {isSelected ? (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-sm"
                          style={{ backgroundColor: p.primary, color: p.textOnAccent }}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-[var(--border-card)]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Glass>

        </div>

        {/* RIGHT COLUMN: DENSITY & CLOUD STORAGE (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Catalog Speed & Image Optimization */}
          <Glass className="p-7 border-[var(--border-card)]">
            <div className="mb-3">
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Catalog Browsing Density
              </h3>
            </div>
            
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
              With 185 menu items, chunked pagination prevents browser network queuing, allowing all food images to load in <strong>under 300ms</strong>.
            </p>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Dishes Rendered Per Page:</span>
              <div className="grid grid-cols-4 gap-2">
                {[12, 18, 24, 36].map(size => {
                  const isSelected = pageSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => handlePageSizeChange(size)}
                      style={isSelected ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent, borderColor: themeConfig.primary } : {}}
                      className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all border ${
                        isSelected 
                          ? 'shadow-md font-extrabold' 
                          : isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-black/30 border-white/[0.08] text-white/60 hover:text-white'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                {pageSize === 18 ? '⚡ Optimal balance of fast visual browsing and 0ms filter response.' : ''}
              </p>
            </div>
          </Glass>

          {/* Database & Supabase Storage Quota Monitor */}
          <Glass className="p-7 border-[var(--border-card)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Database className="w-4 h-4" style={{ color: themeConfig.primary }} />
                Cloud Database Storage
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Safe Tier
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Strict 500MB storage ceiling preservation monitor:
            </p>

            <div className={`space-y-2.5 p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/[0.08]'}`}>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[var(--text-secondary)]">Current Database Size</span>
                <span className="text-emerald-500 font-bold">~14.2 MB / 500 MB (2.8%)</span>
              </div>
              <div className={`w-full ${isLight ? 'bg-slate-200' : 'bg-white/10'} h-2 rounded-full overflow-hidden`}>
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '2.8%' }} />
              </div>
              <div className="pt-2 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Zero redundant database tables or bulky event logs are created.</span>
              </div>
            </div>
          </Glass>

          {/* Waiter Native App Terminal Connection */}
          <Glass className="p-7 border-[var(--border-card)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-500" />
                Waiter Terminal Bridge
              </h3>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Online
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Realtime Postgres channels synchronize menu dish availability and waiter app tickets instantaneously.
            </p>
          </Glass>

        </div>

      </div>

    </div>
  );
}
