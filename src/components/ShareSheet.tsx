"use client";

import { useStore } from "@/lib/store";
import { GhostButton, PrimaryButton } from "./Buttons";

export function ShareSheet({ onClose }: { onClose: () => void }) {
  const { userName, showToast } = useStore();
  const link = typeof window !== "undefined" ? `${window.location.origin}/?book=${encodeURIComponent(userName)}` : "";

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/45" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md animate-[sheetUp_0.22s_ease-out] rounded-t-3xl bg-surface p-5 mx-auto">
        <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
          שיתוף
        </div>
        <h2 className="pb-3 pt-1 text-lg font-bold">שיתוף ספר המתכונים</h2>
        <div dir="ltr" className="truncate rounded-2xl bg-surface-2 px-3.5 py-3 text-left text-sm text-muted">
          {link}
        </div>
        <div className="flex gap-2.5 pt-3">
          <GhostButton onClick={onClose}>סגירה</GhostButton>
          <PrimaryButton
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
              } catch {
                // clipboard permission denied — link is still visible above to copy manually
              }
              showToast("הקישור הועתק.");
              onClose();
            }}
          >
            העתקת קישור
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
