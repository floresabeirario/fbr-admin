// ============================================================
// FBR Admin — Tipos TypeScript para o Livro de Receitas
// ============================================================

export type RecipeDifficulty = "facil" | "media" | "dificil" | "experimental";

export interface RecipeStep {
  order: number;
  title: string;
  body: string;
  photo_url?: string | null;
}

export interface RecipePhoto {
  url: string;
  caption?: string | null;
}

export interface Recipe {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  created_by_email: string | null;
  updated_by: string | null;

  flower_name: string;
  scientific_name: string | null;
  difficulty: RecipeDifficulty;
  press_days_min: number | null;
  press_days_max: number | null;
  intro: string | null;
  steps: RecipeStep[];
  observations: string | null;
  photos: RecipePhoto[];
  related_orders: string[];
}

export type RecipeInsert = Partial<Omit<Recipe, "id" | "created_at" | "updated_at">> & {
  flower_name: string;
};

export type RecipeUpdate = Partial<Omit<Recipe, "id" | "created_at">>;

// ── Labels & cores ───────────────────────────────────────────

export const RECIPE_DIFFICULTY_LABELS: Record<RecipeDifficulty, string> = {
  facil: "Fácil",
  media: "Média",
  dificil: "Difícil",
  experimental: "Experimental",
};

export const RECIPE_DIFFICULTY_COLORS: Record<RecipeDifficulty, string> = {
  facil:        "bg-emerald-100 text-emerald-800 border-emerald-300",
  media:        "bg-sky-100 text-sky-800 border-sky-300",
  dificil:      "bg-amber-100 text-amber-800 border-amber-300",
  experimental: "bg-violet-100 text-violet-800 border-violet-300",
};

export const RECIPE_DIFFICULTY_ORDER: RecipeDifficulty[] = [
  "facil",
  "media",
  "dificil",
  "experimental",
];
