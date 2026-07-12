import type { SupabaseClient } from "@supabase/supabase-js";
import { Ingredient, IngredientNote, Recipe, RecipeStep } from "./recipes";

type DbRecipeRow = {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  source: string;
  keywords: string[];
  have_items: Ingredient[];
  buy_items: Ingredient[];
  steps: RecipeStep[];
  note: string | null;
  ingredient_notes: IngredientNote[] | null;
  pending: boolean;
};

function fromDb(row: DbRecipeRow): Recipe {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    blurb: row.blurb,
    source: row.source,
    keywords: row.keywords,
    haveItems: row.have_items,
    buyItems: row.buy_items,
    steps: row.steps,
    note: row.note ?? undefined,
    ingredientNotes: row.ingredient_notes ?? undefined,
    pending: row.pending,
  };
}

function toDbFields(recipe: Recipe) {
  return {
    title: recipe.title,
    emoji: recipe.emoji,
    blurb: recipe.blurb,
    source: recipe.source,
    keywords: recipe.keywords,
    have_items: recipe.haveItems,
    buy_items: recipe.buyItems,
    steps: recipe.steps,
    note: recipe.note ?? null,
    ingredient_notes: recipe.ingredientNotes ?? null,
    pending: recipe.pending ?? false,
  };
}

export async function fetchRecipes(supabase: SupabaseClient, ownerId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as DbRecipeRow[]).map(fromDb);
}

/** Looks up a single recipe by id regardless of owner — succeeds only if row-level
 * security allows it (it's the caller's own recipe, or its owner has sharing on).
 * Used as a fallback when a recipe isn't in memory, e.g. a friend's recipe opened
 * after the page was reloaded. */
export async function fetchRecipeById(supabase: SupabaseClient, id: string): Promise<Recipe | null> {
  const { data, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return fromDb(data as DbRecipeRow);
}

/** Inserts a recipe and returns it with the real database-generated id. */
export async function insertRecipe(
  supabase: SupabaseClient,
  ownerId: string,
  recipe: Recipe
): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({ owner_id: ownerId, ...toDbFields(recipe) })
    .select()
    .single();
  if (error || !data) {
    if (error) console.error("insertRecipe failed:", error.message);
    return null;
  }
  return fromDb(data as DbRecipeRow);
}

export async function insertRecipes(
  supabase: SupabaseClient,
  ownerId: string,
  recipes: Recipe[]
): Promise<Recipe[]> {
  const rows = recipes.map((r) => ({ owner_id: ownerId, ...toDbFields(r) }));
  const { data, error } = await supabase.from("recipes").insert(rows).select();
  if (error || !data) return [];
  return (data as DbRecipeRow[]).map(fromDb);
}

export async function updateRecipe(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Recipe>
): Promise<Recipe | null> {
  const fields: Record<string, unknown> = {};
  if (patch.buyItems !== undefined) fields.buy_items = patch.buyItems;
  if (patch.haveItems !== undefined) fields.have_items = patch.haveItems;
  if (patch.steps !== undefined) fields.steps = patch.steps;
  if (patch.note !== undefined) fields.note = patch.note ?? null;
  if (patch.ingredientNotes !== undefined) fields.ingredient_notes = patch.ingredientNotes ?? null;
  if (patch.pending !== undefined) fields.pending = patch.pending;
  if (patch.source !== undefined) fields.source = patch.source;

  const { data, error } = await supabase.from("recipes").update(fields).eq("id", id).select().single();
  if (error || !data) {
    if (error) console.error("updateRecipe failed:", error.message);
    return null;
  }
  return fromDb(data as DbRecipeRow);
}

export async function deleteRecipeRow(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  return !error;
}
