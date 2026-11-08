"use client";
import { Share, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";

const KEY = "ember-install-hint-dismissed";

function isIosSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV/.test(ua);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return iOS && safari && !standalone;
}

const noop = () => () => undefined;

/** One-time "Share → Add to Home Screen" hint for iOS Safari when not installed. */
export function InstallHint() {
  const eligible = useSyncExternalStore(noop, isIosSafariBrowser, () => false);
  const [dismissed, setDismissed] = useLocalStorage(KEY);
  if (!eligible || dismissed) return null;
  return (
    <div role="dialog" aria-label="Install Ember" className="fixed inset-x-3 z-50 mx-auto max-w-md rounded-2xl bg-card p-4 shadow-xl ring-1 ring-border" style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed("1")} className="absolute top-1 right-1 grid size-11 place-items-center text-muted-foreground">
        <X className="size-5" aria-hidden />
      </button>
      <p className="pr-8 font-semibold">Install Ember on your iPhone</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>. It opens full-screen like a native app and can send reminders.
      </p>
    </div>
  );
}
