"use client";

import { useState, useRef, useMemo } from "react";
import { UploadCloud, Edit2, Trash2, CornerDownRight, Loader2, FolderTree, Search, UtensilsCrossed } from "lucide-react";
import { Category, Dish } from "@/types";
import { getCategoryPath } from "@/lib/utils";
import { uploadImage } from "@/lib/supabase";
import { Glass, Field, PageHead, inputCls } from "@/components/ui/Primitives";
import { useToast, useConfirm } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";

export default function StructureView({ 
  categories = [], 
  setCategories, 
  dishes = [] 
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

  // Live item count map per category
  const dishCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (dishes || []).forEach(d => {
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
        // Update existing category via AWS API
        const res = await fetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingCatId,
            name: newCat.trim(),
            parent_id: parentId || null,
            img: finalImgUrl,
          }),
        });
        const updated = await res.json();
        if (!res.ok) throw new Error(updated.error || "Failed to update category.");
        setCategories((prev: Category[]) => prev.map(c => c.id === editingCatId ? updated : c));
        toast.success("Section Updated", `"${newCat}" has been successfully updated.`);
      } else {
        // Insert new category via AWS API
        const maxSort = categories.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    const cat = categories.find(c => c.id === id);
    const assignedDishes = dishCounts[id] || 0;
    const hasChildren = categories.some(c => c.parent_id === id);

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
      const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete category.");
      setCategories((prev: Category[]) => prev.filter(c => c.id !== id));
      toast.success("Section Deleted", `"${cat?.name}" was removed.`);
      if (editingCatId === id) cancelEdit();
    } catch (err: any) {
      console.error(err);
      toast.error("Deletion Error", err.message || "Could not delete category.");
    }
  };

  const CategoryNode = ({ cat, depth = 0 }: { cat: Category, depth?: number }) => {
    const children = categories.filter((c: Category) => c.parent_id === cat.id);
    const assignedDishes = dishCounts[cat.id] || 0;

    // Filter by search
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchSelf = cat.name.toLowerCase().includes(q);
      const matchChild = children.some(c => c.name.toLowerCase().includes(q));
      if (!matchSelf && !matchChild) return null;
    }

    return (
      <div className="mt-2">
        <div 
          className={`group flex items-center justify-between p-3 rounded-2xl border transition-all ${
            isLight 
              ? "bg-white/80 hover:bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs" 
              : "bg-white/[0.02] hover:bg-white/[0.04] border-white/5 hover:border-white/15"
          }`} 
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />}
            
            {cat.img ? (
              <img src={cat.img} alt="" className="w-7 h-7 rounded-xl object-cover shrink-0 shadow-2xs" />
            ) : (
              <div className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 ${
                isLight ? "bg-white border-slate-200" : "bg-white/[0.04] border-white/[0.08]"
              }`}>
                <FolderTree className="w-3.5 h-3.5" style={{ color: themeConfig.primary }} />
              </div>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <span className={`truncate font-semibold ${
                depth === 0 
                  ? isLight ? 'text-slate-900 font-bold text-sm' : 'text-white font-bold text-sm' 
                  : isLight ? 'text-slate-700 text-xs' : 'text-white/80 text-xs'
              }`}>
                {cat.name}
              </span>

              {/* Live Assigned Dishes Counter */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                assignedDishes > 0 
                  ? isLight 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : isLight 
                    ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                    : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'
              }`}>
                <UtensilsCrossed className="w-2.5 h-2.5" />
                {assignedDishes} {assignedDishes === 1 ? 'dish' : 'dishes'}
              </span>
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

        {children.map((child: Category) => (
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
        <Glass className={`lg:col-span-5 p-7 border-t-4 h-fit transition-colors ${
          editingCatId ? 'border-t-emerald-500' : ''
        }`} style={!editingCatId ? { borderTopColor: themeConfig.primary } : {}}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`font-serif text-xl font-bold ${
              editingCatId 
                ? 'text-emerald-500' 
                : isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {editingCatId ? "Edit Category" : "Create New Category"}
            </h2>
            {editingCatId && (
              <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-white uppercase tracking-wider">
                Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            <Field label="Parent Category (Leave blank for root)">
              <select 
                className={inputCls} 
                value={parentId || ""} 
                onChange={e => setParentId(e.target.value || null)}
              >
                <option value="">None (Root Category)</option>
                {categories
                  .filter((c: any) => c.id !== editingCatId)
                  .map((c: any) => (
                    <option key={c.id} value={c.id} className={isLight ? "bg-white text-slate-900" : "bg-[#121214] text-white"}>
                      {getCategoryPath(c.id, categories)}
                    </option>
                  ))
                }
              </select>
            </Field>

            <Field label="Category Name">
              <input 
                className={inputCls} 
                value={newCat} 
                onChange={e => setNewCat(e.target.value)} 
                placeholder="e.g. Traditional Tiffins" 
              />
            </Field>

            <Field label="Section Icon / Photography (Optional)">
              <div 
                onClick={() => fileRef.current?.click()} 
                className={`h-20 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
                  isLight 
                    ? "border-slate-300 bg-slate-50 hover:border-amber-500 hover:bg-slate-100" 
                    : "border-white/20 bg-white/[0.02] hover:border-[#D4AF37]/50 hover:bg-white/[0.04]"
                }`}
              >
                {catImagePreview ? (
                  <>
                    <img src={catImagePreview} alt="" className="h-full w-full object-cover opacity-70 group-hover:opacity-30 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="bg-black/80 px-3 py-1 rounded-full text-xs font-bold text-white">Change Image</p>
                    </div>
                  </>
                ) : (
                  <div className={`flex items-center gap-2 text-xs transition-colors ${
                    isLight ? "text-slate-500 group-hover:text-slate-900" : "text-white/40 group-hover:text-white"
                  }`}>
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
              className={`w-full mt-2 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest flex justify-center items-center transition-all shadow-md cursor-pointer ${
                editingCatId 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' 
                  : 'hover:opacity-90'
              }`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : editingCatId ? "Save Changes" : "Create Section"}
            </button>
          </div>
        </Glass>

        {/* Right Column: Taxonomy Hierarchy Map with Live Counters (7 cols) */}
        <Glass className="lg:col-span-7 p-7 max-h-[75vh] flex flex-col">
          <div className={`flex items-center justify-between gap-4 mb-4 shrink-0 border-b pb-4 ${isLight ? "border-slate-200" : "border-white/[0.06]"}`}>
            <div>
              <h2 className={`font-serif text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Taxonomy Map</h2>
              <p className={`text-xs ${isLight ? "text-slate-500 font-medium" : "text-white/40"}`}>Hierarchical layout of active menu departments.</p>
            </div>

            {/* Quick Search */}
            <div className="relative w-44">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isLight ? "text-slate-400" : "text-white/40"}`} />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="Find section..." 
                className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none border transition-colors ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-600" 
                    : "bg-black/40 border-white/10 text-white focus:border-[#D4AF37]"
                }`}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {categories.length === 0 ? (
              <div className={`py-12 text-center text-xs ${isLight ? "text-slate-500" : "text-white/40"}`}>
                No sections defined yet. Create your first category on the left.
              </div>
            ) : (
              categories
                .filter((c: Category) => !c.parent_id)
                .map((rootCat: Category) => (
                  <CategoryNode key={rootCat.id} cat={rootCat} />
                ))
            )}
          </div>
        </Glass>
      </div>
    </>
  );
}