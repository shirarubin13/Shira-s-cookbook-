"use client";

import { useParams, useRouter } from "next/navigation";
import { sharedCookbooks } from "@/lib/sharedCookbooks";
import { useStore } from "@/lib/store";
import { Screen } from "@/components/Screen";
import { Header } from "@/components/Header";
import { RecipeCard } from "@/components/RecipeCard";

export default function BrowseDetailPage() {
  const { owner } = useParams<{ owner: string }>();
  const ownerName = decodeURIComponent(owner);
  const router = useRouter();
  const { setSharedOwnerContext } = useStore();
  const cookbook = sharedCookbooks.find((cb) => cb.owner === ownerName);

  return (
    <Screen>
      <Header title={`הספר של ${ownerName}`} />
      <div className="flex flex-col gap-2.5 pt-3">
        {cookbook?.recipes.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            onClick={() => {
              setSharedOwnerContext(ownerName);
              router.push(`/recipe/${r.id}`);
            }}
          />
        ))}
      </div>
    </Screen>
  );
}
