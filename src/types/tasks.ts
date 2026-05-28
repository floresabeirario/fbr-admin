// ============================================================
// FBR Admin — Tipos para Tarefas (afazeres globais) e Checklist pessoal
// ============================================================

export type TaskPriority = "baixa" | "media" | "alta" | "urgente";

// Estado de trabalho (GTD-style). `done` é separado — marca-se com checkbox.
export type TaskStatus = "por_comecar" | "a_fazer_hoje" | "em_curso";

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
  status: TaskStatus;
  due_date: string | null;

  done: boolean;
  done_at: string | null;
  done_by: string | null;

  // Emails que já abriram o Dashboard depois desta tarefa lhes ser atribuída.
  // Usado para a bolinha de notificação na sidebar e o toast inicial.
  seen_by: string[];

  // Ligação opcional a uma encomenda OU a um vale (mig 052). No máximo um
  // dos dois está preenchido — o workbench onde a tarefa foi criada decide.
  order_id: string | null;
  voucher_id: string | null;

  // Valor associado à tarefa (€). Usado por templates `needs_amount`
  // (ex.: fatura) que perguntam o montante no diálogo de criação.
  // Mostra-se alinhado à direita na lista.
  amount: number | null;
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

// ── Estado de trabalho ───────────────────────────────────────

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  por_comecar: "Por começar",
  a_fazer_hoje: "A fazer hoje",
  em_curso: "Em curso",
};

// Abreviatura usada no pill compacto do card (espaço escasso).
export const TASK_STATUS_SHORT: Record<TaskStatus, string> = {
  por_comecar: "Por começar",
  a_fazer_hoje: "Hoje",
  em_curso: "Em curso",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  por_comecar:  "bg-slate-100 text-slate-600 border-slate-300",
  a_fazer_hoje: "bg-amber-100 text-amber-800 border-amber-300",
  em_curso:     "bg-sky-100 text-sky-800 border-sky-300",
};

// Bola pequena para o popover (item da lista de mudança de estado).
export const TASK_STATUS_DOT_COLOR: Record<TaskStatus, string> = {
  por_comecar:  "bg-slate-300",
  a_fazer_hoje: "bg-amber-500",
  em_curso:     "bg-sky-500",
};

// Ordem para sort: "em curso" primeiro (foco), depois "hoje", depois "por começar".
export const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  em_curso: 0,
  a_fazer_hoje: 1,
  por_comecar: 2,
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
  // Detalhes opcionais (mig 051). Aparece por baixo do título no tile.
  description: string | null;
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

// ── Templates de tarefas (mig 052) ───────────────────────────

export type TaskTemplateScope = "order" | "voucher" | "both";

export interface TaskTemplate {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  slug: string;
  name: string;

  // Suporta variáveis: {nome_cliente}, {nif}, {nome_parceiro},
  // {valor_comissao}, {valor}. Interpolação acontece no cliente.
  title_template: string;
  description_template: string | null;

  default_category: TaskCategory;
  default_priority: TaskPriority;

  // Quando true, criar a tarefa abre um diálogo a perguntar o valor
  // (€ a faturar, por exemplo). O valor escolhido vai para Task.amount
  // e a variável {valor} é substituída no título/descrição.
  needs_amount: boolean;
  amount_label: string | null;

  scope: TaskTemplateScope;
  position: number;
  is_seed: boolean;
}

export type TaskTemplateInsert = Partial<Omit<TaskTemplate, "id" | "created_at" | "updated_at">> & {
  slug: string;
  name: string;
  title_template: string;
};

export type TaskTemplateUpdate = Partial<Omit<TaskTemplate, "id" | "created_at" | "slug" | "is_seed">>;

// Lista de variáveis suportadas — mostrada na UI de gestão de templates
// (sessão D) para a Maria saber o que pode escrever.
export const TASK_TEMPLATE_VARIABLES: Array<{ key: string; description: string; scope: TaskTemplateScope }> = [
  { key: "{nome_cliente}",   description: "Nome do cliente (encomenda) ou remetente (vale)", scope: "both" },
  { key: "{nif}",            description: "NIF da encomenda (vazio mostra '—')",             scope: "order" },
  { key: "{nome_parceiro}",  description: "Nome do parceiro recomendador",                   scope: "order" },
  { key: "{valor_comissao}", description: "Comissão do parceiro formatada (€)",              scope: "order" },
  { key: "{valor}",          description: "Valor escolhido no diálogo (templates com `needs_amount`)", scope: "both" },
];

