"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Remembers the last place in the app, so reopening it (e.g. from the home-screen
// icon, which always starts at the home page) jumps back to where the person was —
// most importantly the middle of cooking a recipe. Only recipe pages are resumed,
// and only for a few hours; navigating home on purpose overwrites the memory, so
// it never fights the person's own navigation.
const STORAGE_KEY = "cookbook-last-place";
const RESUME_TTL_MS = 3 * 60 * 60 * 1000;

function ResumeTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      if (pathname === "/") {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (
              parsed &&
              typeof parsed.path === "string" &&
              parsed.path.startsWith("/recipe/") &&
              Date.now() - parsed.at < RESUME_TTL_MS
            ) {
              router.replace(parsed.path);
              return;
            }
          }
        } catch {
          // unreadable — just don't resume
        }
      }
    }

    const query = searchParams.toString();
    const fullPath = query ? `${pathname}?${query}` : pathname;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ path: fullPath, at: Date.now() }));
    } catch {
      // storage blocked — resuming just won't work
    }
  }, [pathname, searchParams, router]);

  return null;
}

export function ResumeTracker() {
  return (
    <Suspense fallback={null}>
      <ResumeTrackerInner />
    </Suspense>
  );
}
