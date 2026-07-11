"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { Recipe } from "@/lib/recipes";
import { Screen } from "@/components/Screen";
import { ProgressGauge } from "@/components/ProgressGauge";
import { PrimaryButton } from "@/components/Buttons";
import { TimerRing } from "@/components/TimerRing";
import { AskChefBubble } from "@/components/AskChefSheet";

export default function CookPage() {
  return (
    <Suspense fallback={null}>
      <CookPageInner />
    </Suspense>
  );
}

function CookPageInner() {
  const { id } = useParams<{ id: string }>();
  const { getRecipeById } = useStore();
  const recipe = getRecipeById(id);

  if (!recipe) return null;
  return <CookBody recipe={recipe} />;
}

function CookBody({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The step lives in the URL (not component state) so the browser's own back/forward
  // buttons — and any swipe-back gesture — step through the recipe one instruction at a
  // time, instead of jumping straight out of the whole cooking flow.
  const rawStep = Number(searchParams.get("step") ?? "0");
  const stepIndex = Number.isFinite(rawStep) ? Math.min(Math.max(rawStep, 0), recipe.steps.length - 1) : 0;

  const step = recipe.steps[stepIndex];
  const isLast = stepIndex === recipe.steps.length - 1;

  return (
    <Screen>
      <div className="flex items-center justify-between pb-2" dir="ltr">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.back()}
            aria-label="חזרה"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15,5 L8,12 L15,19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span dir="rtl" className="text-xs font-bold text-muted">
            שלב {stepIndex + 2}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-28 pt-2">
        <ProgressGauge current={stepIndex + 2} total={recipe.steps.length + 1} />

        <h1 className="text-xl font-bold leading-snug">{step.text}</h1>

        {step.parallelTip && (
          <div className="rounded-2xl p-3.5" style={{ background: "var(--herb-soft)" }}>
            <div className="pb-1 text-xs font-bold text-herb">בינתיים</div>
            <p className="text-sm font-bold">{step.parallelTip}</p>
          </div>
        )}

        {step.timerSeconds && <TimerRing totalSeconds={step.timerSeconds} key={stepIndex} />}

        <PrimaryButton
          onClick={() => {
            if (isLast) router.push(`/recipe/${recipe.id}/feedback`);
            else router.push(`/recipe/${recipe.id}/cook?step=${stepIndex + 1}`);
          }}
        >
          {isLast ? "סיום" : "בוצע, לשלב הבא"}
        </PrimaryButton>
      </div>

      <AskChefBubble recipe={recipe} />
    </Screen>
  );
}
