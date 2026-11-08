import { z } from "zod";
import { localDateSchema } from "./diary";

export const sexSchema = z.enum(["male", "female"]);
export const goalTypeSchema = z.enum(["lose", "maintain", "gain"]);
export const activitySchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export const unitsSchema = z.enum(["metric", "imperial"]);

export const timezoneSchema = z.string().min(1).max(64).refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone");

export const targetsSchema = z.object({
  kcal_target: z.number().int().min(800).max(8000),
  protein_g: z.number().int().min(0).max(600),
  carbs_g: z.number().int().min(0).max(1500),
  fat_g: z.number().int().min(0).max(600),
  fiber_g: z.number().int().min(0).max(200).nullable().optional(),
});

export const goalInputSchema = targetsSchema.extend({
  effective_from: localDateSchema,
  goal_type: goalTypeSchema,
  goal_weight_kg: z.number().min(20).max(400).nullable(),
  weekly_rate_kg: z.number().min(-2).max(2),
  activity_level: activitySchema,
  bmr_method: z.enum(["mifflin", "katch"]).default("mifflin"),
  tdee_kcal: z.number().int().min(800).max(10000).nullable().optional(),
  is_manual: z.boolean().default(false),
});
export type GoalInput = z.infer<typeof goalInputSchema>;

export const onboardingSchema = z.object({
  profile: z.object({
    sex: sexSchema,
    birth_date: localDateSchema.refine((d) => {
      const y = Number(d.slice(0, 4));
      const now = new Date().getUTCFullYear();
      return y >= now - 110 && y <= now - 13;
    }, "Age must be between 13 and 110"),
    height_cm: z.number().min(100).max(250),
    units: unitsSchema,
    timezone: timezoneSchema,
  }),
  goal: goalInputSchema,
  weight: z.object({ id: z.uuid(), date: localDateSchema, weight_kg: z.number().min(20).max(400) }),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const profilePatchSchema = z
  .object({
    display_name: z.string().trim().max(60).nullable(),
    sex: sexSchema,
    birth_date: localDateSchema,
    height_cm: z.number().min(100).max(250),
    units: unitsSchema,
    timezone: timezoneSchema,
    meal_names: z.array(z.string().trim().min(1).max(30)).min(1).max(6),
    checkin_day: z.number().int().min(0).max(6),
    exercise_budget_enabled: z.boolean(),
    exercise_budget_pct: z.number().int().min(0).max(100),
    theme: z.enum(["system", "light", "dark"]),
    water_goal_ml: z.number().int().min(0).max(10000),
    calorie_floor_kcal: z.number().int().min(800).max(3000).nullable(),
  })
  .partial();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
