import { Bar } from "@/components/ui/progress";

export function MacroBars({ protein, carbs, fat, targets }: { protein: number; carbs: number; fat: number; targets: { protein: number; carbs: number; fat: number } }) {
  const rows = [
    { key: "Protein", v: protein, t: targets.protein, color: "bg-protein" },
    { key: "Carbs", v: carbs, t: targets.carbs, color: "bg-carbs" },
    { key: "Fat", v: fat, t: targets.fat, color: "bg-fat" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((r) => (
        <div key={r.key} className="grid gap-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium">{r.key}</span>
          </div>
          <Bar value={r.v} max={r.t} colorClass={r.color} label={`${r.key} ${Math.round(r.v)} of ${r.t} grams`} />
          <span className="text-xs text-muted-foreground tabular">
            {Math.round(r.v)}/{r.t} g
          </span>
        </div>
      ))}
    </div>
  );
}
