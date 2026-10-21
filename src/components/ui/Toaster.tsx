"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export function toast(message: string, type: ToastType = "info") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ss-toast", { detail: { message, type } }));
  }
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let counter = 0;
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail;
      const id = ++counter;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5000);
    };
    window.addEventListener("ss-toast", handler);
    return () => window.removeEventListener("ss-toast", handler);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-2 rounded-lg px-4 py-3 shadow-lg text-sm text-white animate-[slideIn_.2s_ease-out]",
            t.type === "success" && "bg-emerald-600",
            t.type === "error" && "bg-rose-600",
            t.type === "info" && "bg-slate-800"
          )}
        >
          {t.type === "success" && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
          {t.type === "error" && <XCircle size={16} className="mt-0.5 shrink-0" />}
          {t.type === "info" && <Info size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => setItems((prev) => prev.filter((i) => i.id !== t.id))}
            className="opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`@keyframes slideIn { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
