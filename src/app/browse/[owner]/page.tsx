"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { Recipe } from "@/lib/recipes";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";

type Status = "loading" | "not-shared" | "ready";

export default function BrowseOwnerPage() {
  const { owner } = useParams<{ owner: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [ownerName, setOwnerName] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Recipe | null>(null);

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
          source: row.source,
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

  if (selected) {
    return (
      <Screen>
        <Header title={ownerName} onBack={() => setSelected(null)} />
        <div className="flex flex-col gap-1.5 pb-4 pt-1">
          <span className="text-3xl">{selected.emoji}</span>
          <h1 className="pt-1 text-lg font-bold">{selected.title}</h1>
          <p className="text-sm font-bold text-muted">{selected.blurb}</p>
        </div>

        <IngredientGroup title="כנראה יש בבית" items={selected.haveItems} />
        <IngredientGroup title="לקנייה" items={selected.buyItems} />

        <div className="pb-2 pt-2 text-xs text-muted">שלבים</div>
        <ol className="flex flex-col gap-2.5">
          {selected.steps.map((step, i) => (
            <li key={i} className="rounded-2xl border border-border bg-surface p-3.5 text-sm font-bold">
              <span className="pl-1.5 text-muted">{i + 1}.</span> {step.text}
            </li>
          ))}
        </ol>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={`הספר של ${ownerName}`} onBack={() => router.push("/")} />
      <p className="py-3 text-sm font-bold text-muted">לצפייה בלבד — לחצי על מתכון כדי לראות אותו.</p>
      {recipes.length === 0 ? (
        <p className="text-sm font-bold text-muted">אין עדיין מתכונים בספר הזה.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {recipes.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
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

function IngredientGroup({ title, items }: { title: string; items: Recipe["buyItems"] }) {
  if (!items.length) return null;
  return (
    <div className="pb-4">
      <div className="pb-2 text-xs text-muted">{title}</div>
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline justify-between gap-2 border-b border-border py-2 last:border-0">
          <span className="text-sm font-bold">{item.name}</span>
          {item.quantity && <span className="text-xs font-bold text-muted">{item.quantity}</span>}
        </div>
      ))}
    </div>
  );
}
