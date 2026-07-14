"use client";

import { useEffect, useState } from "react";

const R = 52;
const C = 2 * Math.PI * R;

// A running timer is anchored to the clock (its end time), not to a ticking
// counter — so navigating between steps, leaving the app, or reloading the page
// doesn't stop or reset it: coming back shows the real remaining time, like a
// kitchen timer would.
const TIMER_TTL_MS = 12 * 60 * 60 * 1000;

type StoredTimer =
  | { status: "running"; endsAt: number; at: number }
  | { status: "paused"; remaining: number; at: number }
  | { status: "done"; at: number };

function storageKey(id: string) {
  return `cookbook-timer-${id}`;
}

function loadTimer(id: string): StoredTimer | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTimer;
    if (!parsed || Date.now() - parsed.at > TIMER_TTL_MS) {
      localStorage.removeItem(storageKey(id));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveTimer(id: string, timer: StoredTimer | null) {
  try {
    if (timer) localStorage.setItem(storageKey(id), JSON.stringify(timer));
    else localStorage.removeItem(storageKey(id));
  } catch {
    // storage blocked — timer still works for this visit, just won't survive leaving
  }
}

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

export function TimerRing({ totalSeconds, timerId }: { totalSeconds: number; timerId: string }) {
  const [state, setState] = useState<TimerState>({ status: "idle" });
  // Ticks once a second purely to re-render — remaining time is always computed
  // from the clock, so missed ticks (background tab) can't drift the timer.
  const [, setTick] = useState(0);

  useEffect(() => {
    const stored = loadTimer(timerId);
    if (!stored) {
      setState({ status: "idle" });
    } else if (stored.status === "running") {
      if (stored.endsAt <= Date.now()) {
        setState({ status: "done" });
        saveTimer(timerId, { status: "done", at: Date.now() });
      } else {
        setState({ status: "running", endsAt: stored.endsAt });
      }
    } else if (stored.status === "paused") {
      setState({ status: "paused", remaining: stored.remaining });
    } else {
      setState({ status: "done" });
    }
  }, [timerId]);

  useEffect(() => {
    if (state.status !== "running") return;
    const interval = setInterval(() => {
      if (state.endsAt <= Date.now()) {
        setState({ status: "done" });
        saveTimer(timerId, { status: "done", at: Date.now() });
      } else {
        setTick((t) => t + 1);
      }
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
      saveTimer(timerId, { status: "paused", remaining: left, at: Date.now() });
    } else if (state.status === "idle" || state.status === "paused") {
      const seconds = state.status === "paused" ? state.remaining : totalSeconds;
      if (seconds <= 0) return;
      const endsAt = Date.now() + seconds * 1000;
      setState({ status: "running", endsAt });
      saveTimer(timerId, { status: "running", endsAt, at: Date.now() });
    }
  }

  const fraction = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const offset = C * (1 - fraction);

  const label =
    state.status === "idle"
      ? "התחלה"
      : state.status === "done"
        ? "הסתיים"
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
        <div
          className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-bold"
          dir="ltr"
        >
          {fmt(remaining)}
        </div>
      </div>
      <button
        onClick={onPress}
        className="rounded-full px-7 py-2.5 font-bold active:scale-95"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {label}
      </button>
    </div>
  );
}
