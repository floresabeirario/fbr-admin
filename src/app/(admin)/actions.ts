"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/server";
import { sendPushToEmails } from "@/lib/push/send";
import type {
  Task,
  TaskInsert,
  TaskUpdate,
  ChecklistItem,
  ChecklistItemInsert,
  ChecklistItemUpdate,
} from "@/types/tasks";

// Notifica (push) quem foi atribuído a uma tarefa, exceto quem fez a
// atribuição (não faz sentido avisar-me de uma tarefa que eu próprio me
// dei). Best-effort e fora do caminho crítico (`after`): nunca atrasa nem
// faz falhar a criação/edição da tarefa.
function notifyTaskAssignees(assignees: string[], actor: string, task: Task) {
  const targets = assignees.filter((e) => e && e !== actor);
  if (targets.length === 0) return;
  after(async () => {
    try {
      const admin = createAdminClient();
      await sendPushToEmails(admin, targets, {
        title: "✅ Tarefa nova para ti",
        body: task.title,
        url: "/",
        tag: `task-${task.id}`,
      });
    } catch (err) {
      console.error("[push] notifyTaskAssignees falhou", err);
    }
  });
}

// ============================================================
// Afazeres globais (tasks)
// ============================================================

export async function createTaskAction(task: TaskInsert): Promise<Task> {
  const actor = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const created = data as Task;
  notifyTaskAssignees(created.assignee_emails ?? [], actor, created);
  revalidatePath("/");
  return created;
}

export async function updateTaskAction(
  id: string,
  updates: TaskUpdate,
): Promise<Task> {
  const actor = await requireUser();
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

  // Se os responsáveis vão mudar, buscamos os anteriores para notificar só
  // quem é NOVO na tarefa (não re-avisar quem já lá estava).
  let prevAssignees: string[] | null = null;
  if (updates.assignee_emails !== undefined) {
    const { data: prev } = await supabase
      .from("tasks")
      .select("assignee_emails")
      .eq("id", id)
      .single();
    prevAssignees = (prev?.assignee_emails as string[] | null) ?? [];
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const updated = data as Task;

  if (prevAssignees !== null) {
    const added = (updated.assignee_emails ?? []).filter(
      (e) => !prevAssignees!.includes(e),
    );
    notifyTaskAssignees(added, actor, updated);
  }

  revalidatePath("/");
  return updated;
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

// Marca um conjunto de tarefas como "vistas" pelo utilizador actual.
// Usa a RPC mark_tasks_seen (mig 044): SECURITY DEFINER cirúrgica que
// só consegue acrescentar o email do JWT ao array seen_by, e só se
// o utilizador estiver entre os assignees da tarefa.
export async function markTasksSeenAction(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_tasks_seen", { task_ids: taskIds });
  if (error) throw new Error(error.message);
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

// ============================================================
// Monitorização de erros (mig 086) — regista erros JS do browser
// ============================================================
// Best-effort: se falhar (mig por correr, offline), falha em silêncio
// — reportar um erro nunca pode causar outro erro visível.

export async function reportClientErrorAction(input: {
  message: string;
  stack?: string | null;
  path?: string | null;
  source?: "client" | "boundary";
}): Promise<void> {
  try {
    const email = await requireUser();
    const supabase = await createClient();
    await supabase.from("client_errors").insert({
      message: String(input.message ?? "sem mensagem").slice(0, 1000),
      stack: input.stack ? String(input.stack).slice(0, 4000) : null,
      path: input.path ? String(input.path).slice(0, 300) : null,
      source: input.source === "boundary" ? "boundary" : "client",
      user_email: email,
    });
  } catch {
    // silêncio intencional
  }
}
