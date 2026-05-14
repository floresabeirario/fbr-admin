"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getCurrentEmail } from "@/lib/auth/server";
import type { Recipe, RecipeInsert, RecipeUpdate } from "@/types/recipe";

export async function createRecipeAction(input: RecipeInsert): Promise<Recipe> {
  await requireUser();
  const email = await getCurrentEmail();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .insert({ ...input, created_by_email: email })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/livro-receitas");
  return data as Recipe;
}

export async function updateRecipeAction(id: string, updates: RecipeUpdate): Promise<Recipe> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/livro-receitas");
  revalidatePath(`/livro-receitas/${id}`);
  return data as Recipe;
}

export async function archiveRecipeAction(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/livro-receitas");
}
