"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { GhostButton, PrimaryButton } from "./Buttons";

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { importFromVideo } = useStore();
  const [link, setLink] = useState("");

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/45" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md animate-[sheetUp_0.22s_ease-out] rounded-t-3xl bg-surface p-5 mx-auto">
        <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
          ייבוא
        </div>
        <h2 className="pb-3 pt-1 text-lg font-bold">הדביקי קישור לסרטון</h2>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="tiktok.com/@user/video/…"
          dir="ltr"
          className="w-full rounded-2xl bg-surface-2 px-3.5 py-3 text-left"
        />
        <div className="flex gap-2.5 pt-3">
          <GhostButton onClick={onClose}>ביטול</GhostButton>
          <PrimaryButton
            onClick={() => {
              if (!link.trim()) return;
              importFromVideo();
              onClose();
            }}
          >
            ייבוא
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
