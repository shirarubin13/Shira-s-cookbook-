"use client";

import { useRouter } from "next/navigation";
import { sharedCookbooks } from "@/lib/sharedCookbooks";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";

export default function BrowsePage() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="ספרים משותפים" />
      <p className="py-3 text-sm font-bold text-muted">
        ספרים אחרים ששיתפו איתך — לצפייה, ואפשר להוסיף מתכון לספר שלך.
      </p>
      <div className="flex flex-col gap-2.5">
        {sharedCookbooks.map((cb) => (
          <button
            key={cb.owner}
            onClick={() => router.push(`/browse/${encodeURIComponent(cb.owner)}`)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-right"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-surface-2 text-xl">
              📖
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-bold">הספר של {cb.owner}</span>
              <span className="text-xs font-bold text-muted">{cb.recipes.length} מתכונים</span>
            </span>
          </button>
        ))}
      </div>
    </Screen>
  );
}
