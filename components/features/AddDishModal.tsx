import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Loader2, Sparkles, Star, IndianRupee, TrendingUp } from "lucide-react";
import { uploadImage } from "@/lib/supabase";
import { getCategoryPath, inr } from "@/lib/utils";
import { Glass, Field, Toggle, inputCls } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";

export default function AddDishModal({ open, onClose, dishToEdit, onSave, categories }: any) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const toast = useToast();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(categories[0]?.id || "");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [popular, setPopular] = useState(false);
  const [isVeg, setIsVeg] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      if (dishToEdit) {
        setName(dishToEdit.name || "");
        setDesc(dishToEdit.desc || "");
        setCat(dishToEdit.category_id || categories[0]?.id || "");
        setPrice(dishToEdit.price ? dishToEdit.price.toString() : "");
        setCost(dishToEdit.cost_price ? dishToEdit.cost_price.toString() : "");
        setPopular(!!dishToEdit.popular);
        setIsVeg(dishToEdit.is_veg !== false);
        setPreview(dishToEdit.img || null);
        setImageFile(null);
      } else {
        setName("");
        setDesc("");
        setCat(categories[0]?.id || "");
        setPrice("");
        setCost("");
        setPopular(false);
        setIsVeg(true);
        setPreview(null);
        setImageFile(null);
      }
    }
  }, [open, dishToEdit, categories]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // Kitchen Margin Intelligence Calculation
  const priceNum = Number(price) || 0;
  const costNum = Number(cost) || 0;
  const profitNum = priceNum - costNum;
  const marginPct = priceNum > 0 && costNum > 0 ? Math.round((profitNum / priceNum) * 100) : null;

  const callMagicAI = async () => {
    if (!name.trim()) {
      toast.warning("Dish Name Required", "Please enter a dish name first so the AI copywriter knows what to describe.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishName: name })
      });
      const data = await res.json();
      setDesc(data.text);
      toast.success("Description Generated", "AI copywriter crafted a culinary description.");
    } catch (e) {
      toast.error("AI Service Error", "Unable to reach the copywriter service at this time.");
    }
    setAiLoading(false);
  };

  const submit = async () => {
    if (!name.trim() || !price || !cat) {
      toast.warning("Required Fields Missing", "Please provide the dish name, selling price, and category.");
      return;
    }
    if (!preview && !imageFile) {
      toast.warning("Dish Image Required", "Please select or upload a presentation image for this offering.");
      return;
    }
    setLoading(true);
    try {
      let finalImgUrl = dishToEdit?.img || "";
      if (imageFile) finalImgUrl = await uploadImage(imageFile);

      const payload: any = {
        name: name.trim(),
        desc: desc.trim(),
        price: Number(price),
        category_id: cat,
        img: finalImgUrl,
        popular,
        is_veg: isVeg,
        dietary_tags: []
      };

      let data;
      if (dishToEdit) {
        const res = await fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dishToEdit.id, ...payload }),
        });
        data = await res.json();
      } else {
        const res = await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        data = await res.json();
      }

      if (data?.id) {
        toast.success(
          dishToEdit ? "Dish Updated" : "Dish Published",
          `"${name}" has been successfully saved to the active culinary catalog.`
        );
        onSave(data, !!dishToEdit);
        onClose();
      } else {
        throw new Error(data?.error || "Failed to save dish.");
      }
    } catch (e: any) {
      toast.error("Database Error", e.message || "Failed to save dish record.");
    }
    setLoading(false);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md transition-colors ${
            isLight ? "bg-slate-900/40" : "bg-black/85"
          }`} 
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 16 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 16 }} 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-xl"
          >
            <Glass className={`max-h-[92vh] overflow-y-auto p-7 border shadow-2xl custom-scrollbar transition-all ${
              isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#101014]/98 border-[#D4AF37]/25 text-white"
            }`}>
              
              {/* Modal Header */}
              <div className={`mb-6 flex items-start justify-between border-b pb-4 ${
                isLight ? "border-slate-200" : "border-white/[0.08]"
              }`}>
                <div>
                  <h2 className={`font-serif text-2xl font-bold ${
                    isLight ? "text-slate-900" : "text-white"
                  }`}>
                    {dishToEdit ? "Edit Menu Item" : "Create New Menu Item"}
                  </h2>
                  <p className={`text-xs mt-1 ${isLight ? "text-slate-500 font-medium" : "text-white/50"}`}>
                    Configure culinary offering, pricing, and live presentation.
                  </p>
                </div>
                <button 
                  onClick={onClose} 
                  className={`rounded-full p-2 transition-colors ${
                    isLight 
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900" 
                      : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5">
                
                {/* Image Upload Area */}
                <Field label="Presentation Photography">
                  <div 
                    onClick={() => fileRef.current?.click()} 
                    className={`relative h-44 w-full rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer group transition-all flex items-center justify-center ${
                      isLight 
                        ? "border-slate-300 bg-slate-50 hover:border-amber-500 hover:bg-slate-100" 
                        : "border-white/20 bg-black/40 hover:border-[#D4AF37]/60"
                    }`}
                  >
                    {preview ? (
                      <>
                        <img src={preview} alt="Dish Preview" className="w-full h-full object-cover opacity-85 group-hover:opacity-40 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="bg-black/80 px-4 py-2 rounded-full text-xs font-bold tracking-widest text-white border border-white/20">Change Image</p>
                        </div>
                      </>
                    ) : (
                      <div className={`flex flex-col items-center transition-colors ${
                        isLight ? "text-slate-500 group-hover:text-amber-700" : "text-white/40 group-hover:text-[#D4AF37]"
                      }`}>
                        <UploadCloud className="w-8 h-8 mb-2" />
                        <span className="text-xs uppercase tracking-widest font-semibold">Upload Food Photography</span>
                        <span className={`text-[10px] mt-1 ${isLight ? "text-slate-400" : "text-white/30"}`}>PNG, JPG or WebP</span>
                      </div>
                    )}
                  </div>
                  <input type="file" hidden ref={fileRef} accept="image/*" onChange={handleFile} />
                </Field>

                {/* Dish Name */}
                <Field label="Dish Name *">
                  <input 
                    className={inputCls} 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Tandoori Murgh Tikka" 
                  />
                </Field>
                
                {/* Category Selection */}
                <Field label="Category / Section *">
                  <select className={inputCls} value={cat} onChange={e => setCat(e.target.value)}>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id} className={isLight ? "bg-white text-slate-900" : "bg-[#121214] text-white"}>
                        {getCategoryPath(c.id, categories)}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Description & Magic AI */}
                <Field label="Menu Description">
                  <div className="relative">
                    <textarea 
                      className={`${inputCls} resize-none h-24 pr-12`} 
                      value={desc} 
                      onChange={e => setDesc(e.target.value)} 
                      placeholder="Craft an appetizing description highlighting flavours and preparation..."
                    />
                    <button 
                      type="button"
                      onClick={callMagicAI} 
                      disabled={aiLoading} 
                      style={{ color: themeConfig.primary }}
                      className={`absolute right-2 bottom-2 rounded-xl px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5 border transition-colors cursor-pointer ${
                        isLight 
                          ? "bg-amber-50 border-amber-300 hover:bg-amber-100" 
                          : "bg-[#D4AF37]/20 border-[#D4AF37]/30 hover:bg-[#D4AF37] hover:text-black"
                      }`}
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3" /> AI Copywriter</>}
                    </button>
                  </div>
                </Field>

                {/* Pricing & Kitchen Margin Intelligence */}
                <div className={`rounded-2xl border p-4 space-y-3 ${
                  isLight ? "bg-slate-50 border-slate-200" : "border-white/[0.08] bg-white/[0.02]"
                }`}>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Selling Price (₹) *">
                      <div className="relative">
                        <span className={`absolute left-3 top-3 text-sm font-sans ${isLight ? "text-slate-500" : "text-white/40"}`}>₹</span>
                        <input 
                          className={`${inputCls} pl-8 font-mono`} 
                          value={price} 
                          inputMode="numeric" 
                          placeholder="350"
                          onChange={e => setPrice(e.target.value.replace(/\D/g, ""))} 
                        />
                      </div>
                    </Field>
                    <Field label="Kitchen Prep Cost (₹) (Optional)">
                      <div className="relative">
                        <span className={`absolute left-3 top-3 text-sm font-sans ${isLight ? "text-slate-500" : "text-white/40"}`}>₹</span>
                        <input 
                          className={`${inputCls} pl-8 font-mono`} 
                          value={cost} 
                          inputMode="numeric" 
                          placeholder="120"
                          onChange={e => setCost(e.target.value.replace(/\D/g, ""))} 
                        />
                      </div>
                    </Field>
                  </div>

                  {/* Live Profit Margin Badge */}
                  {marginPct !== null && (
                    <div className={`flex items-center justify-between pt-2 border-t text-xs ${
                      isLight ? "border-slate-200" : "border-white/[0.06]"
                    }`}>
                      <span className={`flex items-center gap-1 ${isLight ? "text-slate-600" : "text-white/50"}`}>
                        <TrendingUp className="w-3.5 h-3.5" style={{ color: themeConfig.primary }} />
                        Estimated Profit: <strong className={`font-mono ${isLight ? "text-slate-900" : "text-white"}`}>{inr(profitNum)}</strong>
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                        marginPct >= 55 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' :
                        marginPct >= 35 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                      }`}>
                        {marginPct}% Gross Margin
                      </span>
                    </div>
                  )}
                </div>

                {/* Dietary Classification & Signature Flags */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Veg / Non-Veg FSSAI Selector */}
                  <div 
                    onClick={() => setIsVeg(!isVeg)}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 cursor-pointer transition-all select-none border ${
                      isLight 
                        ? "bg-slate-50 border-slate-200 hover:border-slate-300" 
                        : "bg-black/40 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 border-2 ${isVeg ? 'border-emerald-500' : 'border-rose-500'} flex items-center justify-center rounded-sm shrink-0`}>
                        <div className={`w-2 h-2 rounded-full ${isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      </div>
                      <span className={`text-xs uppercase tracking-wider font-bold ${isVeg ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isVeg ? 'Pure Veg' : 'Non-Veg'}
                      </span>
                    </div>
                    <Toggle on={isVeg} onClick={() => setIsVeg(!isVeg)} />
                  </div>

                  {/* Signature Toggle */}
                  <div 
                    onClick={() => setPopular(!popular)}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 cursor-pointer transition-all select-none border ${
                      isLight 
                        ? "bg-slate-50 border-slate-200 hover:border-slate-300" 
                        : "bg-black/40 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-2 ${
                      isLight ? "text-slate-800" : "text-white/70"
                    }`}>
                      <Star className={`w-3.5 h-3.5 ${popular ? 'text-amber-500 fill-amber-500' : isLight ? 'text-slate-300' : 'text-white/40'}`} /> 
                      Signature
                    </span>
                    <Toggle on={popular} onClick={() => setPopular(!popular)} />
                  </div>
                </div>

                {/* Submit Action */}
                <motion.button 
                  onClick={submit} 
                  disabled={loading} 
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{ backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent }}
                  className="w-full mt-6 rounded-2xl py-4 text-sm font-bold uppercase tracking-widest flex justify-center items-center hover:opacity-90 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : dishToEdit ? "Save Dish Changes" : "Publish to Live Menu"}
                </motion.button>

              </div>
            </Glass>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}