"use client";

import { useEffect, useState } from "react";
import { loadTimer, saveTimer } from "@/lib/timerStorage";
import {
  AlertPermission,
  notificationPermission,
  primeAlerts,
  requestNotificationPermission,
  stopAlarm,
} from "@/lib/timerAlerts";

const R = 52;
const C = 2 * Math.PI * R;

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type TimerState =
  | { status: "idle" }
  | { status: "running"; endsAt: number }
  | { status: "paused"; remaining: number }
  | { status: "done" };

export function TimerRing({
  totalSeconds,
  timerId,
  label,
  href,
}: {
  totalSeconds: number;
  timerId: string;
  /** Recipe name, so an alarm firing on another screen can say what finished. */
  label?: string;
  /** The step to return to when the alarm's notification is tapped. */
  href?: string;
}) {
  const [state, setState] = useState<TimerState>({ status: "idle" });
  // Ticks once a second purely to re-render — remaining time is always computed
  // from the clock, so missed ticks (background tab) can't drift the timer.
  const [, setTick] = useState(0);
  const [permission, setPermission] = useState<AlertPermission>("unsupported");

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  useEffect(() => {
    const stored = loadTimer(timerId);
    if (!stored) {
      setState({ status: "idle" });
    } else if (stored.status === "running") {
      setState(stored.endsAt <= Date.now() ? { status: "done" } : { status: "running", endsAt: stored.endsAt });
    } else if (stored.status === "paused") {
      setState({ status: "paused", remaining: stored.remaining });
    } else {
      setState({ status: "done" });
    }
  }, [timerId]);

  useEffect(() => {
    if (state.status !== "running") return;
    const interval = setInterval(() => {
      // Reaching zero is only reflected locally here. Writing the finished record —
      // and sounding the alarm — belongs to the app-wide TimerAlarm watcher, which
      // keeps working even when this screen isn't the one being looked at.
      if (state.endsAt <= Date.now()) setState({ status: "done" });
      else setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state, timerId]);

  const remaining =
    state.status === "running"
      ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
      : state.status === "paused"
        ? state.remaining
        : state.status === "done"
          ? 0
          : totalSeconds;

  function onPress() {
    if (state.status === "running") {
      const left = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
      setState({ status: "paused", remaining: left });
      saveTimer(timerId, { status: "paused", remaining: left, at: Date.now(), label, href });
    } else {
      // Covers idle, paused and done. A finished timer restarts from the top, which
      // is what a kitchen timer does and what the step usually needs — another few
      // minutes for something that wasn't quite ready.
      const seconds = state.status === "paused" ? state.remaining : totalSeconds;
      if (seconds <= 0) return;
      // Restarting while the alarm is still sounding should silence it.
      stopAlarm();
      // Starting is the tap that buys us sound and notifications later: browsers only
      // unlock audio and grant notification permission from a real gesture.
      void primeAlerts().then(() => setPermission(notificationPermission()));
      const endsAt = Date.now() + seconds * 1000;
      setState({ status: "running", endsAt });
      saveTimer(timerId, { status: "running", endsAt, at: Date.now(), label, href });
    }
  }

  const fraction = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const offset = C * (1 - fraction);

  const buttonLabel =
    state.status === "idle"
      ? "התחלה"
      : state.status === "done"
        ? "הפעלה מחדש"
        : state.status === "running"
          ? "השהיה"
          : "המשך";

  return (
    <div className="flex flex-col items-center gap-3.5 py-2">
      <div className="relative h-[168px] w-[168px]">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="var(--accent-deep)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-bold" dir="ltr">
          {fmt(remaining)}
        </div>
      </div>

      <button
        onClick={onPress}
        className="rounded-full px-7 py-2.5 font-bold active:scale-95"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {buttonLabel}
      </button>

      <TimerAlertHint
        permission={permission}
        onEnable={async () => {
          await requestNotificationPermission();
          setPermission(notificationPermission());
        }}
      />
    </div>
  );
}

/** Says plainly what will and won't happen when the time is up, rather than letting
 * the cook assume an alarm that the phone may not be allowed to sound. */
function TimerAlertHint({
  permission,
  onEnable,
}: {
  permission: AlertPermission;
  onEnable: () => void;
}) {
  if (permission === "granted") {
    return (
      <p className="max-w-[15rem] text-center text-[11px] font-bold leading-snug text-muted">
        הצלצול יישמע כשהאפליקציה פתוחה. אם הטלפון סוגר אותה ברקע — הוא יישמע ברגע שחוזרים אליה.
      </p>
    );
  }

  if (permission === "default") {
    return (
      <button
        onClick={onEnable}
        className="rounded-xl px-3.5 py-2 text-xs font-bold"
        style={{ background: "var(--accent-soft)", color: "var(--accent-deep)" }}
      >
        🔔 לקבל התראה גם כשלא באפליקציה
      </button>
    );
  }

  return (
    <p className="max-w-[15rem] text-center text-[11px] font-bold leading-snug text-muted">
      התראות חסומות בהגדרות הדפדפן — הצלצול יישמע כשהאפליקציה פתוחה, או ברגע שחוזרים אליה.
    </p>
  );
}
