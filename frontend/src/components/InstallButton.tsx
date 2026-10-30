"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, EllipsisVertical, MonitorDown, Share, SquarePlus, X } from "lucide-react";
import { detectBrowser, detectPlatform, promptInstall, startPwa, usePwa, type Browser, type Platform } from "@/lib/pwa";
import { SageMark } from "./Logo";

type Variant = "nav" | "menu" | "sidebar" | "icon";

/** "Install app" button: native prompt where the browser offers one, step-by-step help everywhere else. */
export function InstallButton({ variant }: { variant: Variant }) {
  const { canPrompt, installed } = usePwa();
  const [help, setHelp] = useState(false);

  useEffect(() => startPwa(), []);

  if (installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome) return;
    }
    setHelp(true);
  };

  const button = {
    nav: (
      <button
        onClick={onClick}
        className="hidden items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 lg:flex"
      >
        <Download className="h-4 w-4" /> Install app
      </button>
    ),
    menu: (
      <button
        onClick={onClick}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <Download className="h-4 w-4" /> Install the app
      </button>
    ),
    sidebar: (
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/5 transition hover:bg-white/[0.08]"
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
          <Download className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">Install the app</span>
          <span className="block text-xs text-white/45">On your phone or PC</span>
        </span>
      </button>
    ),
    icon: (
      <button onClick={onClick} className="rounded-lg p-1.5 text-forest-900" aria-label="Install the app">
        <Download className="h-5 w-5" />
      </button>
    ),
  }[variant];

  return (
    <>
      {button}
      {/* Portal to <body>: headers with backdrop-blur or transforms would otherwise trap a fixed overlay. */}
      {help && createPortal(<InstallHelp onClose={() => setHelp(false)} />, document.body)}
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 font-mono text-xs font-bold text-white">
        {n}
      </span>
      <span className="pt-0.5 text-sm leading-6 text-forest-900/85">{children}</span>
    </li>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-forest-900/5 px-1.5 py-0.5 align-middle text-[13px] font-semibold text-forest-950 ring-1 ring-forest-900/10">
      {children}
    </span>
  );
}

function steps(platform: Platform, browser: Browser) {
  if (platform === "ios") {
    return (
      <>
        <Step n={1}>Open this page in <b>Safari</b>.</Step>
        <Step n={2}>
          Tap <Key><Share className="h-3.5 w-3.5" /> Share</Key> at the bottom (or top) of the screen.
        </Step>
        <Step n={3}>
          Choose <Key><SquarePlus className="h-3.5 w-3.5" /> Add to Home Screen</Key>, then tap <b>Add</b>.
        </Step>
      </>
    );
  }
  if (platform === "android") {
    return (
      <>
        <Step n={1}>Open this page in <b>Chrome</b> (or Edge / Samsung Internet).</Step>
        <Step n={2}>
          Tap the <Key><EllipsisVertical className="h-3.5 w-3.5" /> menu</Key> in the top-right corner.
        </Step>
        <Step n={3}>
          Tap <Key>Install app</Key> or <Key>Add to Home screen</Key>, then confirm.
        </Step>
      </>
    );
  }
  if (browser === "firefox") {
    return (
      <>
        <Step n={1}>Firefox on computers can&apos;t install web apps.</Step>
        <Step n={2}>Open this page in <b>Chrome</b> or <b>Edge</b> and click <b>Install app</b> again.</Step>
      </>
    );
  }
  if (browser === "safari") {
    return (
      <>
        <Step n={1}>In Safari on a Mac (macOS Sonoma or later), open the <Key>File</Key> menu.</Step>
        <Step n={2}>Choose <Key>Add to Dock…</Key>, then click <b>Add</b>.</Step>
      </>
    );
  }
  return (
    <>
      <Step n={1}>
        Click the <Key><MonitorDown className="h-3.5 w-3.5" /> install</Key> icon at the right end of the address bar.
      </Step>
      <Step n={2}>
        No icon? Open the browser menu <Key><EllipsisVertical className="h-3.5 w-3.5" /></Key> and choose{" "}
        <Key>Install FinSage</Key> (Chrome: under <b>Cast, save and share</b>; Edge: under <b>Apps</b>).
      </Step>
      <Step n={3}>Confirm with <b>Install</b>. FinSage opens in its own window and gets a desktop shortcut.</Step>
    </>
  );
}

function InstallHelp({ onClose }: { onClose: () => void }) {
  const [env] = useState(() => ({ platform: detectPlatform(), browser: detectBrowser() }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const where = env.platform === "ios" ? "iPhone / iPad" : env.platform === "android" ? "Android" : "your computer";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-forest-950/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
    >
      <div
        className="w-full max-w-md animate-fade-up rounded-3xl bg-white p-6 text-forest-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <SageMark className="h-14 w-14 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h2 id="install-title" className="text-lg font-bold">
              Install FinSage
            </h2>
            <p className="mt-0.5 text-sm text-forest-800/60">
              Use it like an app on {where} — its own window, one tap away, no app store.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-forest-800/50 hover:text-forest-950" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ol className="mt-6 space-y-4">{steps(env.platform, env.browser)}</ol>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-forest-900 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
