"use client";

import { useSyncExternalStore } from "react";

/** Chromium's install prompt event (not in the TS DOM types yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __finsageInstallPrompt?: BeforeInstallPromptEvent;
  }
}

/**
 * Captures the install prompt as early as possible — it can fire before React hydrates.
 * Injected into <head> by the root layout.
 */
export const EARLY_CAPTURE_SCRIPT =
  "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__finsageInstallPrompt=e;});";

export type Platform = "ios" | "android" | "desktop";
export type Browser = "chromium" | "safari" | "firefox" | "other";

interface PwaState {
  canPrompt: boolean;
  installed: boolean;
}

const SERVER_STATE: PwaState = { canPrompt: false, installed: false };
let state: PwaState = SERVER_STATE;
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let started = false;

function update(next: Partial<PwaState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** Wire up install events and register the service worker. Safe to call more than once. */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) update({ installed: true });

  if (window.__finsageInstallPrompt) {
    deferred = window.__finsageInstallPrompt;
    update({ canPrompt: true });
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    update({ canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    update({ canPrompt: false, installed: true });
  });

  // Only in production: a service worker in dev would cache stale bundles.
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}

/** Show the browser's own install dialog. Resolves to the user's choice, or null if it isn't available. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!deferred) return null;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  window.__finsageInstallPrompt = undefined;
  update({ canPrompt: false, installed: outcome === "accepted" || state.installed });
  return outcome;
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER_STATE,
  );
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  if (/Edg\/|Chrome|CriOS|Chromium|SamsungBrowser|OPR\//i.test(ua)) return "chromium";
  if (/Safari/i.test(ua)) return "safari";
  return "other";
}
