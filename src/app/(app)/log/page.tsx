import type { Metadata } from "next";
import { Suspense } from "react";
import { LogScreen } from "@/components/log/log-screen";

export const metadata: Metadata = { title: "Log food" };

export default function LogPage() {
  return (
    <Suspense>
      <LogScreen />
    </Suspense>
  );
}
