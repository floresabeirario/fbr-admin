// ============================================================
// FBR Admin — Tipos da tabela de preços (Finanças)
// ============================================================

export type PricingCategory =
  | "base_frame"
  | "background_supplement"
  | "extra";

export interface PricingItem {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  category: PricingCategory;
  key: string;
  label: string;
  price: number;
  position: number;
  notes: string | null;
}

export type PricingItemInsert = Pick<
  PricingItem,
  "category" | "key" | "label" | "price"
> &
  Partial<Pick<PricingItem, "position" | "notes">>;

export type PricingItemUpdate = Partial<
  Pick<PricingItem, "label" | "price" | "position" | "notes">
>;

// ── Snapshot guardado em orders.pricing_snapshot ────────────

export interface PricingSnapshotLine {
  category: PricingCategory;
  key: string;
  label: string;
  qty: number;
  unit_price: number;
  subtotal: number;
}

export interface PricingSnapshot {
  computed_at: string;
  total: number;
  lines: PricingSnapshotLine[];
}

// ── Labels PT para a UI ──────────────────────────────────────

export const PRICING_CATEGORY_LABELS: Record<PricingCategory, string> = {
  base_frame: "Moldura (preço-base por tamanho)",
  background_supplement: "Suplemento por fundo",
  extra: "Extras por unidade",
};

export const PRICING_CATEGORY_HELPER: Record<PricingCategory, string> = {
  base_frame:
    "Preço fixo de cada tamanho de quadro. Define a base do orçamento.",
  background_supplement:
    "Suplemento aplicado por cima da base, consoante o fundo escolhido. Pode ser 0.",
  extra: "Cobrado por unidade (multiplicado pela quantidade).",
};
