"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import type {
  TaskTemplateInsert,
  TaskTemplateUpdate,
} from "@/types/tasks";

export async function createTaskTemplateAction(
  input: TaskTemplateInsert,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").insert({
    slug: input.slug,
    name: input.name,
    title_template: input.title_template,
    description_template: input.description_template ?? null,
    default_category: input.default_category ?? "outros",
    default_priority: input.default_priority ?? "media",
    needs_amount: input.needs_amount ?? false,
    amount_label: input.amount_label ?? null,
    scope: input.scope ?? "order",
    position: input.position ?? 0,
    is_seed: false,
  });
  if (error) throw new Error(`Não foi possível criar o template: ${error.message}`);
  revalidatePath("/settings/templates-tarefas");
}

export async function updateTaskTemplateAction(
  id: string,
  patch: TaskTemplateUpdate,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  // slug e is_seed não devem ser editáveis via UI normal.
  const safe = { ...patch } as Record<string, unknown>;
  delete safe.slug;
  delete safe.is_seed;
  const { error } = await supabase
    .from("task_templates")
    .update(safe)
    .eq("id", id);
  if (error) throw new Error(`Não foi possível guardar o template: ${error.message}`);
  revalidatePath("/settings/templates-tarefas");
}

export async function archiveTaskTemplateAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Não foi possível arquivar o template: ${error.message}`);
  revalidatePath("/settings/templates-tarefas");
}

export async function restoreTaskTemplateAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_templates")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(`Não foi possível restaurar o template: ${error.message}`);
  revalidatePath("/settings/templates-tarefas");
}
