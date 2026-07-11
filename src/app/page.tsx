"use client";

import { useStore } from "@/lib/store";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { CookbookHome } from "@/components/CookbookHome";

export default function HomePage() {
  const { authStatus } = useStore();

  if (authStatus === "loading") return null;
  if (authStatus === "ready") return <CookbookHome />;
  return <WelcomeScreen />;
}
