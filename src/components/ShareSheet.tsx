"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { GhostButton, PrimaryButton } from "./Buttons";

export function ShareSheet({ onClose }: { onClose: () => void }) {
  const { userId, isShared, setSharing, showToast } = useStore();
  const [busy, setBusy] = useState(false);
  const link = typeof window !== "undefined" && userId ? `${window.location.origin}/browse/${userId}` : "";

  async function toggle() {
    setBusy(true);
    await setSharing(!isShared);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/45" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md animate-[sheetUp_0.22s_ease-out] rounded-t-3xl bg-surface p-5 mx-auto">
        <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
          שיתוף
        </div>
        <h2 className="pb-3 pt-1 text-lg font-bold">שיתוף ספר המתכונים</h2>

        <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5">
          <span className="text-sm font-bold">{isShared ? "השיתוף פעיל" : "השיתוף כבוי"}</span>
          <button
            onClick={toggle}
            disabled={busy}
            aria-label="הפעלת שיתוף"
            className="relative h-[22px] w-10 flex-none rounded-full transition disabled:opacity-60"
            style={{ background: isShared ? "var(--herb)" : "var(--surface-3)" }}
          >
            <span
              className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-surface transition-all"
              style={{ left: isShared ? "2px" : "20px" }}
            />
          </button>
        </div>

        {isShared ? (
          <>
            <p className="pb-2 text-xs font-bold text-muted">
              כל מי שיש לו את הקישור יכול לצפות במתכונים שלך (בלי צורך בהתחברות).
            </p>
            <div dir="ltr" className="truncate rounded-2xl bg-surface-2 px-3.5 py-3 text-left text-sm text-muted">
              {link}
            </div>
          </>
        ) : (
          <p className="text-xs font-bold text-muted">
            הפעילי כדי לקבל קישור שחברות יכולות להשתמש בו כדי לצפות בספר שלך.
          </p>
        )}

        <div className="flex gap-2.5 pt-3">
          <GhostButton onClick={onClose}>סגירה</GhostButton>
          {isShared && (
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
          )}
        </div>
      </div>
    </div>
  );
}
