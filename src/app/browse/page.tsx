"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { useStore } from "@/lib/store";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";

type FriendBook = {
  ownerId: string;
  name: string | null; // null when the owner turned sharing off
};

export default function BrowsePage() {
  const router = useRouter();
  const { userId } = useStore();
  const [books, setBooks] = useState<FriendBook[] | null>(null);

  useEffect(() => {
    if (!userId) {
      setBooks([]);
      return;
    }
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const { data: follows } = await supabase
        .from("followed_cookbooks")
        .select("owner_id")
        .eq("follower_id", userId)
        .order("created_at", { ascending: true });

      const ownerIds = (follows ?? []).map((f) => f.owner_id as string);
      if (!ownerIds.length) {
        if (!cancelled) setBooks([]);
        return;
      }

      // Profiles are only readable while their owner keeps sharing on, so a book
      // whose owner stopped sharing simply comes back without a name.
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", ownerIds);

      if (cancelled) return;
      const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.name as string]));
      setBooks(ownerIds.map((id) => ({ ownerId: id, name: nameById.get(id) ?? null })));
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function removeBook(ownerId: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase
      .from("followed_cookbooks")
      .delete()
      .eq("follower_id", userId)
      .eq("owner_id", ownerId);
    setBooks((list) => (list ?? []).filter((b) => b.ownerId !== ownerId));
  }

  return (
    <Screen>
      <Header title="ספרים של חברים" onBack={() => router.push("/")} />
      {books === null ? null : books.length === 0 ? (
        <div className="flex flex-col items-center gap-3 pt-16 text-center">
          <span className="text-4xl">📖</span>
          <p className="text-sm font-bold text-muted">עדיין אין כאן ספרים.</p>
          <p className="text-xs font-bold text-muted">
            כשחברה תשלח לך קישור לספר שלה, פתחי אותו פעם אחת — והוא יישמר כאן לתמיד.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 pt-3">
          {books.map((b) => (
            <div
              key={b.ownerId}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5"
            >
              <button
                onClick={() => b.name && router.push(`/browse/${b.ownerId}`)}
                disabled={!b.name}
                className="flex min-w-0 flex-1 items-center gap-3 text-right disabled:opacity-60"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-surface-2 text-xl">
                  {b.name ? "📖" : "🔒"}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-bold">{b.name ? `הספר של ${b.name}` : "ספר שכבר לא משותף"}</span>
                  <span className="text-xs font-bold text-muted">
                    {b.name ? "לחצי כדי לפתוח" : "בעלת הספר כיבתה את השיתוף"}
                  </span>
                </span>
              </button>
              <button
                onClick={() => removeBook(b.ownerId)}
                aria-label="הסרה מהרשימה"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-muted"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
