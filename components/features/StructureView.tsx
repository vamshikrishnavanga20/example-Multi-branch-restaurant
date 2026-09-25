"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import {
  UploadCloud,
  Edit2,
  Trash2,
  CornerDownRight,
  Loader2,
  FolderTree,
  Search,
  UtensilsCrossed,
  GripVertical,
  ChevronRight,
  ChevronDown,
  ArrowDownToLine,
  Sparkles,
} from "lucide-react";
import { Category, Dish } from "@/types";
import { getCategoryPath } from "@/lib/utils";
import { uploadImage } from "@/lib/supabase";
import { Glass, Field, PageHead, inputCls } from "@/components/ui/Primitives";
import { useToast, useConfirm } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";

type DropPosition = "before" | "after" | "nest" | null;

export default function StructureView({
  categories = [],
  setCategories,
  dishes = [],
}: {
  categories: Category[];
  setCategories: any;
  dishes?: Dish[];
}) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const toast = useToast();
  const confirm = useConfirm();

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catImage, setCatImage] = useState<File | null>(null);
  const [catImagePreview, setCatImagePreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Drag & Drop State
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<DropPosition>(null);
  const [dragOverRootZone, setDragOverRootZone] = useState(false);
  const [isSyncingReorder, setIsSyncingReorder] = useState(false);

  // Expand / collapse state for nested categories
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Live item count map per category
  const dishCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (dishes || []).forEach((d) => {
      if (d.category_id) {
        map[d.category_id] = (map[d.category_id] || 0) + 1;
      }
    });
    return map;
  }, [dishes]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCatImage(file);
      setCatImagePreview(URL.createObjectURL(file));
    }
  };

  const startEdit = (cat: Category) => {
    setEditingCatId(cat.id);
    setNewCat(cat.name);
    setParentId(cat.parent_id || null);
    setCatImagePreview(cat.img || null);
    setCatImage(null);
  };

  const cancelEdit = () => {
    setEditingCatId(null);
    setNewCat("");
    setParentId(null);
    setCatImage(null);
    setCatImagePreview(null);
  };

  const saveCategory = async () => {
    if (!newCat.trim()) {
      toast.warning("Section Title Required", "Please specify a name for the menu section.");
      return;
    }
    setLoading(true);

    try {
      let finalImgUrl: string | null = catImagePreview;
      if (catImage) {
        finalImgUrl = await uploadImage(catImage);
      }

      if (editingCatId) {
        // Update existing category via API
        const res = await fetch("/api/categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCatId,
            name: newCat.trim(),
            parent_id: parentId || null,
            img: finalImgUrl,
          }),
        });
        const updated = await res.json();
        if (!res.ok) throw new Error(updated.error || "Failed to update category.");
        setCategories((prev: Category[]) => prev.map((c) => (c.id === editingCatId ? updated : c)));
        toast.success("Section Updated", `"${newCat}" has been successfully updated.`);
      } else {
        // Insert new category via API
        const maxSort = categories.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newCat.trim(),
            parent_id: parentId || null,
            img: finalImgUrl,
            sort_order: maxSort + 1,
          }),
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.error || "Failed to create category.");
        setCategories((prev: Category[]) => [...prev, created]);
        toast.success("Section Created", `"${newCat}" has been added to the taxonomy map.`);
      }

      cancelEdit();
    } catch (err: any) {
      console.error(err);
      toast.error("Operation Failed", err.message || "Failed to save category section.");
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    const assignedDishes = dishCounts[id] || 0;
    const hasChildren = categories.some((c) => c.parent_id === id);

    if (assignedDishes > 0 || hasChildren) {
      toast.warning(
        "Cannot Delete Section",
        `This section contains ${assignedDishes} active dishes and ${hasChildren ? "subcategories" : ""}. Reassign them before deleting.`
      );
      return;
    }

    const confirmed = await confirm({
      title: "Delete Menu Section",
      description: `Are you sure you want to permanently delete "${cat?.name || "this section"}"?`,
      confirmText: "Delete Section",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete category.");
      setCategories((prev: Category[]) => prev.filter((c) => c.id !== id));
      toast.success("Section Deleted", `"${cat?.name}" was removed.`);
      if (editingCatId === id) cancelEdit();
    } catch (err: any) {
      console.error(err);
      toast.error("Deletion Error", err.message || "Could not delete category.");
    }
  };

  // ---------------------------------------------------------------------------
  // Drag & Drop Helpers
  // ---------------------------------------------------------------------------
  const isDescendant = (potentialParentId: string, targetId: string): boolean => {
    let current = categories.find((c) => c.id === targetId);
    while (current && current.parent_id) {
      if (current.parent_id === potentialParentId) return true;
      current = categories.find((c) => c.id === current?.parent_id);
    }
    return false;
  };

  const resetDragState = () => {
    setDraggedCatId(null);
    setDragOverTargetId(null);
    setDragOverPos(null);
    setDragOverRootZone(false);
  };

  const syncReorderToBackend = async (updatedList: Category[], catName?: string) => {
    setIsSyncingReorder(true);
    try {
      const items = updatedList.map((c, idx) => ({
        id: c.id,
        sort_order: c.sort_order ?? idx + 1,
        parent_id: c.parent_id || null,
      }));

      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", items }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to persist category order.");
      }

      toast.success(
        "Taxonomy Reordered",
        catName ? `"${catName}" moved successfully.` : "Menu structure updated successfully."
      );
    } catch (err: any) {
      console.error("Reorder failed:", err);
      toast.error("Reorder Failed", err.message || "Could not save taxonomy changes.");
      // Rollback to server state
      const fresh = await fetch("/api/categories").then((r) => r.json()).catch(() => []);
      if (Array.isArray(fresh)) setCategories(fresh);
    } finally {
      setIsSyncingReorder(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, cat: Category) => {
    e.stopPropagation();
    setDraggedCatId(cat.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cat.id);
  };

  const handleDragOverNode = (e: React.DragEvent<HTMLDivElement>, targetCat: Category) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCatId || draggedCatId === targetCat.id) return;
    if (isDescendant(draggedCatId, targetCat.id)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    let pos: DropPosition = "nest";
    if (offsetY < height * 0.28) {
      pos = "before";
    } else if (offsetY > height * 0.72) {
      pos = "after";
    } else {
      pos = "nest";
    }

    setDragOverTargetId(targetCat.id);
    setDragOverPos(pos);
  };

  const handleDragLeaveNode = (e: React.DragEvent, targetCat: Category) => {
    e.stopPropagation();
    if (dragOverTargetId === targetCat.id) {
      setDragOverTargetId(null);
      setDragOverPos(null);
    }
  };

  const handleDropOnNode = async (e: React.DragEvent, targetCat: Category) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCatId || !dragOverPos) {
      resetDragState();
      return;
    }
    if (draggedCatId === targetCat.id || isDescendant(draggedCatId, targetCat.id)) {
      resetDragState();
      return;
    }

    const draggedCat = categories.find((c) => c.id === draggedCatId);
    if (!draggedCat) {
      resetDragState();
      return;
    }

    let updated = [...categories];

    if (dragOverPos === "nest") {
      // Nest dragged category inside target category
      const targetChildren = updated.filter((c) => c.parent_id === targetCat.id && c.id !== draggedCatId);
      const newSort = targetChildren.length + 1;

      updated = updated.map((c) =>
        c.id === draggedCatId ? { ...c, parent_id: targetCat.id, sort_order: newSort } : c
      );

      // Auto-expand the target so the newly nested child is visible
      setCollapsedCategories((prev) => ({ ...prev, [targetCat.id]: false }));
    } else {
      // Insert before or after targetCat at the same parent level
      const targetParent = targetCat.parent_id || null;
      const siblings = updated
        .filter((c) => (c.parent_id || null) === targetParent && c.id !== draggedCatId)
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

      const targetIdx = siblings.findIndex((c) => c.id === targetCat.id);
      const insertIdx = dragOverPos === "before" ? targetIdx : targetIdx + 1;

      siblings.splice(insertIdx, 0, { ...draggedCat, parent_id: targetParent });

      const sortMap = new Map<string, number>();
      siblings.forEach((c, idx) => sortMap.set(c.id, idx + 1));

      updated = updated.map((c) => {
        if (sortMap.has(c.id)) {
          return { ...c, parent_id: targetParent, sort_order: sortMap.get(c.id)! };
        }
        return c;
      });
    }

    setCategories(updated);
    resetDragState();
    await syncReorderToBackend(updated, draggedCat.name);
  };

  const handleDropOnRootZone = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCatId) {
      resetDragState();
      return;
    }

    const draggedCat = categories.find((c) => c.id === draggedCatId);
    if (!draggedCat) {
      resetDragState();
      return;
    }

    // Already a root category with no parent?
    if (!draggedCat.parent_id) {
      resetDragState();
      return;
    }

    const rootItems = categories
      .filter((c) => !c.parent_id && c.id !== draggedCatId)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

    const updated = categories.map((c) => {
      if (c.id === draggedCatId) {
        return { ...c, parent_id: null, sort_order: rootItems.length + 1 };
      }
      return c;
    });

    setCategories(updated);
    resetDragState();
    await syncReorderToBackend(updated, draggedCat.name);
  };

  // ---------------------------------------------------------------------------
  // Category Node Component
  // ---------------------------------------------------------------------------
  const CategoryNode = ({ cat, depth = 0 }: { cat: Category; depth?: number }) => {
    const children = categories
      .filter((c: Category) => c.parent_id === cat.id)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    const assignedDishes = dishCounts[cat.id] || 0;
    const isCollapsed = !!collapsedCategories[cat.id];
    const isBeingDragged = draggedCatId === cat.id;
    const isDragTarget = dragOverTargetId === cat.id && !isBeingDragged;
    const hasChildren = children.length > 0;

    // Search query filtering
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchSelf = cat.name.toLowerCase().includes(q);
      const matchChild = children.some((c) => c.name.toLowerCase().includes(q));
      if (!matchSelf && !matchChild) return null;
    }

    return (
      <div className="mt-1.5 transition-all duration-150">
        {/* Drop Insertion Bar - Before */}
        {isDragTarget && dragOverPos === "before" && (
          <div
            className="h-1 rounded-full my-1 transition-all animate-pulse"
            style={{
              backgroundColor: themeConfig.primary || "#D4AF37",
              marginLeft: `${depth * 20}px`,
              boxShadow: `0 0 10px ${themeConfig.primary || "#D4AF37"}`,
            }}
          />
        )}

        <div
          draggable
          onDragStart={(e) => handleDragStart(e, cat)}
          onDragOver={(e) => handleDragOverNode(e, cat)}
          onDragLeave={(e) => handleDragLeaveNode(e, cat)}
          onDrop={(e) => handleDropOnNode(e, cat)}
          onDragEnd={resetDragState}
          className={`group flex items-center justify-between p-3 rounded-2xl border transition-all select-none cursor-grab active:cursor-grabbing ${
            isBeingDragged
              ? "opacity-30 border-dashed scale-[0.98] border-amber-500/50 bg-amber-500/5"
              : isDragTarget && dragOverPos === "nest"
              ? "border-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(212,175,55,0.25)] scale-[1.01]"
              : isLight
              ? "bg-white/85 hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
              : "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/15"
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Grip Drag Handle */}
            <div
              className={`p-1 -ml-1 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0 ${
                isLight ? "text-slate-400 hover:text-slate-700" : "text-white/40 hover:text-white"
              }`}
              title="Drag to reorder or nest inside another category"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Depth Indicator / Expand Collapse Toggle */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleCollapse(cat.id, e)}
                className={`p-1 rounded-lg transition-colors shrink-0 ${
                  isLight ? "hover:bg-slate-100 text-slate-500" : "hover:bg-white/10 text-white/50"
                }`}
                title={isCollapsed ? "Expand subcategories" : "Collapse subcategories"}
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : depth > 0 ? (
              <CornerDownRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            ) : null}

            {/* Category Image or Icon */}
            {cat.img ? (
              <img src={cat.img} alt="" className="w-7 h-7 rounded-xl object-cover shrink-0 shadow-2xs" />
            ) : (
              <div
                className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${
                  isLight ? "bg-white border-slate-200" : "bg-white/[0.04] border-white/[0.08]"
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" style={{ color: themeConfig.primary }} />
              </div>
            )}

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`truncate font-semibold ${
                  depth === 0
                    ? isLight
                      ? "text-slate-900 font-bold text-sm"
                      : "text-white font-bold text-sm"
                    : isLight
                    ? "text-slate-700 text-xs"
                    : "text-white/80 text-xs"
                }`}
              >
                {cat.name}
              </span>

              {/* Nest Drop Indicator Badge */}
              {isDragTarget && dragOverPos === "nest" && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse text-amber-300 bg-amber-900/60 border border-amber-500/40"
                >
                  ↳ Drop to nest inside
                </span>
              )}

              {/* Live Assigned Dishes Counter */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                  assignedDishes > 0
                    ? isLight
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : isLight
                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                    : "bg-white/[0.04] text-white/40 border border-white/[0.06]"
                }`}
              >
                <UtensilsCrossed className="w-2.5 h-2.5" />
                {assignedDishes} {assignedDishes === 1 ? "dish" : "dishes"}
              </span>

              {/* Subcategories count badge if any */}
              {hasChildren && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isLight ? "bg-slate-100 text-slate-500" : "bg-white/5 text-white/40"
                  }`}
                >
                  {children.length} {children.length === 1 ? "sub" : "subs"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => startEdit(cat)}
              className={`p-2 rounded-xl border transition-colors ${
                isLight
                  ? "bg-white border-slate-200 text-slate-600 hover:text-amber-800 hover:bg-slate-50 shadow-2xs"
                  : "bg-black/60 border-white/10 text-white/60 hover:text-[#D4AF37] hover:bg-white/10"
              }`}
              title="Edit Section"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => deleteCategory(cat.id)}
              className={`p-2 rounded-xl border transition-colors ${
                isLight
                  ? "bg-white border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 shadow-2xs"
                  : "bg-black/60 border-white/10 text-white/60 hover:text-rose-400 hover:bg-rose-500/10"
              }`}
              title="Delete Section"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Drop Insertion Bar - After */}
        {isDragTarget && dragOverPos === "after" && (
          <div
            className="h-1 rounded-full my-1 transition-all animate-pulse"
            style={{
              backgroundColor: themeConfig.primary || "#D4AF37",
              marginLeft: `${depth * 20}px`,
              boxShadow: `0 0 10px ${themeConfig.primary || "#D4AF37"}`,
            }}
          />
        )}

        {/* Child Subcategories Render (if not collapsed) */}
        {!isCollapsed &&
          children.map((child: Category) => (
            <CategoryNode key={child.id} cat={child} depth={depth + 1} />
          ))}
      </div>
    );
  };

  return (
    <>
      <PageHead eyebrow="Flexible Taxonomy" title="Menu Structure" />
      <div className="grid gap-6 lg:grid-cols-12 pb-12">
        {/* Left Column: Form (5 cols) */}
        <Glass
          className={`lg:col-span-5 p-7 border-t-4 h-fit transition-colors ${
            editingCatId ? "border-t-emerald-500" : ""
          }`}
          style={!editingCatId ? { borderTopColor: themeConfig.primary } : {}}
        >
          <div className="flex justify-between items-center mb-6">
            <h2
              className={`font-serif text-xl font-bold ${
                editingCatId ? "text-emerald-500" : isLight ? "text-slate-900" : "text-white"
              }`}
            >
              {editingCatId ? "Edit Category" : "Create New Category"}
            </h2>
            {editingCatId && (
              <button
                onClick={cancelEdit}
                className="text-xs text-gray-400 hover:text-white uppercase tracking-wider font-semibold hover:underline"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            <Field label="Parent Category (Leave blank for root)">
              <select
                className={inputCls}
                value={parentId || ""}
                onChange={(e) => setParentId(e.target.value || null)}
              >
                <option value="">None (Root Category)</option>
                {categories
                  .filter((c: any) => c.id !== editingCatId)
                  .map((c: any) => (
                    <option
                      key={c.id}
                      value={c.id}
                      className={isLight ? "bg-white text-slate-900" : "bg-[#121214] text-white"}
                    >
                      {getCategoryPath(c.id, categories)}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Category Name">
              <input
                className={inputCls}
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="e.g. Traditional Tiffins"
              />
            </Field>

            <Field label="Section Icon / Photography (Optional)">
              <div
                onClick={() => fileRef.current?.click()}
                className={`h-24 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
                  isLight
                    ? "border-slate-300 bg-slate-50 hover:border-amber-500 hover:bg-slate-100"
                    : "border-white/20 bg-white/[0.02] hover:border-[#D4AF37]/50 hover:bg-white/[0.04]"
                }`}
              >
                {catImagePreview ? (
                  <>
                    <img
                      src={catImagePreview}
                      alt=""
                      className="h-full w-full object-cover opacity-80 group-hover:opacity-40 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="bg-black/80 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg">
                        Change Image
                      </p>
                    </div>
                  </>
                ) : (
                  <div
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      isLight ? "text-slate-500 group-hover:text-slate-900" : "text-white/40 group-hover:text-white"
                    }`}
                  >
                    <UploadCloud className="w-4 h-4" style={{ color: themeConfig.primary }} />
                    <span className="font-semibold">Upload Section Image</span>
                  </div>
                )}
              </div>
              <input type="file" hidden ref={fileRef} accept="image/*" onChange={handleFile} />
            </Field>

            <button
              onClick={saveCategory}
              disabled={loading}
              style={!editingCatId ? { backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent } : {}}
              className={`w-full mt-2 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex justify-center items-center gap-2 transition-all shadow-md cursor-pointer ${
                editingCatId
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20"
                  : "hover:opacity-90"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : editingCatId ? (
                "Save Changes"
              ) : (
                "Create Section"
              )}
            </button>
          </div>
        </Glass>

        {/* Right Column: Taxonomy Hierarchy Map with Drag & Drop (7 cols) */}
        <Glass className="lg:col-span-7 p-7 max-h-[82vh] flex flex-col">
          <div
            className={`flex items-center justify-between gap-4 mb-3 shrink-0 border-b pb-4 ${
              isLight ? "border-slate-200" : "border-white/[0.06]"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`font-serif text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                  Taxonomy Map
                </h2>
                {isSyncingReorder && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 animate-pulse">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Saving order...
                  </span>
                )}
              </div>
              <p className={`text-xs ${isLight ? "text-slate-500 font-medium" : "text-white/40"}`}>
                Hierarchical layout of active menu departments.
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-44">
              <Search
                className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isLight ? "text-slate-400" : "text-white/40"}`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find section..."
                className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors ${
                  isLight
                    ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-600"
                    : "bg-black/40 border-white/10 text-white focus:border-[#D4AF37]"
                }`}
              />
            </div>
          </div>

          {/* Interactive Drag & Drop Instruction Pill */}
          <div
            className={`mb-3 px-3 py-2 rounded-xl text-[11px] flex items-center justify-between border ${
              isLight
                ? "bg-amber-50/80 border-amber-200/80 text-amber-900"
                : "bg-amber-500/[0.06] border-amber-500/20 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>
                <strong>Drag & Drop:</strong> Grab handle (⠿) to reorder. Hover edge to move, center to nest.
              </span>
            </div>
          </div>

          {/* Dedicated Drop Zone: Convert to Root Level (Visible while dragging subcategories) */}
          {draggedCatId && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverRootZone(true);
              }}
              onDragLeave={() => setDragOverRootZone(false)}
              onDrop={handleDropOnRootZone}
              className={`mb-2 p-3 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                dragOverRootZone
                  ? "border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_12px_rgba(212,175,55,0.3)] scale-[1.01]"
                  : isLight
                  ? "border-slate-300 bg-slate-50 text-slate-600 hover:border-amber-500"
                  : "border-white/20 bg-white/[0.02] text-white/50 hover:border-white/40"
              }`}
            >
              <ArrowDownToLine className="w-4 h-4 text-amber-500 animate-bounce" />
              <span>Drop here to convert to Top-Level (Root) Department</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {categories.length === 0 ? (
              <div className={`py-12 text-center text-xs ${isLight ? "text-slate-500" : "text-white/40"}`}>
                No sections defined yet. Create your first category on the left.
              </div>
            ) : (
              categories
                .filter((c: Category) => !c.parent_id)
                .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
                .map((rootCat: Category) => <CategoryNode key={rootCat.id} cat={rootCat} />)
            )}
          </div>
        </Glass>
      </div>
    </>
  );
}