"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Info,
  X,
  Trash2,
  ShieldAlert,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
}

interface ToastAPI {
  success: (title: string, description?: string, duration?: number) => void;
  error: (title: string, description?: string, duration?: number) => void;
  warning: (title: string, description?: string, duration?: number) => void;
  info: (title: string, description?: string, duration?: number) => void;
}

interface NotificationContextValue {
  toast: ToastAPI;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/* PROVIDER COMPONENT                                                         */
/* -------------------------------------------------------------------------- */

export function LuxuryNotificationProvider({ children }: { children: ReactNode }) {
  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  /* --- Toast Methods --- */
  const addToast = useCallback(
    (type: ToastType, title: string, description?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, title, description, duration }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast: ToastAPI = {
    success: (title, description, duration) => addToast("success", title, description, duration),
    error: (title, description, duration) => addToast("error", title, description, duration),
    warning: (title, description, duration) => addToast("warning", title, description, duration),
    info: (title, description, duration) => addToast("info", title, description, duration),
  };

  /* --- Confirm Method --- */
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirmAction = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Luxury Toast Queue Container */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <LuxuryToastItem key={t.id} item={t} onDismiss={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Luxury Confirm Modal Dialog */}
      <AnimatePresence>
        {confirmState && confirmState.isOpen && (
          <LuxuryConfirmDialog
            options={confirmState.options}
            onConfirm={() => handleConfirmAction(true)}
            onCancel={() => handleConfirmAction(false)}
          />
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/* HOOKS                                                                      */
/* -------------------------------------------------------------------------- */

export function useToast(): ToastAPI {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useToast must be used within a LuxuryNotificationProvider");
  }
  return context.toast;
}

export function useConfirm() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useConfirm must be used within a LuxuryNotificationProvider");
  }
  return context.confirm;
}

/* -------------------------------------------------------------------------- */
/* TOAST ITEM COMPONENT                                                       */
/* -------------------------------------------------------------------------- */

function LuxuryToastItem({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const { type, title, description, duration = 4000 } = item;

  // Visual Theme mapping
  const styles = {
    success: {
      border: "border-emerald-500/40",
      glow: "shadow-[0_0_30px_rgba(16,185,129,0.15)]",
      badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      progress: "bg-emerald-400",
      icon: CheckCircle2,
    },
    error: {
      border: "border-rose-500/40",
      glow: "shadow-[0_0_30px_rgba(244,63,94,0.18)]",
      badge: "bg-rose-500/10 border-rose-500/30 text-rose-400",
      progress: "bg-rose-500",
      icon: AlertOctagon,
    },
    warning: {
      border: "border-[#D4AF37]/50",
      glow: "shadow-[0_0_30px_rgba(212,175,55,0.18)]",
      badge: "bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37]",
      progress: "bg-[#D4AF37]",
      icon: AlertTriangle,
    },
    info: {
      border: "border-blue-500/40",
      glow: "shadow-[0_0_30px_rgba(59,130,246,0.15)]",
      badge: "bg-blue-500/10 border-blue-500/30 text-blue-400",
      progress: "bg-blue-400",
      icon: Info,
    },
  }[type];

  const Icon = styles.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 450, damping: 32 }}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-[#121214]/95 backdrop-blur-2xl border ${styles.border} ${styles.glow} p-4 shadow-2xl`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${styles.badge}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <h4 className="font-serif text-sm font-bold tracking-wide text-white">{title}</h4>
          {description && (
            <p className="mt-1 text-xs text-gray-300 leading-relaxed">{description}</p>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <motion.div
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        onAnimationComplete={onDismiss}
        className={`absolute bottom-0 left-0 h-1 ${styles.progress} opacity-70`}
      />
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* CONFIRMATION MODAL DIALOG                                                  */
/* -------------------------------------------------------------------------- */

function LuxuryConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {
    title,
    description,
    confirmText = "Confirm Action",
    cancelText = "Cancel",
    variant = "default",
  } = options;

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Dark backdrop blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#121214] p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.85)]"
      >
        <div className="flex flex-col items-center text-center">
          {/* Header Badge */}
          <div
            className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${
              isDanger
                ? "border-rose-500/40 bg-rose-500/10 text-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.2)]"
                : "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.2)]"
            }`}
          >
            {isDanger ? <Trash2 className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
          </div>

          <h3 className="font-serif text-2xl font-bold tracking-tight text-white">{title}</h3>

          <p className="mt-2 text-sm text-gray-300 leading-relaxed">{description}</p>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto rounded-xl px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all ${
              isDanger
                ? "bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg shadow-rose-900/40 hover:from-red-500 hover:to-rose-600"
                : "bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 hover:bg-white"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
