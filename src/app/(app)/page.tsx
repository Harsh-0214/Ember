import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayScreen } from "@/components/today/today-screen";

export default function TodayPage() {
  return (
    <Suspense fallback={<div className="grid gap-4 p-4 pt-16"><Skeleton className="h-64" /><Skeleton className="h-28" /></div>}>
      <TodayScreen />
    </Suspense>
  );
}
