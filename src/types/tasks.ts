// ============================================================
// FBR Admin — Tipos para Tarefas (afazeres globais) e Checklist pessoal
// ============================================================

export type TaskPriority = "baixa" | "media" | "alta" | "urgente";

export type TaskCategory =
  | "packaging"
  | "flores"
  | "presenca_online"
  | "estudio"
  | "administrativo"
  | "outros";

export interface Task {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;

  title: string;
  description: string | null;

  // Opção A: tarefa pode ter 2+ responsáveis; qualquer um marca como
  // concluída e desaparece da checklist de todos (completação partilhada).
  assignee_emails: string[];
  priority: TaskPriority;
  category: TaskCategory;
  due_date: string | null;

  done: boolean;
  done_at: string | null;
  done_by: string | null;

  // Emails que já abriram o Dashboard depois desta tarefa lhes ser atribuída.
  // Usado para a bolinha de notificação na sidebar e o toast inicial.
  seen_by: string[];

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

// ── Categorias ───────────────────────────────────────────────

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  packaging: "Packaging",
  flores: "Flores",
  presenca_online: "Presença online",
  estudio: "Estúdio",
  administrativo: "Administrativo",
  outros: "Outros",
};

// Cor de fundo + texto para cabeçalhos de grupo e badges inline.
// Escolhidas para serem distintas mas harmoniosas com a paleta cream/cocoa.
export const TASK_CATEGORY_COLORS: Record<TaskCategory, string> = {
  packaging:       "bg-amber-100 text-amber-800 border-amber-300",
  flores:          "bg-rose-100 text-rose-800 border-rose-300",
  presenca_online: "bg-sky-100 text-sky-800 border-sky-300",
  estudio:         "bg-violet-100 text-violet-800 border-violet-300",
  administrativo:  "bg-slate-100 text-slate-700 border-slate-300",
  outros:          "bg-stone-100 text-stone-700 border-stone-300",
};

// Ordem dos grupos na lista (packaging→flores→online→estúdio→admin→outros).
export const TASK_CATEGORY_ORDER: Record<TaskCategory, number> = {
  packaging: 0,
  flores: 1,
  presenca_online: 2,
  estudio: 3,
  administrativo: 4,
  outros: 5,
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

  // Paridade visual com tasks (mig 049). Sem assignee — owner_email já manda.
  priority: TaskPriority;
  due_date: string | null;
}

export type ChecklistItemInsert = Partial<Omit<ChecklistItem, "id" | "created_at" | "updated_at">> & {
  owner_email: string;
  text: string;
};

export type ChecklistItemUpdate = Partial<Omit<ChecklistItem, "id" | "created_at">>;
