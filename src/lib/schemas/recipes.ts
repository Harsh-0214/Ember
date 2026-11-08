import { z } from "zod";

export const recipeInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(200),
  servings: z.number().positive().max(200),
  total_grams: z.number().positive().max(50000).nullable().optional().transform((v) => v ?? null),
  notes: z.string().trim().max(2000).nullable().optional().transform((v) => v || null),
  items: z
    .array(
      z.object({
        food_id: z.uuid(),
        grams: z.number().positive().max(20000),
        serving_name: z.string().trim().max(100).nullable().optional().transform((v) => v || null),
        quantity: z.number().min(0).max(1000).nullable().optional().transform((v) => v ?? null),
      }),
    )
    .min(1, "Add at least one ingredient")
    .max(100),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;

const nn = (max: number) => z.number().finite().min(0).max(max);
const opt = (max: number) => nn(max).nullable().optional().transform((v) => v ?? null);

export const savedMealInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(200),
  default_meal: z.number().int().min(0).max(5).nullable().optional().transform((v) => v ?? null),
  items: z
    .array(
      z.object({
        food_id: z.uuid().nullable().optional().transform((v) => v ?? null),
        name: z.string().trim().min(1).max(200),
        brand: z.string().trim().max(200).nullable().optional().transform((v) => v || null),
        grams: opt(20000),
        serving_name: z.string().trim().max(100).nullable().optional().transform((v) => v || null),
        quantity: opt(1000),
        kcal: nn(20000),
        protein_g: nn(2000),
        carbs_g: nn(2000),
        fat_g: nn(2000),
        fiber_g: opt(2000),
        sugar_g: opt(2000),
        sat_fat_g: opt(2000),
        sodium_mg: opt(200000),
      }),
    )
    .min(1)
    .max(60),
});
export type SavedMealInput = z.infer<typeof savedMealInputSchema>;
