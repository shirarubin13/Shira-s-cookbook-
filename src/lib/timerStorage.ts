"use client";

/**
 * Where cooking timers live. A timer is anchored to the clock (its end time), not
 * to a ticking counter — so navigating between steps, leaving the app, or reloading
 * the page doesn't stop or reset it: coming back shows the real remaining time,
 * like a kitchen timer would.
 *
 * Kept in its own module because two places need the same records: the timer dial
 * on the cooking step, and the app-wide alarm watcher that has to notice a timer
 * finishing even when the cook is on a different screen entirely.
 */

export const TIMER_TTL_MS = 12 * 60 * 60 * 1000;

/** How long after a timer ends the alarm is still worth sounding. Past this, the
 * cook has clearly moved on and a sudden alarm would just be startling. */
export const ALERT_GRACE_MS = 15 * 60 * 1000;

const PREFIX = "cookbook-timer-";

/** `label` and `href` are stored with the timer so the alarm can say which recipe
 * finished, and take the cook back to that exact step, from anywhere in the app. */
type TimerMeta = { label?: string; href?: string };

export type StoredTimer =
  | ({ status: "running"; endsAt: number; at: number } & TimerMeta)
  | ({ status: "paused"; remaining: number; at: number } & TimerMeta)
  | ({ status: "done"; at: number; endedAt?: number; alerted?: boolean } & TimerMeta);

export function timerKey(id: string): string {
  return PREFIX + id;
}

function isFresh(timer: StoredTimer): boolean {
  return Date.now() - timer.at <= TIMER_TTL_MS;
}

export function loadTimer(id: string): StoredTimer | null {
  try {
    const raw = localStorage.getItem(timerKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTimer;
    if (!parsed || !parsed.status || !isFresh(parsed)) {
      localStorage.removeItem(timerKey(id));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveTimer(id: string, timer: StoredTimer | null) {
  try {
    if (timer) localStorage.setItem(timerKey(id), JSON.stringify(timer));
    else localStorage.removeItem(timerKey(id));
  } catch {
    // storage blocked — the timer still works for this visit, it just won't survive leaving
  }
}

/** Every timer currently stored, so the alarm watcher can check them all at once.
 * Expired ones are dropped as they're found. */
export function allTimers(): Array<{ id: string; timer: StoredTimer }> {
  const found: Array<{ id: string; timer: StoredTimer }> = [];
  let keys: string[] = [];
  try {
    // Collected up front: loadTimer deletes expired records, and removing entries
    // while walking localStorage by index would skip over the next one each time.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
  } catch {
    keys = [];
  }
  for (const key of keys) {
    const id = key.slice(PREFIX.length);
    const timer = loadTimer(id);
    if (timer) found.push({ id, timer });
  }
  return found;
}
