"use client";

/**
 * How a finished timer makes itself heard: an alarm tone, a vibration, and a
 * system notification for when the app isn't what's on screen.
 *
 * Worth being clear about the limit, because it shapes the design: a phone is
 * allowed to freeze a web app the moment it's in the background, and a frozen
 * page cannot ring on the exact second. So the alert is layered rather than
 * promised — ring and notify immediately if the app is still running, and if the
 * phone did freeze it, sound the alarm the instant the cook opens the app again,
 * saying how long ago the timer actually finished. The UI says as much instead of
 * implying an alarm that's guaranteed to fire.
 */

type LegacyAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let audioCtx: AudioContext | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;
let ringStopTimeout: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as LegacyAudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export type AlertPermission = NotificationPermission | "unsupported";

export function notificationPermission(): AlertPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<AlertPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Unlocks sound and asks for notification permission. Both are things a browser
 * only grants off a real tap, which is why this runs when the cook presses start —
 * long before the moment the timer actually needs to ring.
 */
export async function primeAlerts(): Promise<void> {
  // Asked for first, before anything is awaited. Safari only honours a permission
  // request while the tap that triggered it is still "fresh", and waiting on the
  // audio context first spends that window — which is why the prompt never appeared.
  const permissionAsked = requestNotificationPermission();

  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // stays suspended — the notification is still the backstop
    }
  }
  await permissionAsked;
}

function beep(ctx: AudioContext, startAt: number, frequency: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle"; // carries across a noisy kitchen better than a sine
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.4, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

function ringOnce() {
  const ctx = getAudioContext();
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    // Three rising chirps — reads as an alarm rather than a notification blip.
    beep(ctx, now, 880, 0.18);
    beep(ctx, now + 0.22, 1108, 0.18);
    beep(ctx, now + 0.44, 1318, 0.3);
  }
  try {
    navigator.vibrate?.([260, 130, 260, 130, 420]);
  } catch {
    // vibration unsupported (desktop, iOS Safari) — the sound carries it
  }
}

/** Rings repeatedly until stopped, giving up after `maxMs` so a timer that finished
 * in an empty kitchen doesn't chirp forever. */
export function startAlarm(maxMs = 60_000) {
  stopAlarm();
  ringOnce();
  ringInterval = setInterval(ringOnce, 2200);
  ringStopTimeout = setTimeout(stopAlarm, maxMs);
}

export function stopAlarm() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  if (ringStopTimeout) {
    clearTimeout(ringStopTimeout);
    ringStopTimeout = null;
  }
  try {
    navigator.vibrate?.(0);
  } catch {
    // nothing to cancel
  }
}

/**
 * The system notification — the part that reaches the cook when the app isn't on
 * screen. Shown through the service worker when one is registered (phones require
 * that, and it's what lets tapping the notification reopen the right step).
 */
export async function showTimerNotification(body: string, href?: string): Promise<void> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body,
    tag: "cookbook-timer",
    icon: "/icon.png",
    badge: "/icon.png",
    requireInteraction: true,
    data: { url: href ?? "/" },
  };

  try {
    // getRegistration (not `ready`, which never settles when no worker was registered).
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.active) {
      await registration.showNotification("הזמן נגמר!", options);
      return;
    }
  } catch {
    // fall through to the plain notification below
  }

  try {
    new Notification("הזמן נגמר!", options);
  } catch {
    // some browsers only allow notifications via a service worker — the in-app alarm remains
  }
}
