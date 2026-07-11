"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { GhostButton, PrimaryButton } from "./Buttons";

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { importFromText } = useStore();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/45" onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className="w-full max-w-md animate-[sheetUp_0.22s_ease-out] rounded-t-3xl bg-surface p-5 mx-auto">
        <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
          ייבוא
        </div>
        <h2 className="pb-1 pt-1 text-lg font-bold">הדביקי את הטקסט של המתכון</h2>
        <p className="pb-3 text-xs font-bold text-muted">
          כיתוב הסרטון, תיאור, או כל טקסט שמתאר את המתכון — ננתח אותו ונבנה ממנו מתכון מלא.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="לדוגמה: פסטה קרבונרה עם גבעולי חסה מוקרמלים..."
          rows={5}
          className="w-full rounded-2xl bg-surface-2 px-3.5 py-3 text-right"
        />
        <div className="flex gap-2.5 pt-3">
          <GhostButton onClick={onClose}>ביטול</GhostButton>
          <PrimaryButton
            onClick={async () => {
              if (!text.trim() || loading) return;
              setLoading(true);
              await importFromText(text);
              setLoading(false);
              onClose();
            }}
          >
            {loading ? "מייבאת…" : "ייבוא"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
