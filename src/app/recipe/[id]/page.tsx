"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Ingredient, IngredientNote, Recipe } from "@/lib/recipes";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";
import { ProgressGauge } from "@/components/ProgressGauge";
import { PrimaryButton } from "@/components/Buttons";
import { UpgradeBox } from "@/components/UpgradeBox";
import { AskChefBubble } from "@/components/AskChefSheet";

export default function IngredientsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { getRecipeById, ensureRecipeCached } = useStore();
  const recipe = getRecipeById(id);
  const [checkedNotFound, setCheckedNotFound] = useState(false);

  useEffect(() => {
    if (recipe) return;
    ensureRecipeCached(id).finally(() => setCheckedNotFound(true));
  }, [id, recipe, ensureRecipeCached]);

  if (!recipe) {
    if (!checkedNotFound) return null;
    return (
      <Screen>
        <Header title="מתכון" onBack={() => router.push("/")} />
        <p className="pt-6 text-sm font-bold text-muted">המתכון לא נמצא.</p>
      </Screen>
    );
  }

  return <IngredientsBody key={id} recipe={recipe} />;
}

function findNote(item: Ingredient, notes: IngredientNote[] | undefined): IngredientNote | undefined {
  if (!notes) return undefined;
  return notes.find((n) => n.name === item.name || item.name.includes(n.name) || n.name.includes(item.name));
}

function ScaleBox({ recipeId }: { recipeId: string }) {
  const { scaledRequestFor, applyScale, resetScale, showToast } = useStore();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const activeRequest = scaledRequestFor(recipeId);

  async function send() {
    const text = draft.trim();
    if (!text || loading) return;
    setLoading(true);
    const ok = await applyScale(recipeId, text);
    setLoading(false);
    if (ok) {
      setDraft("");
      showToast("הכמויות הותאמו.");
    } else {
      showToast("השף החכם לא זמין כרגע — נסי שוב עוד כמה דקות.");
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
      <div className="text-xs font-bold">מבשלת לכמות אחרת?</div>
      {activeRequest && (
        <div className="flex items-center justify-between gap-2 rounded-xl p-2.5" style={{ background: "var(--accent-soft)" }}>
          <span className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
            הכמויות מותאמות ל: &quot;{activeRequest}&quot;
          </span>
          <button
            onClick={() => resetScale(recipeId)}
            className="flex-none text-xs font-bold underline"
            style={{ color: "var(--accent-deep)" }}
          >
            חזרה למקור
          </button>
        </div>
      )}
      <div className="flex gap-2.5">
        <button
          onClick={send}
          disabled={loading}
          className="flex-none rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-60"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {loading ? "מתאימה…" : "התאמה"}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="ל-2 אנשים / רק כוס אחת של אורז…"
          className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-2 text-right text-xs"
        />
      </div>
    </div>
  );
}

function IngredientsBody({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const { recipes, userId, addToMyBook, applyNoteRevision } = useStore();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [revising, setRevising] = useState(false);
  const [addState, setAddState] = useState<"idle" | "adding" | "added">("idle");

  const inMyBook = recipes.some((r) => r.id === recipe.id);

  function isChecked(key: string, fallback: boolean) {
    return key in checks ? checks[key] : fallback;
  }

  async function reviseByNote() {
    if (revising) return;
    setRevising(true);
    await applyNoteRevision(recipe.id);
    setRevising(false);
  }

  async function addThisToMyBook() {
    if (addState !== "idle") return;
    setAddState("adding");
    // A shared-recipe link carries the sharer's name (?from=...), so the copy can
    // say whose book it came from.
    const from = new URLSearchParams(window.location.search).get("from") ?? undefined;
    const saved = await addToMyBook(recipe, from ?? undefined);
    setAddState(saved ? "added" : "idle");
  }

  return (
    <Screen>
      <Header title={recipe.title} onBack={() => router.push("/")} />

      <div className="flex flex-col gap-1.5 pb-4 pt-1">
        <ProgressGauge current={1} total={recipe.steps.length + 1} />
        <h1 className="pt-1 text-lg font-bold">{recipe.title}</h1>
        <p className="text-sm font-bold text-muted">סמני מה יש לך לפני שמתחילים.</p>
      </div>

      {recipe.note && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl p-3.5" style={{ background: "var(--accent-soft)" }}>
          <div className="text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
            הערה מהפעם הקודמת
          </div>
          <p className="text-sm font-bold">
            בפעם שעברה כתבת &quot;{recipe.note}&quot; — אפשר לעדכן את המתכון בהתאם, או לשאול את השף.
          </p>
          <button
            onClick={reviseByNote}
            disabled={revising}
            className="self-start rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {revising ? "מעדכנת את המתכון…" : "עדכון המתכון לפי ההערה"}
          </button>
        </div>
      )}

      {!inMyBook && userId && (
        <button
          onClick={addThisToMyBook}
          disabled={addState !== "idle"}
          className="mb-4 w-full rounded-2xl border border-border bg-surface py-3 text-sm font-bold disabled:opacity-70"
        >
          {addState === "added" ? "✓ נשמר בספר שלך" : addState === "adding" ? "שומרת…" : "+ הוספה לספר המתכונים שלי"}
        </button>
      )}

      <ScaleBox recipeId={recipe.id} />

      <Group
        title="כנראה יש לך בבית"
        items={recipe.haveItems}
        notes={recipe.ingredientNotes}
        prefix="h"
        defaultOn={true}
        isChecked={isChecked}
        onToggle={(key, val) => setChecks((c) => ({ ...c, [key]: val }))}
      />
      <Group
        title="להוסיף לרשימה"
        items={recipe.buyItems}
        notes={recipe.ingredientNotes}
        prefix="b"
        defaultOn={false}
        isChecked={isChecked}
        onToggle={(key, val) => setChecks((c) => ({ ...c, [key]: val }))}
      />

      <div className="py-4">
        <UpgradeBox recipe={recipe} />
      </div>

      <PrimaryButton onClick={() => router.push(`/recipe/${recipe.id}/cook`)}>
        התחלת בישול
      </PrimaryButton>

      <AskChefBubble recipe={recipe} />
    </Screen>
  );
}

function Group({
  title,
  items,
  notes,
  prefix,
  defaultOn,
  isChecked,
  onToggle,
}: {
  title: string;
  items: Ingredient[];
  notes: IngredientNote[] | undefined;
  prefix: string;
  defaultOn: boolean;
  isChecked: (key: string, fallback: boolean) => boolean;
  onToggle: (key: string, val: boolean) => void;
}) {
  return (
    <div className="pb-4">
      <div className="pb-2 text-xs text-muted">{title}</div>
      {items.map((item, i) => {
        const key = `${prefix}${i}`;
        const checked = isChecked(key, defaultOn);
        const note = findNote(item, notes);
        return (
          <button
            key={key}
            onClick={() => onToggle(key, !checked)}
            className="flex w-full items-start gap-2.5 border-b border-border py-2 text-right last:border-0"
          >
            <span
              className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-md border"
              style={{
                background: checked ? "var(--herb)" : "transparent",
                borderColor: checked ? "var(--herb)" : "var(--muted)",
              }}
            >
              {checked && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-baseline justify-between gap-2">
                <span className={`text-sm font-bold ${checked ? "text-muted line-through" : ""}`}>{item.name}</span>
                {item.quantity && <span className="text-xs font-bold text-muted">{item.quantity}</span>}
              </span>
              {note && (
                <span className="pt-0.5 text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
                  הערה: {note.suggestion}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
