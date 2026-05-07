// ============================================================
// FBR Admin — Tipos para Tarefas (afazeres globais) e Checklist pessoal
// ============================================================

export type TaskPriority = "baixa" | "media" | "alta" | "urgente";

export interface Task {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;

  title: string;
  description: string | null;

  assignee_email: string | null;
  priority: TaskPriority;
  due_date: string | null;

  done: boolean;
  done_at: string | null;
  done_by: string | null;

  order_id: string | null;
}

export type TaskInsert = Partial<Omit<Task, "id" | "created_at" | "updated_at">> & {
  title: string;
};

export type TaskUpdate = Partial<Omit<Task, "id" | "created_at">>;

// ── Labels e cores ───────────────────────────────────────────

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  baixa:   "bg-slate-100 text-slate-700 border-slate-300",
  media:   "bg-sky-100 text-sky-800 border-sky-300",
  alta:    "bg-amber-100 text-amber-800 border-amber-300",
  urgente: "bg-rose-100 text-rose-800 border-rose-300",
};

// Ordem de prioridade para sort (urgente primeiro)
export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

// ── Checklist pessoal ────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  owner_email: string;
  text: string;
  done: boolean;
  done_at: string | null;
  position: number;
}

export type ChecklistItemInsert = Partial<Omit<ChecklistItem, "id" | "created_at" | "updated_at">> & {
  owner_email: string;
  text: string;
};

export type ChecklistItemUpdate = Partial<Omit<ChecklistItem, "id" | "created_at">>;
