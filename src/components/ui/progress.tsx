import { cn } from "@/lib/utils";

export function Bar({ value, max, colorClass, label, className }: { value: number; max: number; colorClass: string; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-ring-track", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", colorClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}
