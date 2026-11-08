import { z } from "zod";

const num = (max: number) => z.number().finite().min(0).max(max);
const optNum = (max: number) => num(max).nullable().optional().transform((v) => v ?? null);

/** Nutrients per 100 g (or 100 ml). */
export const per100Schema = z.object({
  kcal: num(1000),
  protein_g: num(100),
  carbs_g: num(100),
  fat_g: num(100),
  fiber_g: optNum(100),
  sugar_g: optNum(100),
  sat_fat_g: optNum(100),
  sodium_mg: optNum(100000),
});

export const servingSchema = z.object({
  name: z.string().trim().min(1).max(100),
  grams: z.number().finite().positive().max(10000),
});

export const foodSourceSchema = z.enum(["custom", "off", "usda", "seed", "recipe", "import", "ai"]);
export type FoodSource = z.infer<typeof foodSourceSchema>;

/** A food from any source, normalised to Ember's model. */
export const normalizedFoodSchema = z.object({
  source: foodSourceSchema,
  sourceId: z.string().max(100).nullable(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).nullable(),
  barcode: z.string().regex(/^\d{6,14}$/).nullable(),
  basis: z.enum(["g", "ml"]),
  per100: per100Schema,
  servings: z.array(servingSchema).max(20),
});
export type NormalizedFood = z.infer<typeof normalizedFoodSchema>;

export const customFoodInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).nullable().optional().transform((v) => v || null),
  barcode: z.string().trim().regex(/^\d{6,14}$/, "Barcodes are 6–14 digits").nullable().optional().transform((v) => v || null),
  basis: z.enum(["g", "ml"]).default("g"),
  per100: per100Schema,
  servings: z.array(servingSchema).max(20).default([]),
});
export type CustomFoodInput = z.infer<typeof customFoodInputSchema>;

export const cacheFoodInputSchema = z.object({
  source: z.enum(["off", "usda"]),
  sourceId: z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z_-]+$/),
});
