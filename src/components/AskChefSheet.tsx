"use client";

import { useState } from "react";
import { Recipe } from "@/lib/recipes";
import { GhostButton } from "./Buttons";

type Msg = { isUser: boolean; text: string };

async function askChef(recipe: Recipe, question: string): Promise<string> {
  try {
    const res = await fetch("/api/ask-chef", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: recipe.title,
        steps: recipe.steps,
        buyItems: recipe.buyItems,
        haveItems: recipe.haveItems,
        question,
      }),
    });
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    return data.answer ?? "לא הצלחתי למצוא תשובה טובה לזה כרגע — אפשר לנסח אחרת?";
  } catch {
    return "הייתה בעיה בחיבור לשף כרגע — נסי שוב עוד רגע.";
  }
}

export function AskChefBubble({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { isUser: true, text }]);
    setDraft("");
    setThinking(true);
    const answer = await askChef(recipe, text);
    setThinking(false);
    setMessages((m) => [...m, { isUser: false, text: answer }]);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="שאלה על המתכון"
        className="fixed bottom-6 left-4 z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg active:scale-95"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5H20V16H8.5L4 20V5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10.5" r="1.1" fill="currentColor" />
          <circle cx="12" cy="10.5" r="1.1" fill="currentColor" />
          <circle cx="15" cy="10.5" r="1.1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end bg-black/45"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full animate-[sheetUp_0.22s_ease-out] rounded-t-3xl bg-surface p-5">
            <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
              שאלה על המתכון
            </div>
            <div className="pb-3 pt-1 text-lg font-bold">{recipe.title}</div>

            <div className="flex max-h-44 flex-col gap-2.5 overflow-y-auto">
              {messages.length === 0 ? (
                <Bubble isUser={false}>
                  יש לך שאלה על {recipe.title}? תשאלי אותי — למשל על תחליף למצרך שאין לך.
                </Bubble>
              ) : (
                messages.map((m, i) => (
                  <Bubble key={i} isUser={m.isUser}>
                    {m.text}
                  </Bubble>
                ))
              )}
              {thinking && <Bubble isUser={false}>חושבת על זה…</Bubble>}
            </div>

            <div className="flex gap-2.5 pt-3">
              <button
                onClick={send}
                disabled={thinking}
                className="flex-none rounded-2xl px-4 py-3 font-bold disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                שליחה
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="למשל: אין לי רוטב עגבניות, מה במקום?"
                className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3.5 py-3 text-right"
              />
            </div>

            <div className="pt-3">
              <GhostButton onClick={() => setOpen(false)}>סגירה</GhostButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ isUser, children }: { isUser: boolean; children: React.ReactNode }) {
  return (
    <div
      className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm font-bold"
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        background: isUser ? "var(--accent)" : "var(--surface-2)",
        color: isUser ? "var(--accent-ink)" : "var(--ink)",
      }}
    >
      {children}
    </div>
  );
}
