import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center pt-safe">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-muted-foreground">This page hasn&apos;t been saved for offline use yet. Anything you log on Today is queued and syncs when you&apos;re back online.</p>
      <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">Go to Today</Link>
    </main>
  );
}
