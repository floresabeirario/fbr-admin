// ============================================================
// FBR Admin — Tipos para a tabela `competitors` (Finanças → Competição)
// ============================================================

export interface CompetitorPrice {
  product: string;       // ex.: "Quadro 30x40", "Pingente"
  price: number | null;  // em euros
  notes: string | null;
}

export interface Competitor {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  name: string;
  websites: string[];

  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  country: string | null;

  prices: CompetitorPrice[];

  notes: string | null;
}

export type CompetitorInsert = Partial<Omit<Competitor, "id" | "created_at" | "updated_at">> & {
  name: string;
};

export type CompetitorUpdate = Partial<Omit<Competitor, "id" | "created_at">>;
