export type Sex = "male" | "female";
export type GoalType = "lose" | "maintain" | "gain";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type BmrMethod = "mifflin" | "katch";
export type Confidence = "none" | "low" | "medium" | "high";
export type Intensity = "light" | "moderate" | "vigorous";

/** Nutrient values (per 100 g/ml for foods, totals for entries). */
export interface Nutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sat_fat_g: number | null;
  sodium_mg: number | null;
}

export const KCAL_PER_KG = 7700;
