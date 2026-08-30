"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ALERT_GRACE_MS, allTimers, saveTimer } from "@/lib/timerStorage";
import { showTimerNotification, startAlarm, stopAlarm } from "@/lib/timerAlerts";

type FiredTimer = { id: string; label?: string; href?: string; endedAt: number };

function agoText(endedAt: number): string | null {
  const minutes = Math.floor((Date.now() - endedAt) / 60000);
  if (minutes < 1) return null;
  if (minutes === 1) return "הסתיים לפני דקה";
  return `הסתיים לפני ${minutes} דקות`;
}

/**
 * Watches every stored timer, app-wide. It lives in the layout rather than next to
 * the timer dial on purpose: the cook often walks away from the cooking step — back
 * to the ingredients, to the chat, or out of the app — and the timer still has to
 * go off. Checking the clock (rather than counting down) also means a timer that
 * finished while the phone had the app frozen is caught the moment it thaws.
 */
export function TimerAlarm() {
  const router = useRouter();
  const [fired, setFired] = useState<FiredTimer | null>(null);

  // Registered here because timer notifications are the only thing the worker does.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // no worker — in-app alarm still works, only background notifications are lost
    });
  }, []);

  const check = useCallback(() => {
    for (const { id, timer } of allTimers()) {
      if (timer.status === "running" && timer.endsAt <= Date.now()) {
        saveTimer(id, {
          status: "done",
          at: Date.now(),
          endedAt: timer.endsAt,
          alerted: true,
          label: timer.label,
          href: timer.href,
        });
        if (Date.now() - timer.endsAt < ALERT_GRACE_MS) {
          setFired({ id, label: timer.label, href: timer.href, endedAt: timer.endsAt });
        }
      } else if (
        timer.status === "done" &&
        !timer.alerted &&
        timer.endedAt &&
        Date.now() - timer.endedAt < ALERT_GRACE_MS
      ) {
        // Finished while the app was closed, and never announced — do it now.
        saveTimer(id, { ...timer, alerted: true });
        setFired({ id, label: timer.label, href: timer.href, endedAt: timer.endedAt });
      }
    }
  }, []);

  useEffect(() => {
    // The first sweep catches a timer that ended while the app was closed. It's
    // deferred a beat rather than run during mount, so a waiting alarm doesn't
    // re-render the whole app mid-paint.
    const firstCheck = setTimeout(check, 200);
    const interval = setInterval(check, 1000);
    const recheck = () => check();
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      clearTimeout(firstCheck);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [check]);

  // Ring, and notify if the app isn't what's on screen.
  useEffect(() => {
    if (!fired) return;
    const body = fired.label ? `${fired.label} — הטיימר סיים.` : "הטיימר סיים.";
    if (document.hidden) void showTimerNotification(body, fired.href);
    startAlarm();
    return () => stopAlarm();
  }, [fired]);

  // Coming back to the app with an alarm still pending: sound it again, since the
  // phone almost certainly silenced (or never played) the first one.
  useEffect(() => {
    if (!fired) return;
    const onVisible = () => {
      if (!document.hidden) startAlarm(20_000);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fired]);

  if (!fired) return null;

  const ago = agoText(fired.endedAt);
  const dismiss = () => {
    stopAlarm();
    setFired(null);
  };

  return (
    // Sits above the floating "ask the chef" bubble and the toast, which both live
    // in the bottom corner — otherwise the alarm's own buttons end up underneath them.
    <div className="fixed inset-x-0 bottom-24 z-50 px-3">
      <div
        className="mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3.5 shadow-lg"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        role="alert"
      >
        <span className="text-2xl leading-none">⏰</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-bold">הזמן נגמר!</span>
          <span className="truncate text-xs font-bold opacity-80">
            {ago ?? fired.label ?? "הטיימר סיים"}
          </span>
        </div>
        {fired.href && (
          <button
            onClick={() => {
              const href = fired.href!;
              dismiss();
              router.push(href);
            }}
            className="flex-none rounded-xl bg-surface px-3 py-2 text-xs font-bold text-ink"
          >
            למתכון
          </button>
        )}
        <button
          onClick={dismiss}
          className="flex-none rounded-xl px-3 py-2 text-xs font-bold underline"
          aria-label="עצירת הצלצול"
        >
          עצירה
        </button>
      </div>
    </div>
  );
}
