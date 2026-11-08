"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProfile } from "@/lib/data/hooks";
import { Fab } from "./fab";
import { InstallHint } from "./install-hint";
import { OfflineIndicator } from "./offline-indicator";
import { TabBar } from "./tab-bar";

/** Sends users who haven't finished onboarding to the wizard. */
function OnboardingGate() {
  const { data, isSuccess, isFetchedAfterMount } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    // Only trust a fresh fetch: the persisted cache may predate onboarding.
    if (isSuccess && isFetchedAfterMount && (!data || !data.onboarded_at) && pathname !== "/onboarding") router.replace("/onboarding");
  }, [data, isSuccess, isFetchedAfterMount, pathname, router]);
  return null;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OnboardingGate />
      <OfflineIndicator />
      <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(env(safe-area-inset-bottom)+9rem)]">{children}</div>
      <Fab />
      <TabBar />
      <InstallHint />
    </>
  );
}
