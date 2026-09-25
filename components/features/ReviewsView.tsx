"use client";

import { Star, CheckCircle, Trash2 } from "lucide-react";
import { Review } from "@/types";
import { PageHead, Glass } from "@/components/ui/Primitives";
import { useToast, useConfirm } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";

export default function ReviewsView({ reviews = [], setReviews }: any) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const toast = useToast();
  const confirm = useConfirm();

  const togglePublish = async (id: string, current: boolean) => {
    const rev = reviews.find((r: any) => r.id === id);
    const nextStatus = !current;
    setReviews((p: any) => p.map((r: any) => r.id === id ? { ...r, is_published: nextStatus } : r));
    
    try {
      const res = await fetch('/api/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_published: nextStatus }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Unable to update review publication status.");
      }
      toast.success(
        nextStatus ? "Review Approved" : "Review Hidden",
        `Feedback from ${rev?.customer_name || 'Guest'} is now ${nextStatus ? 'visible' : 'hidden'} on the guestbook.`
      );
    } catch (err: any) {
      toast.error("Update Failed", err.message);
      setReviews((p: any) => p.map((r: any) => r.id === id ? { ...r, is_published: current } : r));
    }
  };

  const deleteReview = async (id: string) => {
    const rev = reviews.find((r: any) => r.id === id);
    const confirmed = await confirm({
      title: "Delete Customer Review",
      description: `Are you sure you want to permanently remove feedback from ${rev?.customer_name || 'this guest'}?`,
      confirmText: "Delete Review",
      variant: "danger",
    });
    if (!confirmed) return;

    setReviews((p: any) => p.filter((r: any) => r.id !== id));
    try {
      const res = await fetch(`/api/reviews?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Could not delete review.");
      }
      toast.success("Review Deleted", "Feedback successfully removed.");
    } catch (err: any) {
      toast.error("Deletion Error", err.message);
    }
  };

  return (
    <div className="pb-10">
      <PageHead eyebrow="Feedback" title="Customer Reviews" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(reviews || []).length === 0 && (
          <p className={`ml-2 text-sm ${isLight ? "text-slate-500" : "text-gray-500"}`}>
            No reviews have been submitted yet.
          </p>
        )}
        {(reviews || []).map((r: any) => (
          <Glass key={r.id} className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className={`font-bold text-sm ${isLight ? "text-slate-900" : "text-white"}`}>
                  {r.customer_name}
                </span>
                <div className="flex" style={{ color: themeConfig.primary }}>
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-3.5 h-3.5 ${
                        i < r.rating 
                          ? "fill-current" 
                          : isLight ? "text-slate-200 fill-transparent" : "text-gray-600 fill-transparent"
                      }`} 
                    />
                  ))}
                </div>
              </div>
              <p className={`text-sm mb-6 italic leading-relaxed ${isLight ? "text-slate-600" : "text-gray-400"}`}>
                "{r.comment}"
              </p>
            </div>
            <div className={`flex items-center justify-between border-t pt-3 mt-4 ${
              isLight ? "border-slate-100" : "border-white/10"
            }`}>
               <button 
                 onClick={() => togglePublish(r.id, r.is_published)} 
                 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${
                   r.is_published 
                     ? isLight ? "text-emerald-600 font-extrabold" : "text-green-500" 
                     : isLight ? "text-slate-500 hover:text-slate-900" : "text-gray-500 hover:text-white"
                 }`}
               >
                 <CheckCircle className="w-4 h-4" /> {r.is_published ? 'Published' : 'Approve'}
               </button>
               <button 
                 onClick={() => deleteReview(r.id)} 
                 className={`transition-colors ${isLight ? "text-slate-400 hover:text-red-600" : "text-gray-500 hover:text-red-500"}`}
                 title="Delete Review"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
          </Glass>
        ))}
      </div>
    </div>
  );
}