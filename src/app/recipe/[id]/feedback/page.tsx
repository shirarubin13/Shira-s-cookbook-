"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Recipe } from "@/lib/recipes";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";
import { PrimaryButton } from "@/components/Buttons";

export default function FeedbackPage() {
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
  return <FeedbackBody key={id} recipe={recipe} />;
}

function FeedbackBody({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const { isSaved, submitFeedback, pendingUpgrade, confirmPendingUpgrade } = useStore();
  const alreadySaved = isSaved(recipe.id);
  const upgrade = pendingUpgrade?.recipeId === recipe.id ? pendingUpgrade : null;

  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [saveToggle, setSaveToggle] = useState(true);
  const [keepUpgradeToggle, setKeepUpgradeToggle] = useState(true);

  return (
    <Screen>
      <Header title="משוב" onBack={() => router.push(`/recipe/${recipe.id}/cook`)} />

      <div className="flex flex-col gap-1 pb-4 pt-1">
        <h1 className="text-lg font-bold">איך זה יצא?</h1>
        <p className="text-sm font-bold text-muted">{recipe.title}</p>
      </div>

      <div className="flex justify-end gap-1.5 pb-4" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} כוכבים`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill={n <= rating ? "var(--accent-deep)" : "none"}>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                stroke={n <= rating ? "var(--accent-deep)" : "var(--surface-3)"}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="משהו לזכור לפעם הבאה? למשל — מלוח מדי"
        rows={3}
        className="mb-4 rounded-2xl bg-surface-2 px-4 py-3.5 text-right"
      />

      {!alreadySaved && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5">
          <span className="text-sm font-bold">הוספה לספר המתכונים שלי</span>
          <button
            onClick={() => setSaveToggle((v) => !v)}
            aria-label="הוספה לספר המתכונים שלי"
            className="relative h-[22px] w-10 flex-none rounded-full transition"
            style={{ background: saveToggle ? "var(--herb)" : "var(--surface-3)" }}
          >
            <span
              className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-surface transition-all"
              style={{ left: saveToggle ? "2px" : "20px" }}
            />
          </button>
        </div>
      )}

      {upgrade && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5">
          <span className="text-sm font-bold">לשמור את השדרוג: &quot;{upgrade.idea}&quot;?</span>
          <button
            onClick={() => setKeepUpgradeToggle((v) => !v)}
            aria-label="לשמור את השדרוג"
            className="relative h-[22px] w-10 flex-none rounded-full transition"
            style={{ background: keepUpgradeToggle ? "var(--herb)" : "var(--surface-3)" }}
          >
            <span
              className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-surface transition-all"
              style={{ left: keepUpgradeToggle ? "2px" : "20px" }}
            />
          </button>
        </div>
      )}

      <PrimaryButton
        onClick={async () => {
          const finalRecipe = upgrade ? ((await confirmPendingUpgrade(keepUpgradeToggle)) ?? recipe) : recipe;
          await submitFeedback(finalRecipe, notes, saveToggle);
          router.push("/");
        }}
      >
        סיימתי
      </PrimaryButton>
    </Screen>
  );
}
