"use client";

import { useEffect, useRef, useState } from "react";

const R = 52;
const C = 2 * Math.PI * R;

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerRing({ totalSeconds }: { totalSeconds: number }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(totalSeconds);
    setRunning(false);
    setStarted(false);
  }, [totalSeconds]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const fraction = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const offset = C * (1 - fraction);

  const label = !started ? "התחלה" : remaining <= 0 ? "הסתיים" : running ? "השהיה" : "המשך";

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
        onClick={() => {
          if (running) {
            setRunning(false);
          } else if (remaining > 0) {
            setRunning(true);
            setStarted(true);
          }
        }}
        className="rounded-full px-7 py-2.5 font-bold active:scale-95"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        {label}
      </button>
    </div>
  );
}
