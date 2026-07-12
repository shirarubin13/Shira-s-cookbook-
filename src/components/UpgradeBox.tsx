"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Recipe } from "@/lib/recipes";

async function askForUpgrades(recipe: Recipe, request: string): Promise<string[] | null> {
  try {
    const res = await fetch("/api/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: recipe.title, blurb: recipe.blurb, request }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ideas = data.ideas as string[] | undefined;
    return ideas && ideas.length ? ideas : null;
  } catch {
    return null;
  }
}

export function UpgradeBox({ recipe }: { recipe: Recipe }) {
  const { applyUpgrade, nextUpgradeIdeas } = useStore();
  const [draft, setDraft] = useState("");
  const [lastRequest, setLastRequest] = useState("");
  const [intro, setIntro] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // When the AI is unavailable, the canned ideas are shown with an honest note
  // instead of being passed off as a tailored answer.
  const AI_DOWN_INTRO =
    "השף החכם לא זמין כרגע (עומס או מכסה יומית) — הנה כמה רעיונות כלליים בינתיים, ואפשר לנסות שוב עוד כמה דקות:";

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setLastRequest(text);
    setLoading(true);
    setIntro(`חושבת על רעיונות ל"${text}"…`);
    const found = await askForUpgrades(recipe, text);
    setIdeas(found ?? nextUpgradeIdeas());
    setIntro(found ? `כמה רעיונות שיכולים להתאים ל"${text}":` : AI_DOWN_INTRO);
    setLoading(false);
  }

  async function more() {
    if (!lastRequest || loading) return;
    setLoading(true);
    const found = await askForUpgrades(recipe, lastRequest);
    setIdeas(found ?? nextUpgradeIdeas());
    setIntro(found ? "בטח, עוד כמה אפשרויות:" : AI_DOWN_INTRO);
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
      <div className="text-xs font-bold">רוצה לשדרג את המתכון?</div>

      <div className="flex gap-2.5">
        <button
          onClick={send}
          disabled={loading}
          className="flex-none rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-60"
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
          {!loading &&
            ideas.map((idea) => (
              <button
                key={idea}
                onClick={() => applyUpgrade(recipe.id, idea)}
                className="w-full rounded-xl bg-surface-2 px-3 py-2.5 text-right text-xs font-bold"
              >
                {idea}
              </button>
            ))}
          {!loading && (
            <button onClick={more} className="self-end text-xs font-bold text-muted">
              רוצה רעיונות אחרים?
            </button>
          )}
        </>
      )}
    </div>
  );
}
