import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Sticky header for secondary screens. */
export function PageHeader({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-2 bg-background/95 px-4 pt-safe backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1">
        {back ? (
          <Link href={back} aria-label="Back" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="size-6" aria-hidden />
          </Link>
        ) : null}
        <h1 className="flex-1 truncate text-xl font-bold tracking-tight">{title}</h1>
        {right}
      </div>
    </div>
  );
}
