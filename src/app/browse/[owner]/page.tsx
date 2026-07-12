"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { useStore } from "@/lib/store";
import { Recipe } from "@/lib/recipes";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";

type Status = "loading" | "not-shared" | "ready";

export default function BrowseOwnerPage() {
  const { owner } = useParams<{ owner: string }>();
  const router = useRouter();
  const { userId, cacheAiSuggestions } = useStore();
  const [status, setStatus] = useState<Status>("loading");
  const [ownerName, setOwnerName] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, is_shared")
        .eq("id", owner)
        .maybeSingle();

      if (cancelled) return;
      if (!profile || !profile.is_shared) {
        setStatus("not-shared");
        return;
      }
      setOwnerName(profile.name);

      const { data: rows } = await supabase
        .from("recipes")
        .select("*")
        .eq("owner_id", owner)
        .eq("pending", false)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setRecipes(
        (rows ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          emoji: row.emoji,
          blurb: row.blurb,
          source: `מהספר של ${profile.name}`,
          keywords: row.keywords,
          haveItems: row.have_items,
          buyItems: row.buy_items,
          steps: row.steps,
        }))
      );
      setStatus("ready");
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [owner]);

  // Visiting a shared book while signed in saves it to "friends' books" — after that
  // it's always reachable from the browse page, no need to keep the link around.
  useEffect(() => {
    if (status !== "ready" || !userId || userId === owner) return;
    const supabase = createClient();
    supabase
      .from("followed_cookbooks")
      .upsert(
        { follower_id: userId, owner_id: owner },
        { onConflict: "follower_id,owner_id", ignoreDuplicates: true }
      )
      .then();
  }, [status, userId, owner]);

  function openRecipe(recipe: Recipe) {
    // Feed it into the same in-session cache chat suggestions use, so the regular
    // recipe flow (ingredients → steps → feedback) can find and drive it. Saving at
    // the end copies it into the visitor's own cookbook.
    cacheAiSuggestions([recipe]);
    router.push(`/recipe/${recipe.id}`);
  }

  if (status === "loading") return null;

  if (status === "not-shared") {
    return (
      <Screen>
        <Header title="ספר משותף" onBack={() => router.push("/")} />
        <div className="flex flex-col items-center gap-3 pt-16 text-center">
          <span className="text-4xl">🔒</span>
          <p className="text-sm font-bold text-muted">הספר הזה לא משותף כרגע.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={`הספר של ${ownerName}`} onBack={() => router.push("/")} />
      <p className="py-3 text-sm font-bold text-muted">
        אפשר לפתוח כל מתכון ולבשל אותו — ובסוף גם לשמור אותו לספר שלך.
      </p>
      {recipes.length === 0 ? (
        <p className="text-sm font-bold text-muted">אין עדיין מתכונים בספר הזה.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {recipes.map((r) => (
            <button
              key={r.id}
              onClick={() => openRecipe(r)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-right"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-surface-2 text-xl">
                {r.emoji}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-bold">{r.title}</span>
                <span className="text-xs font-bold text-muted">{r.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Screen>
  );
}
