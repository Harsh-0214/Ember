import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;
export type Goal = Tables<"goals">;
export type FoodRow = Tables<"foods">;
export type ServingRow = Tables<"food_servings">;
export type FoodWithServings = FoodRow & { food_servings: ServingRow[] };
export type FoodEntry = Tables<"food_entries">;
export type WaterEntry = Tables<"water_entries">;
export type BodyMetric = Tables<"body_metrics">;
export type DailySummary = Tables<"daily_summaries">;
export type Workout = Tables<"workouts">;
export type HealthSample = Tables<"health_samples">;
