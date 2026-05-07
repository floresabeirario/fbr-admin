"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type {
  Task,
  TaskInsert,
  TaskUpdate,
  ChecklistItem,
  ChecklistItemInsert,
  ChecklistItemUpdate,
} from "@/types/tasks";

// ============================================================
// Afazeres globais (tasks)
// ============================================================

export async function createTaskAction(task: TaskInsert): Promise<Task> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data as Task;
}

export async function updateTaskAction(
  id: string,
  updates: TaskUpdate,
): Promise<Task> {
  await requireUser();
  const supabase = await createClient();

  // Marcar como feita: regista quando e por quem
  if (updates.done === true) {
    const { data: { user } } = await supabase.auth.getUser();
    updates.done_at = new Date().toISOString();
    updates.done_by = user?.id ?? null;
  }
  // Voltar a abrir: limpa metadata
  if (updates.done === false) {
    updates.done_at = null;
    updates.done_by = null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data as Task;
}

export async function deleteTaskAction(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

// ============================================================
// Checklist pessoal (personal_checklist)
// ============================================================

export async function createChecklistItemAction(
  item: ChecklistItemInsert,
): Promise<ChecklistItem> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_checklist")
    .insert(item)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data as ChecklistItem;
}

export async function updateChecklistItemAction(
  id: string,
  updates: ChecklistItemUpdate,
): Promise<ChecklistItem> {
  await requireUser();
  const supabase = await createClient();

  if (updates.done === true) {
    updates.done_at = new Date().toISOString();
  }
  if (updates.done === false) {
    updates.done_at = null;
  }

  const { data, error } = await supabase
    .from("personal_checklist")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data as ChecklistItem;
}

export async function deleteChecklistItemAction(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("personal_checklist")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
