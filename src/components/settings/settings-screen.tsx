"use client";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { useGoalFor, useProfile, useToday } from "@/lib/data/hooks";
import { useLatestWeightKg } from "@/lib/data/day";
import { qk } from "@/lib/data/keys";
import type { Goal, Profile } from "@/lib/data/types";
import { weekdayName } from "@/lib/dates";
import { fillCarbs } from "@/lib/nutrition";
import type { ProfilePatch } from "@/lib/schemas/profile";
import { cmToFtIn, ftInToCm, round } from "@/lib/units";

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[15px]">{label}</p>
        {desc ? <p className="text-xs text-muted-foreground">{desc}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsScreen() {
  const profile = useProfile();
  const qc = useQueryClient();
  const { setTheme } = useTheme();

  const patch = async (p: ProfilePatch) => {
    const prev = qc.getQueryData<Profile | null>(qk.profile);
    if (prev) qc.setQueryData(qk.profile, { ...prev, ...p });
    try {
      await api.patch("/api/profile", p);
      void qc.invalidateQueries({ queryKey: qk.profile });
    } catch (e) {
      qc.setQueryData(qk.profile, prev);
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  };

  if (!profile.data) {
    return (
      <main className="px-4">
        <PageHeader title="Settings" back="/more" />
        <div className="grid gap-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      </main>
    );
  }
  const p = profile.data;
  return (
    <main className="px-4 pb-10">
      <PageHeader title="Settings" back="/more" />
      <div className="grid gap-5">
        <TargetsCard />

        <section>
          <h2 className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Exercise calories</h2>
          <Card className="divide-y divide-border">
            <Row label="Add exercise calories to budget" desc="Off by default: your TDEE already includes activity.">
              <Switch checked={p.exercise_budget_enabled} onCheckedChange={(v) => void patch({ exercise_budget_enabled: v, exercise_budget_pct: v && p.exercise_budget_pct === 0 ? 50 : p.exercise_budget_pct })} aria-label="Add exercise calories to budget" />
            </Row>
            {p.exercise_budget_enabled ? (
              <div className="px-4 py-3">
                <label htmlFor="ex-pct" className="flex justify-between text-sm"><span>Share of exercise calories added</span><span className="font-semibold tabular">{p.exercise_budget_pct}%</span></label>
                <input id="ex-pct" type="range" min={0} max={100} step={5} value={p.exercise_budget_pct} onChange={(e) => qc.setQueryData(qk.profile, { ...p, exercise_budget_pct: Number(e.target.value) })} onPointerUp={(e) => void patch({ exercise_budget_pct: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => void patch({ exercise_budget_pct: Number((e.target as HTMLInputElement).value) })} className="mt-2 h-11 w-full accent-[var(--primary)]" />
                <p className="text-xs text-muted-foreground">Your base target switches to BMR × 1.2 (sedentary) so activity isn&apos;t counted twice. Re-save your targets below after changing this.</p>
              </div>
            ) : null}
            <Link href="/help/targets" className="flex min-h-12 items-center justify-between px-4 text-sm text-primary">How your target works <ChevronRight className="size-4" aria-hidden /></Link>
          </Card>
        </section>

        <section>
          <h2 className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preferences</h2>
          <Card className="divide-y divide-border">
            <div className="px-4 py-3"><Segmented label="Units" value={p.units as "metric" | "imperial"} onChange={(v) => void patch({ units: v })} options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} /></div>
            <div className="px-4 py-3">
              <Segmented label="Theme" value={p.theme as "system" | "light" | "dark"} onChange={(v) => { setTheme(v); void patch({ theme: v }); }} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
            </div>
            <Row label="Weekly check-in day">
              <select aria-label="Weekly check-in day" value={p.checkin_day} onChange={(e) => void patch({ checkin_day: Number(e.target.value) })} className="h-11 rounded-xl border border-input bg-card px-3">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{weekdayName(d)}</option>)}
              </select>
            </Row>
            <Row label="Daily water goal">
              <WaterGoal key={`${p.water_goal_ml}-${p.units}`} value={p.water_goal_ml} units={p.units as "metric" | "imperial"} onSave={(ml) => void patch({ water_goal_ml: ml })} />
            </Row>
            <Row label="Time zone" desc="Every entry belongs to a local date in this zone.">
              <TimezoneSelect value={p.timezone} onChange={(tz) => void patch({ timezone: tz })} />
            </Row>
          </Card>
        </section>

        <MealNames key={p.meal_names.join("|")} names={p.meal_names} onSave={(meal_names) => void patch({ meal_names })} />
        <ProfileCard profile={p} onSave={(x) => void patch(x)} />

        <section>
          <h2 className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Data & account</h2>
          <Card className="divide-y divide-border">
            {[
              { href: "/settings/health", label: "Connect Apple Health" },
              { href: "/settings/import", label: "Import from MyFitnessPal / Renpho" },
              { href: "/settings/reminders", label: "Reminders" },
              { href: "/settings/data", label: "Export data & delete account" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex min-h-14 items-center justify-between px-4 text-[15px]">{l.label}<ChevronRight className="size-5 text-muted-foreground" aria-hidden /></Link>
            ))}
          </Card>
        </section>
      </div>
    </main>
  );
}

function TargetsCard() {
  const today = useToday();
  const goal = useGoalFor(today);
  if (!goal) return <Skeleton className="h-44" />;
  return <TargetsEditor key={`${goal.id}-${goal.kcal_target}-${goal.protein_g}-${goal.fat_g}`} goal={goal} today={today} />;
}

function TargetsEditor({ goal, today }: { goal: Goal; today: string }) {
  const qc = useQueryClient();
  const weight = useLatestWeightKg(today);
  const [kcal, setKcal] = useState(String(goal.kcal_target));
  const [protein, setProtein] = useState(String(goal.protein_g));
  const [fat, setFat] = useState(String(goal.fat_g));
  const [saving, setSaving] = useState(false);
  const k = Number(kcal) || 0, pr = Number(protein) || 0, f = Number(fat) || 0;
  const carbs = fillCarbs(k, pr, f);
  const dirty = k !== goal.kcal_target || pr !== goal.protein_g || f !== goal.fat_g;
  const save = async () => {
    setSaving(true);
    try {
      await api.post("/api/goals", {
        effective_from: today, goal_type: goal.goal_type, goal_weight_kg: goal.goal_weight_kg, weekly_rate_kg: goal.weekly_rate_kg, activity_level: goal.activity_level,
        bmr_method: goal.bmr_method, tdee_kcal: goal.tdee_kcal, kcal_target: k, protein_g: pr, carbs_g: carbs, fat_g: f, fiber_g: goal.fiber_g, is_manual: true,
      });
      await qc.invalidateQueries({ queryKey: qk.goals });
      toast.success("Targets updated from today");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section>
      <h2 className="flex items-center justify-between px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Daily targets <Link href="/checkin" className="normal-case tracking-normal text-primary">Recalculate</Link>
      </h2>
      <Card className="grid gap-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Calories" htmlFor="t-k"><Input id="t-k" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></Field>
          <Field label="Protein g" htmlFor="t-p"><Input id="t-p" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} /></Field>
          <Field label="Fat g" htmlFor="t-f"><Input id="t-f" inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} /></Field>
        </div>
        <p className="text-sm text-muted-foreground">Carbs: <span className="font-semibold text-foreground tabular">{carbs} g</span> (fills the rest){weight ? ` · Protein ${round(pr / weight, 1)} g/kg` : ""}</p>
        {dirty ? <Button onClick={save} disabled={saving || k < 800}>{saving ? "Saving…" : "Save targets"}</Button> : null}
      </Card>
    </section>
  );
}

function WaterGoal({ value, units, onSave }: { value: number; units: "metric" | "imperial"; onSave: (ml: number) => void }) {
  const toDisplay = (ml: number) => (units === "imperial" ? String(round(ml / 236.588, 1)) : String(ml));
  const [v, setV] = useState(toDisplay(value));
  return (
    <div className="flex items-center gap-2">
      <Input aria-label="Water goal" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = Number(v); if (n > 0) onSave(Math.round(units === "imperial" ? n * 236.588 : n)); }} className="w-24 text-right" />
      <span className="text-sm text-muted-foreground">{units === "imperial" ? "cups" : "ml"}</span>
    </div>
  );
}

function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const zones: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [value];
  return (
    <select aria-label="Time zone" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 max-w-44 rounded-xl border border-input bg-card px-3">
      {(zones.includes(value) ? zones : [value, ...zones]).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
    </select>
  );
}

function MealNames({ names, onSave }: { names: string[]; onSave: (n: string[]) => void }) {
  const [list, setList] = useState(names);
  const dirty = list.join("|") !== names.join("|");
  return (
    <section>
      <h2 className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Meal names</h2>
      <Card className="grid gap-2 p-4">
        {list.map((n, i) => (
          <Input key={i} aria-label={`Meal ${i + 1} name`} value={n} maxLength={30} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        <div className="flex gap-2">
          {list.length < 6 ? <Button variant="outline" className="flex-1" onClick={() => setList((l) => [...l, `Meal ${l.length + 1}`])}>Add meal</Button> : null}
          {list.length > 1 ? <Button variant="ghost" className="flex-1" onClick={() => setList((l) => l.slice(0, -1))}>Remove last</Button> : null}
        </div>
        {dirty ? <Button onClick={() => onSave(list.map((x) => x.trim()).filter(Boolean))}>Save meal names</Button> : null}
      </Card>
    </section>
  );
}

function ProfileCard({ profile, onSave }: { profile: Profile; onSave: (p: ProfilePatch) => void }) {
  const imperial = profile.units === "imperial";
  const h = profile.height_cm != null ? Number(profile.height_cm) : null;
  const fi = h ? cmToFtIn(h) : { ft: 0, in: 0 };
  const [cm, setCm] = useState(h ? String(round(h)) : "");
  const [ft, setFt] = useState(h ? String(fi.ft) : "");
  const [inch, setInch] = useState(h ? String(fi.in) : "");
  const [birth, setBirth] = useState(profile.birth_date ?? "");
  const [sex, setSex] = useState((profile.sex as "male" | "female") ?? "female");
  const newCm = imperial ? ftInToCm(Number(ft) || 0, Number(inch) || 0) : Number(cm) || 0;
  const dirty = Math.abs(newCm - (h ?? 0)) > 0.4 || birth !== (profile.birth_date ?? "") || sex !== profile.sex;
  return (
    <section>
      <h2 className="px-1 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Profile</h2>
      <Card className="grid gap-3 p-4">
        <Segmented label="Sex (for formulas)" value={sex} onChange={setSex} options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} />
        <Field label="Birth date" htmlFor="p-b"><Input id="p-b" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></Field>
        {imperial ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height ft" htmlFor="p-ft"><Input id="p-ft" inputMode="numeric" value={ft} onChange={(e) => setFt(e.target.value)} /></Field>
            <Field label="in" htmlFor="p-in"><Input id="p-in" inputMode="numeric" value={inch} onChange={(e) => setInch(e.target.value)} /></Field>
          </div>
        ) : (
          <Field label="Height (cm)" htmlFor="p-cm"><Input id="p-cm" inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} /></Field>
        )}
        {dirty ? <Button onClick={() => onSave({ sex, birth_date: birth, height_cm: round(newCm, 1) })} disabled={newCm < 100 || newCm > 250}>Save profile</Button> : null}
      </Card>
    </section>
  );
}
