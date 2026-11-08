"use client";
import { CloudOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";

export function OfflineIndicator({ pending = 0 }: { pending?: number }) {
  const online = useOnline();
  if (online && pending === 0) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 z-50 flex justify-center" style={{ top: "calc(env(safe-area-inset-top) + 6px)" }}>
      <span className="flex items-center gap-1.5 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium text-background shadow">
        <CloudOff className="size-3.5" aria-hidden />
        {online ? `Syncing ${pending}…` : pending > 0 ? `Offline · ${pending} waiting to sync` : "Offline"}
      </span>
    </div>
  );
}
