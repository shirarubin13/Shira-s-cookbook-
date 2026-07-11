"use client";

import { useStore } from "@/lib/store";

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 max-w-[90vw] -translate-x-1/2">
      <div className="animate-[toastIn_0.2s_ease-out] rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-bg">
        {toast}
      </div>
    </div>
  );
}
