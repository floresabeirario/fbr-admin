// ============================================================
// FBR Admin — Tipos da aba Ideias Futuras
// ============================================================

export type IdeaImportance = "baixa" | "media" | "alta" | "critica";

export type IdeaTheme =
  | "preservacao"
  | "vale_presente"
  | "parcerias"
  | "financas"
  | "comunicacao"
  | "design"
  | "tecnologia"
  | "outro";

export type IdeaStatus =
  | "proposta"
  | "em_avaliacao"
  | "planeada"
  | "em_curso"
  | "concluida"
  | "rejeitada";

export interface Idea {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  created_by_email: string | null;
  updated_by: string | null;

  title: string;
  description: string | null;
  importance: IdeaImportance;
  theme: IdeaTheme;
  status: IdeaStatus;
}

export type IdeaInsert = Pick<Idea, "title"> &
  Partial<Pick<Idea, "description" | "importance" | "theme" | "status" | "created_by_email">>;

export type IdeaUpdate = Partial<Pick<Idea, "title" | "description" | "importance" | "theme" | "status">>;

// ── Labels PT ─────────────────────────────────────────────────

export const IDEA_IMPORTANCE_LABELS: Record<IdeaImportance, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const IDEA_IMPORTANCE_ORDER: IdeaImportance[] = ["critica", "alta", "media", "baixa"];

export const IDEA_IMPORTANCE_COLORS: Record<IdeaImportance, string> = {
  baixa: "bg-stone-100 text-stone-700 border-stone-300",
  media: "bg-sky-100 text-sky-800 border-sky-300",
  alta: "bg-amber-100 text-amber-800 border-amber-300",
  critica: "bg-rose-100 text-rose-800 border-rose-300",
};

export const IDEA_THEME_LABELS: Record<IdeaTheme, string> = {
  preservacao: "Preservação",
  vale_presente: "Vale-Presente",
  parcerias: "Parcerias",
  financas: "Finanças",
  comunicacao: "Comunicação",
  design: "Design",
  tecnologia: "Tecnologia",
  outro: "Outro",
};

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  proposta: "Proposta",
  em_avaliacao: "Em avaliação",
  planeada: "Planeada",
  em_curso: "Em curso",
  concluida: "Concluída",
  rejeitada: "Rejeitada",
};

export const IDEA_STATUS_COLORS: Record<IdeaStatus, string> = {
  proposta: "bg-stone-100 text-stone-700 border-stone-300",
  em_avaliacao: "bg-sky-100 text-sky-800 border-sky-300",
  planeada: "bg-violet-100 text-violet-800 border-violet-300",
  em_curso: "bg-amber-100 text-amber-800 border-amber-300",
  concluida: "bg-emerald-100 text-emerald-800 border-emerald-300",
  rejeitada: "bg-stone-100 text-stone-500 border-stone-300 line-through",
};
