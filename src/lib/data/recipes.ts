"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { send } from "@/lib/sync";
import type { RecipeInput, SavedMealInput } from "@/lib/schemas/recipes";
import type { Tables } from "@/types/database";
import { qk, qk2 } from "./keys";
import type { FoodWithServings } from "./types";

export type Recipe = Tables<"recipes">;
export type RecipeItem = Tables<"recipe_items">;
export type RecipeWithItems = Recipe & { recipe_items: (RecipeItem & { foods: FoodWithServings | null })[] };
export type SavedMeal = Tables<"saved_meals"> & { saved_meal_items: Tables<"saved_meal_items">[] };

const sb = () => getSupabaseBrowser();

export function useRecipes() {
  return useQuery({
    queryKey: qk2.recipes,
    queryFn: async () => {
      const { data, error } = await sb().from("recipes").select("*").order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as Recipe[];
    },
  });
}

export function useRecipe(id: string | null) {
  return useQuery({
    queryKey: qk2.recipe(id ?? "new"),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb().from("recipes").select("*, recipe_items(*, foods(*, food_servings(*)))").eq("id", id!).maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as RecipeWithItems | null;
    },
  });
}

export function useSavedMeals() {
  return useQuery({
    queryKey: qk2.savedMeals,
    queryFn: async () => {
      const { data, error } = await sb().from("saved_meals").select("*, saved_meal_items(*)").order("last_used_at", { ascending: false, nullsFirst: false });
      if (error) throw new Error(error.message);
      return (data as unknown as SavedMeal[]).map((m) => ({ ...m, saved_meal_items: [...m.saved_meal_items].sort((a, b) => a.position - b.position) }));
    },
    staleTime: 60_000,
  });
}

export function useSaveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: RecipeInput }) =>
      send<{ recipe: Recipe }>(id ? { method: "PATCH", path: `/api/recipes/${id}`, body: input } : { method: "POST", path: "/api/recipes", body: input }),
    onSuccess: (res) => {
      qc.setQueryData<Recipe[]>(qk2.recipes, (old) => [res.recipe, ...(old ?? []).filter((r) => r.id !== res.recipe.id)]);
      void qc.invalidateQueries({ queryKey: qk2.recipes });
      void qc.invalidateQueries({ queryKey: qk2.recipe(res.recipe.id) });
      void qc.invalidateQueries({ queryKey: qk.myFoods });
      if (res.recipe.food_id) void qc.invalidateQueries({ queryKey: qk.food(res.recipe.food_id) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save recipe"),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => send({ method: "DELETE", path: `/api/recipes/${id}` }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk2.recipes });
      void qc.invalidateQueries({ queryKey: qk.myFoods });
    },
  });
}

export function useSaveSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedMealInput) => send<{ meal: SavedMeal }>({ method: "POST", path: "/api/saved-meals", body: input }),
    onSuccess: (res) => {
      // Update the (persisted) cache directly so every screen sees the new meal immediately.
      qc.setQueryData<SavedMeal[]>(qk2.savedMeals, (old) => [res.meal, ...(old ?? []).filter((m) => m.id !== res.meal.id)]);
      void qc.invalidateQueries({ queryKey: qk2.savedMeals });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save meal"),
  });
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => send({ method: "DELETE", path: `/api/saved-meals/${id}` }),
    onMutate: (id) => qc.setQueryData<SavedMeal[]>(qk2.savedMeals, (old) => (old ?? []).filter((m) => m.id !== id)),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk2.savedMeals }),
  });
}

export function useTouchSavedMeal() {
  return useMutation({
    mutationFn: (id: string) => send({ method: "PATCH", path: `/api/saved-meals/${id}`, body: { last_used_at: new Date().toISOString() } }),
  });
}
