"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export function UpgradeBox({ recipeId }: { recipeId: string }) {
  const { applyUpgrade, nextUpgradeIdeas } = useStore();
  const [draft, setDraft] = useState("");
  const [intro, setIntro] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setIdeas(nextUpgradeIdeas());
    setIntro(`כמה רעיונות שיכולים להתאים ל"${text}":`);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
      <div className="text-xs font-bold">רוצה לשדרג את המתכון?</div>

      <div className="flex gap-2.5">
        <button
          onClick={send}
          className="flex-none rounded-xl px-3.5 py-2 text-xs font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          שליחה
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="רוטב, תוספת, יותר מתוחכם…"
          className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2 text-right text-xs"
        />
      </div>

      {intro && (
        <>
          <div className="rounded-xl bg-surface-2 p-2.5 text-right text-xs font-bold">{intro}</div>
          {ideas.map((idea) => (
            <button
              key={idea}
              onClick={() => {
                applyUpgrade(recipeId, idea);
              }}
              className="w-full rounded-xl bg-surface-2 px-3 py-2.5 text-right text-xs font-bold"
            >
              {idea}
            </button>
          ))}
          <button
            onClick={() => {
              setIdeas(nextUpgradeIdeas());
              setIntro("בטח, עוד כמה אפשרויות:");
            }}
            className="self-end text-xs font-bold text-muted"
          >
            רוצה רעיונות אחרים?
          </button>
        </>
      )}
    </div>
  );
}
