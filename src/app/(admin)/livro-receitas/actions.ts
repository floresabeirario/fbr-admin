"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, getCurrentEmail } from "@/lib/auth/server";
import type { Recipe, RecipeInsert, RecipeUpdate } from "@/types/recipe";

// Só admins criam/editam receitas. A Ana (viewer) edita apenas Tarefas,
// Parcerias e Chat (decisão Maria, 04/07/2026). Reverter = trocar
// requireAdmin por requireUser nas 3 actions.

export async function createRecipeAction(input: RecipeInsert): Promise<Recipe> {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/livro-receitas");
}
