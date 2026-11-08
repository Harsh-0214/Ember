import type { Metadata } from "next";
import { Suspense } from "react";
import { QuickAddScreen } from "@/components/log/quick-add-screen";

export const metadata: Metadata = { title: "Quick add" };

export default function QuickAddPage() {
  return (
    <Suspense>
      <QuickAddScreen />
    </Suspense>
  );
}
