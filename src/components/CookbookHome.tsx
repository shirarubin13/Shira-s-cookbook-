"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { matchesQuery } from "@/lib/recipes";
import { Screen } from "./Screen";
import { BookIllustration } from "./BookIllustration";
import { RecipeCard } from "./RecipeCard";
import { PrimaryButton, GhostButton } from "./Buttons";
import { ImportSheet } from "./ImportSheet";
import { ShareSheet } from "./ShareSheet";

const suggestions = ["ארוחת ערב ב-10 דקות", "משהו מתוק, יום קשה", "ארוחה גדולה", "קציצות"];

export function CookbookHome() {
  const { userName, userEmail, recipes, deleteRecipe, signOut } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const router = useRouter();

  const filtered = recipes.filter((r) => matchesQuery(r, query));

  return (
    <Screen>
      {!open ? (
        <div className="flex flex-col items-center gap-5 pt-10">
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-3.5">
            <BookIllustration title={`ספר המתכונים\nשל ${userName}`} />
            <span className="text-xs font-bold text-muted">הקישי על הספר כדי לראות את המתכונים</span>
          </button>
          <Actions onImport={() => setShowImport(true)} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between" dir="ltr">
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2"
              aria-label="חזרה"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15,5 L8,12 L15,19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span dir="rtl" className="text-sm font-bold text-muted">
              ספר המתכונים של {userName}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowShare(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2"
                aria-label="שיתוף"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V4M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 13V18C5 19.1 5.9 20 7 20H17C18.1 20 19 19.1 19 18V13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (window.confirm(userEmail ? `להתנתק מ-${userEmail}?` : "להתנתק?")) signOut();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2"
                aria-label="התנתקות"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 15l4-4-4-4M20 11H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפשי כל דבר — מנה, מצב רוח, זמן…"
            className="rounded-2xl bg-surface-2 px-4 py-3.5 text-right"
          />

          <span className="text-xs font-bold text-muted">נסי לחפש</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="rounded-full bg-surface-2 px-3.5 py-2 text-xs font-bold"
              >
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm font-bold text-muted">שום דבר לא מתאים כרגע — נסי את הצ׳אט במקום.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filtered.map((r) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  onClick={() => router.push(`/recipe/${r.id}`)}
                  onDelete={() => deleteRecipe(r.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showImport && <ImportSheet onClose={() => setShowImport(false)} />}
      {showShare && <ShareSheet onClose={() => setShowShare(false)} />}
    </Screen>
  );
}

function Actions({ onImport }: { onImport: () => void }) {
  const router = useRouter();
  return (
    <div className="flex w-full flex-col gap-2.5">
      <PrimaryButton onClick={() => router.push("/chat")}>להתייעץ עם הצ׳אט על מתכון חדש</PrimaryButton>
      <GhostButton onClick={onImport}>ייבוא קישור לסרטון</GhostButton>
      <GhostButton onClick={() => router.push("/browse")}>לצפייה בספרים משותפים</GhostButton>
    </div>
  );
}
