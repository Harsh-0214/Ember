import { z } from "zod";

export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Invalid date");
const nn = (max: number) => z.number().finite().min(0).max(max);
const optNn = (max: number) => nn(max).nullable().optional().transform((v) => v ?? null);

export const entrySourceSchema = z.enum(["manual", "quick", "recipe", "saved_meal", "copy", "import", "ai"]);

/** A diary food entry. `id` is generated on the client so retries/replays are idempotent. */
export const entryInputSchema = z.object({
  id: z.uuid(),
  date: localDateSchema,
  meal: z.number().int().min(0).max(5),
  food_id: z.uuid().nullable().optional().transform((v) => v ?? null),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).nullable().optional().transform((v) => v || null),
  grams: optNn(10000),
  serving_name: z.string().trim().max(100).nullable().optional().transform((v) => v || null),
  quantity: optNn(1000),
  kcal: nn(20000),
  protein_g: nn(2000),
  carbs_g: nn(2000),
  fat_g: nn(2000),
  fiber_g: optNn(2000),
  sugar_g: optNn(2000),
  sat_fat_g: optNn(2000),
  sodium_mg: optNn(200000),
  source: entrySourceSchema.default("manual"),
  logged_at: z.iso.datetime({ offset: true }).optional(),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const entriesBatchSchema = z.object({ entries: z.array(entryInputSchema).min(1).max(100) });

export const entryPatchSchema = entryInputSchema.omit({ id: true, source: true }).partial();
export type EntryPatch = z.infer<typeof entryPatchSchema>;

export const waterInputSchema = z.object({
  id: z.uuid(),
  date: localDateSchema,
  ml: z.number().int().min(1).max(5000),
  logged_at: z.iso.datetime({ offset: true }).optional(),
});

export const dayFlagsSchema = z.object({
  date: localDateSchema,
  is_complete: z.boolean().optional(),
  is_fasted: z.boolean().optional(),
});

const measurementsSchema = z
  .object({
    waist: nn(300), hips: nn(300), chest: nn(300), neck: nn(100),
    arm_left: nn(100), arm_right: nn(100), thigh_left: nn(150), thigh_right: nn(150),
    calf_left: nn(100), calf_right: nn(100), shoulders: nn(300),
  })
  .partial();
export type Measurements = z.infer<typeof measurementsSchema>;

export const bodyMetricInputSchema = z
  .object({
    id: z.uuid(),
    date: localDateSchema,
    measured_at: z.iso.datetime({ offset: true }).optional(),
    weight_kg: z.number().min(20).max(400).nullable().optional(),
    body_fat_pct: z.number().min(2).max(75).nullable().optional(),
    muscle_kg: z.number().min(5).max(200).nullable().optional(),
    lean_mass_kg: z.number().min(5).max(300).nullable().optional(),
    body_water_pct: z.number().min(20).max(80).nullable().optional(),
    bone_kg: z.number().min(0.5).max(10).nullable().optional(),
    visceral_fat: z.number().min(0).max(60).nullable().optional(),
    bmi: z.number().min(8).max(100).nullable().optional(),
    measurements: measurementsSchema.nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (b) => [b.weight_kg, b.body_fat_pct, b.muscle_kg, b.lean_mass_kg, b.body_water_pct, b.bone_kg, b.visceral_fat, b.bmi].some((v) => v != null) || (b.measurements && Object.keys(b.measurements).length > 0),
    "Enter at least one value",
  );
export type BodyMetricInput = z.infer<typeof bodyMetricInputSchema>;
