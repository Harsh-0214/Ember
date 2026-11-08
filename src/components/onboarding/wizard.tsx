"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/data/keys";
import type { Profile } from "@/lib/data/types";
import { ageOn, DEFAULT_TIMEZONE, isValidTimeZone, todayIn } from "@/lib/dates";
import { ACTIVITY_LEVELS, assessRate, computeTargets, fillCarbs, formulaTdee, type ActivityLevel, type GoalType, type Sex } from "@/lib/nutrition";
import { ftInToCm, kgToLb, lbToKg, round, type UnitSystem } from "@/lib/units";
import { cn, uuid } from "@/lib/utils";

type StepId = "units" | "goal" | "sex" | "birth" | "height" | "weight" | "goalWeight" | "activity" | "rate" | "result";

interface State {
  units: UnitSystem;
  goal: GoalType | null;
  sex: Sex | null;
  birthDate: string;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  activity: ActivityLevel | null;
  rateKg: number | null; // absolute kg/week
}

const guessUnits = (): UnitSystem => (typeof navigator !== "undefined" && /^en-US|^en-LR|^my/.test(navigator.language) ? "imperial" : "metric");

function Choice({ selected, onClick, title, desc }: { selected: boolean; onClick: () => void; title: string; desc?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn("w-full rounded-2xl p-4 text-left ring-1 transition-colors", selected ? "bg-accent ring-2 ring-primary" : "bg-card ring-border hover:bg-muted")}
    >
      <span className="block font-semibold">{title}</span>
      {desc ? <span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span> : null}
    </button>
  );
}

export function Wizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const [s, setS] = useState<State>(() => ({ units: guessUnits(), goal: null, sex: null, birthDate: "", heightCm: null, weightKg: null, goalWeightKg: null, activity: null, rateKg: null }));
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<{ kcal?: number; protein?: number; fat?: number } | null>(null);
  const tz = typeof Intl !== "undefined" && isValidTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ? Intl.DateTimeFormat().resolvedOptions().timeZone : DEFAULT_TIMEZONE;
  const today = todayIn(tz);

  const steps = useMemo<StepId[]>(() => {
    const all: StepId[] = ["units", "goal", "sex", "birth", "height", "weight", "goalWeight", "activity", "rate", "result"];
    return all.filter((x) => !(s.goal === "maintain" && (x === "goalWeight" || x === "rate")));
  }, [s.goal]);
  const step = steps[Math.min(stepIdx, steps.length - 1)]!;
  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }));

  // ---- height/weight input mirrors in display units
  const [ft, setFt] = useState("");
  const [inch, setInch] = useState("");
  const [cmStr, setCmStr] = useState("");
  const [wStr, setWStr] = useState("");
  const [gwStr, setGwStr] = useState("");
  const toKg = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return s.units === "imperial" ? lbToKg(n) : n;
  };

  const age = s.birthDate ? ageOn(s.birthDate, today) : null;

  const valid: Record<StepId, boolean> = {
    units: true,
    goal: s.goal != null,
    sex: s.sex != null,
    birth: age != null && age >= 13 && age <= 110,
    height: s.heightCm != null && s.heightCm >= 100 && s.heightCm <= 250,
    weight: s.weightKg != null && s.weightKg >= 30 && s.weightKg <= 350,
    goalWeight: s.goalWeightKg != null && s.goalWeightKg >= 30 && s.goalWeightKg <= 350 && (s.goal !== "lose" || (s.weightKg != null && s.goalWeightKg < s.weightKg)) && (s.goal !== "gain" || (s.weightKg != null && s.goalWeightKg > s.weightKg)),
    activity: s.activity != null,
    rate: s.rateKg != null,
    result: true,
  };

  const rateOptions = useMemo(() => {
    if (s.goal === "gain") return s.units === "imperial" ? [0.25, 0.5, 1].map(lbToKg) : [0.1, 0.25, 0.5];
    return s.units === "imperial" ? [0.5, 1, 1.5, 2].map(lbToKg) : [0.25, 0.5, 0.75, 1];
  }, [s.goal, s.units]);
  const rateLabels = s.goal === "gain" ? ["Lean & slow", "Steady", "Fast"] : ["Relaxed", "Steady", "Faster", "Aggressive"];

  const computed = useMemo(() => {
    if (!s.sex || !s.heightCm || !s.weightKg || !s.activity || age == null || !s.goal) return null;
    const tdee = formulaTdee({ sex: s.sex, weightKg: s.weightKg, heightCm: s.heightCm, ageYears: age, activity: s.activity });
    const signedRate = s.goal === "lose" ? -(s.rateKg ?? 0) : s.goal === "gain" ? s.rateKg ?? 0 : 0;
    const t = computeTargets({ sex: s.sex, weightKg: s.weightKg, goalWeightKg: s.goalWeightKg, tdeeKcal: tdee, goal: s.goal, weeklyRateKg: signedRate });
    return { tdee: Math.round(tdee), t, signedRate };
  }, [s, age]);

  const final = useMemo(() => {
    if (!computed) return null;
    const kcal = edits?.kcal ?? computed.t.kcal;
    const protein = edits?.protein ?? computed.t.protein_g;
    const fat = edits?.fat ?? computed.t.fat_g;
    const carbs = edits ? fillCarbs(kcal, protein, fat) : computed.t.carbs_g;
    return { kcal, protein, fat, carbs };
  }, [computed, edits]);

  const fmtW = (kg: number) => (s.units === "imperial" ? `${round(kgToLb(kg), 1)} lb` : `${round(kg, 2)} kg`);

  async function save() {
    if (!computed || !final || !s.sex || !s.heightCm || !s.weightKg || !s.activity || !s.goal) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ profile: Profile }>("/api/onboarding", {
        profile: { sex: s.sex, birth_date: s.birthDate, height_cm: round(s.heightCm, 1), units: s.units, timezone: tz },
        goal: {
          effective_from: today,
          goal_type: s.goal,
          goal_weight_kg: s.goal === "maintain" ? round(s.weightKg, 2) : s.goalWeightKg != null ? round(s.goalWeightKg, 2) : null,
          weekly_rate_kg: round(computed.signedRate, 2),
          activity_level: s.activity,
          bmr_method: "mifflin",
          tdee_kcal: computed.tdee,
          kcal_target: Math.round(final.kcal),
          protein_g: Math.round(final.protein),
          carbs_g: Math.round(final.carbs),
          fat_g: Math.round(final.fat),
          fiber_g: computed.t.fiber_g,
          is_manual: edits != null,
        },
        weight: { id: uuid(), date: today, weight_kg: round(s.weightKg, 2) },
      });
      qc.setQueryData(qk.profile, res.profile);
      await Promise.all([qc.refetchQueries({ queryKey: qk.goals, type: "all" }), qc.invalidateQueries({ queryKey: ["body"] })]);
      router.replace("/?welcome=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
      setSaving(false);
    }
  }

  const next = () => (step === "result" ? void save() : setStepIdx((i) => Math.min(i + 1, steps.length - 1)));
  const back = () => setStepIdx((i) => Math.max(0, i - 1));
  const progress = ((stepIdx + 1) / steps.length) * 100;

  const titles: Record<StepId, string> = {
    units: "How do you like to measure?",
    goal: "What's your goal?",
    sex: "Sex for the calorie formula",
    birth: "When were you born?",
    height: "How tall are you?",
    weight: "What do you weigh today?",
    goalWeight: "What's your goal weight?",
    activity: "How active is a typical day?",
    rate: s.goal === "gain" ? "How fast do you want to gain?" : "How fast do you want to lose?",
    result: "Your daily targets",
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-safe pb-safe">
      <header className="flex items-center gap-2 py-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Back" disabled={stepIdx === 0} className={stepIdx === 0 ? "invisible" : ""}>
          <ChevronLeft aria-hidden />
        </Button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Setup progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-11 text-right text-xs text-muted-foreground tabular">{stepIdx + 1}/{steps.length}</span>
      </header>

      <section className="flex-1 py-4" aria-live="polite">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">{titles[step]}</h1>

        {step === "units" && (
          <div role="radiogroup" aria-label="Units" className="grid gap-3">
            <Choice selected={s.units === "metric"} onClick={() => set({ units: "metric" })} title="Metric" desc="kg, cm, ml" />
            <Choice selected={s.units === "imperial"} onClick={() => set({ units: "imperial" })} title="Imperial" desc="lb, ft/in, cups" />
            <p className="text-sm text-muted-foreground">You can switch any time in Settings.</p>
          </div>
        )}

        {step === "goal" && (
          <div role="radiogroup" aria-label="Goal" className="grid gap-3">
            <Choice selected={s.goal === "lose"} onClick={() => set({ goal: "lose" })} title="Lose fat" desc="Eat in a moderate deficit while keeping muscle" />
            <Choice selected={s.goal === "maintain"} onClick={() => set({ goal: "maintain", rateKg: 0 })} title="Maintain" desc="Stay where you are and build habits" />
            <Choice selected={s.goal === "gain"} onClick={() => set({ goal: "gain" })} title="Build muscle" desc="Small surplus to support training" />
          </div>
        )}

        {step === "sex" && (
          <div role="radiogroup" aria-label="Sex" className="grid gap-3">
            <Choice selected={s.sex === "female"} onClick={() => set({ sex: "female" })} title="Female" />
            <Choice selected={s.sex === "male"} onClick={() => set({ sex: "male" })} title="Male" />
            <p className="text-sm text-muted-foreground">Calorie formulas use biological sex because it affects resting metabolism. It isn&apos;t shown anywhere else.</p>
          </div>
        )}

        {step === "birth" && (
          <Field label="Birth date" htmlFor="birth" hint={age != null && age >= 13 ? `${age} years old` : "Used to estimate your resting metabolism."}>
            <Input id="birth" type="date" max={today} min="1915-01-01" value={s.birthDate} onChange={(e) => set({ birthDate: e.target.value })} />
          </Field>
        )}

        {step === "height" &&
          (s.units === "imperial" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Feet" htmlFor="ft">
                <Input id="ft" inputMode="numeric" value={ft} placeholder="5" onChange={(e) => {
                  setFt(e.target.value);
                  const f = Number(e.target.value), i = Number(inch || 0);
                  set({ heightCm: f > 0 ? ftInToCm(f, i) : null });
                }} />
              </Field>
              <Field label="Inches" htmlFor="in">
                <Input id="in" inputMode="numeric" value={inch} placeholder="10" onChange={(e) => {
                  setInch(e.target.value);
                  const f = Number(ft || 0), i = Number(e.target.value);
                  set({ heightCm: f > 0 ? ftInToCm(f, i) : null });
                }} />
              </Field>
            </div>
          ) : (
            <Field label="Height (cm)" htmlFor="cm">
              <Input id="cm" inputMode="decimal" value={cmStr} placeholder="175" onChange={(e) => {
                setCmStr(e.target.value);
                const n = Number(e.target.value.replace(",", "."));
                set({ heightCm: n > 0 ? n : null });
              }} />
            </Field>
          ))}

        {step === "weight" && (
          <Field label={`Weight (${s.units === "imperial" ? "lb" : "kg"})`} htmlFor="w" hint="Morning weight is best, but any is fine to start.">
            <Input id="w" inputMode="decimal" value={wStr} placeholder={s.units === "imperial" ? "180" : "80"} onChange={(e) => {
              setWStr(e.target.value);
              set({ weightKg: toKg(e.target.value) });
            }} />
          </Field>
        )}

        {step === "goalWeight" && (
          <Field
            label={`Goal weight (${s.units === "imperial" ? "lb" : "kg"})`}
            htmlFor="gw"
            error={s.goalWeightKg != null && !valid.goalWeight ? (s.goal === "lose" ? "Goal should be below your current weight." : "Goal should be above your current weight.") : null}
            hint={s.weightKg ? `Currently ${fmtW(s.weightKg)}` : undefined}
          >
            <Input id="gw" inputMode="decimal" value={gwStr} onChange={(e) => {
              setGwStr(e.target.value);
              set({ goalWeightKg: toKg(e.target.value) });
            }} />
          </Field>
        )}

        {step === "activity" && (
          <div role="radiogroup" aria-label="Activity level" className="grid gap-2.5">
            {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((a) => (
              <Choice key={a} selected={s.activity === a} onClick={() => set({ activity: a })} title={ACTIVITY_LEVELS[a].label} desc={ACTIVITY_LEVELS[a].description} />
            ))}
          </div>
        )}

        {step === "rate" && s.weightKg && s.goal && (
          <div role="radiogroup" aria-label="Weekly rate" className="grid gap-2.5">
            {rateOptions.map((r, i) => {
              const a = assessRate(s.goal!, s.goal === "lose" ? -r : r, s.weightKg!);
              return (
                <Choice
                  key={r}
                  selected={s.rateKg != null && Math.abs(s.rateKg - r) < 0.001}
                  onClick={() => set({ rateKg: r })}
                  title={`${rateLabels[i] ?? ""} · ${fmtW(r)}/week`}
                  desc={a.level === "ok" ? "Within the recommended range" : a.level === "aggressive" ? "Faster than recommended" : "Too aggressive for most people"}
                />
              );
            })}
            {s.rateKg != null && (() => {
              const a = assessRate(s.goal!, s.goal === "lose" ? -s.rateKg! : s.rateKg!, s.weightKg!);
              return a.message ? (
                <p role="alert" className="flex gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {a.message}
                </p>
              ) : null;
            })()}
          </div>
        )}

        {step === "result" && computed && final && (
          <div className="grid gap-5">
            <div className="rounded-3xl bg-card p-6 text-center ring-1 ring-border">
              <p className="text-5xl font-bold tracking-tight tabular">{Math.round(final.kcal).toLocaleString()}</p>
              <p className="text-muted-foreground">calories per day</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-lg font-semibold text-protein tabular">{final.protein} g</p><p className="text-muted-foreground">Protein</p></div>
                <div><p className="text-lg font-semibold text-carbs tabular">{final.carbs} g</p><p className="text-muted-foreground">Carbs</p></div>
                <div><p className="text-lg font-semibold text-fat tabular">{final.fat} g</p><p className="text-muted-foreground">Fat</p></div>
              </div>
            </div>
            <p className="text-[15px] text-muted-foreground">{computed.t.explanation} Ember will refine this from your real logs and weight trend after about two weeks.</p>
            {edits ? (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Calories" htmlFor="ek"><Input id="ek" inputMode="numeric" value={String(edits.kcal ?? final.kcal)} onChange={(e) => setEdits({ ...edits, kcal: Number(e.target.value) || 0 })} /></Field>
                <Field label="Protein g" htmlFor="ep"><Input id="ep" inputMode="numeric" value={String(edits.protein ?? final.protein)} onChange={(e) => setEdits({ ...edits, protein: Number(e.target.value) || 0 })} /></Field>
                <Field label="Fat g" htmlFor="ef"><Input id="ef" inputMode="numeric" value={String(edits.fat ?? final.fat)} onChange={(e) => setEdits({ ...edits, fat: Number(e.target.value) || 0 })} /></Field>
                <p className="col-span-3 text-sm text-muted-foreground">Carbs fill the remaining calories.{final.kcal < computed.t.floorKcal ? ` Below ${computed.t.floorKcal} kcal isn't recommended without medical supervision.` : ""}</p>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setEdits({})}>Adjust targets</Button>
            )}
            {computed.t.floorApplied ? <p className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">We&apos;ve kept you at the {computed.t.floorKcal} kcal safety floor: eating less makes it hard to get enough nutrients and keep muscle.</p> : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
      </section>

      <footer className="sticky bottom-0 bg-background pt-2 pb-4">
        <Button size="lg" className="w-full" onClick={next} disabled={!valid[step] || saving || (step === "result" && final != null && final.kcal < 800)}>
          {step === "result" ? (saving ? "Saving…" : "Start tracking") : "Continue"}
        </Button>
      </footer>
    </main>
  );
}
