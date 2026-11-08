import { cn } from "@/lib/utils";

export function CalorieRing({ eaten, budget, size = 184 }: { eaten: number; budget: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = budget > 0 ? eaten / budget : 0;
  const over = eaten > budget;
  const remaining = Math.round(budget - eaten);
  const dash = Math.min(1, pct) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        {dash > 0.5 ? <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--destructive)" : "var(--primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        /> : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="img" aria-label={`${Math.round(eaten)} of ${Math.round(budget)} calories eaten, ${Math.abs(remaining)} ${over ? "over" : "left"}`}>
        <span className={cn("text-4xl font-bold tracking-tight tabular", over && "text-destructive")}>{Math.abs(remaining).toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">{over ? "kcal over" : "kcal left"}</span>
      </div>
    </div>
  );
}
