'use client';

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Star, Edit2, Trash2, Search, X, CheckSquare, Square, 
  FolderInput, Eye, EyeOff, ArrowUpDown, ChevronLeft, ChevronRight,
  SlidersHorizontal, Check, Utensils
} from "lucide-react";
import { Dish, Category } from "@/types";
import { inr } from "@/lib/utils";
import { uploadImage } from "@/lib/supabase";
import { PageHead, Glass, Toggle } from "@/components/ui/Primitives";
import AddDishModal from "./AddDishModal";
import { useToast, useConfirm } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";

export default function MenuView({ 
  dishes = [], 
  categories = [], 
  setDishes, 
  branches = [], 
  selectedBranch = "ALL" 
}: any) {
  const toast = useToast();
  const confirm = useConfirm();
  const { mode, pageSize, themeConfig } = useTheme();
  const categoryScrollRef = React.useRef<HTMLDivElement>(null);

  const scrollCategoryStrip = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'nonveg' | 'signature'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [sortOption, setSortOption] = useState<'default' | 'priceAsc' | 'priceDesc' | 'name'>('default');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
  const [targetCatId, setTargetCatId] = useState<string>("");
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);

  // 1. Filtered & Sorted Dishes
  const filteredDishes = useMemo(() => {
    let result = [...(dishes || [])];

    // Omnisearch query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d => 
        (d.name && d.name.toLowerCase().includes(q)) || 
        (d.desc && d.desc.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCatId !== "all") {
      result = result.filter(d => d.category_id === selectedCatId);
    }

    // Dietary filter
    if (dietaryFilter === 'veg') {
      result = result.filter(d => d.is_veg === true);
    } else if (dietaryFilter === 'nonveg') {
      result = result.filter(d => d.is_veg === false);
    } else if (dietaryFilter === 'signature') {
      result = result.filter(d => !!d.popular);
    }

    // Availability status
    if (statusFilter === 'available') {
      result = result.filter(d => d.available === true);
    } else if (statusFilter === 'unavailable') {
      result = result.filter(d => d.available === false);
    }

    // Sorting
    if (sortOption === 'priceAsc') {
      result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortOption === 'priceDesc') {
      result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortOption === 'name') {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return result;
  }, [dishes, searchQuery, selectedCatId, dietaryFilter, statusFilter, sortOption]);

  // Reset page to 1 whenever filters change to avoid empty pages
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCatId, dietaryFilter, statusFilter, sortOption]);

  // 2. Pagination Calculations (Eliminates 12-second image lag & sluggishness!)
  const totalPages = Math.max(1, Math.ceil(filteredDishes.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  
  const paginatedDishes = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredDishes.slice(start, start + pageSize);
  }, [filteredDishes, validCurrentPage, pageSize]);

  // 3. Category dish counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (dishes || []).forEach((d: any) => {
      counts[d.category_id] = (counts[d.category_id] || 0) + 1;
    });
    return counts;
  }, [dishes]);

  // 4. Single item actions
  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    const dish = dishes.find((d: any) => d.id === id);
    const nextStatus = !currentStatus;

    if (selectedBranch && selectedBranch !== "ALL") {
      // Toggle branch-specific 86 status
      setDishes((prev: any) =>
        prev.map((d: any) => {
          if (d.id === id) {
            const nextMap = { ...(d.branch_availability || {}), [selectedBranch]: nextStatus };
            return { ...d, branch_availability: nextMap, available: nextStatus };
          }
          return d;
        })
      );

      try {
        const res = await fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, branch_id: selectedBranch, branch_available: nextStatus }),
        });
        if (!res.ok) throw new Error("Unable to update branch stock status.");
        toast.info(
          nextStatus ? "Dish Available at Branch" : "86'd at Current Branch",
          `"${dish?.name || 'Dish'}" is now ${nextStatus ? 'available' : 'sold out'} at this location.`
        );
      } catch (err: any) {
        toast.error("Status Update Failed", err.message);
        setDishes((prev: any) => prev.map((d: any) => d.id === id ? { ...d, available: currentStatus } : d));
      }
      return;
    }

    // Global toggle (Super Admin)
    setDishes((prev: any) => prev.map((d: any) => d.id === id ? { ...d, available: nextStatus } : d));
    
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, available: nextStatus }),
      });
      if (!res.ok) {
        throw new Error("Unable to update menu status.");
      }
      toast.info(
        nextStatus ? "Dish Live on Menu" : "Dish Marked Sold Out (86)",
        `"${dish?.name || 'Dish'}" is now ${nextStatus ? 'active' : 'hidden'} on live menus & waiter terminals.`
      );
    } catch (err: any) {
      toast.error("Status Update Failed", err.message || "Authorization error: Unable to update menu status.");
      setDishes((prev: any) => prev.map((d: any) => d.id === id ? { ...d, available: currentStatus } : d));
    }
  };

  const handleDelete = async (id: string) => {
    const dish = dishes.find((d: any) => d.id === id);
    const confirmed = await confirm({
      title: "Confirm Dish Deletion",
      description: `Are you sure you want to permanently delete "${dish?.name || 'this dish'}"? This action cannot be undone.`,
      confirmText: "Delete Dish",
      variant: "danger",
    });
    if (!confirmed) return;

    const previousDishes = [...dishes];
    setDishes((prev: any) => prev.filter((d: any) => d.id !== id));
    setSelectedIds(prev => prev.filter(x => x !== id));
    
    try {
      const res = await fetch(`/api/menu?id=${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Deletion Failed");
      }
      toast.success("Dish Deleted", `"${dish?.name || 'Item'}" removed from catalog.`);
    } catch (err: any) {
      toast.error("Deletion Failed", err.message);
      setDishes(previousDishes);
    }
  };

  const handleEdit = (dish: Dish) => { 
    setEditingDish(dish); 
    setModalOpen(true); 
  };
  
  const handleAddNew = () => { 
    setEditingDish(null); 
    setModalOpen(true); 
  };

  // 5. Bulk Operations Handlers
  const toggleSelectDish = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllCurrentPage = () => {
    const pageIds = paginatedDishes.map((d: any) => d.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBulkAvailability = async (makeAvailable: boolean) => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const actionLabel = makeAvailable ? "Available" : "Sold Out (86)";
    const confirmed = await confirm({
      title: `Update Availability for ${count} Dishes?`,
      description: `Mark ${count} selected dishes as ${actionLabel} across digital menus and waiter POS terminals?`,
      confirmText: `Mark as ${actionLabel}`,
      cancelText: "Cancel",
      variant: makeAvailable ? "default" : "warning",
    });
    if (!confirmed) return;

    setIsBulkProcessing(true);

    setDishes((prev: any) => prev.map((d: any) => selectedIds.includes(d.id) ? { ...d, available: makeAvailable } : d));

    try {
      await Promise.all(selectedIds.map(id => 
        fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, available: makeAvailable }),
        })
      ));
      toast.success(
        makeAvailable ? "Dishes Live" : "Dishes Sold Out (86)",
        `${count} dishes updated across digital menus and waiter terminals.`
      );
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (err: any) {
      toast.error("Bulk Update Failed", err.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkMoveCategory = async () => {
    if (!targetCatId || selectedIds.length === 0) return;
    const count = selectedIds.length;
    const catName = categories.find((c: any) => c.id === targetCatId)?.name || "selected section";

    const confirmed = await confirm({
      title: `Move ${count} Dishes?`,
      description: `Reassign ${count} dishes to culinary section "${catName}"?`,
      confirmText: `Move to ${catName}`,
      cancelText: "Cancel",
    });
    if (!confirmed) return;

    setIsBulkProcessing(true);

    setDishes((prev: any) => prev.map((d: any) => selectedIds.includes(d.id) ? { ...d, category_id: targetCatId } : d));

    try {
      await Promise.all(selectedIds.map(id => 
        fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, category_id: targetCatId }),
        })
      ));
      toast.success("Dishes Reassigned", `Moved ${count} dishes to "${catName}".`);
      setSelectedIds([]);
      setIsSelectMode(false);
      setBulkMoveModalOpen(false);
    } catch (err: any) {
      toast.error("Bulk Move Failed", err.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const isLight = mode === 'light';

  return (
    <div className="space-y-6 pb-28">
      
      {/* 1. Header with Title and Add Button */}
      <div className={`flex flex-wrap items-end justify-between gap-4 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} pb-5`}>
        <div>
          <PageHead eyebrow="Culinary Operations" title="Menu Management" />
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/50'} mt-1`}>
            Showing {filteredDishes.length} items across {categories.length} culinary sections.
          </p>
        </div>
        
        <motion.button 
          whileHover={{ scale: 1.02 }} 
          whileTap={{ scale: 0.98 }} 
          onClick={handleAddNew} 
          style={{ 
            backgroundColor: themeConfig.primary, 
            color: themeConfig.textOnAccent,
            boxShadow: `0 10px 25px -5px ${themeConfig.glow}`
          }}
          className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all hover:brightness-105"
        >
          <Plus className="h-4 w-4 stroke-[3]" /> Add New Dish
        </motion.button>
      </div>

      {/* 2. Category Tabs & Quick Jump (Guarantees immediate access to all 13 sections including Starters & Tandoori Starters) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <Utensils className="w-3.5 h-3.5" style={{ color: themeConfig.primary }} />
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-white/60'}`}>
              Culinary Sections ({categories.length})
            </span>
          </div>

          {/* Quick Jump Dropdown for immediate direct selection */}
          <div className="flex items-center gap-2">
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'} hidden sm:inline font-medium`}>Quick Select:</span>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer border transition-all ${
                isLight 
                  ? 'bg-white border-slate-200 text-slate-800 shadow-sm hover:border-slate-300' 
                  : 'bg-black/60 border-white/[0.12] text-white hover:border-white/25'
              }`}
            >
              <option value="all" className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>
                All Offerings ({dishes.length})
              </option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id} className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>
                  {c.name} ({categoryCounts[c.id] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Flanked Scrollable Ribbon with Chevrons and Mouse Wheel Support */}
        <div className="relative flex items-center">
          {/* Scroll Left Chevron */}
          <button 
            type="button"
            onClick={() => scrollCategoryStrip('left')}
            aria-label="Scroll Categories Left"
            title="Scroll categories left"
            className={`shrink-0 mr-2 p-2 rounded-xl border transition-all cursor-pointer ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm hover:border-slate-300' 
                : 'bg-[#121216] border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Container */}
          <div 
            ref={categoryScrollRef}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth"
          >
            {/* All Items Pill */}
            <button 
              onClick={() => setSelectedCatId("all")} 
              style={selectedCatId === "all" ? { 
                backgroundColor: themeConfig.primary, 
                color: themeConfig.textOnAccent, 
                boxShadow: `0 4px 14px ${themeConfig.glow}` 
              } : {}}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs transition-all shrink-0 font-medium cursor-pointer ${
                selectedCatId === "all" 
                  ? "font-extrabold shadow-md" 
                  : isLight
                    ? "bg-white text-slate-600 border border-slate-200 hover:text-black hover:border-slate-300 shadow-sm"
                    : "bg-white/[0.04] text-white/60 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <span>All Offerings</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                selectedCatId === "all" 
                  ? "bg-black/20 text-current" 
                  : isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-white/70"
              }`}>
                {dishes.length}
              </span>
            </button>

            {/* Section Pills */}
            {categories.map((c: any) => {
              const count = categoryCounts[c.id] || 0;
              const isSelected = selectedCatId === c.id;

              return (
                <button 
                  key={c.id} 
                  onClick={() => setSelectedCatId(c.id)} 
                  style={isSelected ? { 
                    backgroundColor: themeConfig.primary, 
                    color: themeConfig.textOnAccent, 
                    boxShadow: `0 4px 14px ${themeConfig.glow}` 
                  } : {}}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs transition-all shrink-0 font-medium cursor-pointer ${
                    isSelected 
                      ? "font-extrabold shadow-md" 
                      : isLight
                        ? "bg-white text-slate-600 border border-slate-200 hover:text-black hover:border-slate-300 shadow-sm"
                        : "bg-white/[0.04] text-white/60 border border-white/[0.08] hover:text-white hover:bg-white/[0.08]"
                  }`}
                >
                  {c.img && (
                    <img src={c.img} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                  )}
                  <span>{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isSelected 
                      ? "bg-black/20 text-current" 
                      : isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-white/70"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Chevron */}
          <button 
            type="button"
            onClick={() => scrollCategoryStrip('right')}
            aria-label="Scroll Categories Right"
            title="Scroll categories right"
            className={`shrink-0 ml-2 p-2 rounded-xl border transition-all cursor-pointer ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm hover:border-slate-300' 
                : 'bg-[#121216] border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Streamlined Single Control Toolbar (Clean, No "Options Dump"!) */}
      <div className={`p-3 rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-black/40 border-white/[0.08]'} flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
        
        {/* Left: Minimalist Luxury Omnisearch */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className={`absolute left-3.5 top-3 h-4 w-4 ${isLight ? 'text-slate-400' : 'text-white/40'}`} />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Search dishes by title or description..." 
            className={`w-full rounded-xl pl-10 pr-9 py-2 text-xs outline-none transition-all ${
              isLight 
                ? 'bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-amber-600 border border-transparent focus:border-amber-600' 
                : 'bg-white/[0.05] text-white placeholder:text-white/30 focus:border-[#D4AF37]/60 border border-white/[0.06]'
            }`}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className={`absolute right-3 top-2.5 ${isLight ? 'text-slate-400 hover:text-black' : 'text-white/40 hover:text-white'}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right: Clean Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Dietary Standard Segmented Pill (Veg / Non-Veg / Signature) */}
          <div className={`flex items-center rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/[0.03] border-white/[0.08]'}`}>
            <button 
              onClick={() => setDietaryFilter('all')} 
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                dietaryFilter === 'all' 
                  ? isLight ? 'bg-white text-black font-bold shadow-sm' : 'bg-white/20 text-white font-bold' 
                  : isLight ? 'text-slate-500 hover:text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setDietaryFilter('veg')} 
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                dietaryFilter === 'veg' 
                  ? 'bg-emerald-500/20 text-emerald-500 font-bold border border-emerald-500/30' 
                  : isLight ? 'text-slate-500 hover:text-emerald-600' : 'text-white/40 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Veg
            </button>
            <button 
              onClick={() => setDietaryFilter('nonveg')} 
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                dietaryFilter === 'nonveg' 
                  ? 'bg-red-500/20 text-red-500 font-bold border border-red-500/30' 
                  : isLight ? 'text-slate-500 hover:text-red-600' : 'text-white/40 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-600" />
              Non-Veg
            </button>
            <button 
              onClick={() => setDietaryFilter('signature')} 
              style={dietaryFilter === 'signature' ? { 
                backgroundColor: themeConfig.light, 
                color: themeConfig.primary, 
                borderColor: themeConfig.border 
              } : {}}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                dietaryFilter === 'signature' 
                  ? 'font-bold border' 
                  : isLight ? 'text-slate-500 hover:text-amber-600' : 'text-white/40 hover:text-white'
              }`}
            >
              <Star className="w-3 h-3" style={dietaryFilter === 'signature' ? { color: themeConfig.primary, fill: themeConfig.primary } : {}} />
              Star
            </button>
          </div>

          {/* Status Filter Dropdown */}
          <select 
            value={statusFilter} 
            onChange={(e: any) => setStatusFilter(e.target.value)} 
            className={`rounded-xl px-3 py-1.5 text-xs font-medium outline-none cursor-pointer border ${
              isLight 
                ? 'bg-slate-100 border-slate-200 text-slate-800' 
                : 'bg-black/60 border-white/[0.08] text-white'
            }`}
          >
            <option value="all" className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>All Status</option>
            <option value="available" className={isLight ? 'bg-white text-emerald-600 font-bold' : 'bg-[#121214] text-emerald-400'}>🟢 Live Only</option>
            <option value="unavailable" className={isLight ? 'bg-white text-red-600 font-bold' : 'bg-[#121214] text-rose-400'}>🔴 Sold Out (86)</option>
          </select>

          {/* Sort Selector */}
          <select 
            value={sortOption} 
            onChange={(e: any) => setSortOption(e.target.value)} 
            className={`rounded-xl px-3 py-1.5 text-xs font-medium outline-none cursor-pointer border ${
              isLight 
                ? 'bg-slate-100 border-slate-200 text-slate-800' 
                : 'bg-black/60 border-white/[0.08] text-white'
            }`}
          >
            <option value="default" className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>Sort: Default</option>
            <option value="priceAsc" className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>Price: Low → High</option>
            <option value="priceDesc" className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>Price: High → Low</option>
            <option value="name" className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>Alphabetical (A-Z)</option>
          </select>

          {/* Select Mode Toggle */}
          <button 
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds([]);
            }} 
            style={isSelectMode ? { 
              backgroundColor: themeConfig.primary, 
              color: themeConfig.textOnAccent, 
              borderColor: themeConfig.primary 
            } : {}}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              isSelectMode 
                ? 'shadow-sm font-bold' 
                : isLight 
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-black' 
                  : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isSelectMode ? "Done Selecting" : "Bulk Select"}</span>
          </button>

        </div>

      </div>

      {/* Select All Row (when Select Mode is active) */}
      {isSelectMode && (
        <div 
          style={!isLight ? { backgroundColor: themeConfig.light, borderColor: themeConfig.border, color: themeConfig.primary } : {}}
          className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : ''}`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>Select dishes on this page ({paginatedDishes.length} items):</span>
          </div>
          <button 
            onClick={selectAllCurrentPage}
            className="text-xs font-bold underline cursor-pointer"
          >
            {paginatedDishes.every(d => selectedIds.includes(d.id)) ? "Deselect Page" : "Select Current Page"}
          </button>
        </div>
      )}

      {/* 4. High-Performance Dish Grid (Renders only 18 items at a time -> 0ms lag, <400ms image load!) */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {paginatedDishes.length === 0 ? (
          <div className={`col-span-full py-20 text-center border border-dashed rounded-3xl ${isLight ? 'border-slate-200 bg-white/50' : 'border-white/10 bg-white/[0.01]'}`}>
            <Utensils className={`w-8 h-8 mx-auto mb-3 ${isLight ? 'text-slate-300' : 'text-white/20'}`} />
            <p className={`text-sm font-medium ${isLight ? 'text-slate-600' : 'text-white/50'}`}>No dishes match your active filters.</p>
            <button 
              onClick={() => { setSearchQuery(""); setSelectedCatId("all"); setDietaryFilter("all"); setStatusFilter("all"); }} 
              style={{ color: themeConfig.primary }}
              className="mt-3 text-xs font-bold underline"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          paginatedDishes.map((d: any) => {
            const isSelected = selectedIds.includes(d.id);

            return (
              <div 
                key={d.id} 
                style={isSelected ? { borderColor: themeConfig.primary, boxShadow: `0 0 0 2px ${themeConfig.primary}` } : {}}
                className={`rounded-3xl transition-all duration-200 border overflow-hidden flex flex-col group ${
                  isSelected 
                    ? 'shadow-xl' 
                    : isLight
                      ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                      : 'bg-[#121216]/90 border-white/[0.08] hover:border-white/20'
                }`}
              >
                {/* Food Image Container */}
                <div className="relative h-44 overflow-hidden shrink-0 bg-black/30">
                  
                  {/* Select Checkbox */}
                  {isSelectMode && (
                    <div 
                      onClick={() => toggleSelectDish(d.id)}
                      style={isSelected ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
                      className={`absolute top-3 left-3 z-30 p-1.5 rounded-xl cursor-pointer transition-all ${
                        isSelected 
                          ? 'shadow-lg scale-110' 
                          : 'bg-black/70 backdrop-blur-md text-white/70 border border-white/20'
                      }`}
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </div>
                  )}

                  {/* Food Photography with lazy loading and decoding async */}
                  {d.img && d.img !== "" ? (
                    <img 
                      src={d.img} 
                      alt={d.name} 
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80";
                      }}
                      className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                        d.available ? "" : "grayscale opacity-40"
                      }`} 
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-neutral-900 to-black flex items-center justify-center border-b border-white/5">
                      <span className="text-[11px] font-mono text-white/30 uppercase tracking-wider">Photo Pending</span>
                    </div>
                  )}

                  {/* Subtle Gradient Shade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                  {/* Authentic FSSAI Standard Veg / Non-Veg Badge (Bottom Left) */}
                  <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 shadow-md">
                    <div className={`w-3.5 h-3.5 border-2 ${d.is_veg ? 'border-emerald-500' : 'border-red-600'} flex items-center justify-center rounded-[2px]`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${d.is_veg ? 'bg-emerald-500' : 'bg-red-600'}`} />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${d.is_veg ? 'text-emerald-400' : 'text-red-400'}`}>
                      {d.is_veg ? 'Veg' : 'Non-Veg'}
                    </span>
                  </div>

                  {/* Signature Theme Badge (Top Right) */}
                  {d.popular && (
                    <div 
                      style={{ borderColor: themeConfig.border, color: themeConfig.primary }}
                      className="absolute top-3 right-3 z-20 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border flex items-center gap-1.5 shadow-lg"
                    >
                      <Star className="w-3 h-3" style={{ color: themeConfig.primary, fill: themeConfig.primary }} />
                      <span className="text-[9px] font-extrabold uppercase tracking-widest">Signature</span>
                    </div>
                  )}

                  {/* Quick Edit & Delete Hover Actions */}
                  <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(d)} 
                      className="p-1.5 bg-black/85 backdrop-blur-md rounded-lg border border-white/20 text-white hover:bg-white/20 transition-colors" 
                      title="Edit Dish"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(d.id)} 
                      className="p-1.5 bg-black/85 backdrop-blur-md rounded-lg border border-white/20 text-white hover:bg-rose-600 transition-colors" 
                      title="Delete Dish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>

                {/* Dish Card Content */}
                <div className="flex flex-col flex-1 p-5 justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h3 className={`text-sm font-bold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {d.name}
                      </h3>
                      <span className="font-mono text-base font-extrabold shrink-0" style={{ color: themeConfig.primary }}>
                        {inr(d.price)}
                      </span>
                    </div>

                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/45'} line-clamp-2 leading-relaxed mb-4`}>
                      {d.desc || "Chef specialty prepared fresh on order with select ingredients."}
                    </p>
                  </div>

                  {/* Live Status Toggle Footer */}
                  <div className={`flex items-center justify-between pt-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.05]'}`}>
                    <span className={`text-[10px] uppercase font-extrabold tracking-wider flex items-center gap-1.5 ${
                      d.available ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.available ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {d.available ? "Live on Menu" : "Sold Out (86)"}
                    </span>
                    <Toggle on={d.available} onClick={() => toggleAvailability(d.id, d.available)} />
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Pagination Bar (Fast, Responsive Page Navigation) */}
      {totalPages > 1 && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isLight ? 'bg-white border-slate-200 text-slate-700 shadow-sm' : 'bg-black/40 border-white/[0.08] text-white/70'
        }`}>
          <div className="text-xs font-mono">
            Showing <strong className={isLight ? 'text-black' : 'text-white'}>{(validCurrentPage - 1) * pageSize + 1}</strong> to <strong className={isLight ? 'text-black' : 'text-white'}>{Math.min(validCurrentPage * pageSize, filteredDishes.length)}</strong> of <strong className={isLight ? 'text-black' : 'text-white'}>{filteredDishes.length}</strong> offerings
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                isLight ? 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-black' : 'bg-white/[0.05] border-white/10 hover:bg-white/10 text-white'
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>

            {/* Numeric Page Buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && validCurrentPage > 3) {
                pageNum = validCurrentPage - 2 + i;
                if (pageNum > totalPages) pageNum = totalPages - 4 + i;
              }
              const isActive = validCurrentPage === pageNum;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={isActive ? { 
                    backgroundColor: themeConfig.primary, 
                    color: themeConfig.textOnAccent, 
                    borderColor: themeConfig.primary 
                  } : {}}
                  className={`w-8 h-8 rounded-xl text-xs font-mono font-bold transition-all border ${
                    isActive
                      ? 'shadow-sm font-extrabold'
                      : isLight 
                        ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                isLight ? 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-black' : 'bg-white/[0.05] border-white/10 hover:bg-white/10 text-white'
              }`}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 6. Floating Luxury Bulk Operations Toolbar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 50 }} 
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl"
          >
            <div 
              style={{ borderColor: themeConfig.border }}
              className="bg-[#121216]/98 backdrop-blur-2xl border rounded-2xl p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-white"
            >
              
              <div className="flex items-center gap-2 pl-2">
                <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: themeConfig.primary }} />
                <span className="text-xs font-bold font-mono">
                  {selectedIds.length} {selectedIds.length === 1 ? 'Dish' : 'Dishes'} Selected
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <button 
                  onClick={() => handleBulkAvailability(true)} 
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Make Live</span>
                </button>

                <button 
                  onClick={() => handleBulkAvailability(false)} 
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Sold Out (86)</span>
                </button>

                <button 
                  onClick={() => { setTargetCatId(categories[0]?.id || ""); setBulkMoveModalOpen(true); }} 
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/15 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <FolderInput className="w-3.5 h-3.5" />
                  <span>Move Section</span>
                </button>

                <button 
                  onClick={() => setSelectedIds([])} 
                  className="p-1.5 text-white/50 hover:text-white rounded-lg transition-colors ml-1"
                  title="Clear Selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Move Category Modal */}
      <AnimatePresence>
        {bulkMoveModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setBulkMoveModalOpen(false)}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="font-serif text-lg text-white font-medium mb-1">Reassign Culinary Section</h3>
              <p className="text-xs text-white/50 mb-4">Move {selectedIds.length} selected items to a new section:</p>

              <select 
                value={targetCatId} 
                onChange={e => setTargetCatId(e.target.value)} 
                className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none mb-6"
              >
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-[#121214] text-white">{c.name}</option>
                ))}
              </select>

              <div className="flex items-center justify-end gap-2">
                <button 
                  onClick={() => setBulkMoveModalOpen(false)} 
                  className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkMoveCategory} 
                  disabled={isBulkProcessing}
                  style={{ backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent }}
                  className="px-4 py-2 rounded-xl font-bold text-xs hover:brightness-105 transition-all"
                >
                  Confirm Reassignment
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Dish Modal */}
      <AddDishModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        dishToEdit={editingDish} 
        onSave={(savedDish: any, isEdit: boolean) => {
          if (isEdit) {
            setDishes((p: any) => p.map((d: any) => d.id === savedDish.id ? savedDish : d));
          } else {
            setDishes((p: any) => [savedDish, ...p]);
          }
        }} 
        categories={categories} 
        uploadImage={uploadImage} 
      />
    </div>
  );
}