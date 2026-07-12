"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Recipe, chatSuggestionPool, matchesQuery } from "@/lib/recipes";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";

type ChatEntry =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string }
  | { kind: "suggestions"; recipes: Recipe[] };

type ChatHistoryItem = { role: "user" | "assistant"; text: string };

const GREETING_TEXT = "ספרי לי מה בא לך, מה יש לך בבית, או כמה זמן יש לך.";
const GREETING: ChatEntry = { kind: "bot", text: GREETING_TEXT };

// The conversation survives leaving the chat (e.g. to look at a suggested recipe)
// for a few hours, so coming back shows the earlier options instead of starting over.
const STORAGE_KEY = "cookbook-chat-v1";
const CHAT_TTL_MS = 3 * 60 * 60 * 1000;

function loadStoredChat(): { entries: ChatEntry[]; saved: string[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries) || Date.now() - parsed.at > CHAT_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { entries: parsed.entries, saved: Array.isArray(parsed.saved) ? parsed.saved : [] };
  } catch {
    return null;
  }
}

function fallbackSuggestions(query: string): Recipe[] {
  const matches = chatSuggestionPool.filter((r) => matchesQuery(r, query));
  return (matches.length ? matches : chatSuggestionPool.slice(0, 2)).map((r) => ({ ...r }));
}

async function askAi(message: string, history: ChatHistoryItem[]): Promise<Recipe[] | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.suggestions as Array<Omit<Recipe, "id" | "source">> | undefined;
    if (!raw || !raw.length) return null;
    return raw.map((r) => ({ ...r, id: crypto.randomUUID(), source: "מהצ'אט" }));
  } catch {
    return null;
  }
}

function toHistory(entries: ChatEntry[]): ChatHistoryItem[] {
  return entries
    .filter((e) => !(e.kind === "bot" && e.text === GREETING_TEXT))
    .map((e): ChatHistoryItem => {
      if (e.kind === "user") return { role: "user", text: e.text };
      if (e.kind === "bot") return { role: "assistant", text: e.text };
      return { role: "assistant", text: `הצעתי מתכונים: ${e.recipes.map((r) => r.title).join(", ")}` };
    });
}

export default function ChatPage() {
  const router = useRouter();
  const { saveRecipe, showToast, cacheAiSuggestions } = useStore();
  const [entries, setEntries] = useState<ChatEntry[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  // Restore a recent conversation once on mount, and re-cache its suggested recipes
  // so tapping one still opens it.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const stored = loadStoredChat();
    if (!stored) return;
    setEntries(stored.entries);
    setSaved(new Set(stored.saved));
    const recipes = stored.entries.flatMap((e) => (e.kind === "suggestions" ? e.recipes : []));
    if (recipes.length) cacheAiSuggestions(recipes);
    scrollDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restoredRef.current || entries.length <= 1) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ at: Date.now(), entries, saved: Array.from(saved) })
      );
    } catch {
      // storage full or blocked — the chat just won't be remembered, nothing to do
    }
  }, [entries, saved]);

  function scrollDown() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function send() {
    const text = draft.trim();
    if (!text) return;
    const history = toHistory(entries);
    setEntries((e) => [...e, { kind: "user", text }]);
    setDraft("");
    setThinking(true);
    scrollDown();

    const aiSuggestions = await askAi(text, history);
    // Never silently pass off the canned pool as an AI answer — when the AI is
    // unavailable (daily quota, momentary overload), say so explicitly.
    const suggestions = aiSuggestions ?? fallbackSuggestions(text);
    cacheAiSuggestions(suggestions);
    setThinking(false);

    const intro = !aiSuggestions
      ? "הצ׳אט החכם לא זמין כרגע (עומס או מכסה יומית) — הנה כמה רעיונות מהמאגר הקבוע בינתיים, ואפשר לנסות שוב עוד כמה דקות:"
      : suggestions.length > 1
        ? "כמה אפשרויות שיכולות להתאים:"
        : `מצאתי מתכון שמתאים: ${suggestions[0].title}.`;
    setEntries((e) => [...e, { kind: "bot", text: intro }, { kind: "suggestions", recipes: suggestions }]);
    scrollDown();
  }

  async function saveForLater(recipe: Recipe) {
    setSaved((s) => new Set(s).add(recipe.id));
    const result = await saveRecipe(recipe, true);
    if (result) showToast("נשמר לספר שלך לצפייה — ההחלטה הסופית תהיה בסוף הבישול הראשון.");
    else
      setSaved((s) => {
        const next = new Set(s);
        next.delete(recipe.id);
        return next;
      });
  }

  function startNow(recipe: Recipe) {
    // Deliberately not saved yet — cooking it is a trial. Feedback asks to save it
    // permanently at the end, once the person actually knows whether they liked it.
    router.push(`/recipe/${recipe.id}`);
  }

  return (
    <Screen>
      <Header title="מתכון חדש" />
      <h1 className="pb-3 pt-1 text-lg font-bold">מה בא לך לאכול?</h1>

      <div ref={scrollRef} className="flex max-h-[55vh] flex-col gap-2.5 overflow-y-auto pb-3">
        {entries.map((entry, i) => {
          if (entry.kind === "suggestions") {
            return (
              <div key={i} className="flex flex-col gap-2.5">
                {entry.recipes.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border bg-surface p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-surface-2 text-xl">
                        {r.emoji}
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-bold">{r.title}</span>
                        <span className="text-xs font-bold text-muted">{r.blurb}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3">
                      <button
                        onClick={() => startNow(r)}
                        className="flex-1 rounded-xl py-2.5 text-xs font-bold"
                        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                      >
                        להתחיל לבשל עכשיו
                      </button>
                      <button
                        onClick={() => saveForLater(r)}
                        disabled={saved.has(r.id)}
                        className="flex-1 rounded-xl bg-surface-2 py-2.5 text-xs font-bold disabled:opacity-60"
                      >
                        {saved.has(r.id) ? "✓ נשמר" : "שמירה, אחליט אחר כך"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div
              key={i}
              className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm font-bold"
              style={{
                alignSelf: entry.kind === "user" ? "flex-end" : "flex-start",
                background: entry.kind === "user" ? "var(--accent)" : "var(--surface-2)",
                color: entry.kind === "user" ? "var(--accent-ink)" : "var(--ink)",
              }}
            >
              {entry.text}
            </div>
          );
        })}
        {thinking && (
          <div
            className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm font-bold text-muted"
            style={{ alignSelf: "flex-start", background: "var(--surface-2)" }}
          >
            חושבת על זה…
          </div>
        )}
      </div>

      <div className="flex gap-2.5 pt-2">
        <button
          onClick={send}
          disabled={thinking}
          className="flex-none rounded-2xl px-4 py-3.5 font-bold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          שליחה
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="פסטה שרימפס בחמאת שום"
          className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3.5 py-3.5 text-right"
        />
      </div>
    </Screen>
  );
}
