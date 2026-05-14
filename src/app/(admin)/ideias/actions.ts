"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getCurrentEmail } from "@/lib/auth/server";
import type { Idea, IdeaInsert, IdeaUpdate } from "@/types/idea";

// Todos os 3 utilizadores podem criar/editar ideias (incluindo a Ana).

export async function createIdeaAction(input: IdeaInsert): Promise<Idea> {
  await requireUser();
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
  await requireUser();
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
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("ideas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ideias");
}
