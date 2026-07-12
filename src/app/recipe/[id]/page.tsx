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

function IngredientsBody({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  function isChecked(key: string, fallback: boolean) {
    return key in checks ? checks[key] : fallback;
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
        <div className="mb-4 rounded-2xl p-3.5" style={{ background: "var(--accent-soft)" }}>
          <div className="pb-1 text-xs font-bold" style={{ color: "var(--accent-deep)" }}>
            הערה מהפעם הקודמת
          </div>
          <p className="text-sm font-bold">
            בפעם שעברה כתבת &quot;{recipe.note}&quot; — אפשר לשדרג את המתכון בהתאם, או לשאול את השף.
          </p>
        </div>
      )}

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
