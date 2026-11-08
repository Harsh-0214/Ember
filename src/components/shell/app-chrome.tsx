"use client";
import { Fab } from "./fab";
import { InstallHint } from "./install-hint";
import { OfflineIndicator } from "./offline-indicator";
import { TabBar } from "./tab-bar";

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineIndicator />
      <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">{children}</div>
      <Fab />
      <TabBar />
      <InstallHint />
    </>
  );
}
