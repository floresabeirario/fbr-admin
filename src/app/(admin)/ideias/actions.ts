"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, getCurrentEmail } from "@/lib/auth/server";
import type { Idea, IdeaInsert, IdeaUpdate } from "@/types/idea";

// Só admins criam/editam ideias. A Ana (viewer) edita apenas Tarefas,
// Parcerias e Chat (decisão Maria, 04/07/2026). Reverter = trocar
// requireAdmin por requireUser nas 3 actions.

export async function createIdeaAction(input: IdeaInsert): Promise<Idea> {
  await requireAdmin();
  const email = await getCurrentEmail();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ideas")
    .insert({ ...input, created_by_email: email })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/ideias");
  return data as Idea;
}

export async function updateIdeaAction(id: string, updates: IdeaUpdate): Promise<Idea> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ideas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/ideias");
  return data as Idea;
}

export async function archiveIdeaAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("ideas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ideias");
}
