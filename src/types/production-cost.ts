// ============================================================
// FBR Admin — Tipos da tabela de custos de produção (Finanças)
// ============================================================
// Distinto dos `pricing_items` (preço de venda ao cliente). Estes
// são os custos REAIS que a FBR tem em produzir cada quadro:
// moldura, embalagem, cartão informativo, enchimento, autocolante,
// impressão (quando há fundo fotografia), etc.
//
// Capturado em snapshot por encomenda igual ao pricing_snapshot:
// alterações futuras a esta tabela não recalculam encomendas antigas.

export type ProductionCostKind = "frame" | "photo_print";

export type ProductionCostSize = "30x40" | "40x50" | "50x70" | "mini_20x25";

export type ProductionFrameType = "baixa" | "caixa" | "piramide";

export type ProductionGlassType = "vidro_vidro" | "vidro_cartao";

export interface ProductionCostItem {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  kind: ProductionCostKind;
  size_key: ProductionCostSize;
  frame_type: ProductionFrameType | null;   // só para kind='frame'
  glass_type: ProductionGlassType | null;   // só para kind='frame'
  cost: number;
  position: number;
  notes: string | null;
}

export type ProductionCostItemUpdate = Partial<
  Pick<ProductionCostItem, "cost" | "notes" | "position">
>;

// ── Snapshot guardado em orders.production_cost_snapshot ─────
// Estratégia: copiamos TODAS as linhas activas da tabela no momento
// da criação da encomenda. O total é calculado on-the-fly a partir
// desta cópia + dos campos actuais da encomenda (frame_size,
// frame_background, pyramid_frame, frame_internal_type, extra_small_frames).
// Assim a Maria pode mexer nos campos da encomenda depois (mudar
// fundo, mudar tipo de moldura interno) que o cálculo respeita os
// custos vigentes na altura.

export interface ProductionCostSnapshotLine {
  kind: ProductionCostKind;
  size_key: ProductionCostSize;
  frame_type: ProductionFrameType | null;
  glass_type: ProductionGlassType | null;
  cost: number;
}

export interface ProductionCostSnapshot {
  captured_at: string;
  items: ProductionCostSnapshotLine[];
}

// ── Labels PT ────────────────────────────────────────────────

export const PRODUCTION_SIZE_LABELS: Record<ProductionCostSize, string> = {
  "30x40": "30x40 (A3)",
  "40x50": "40x50",
  "50x70": "50x70",
  mini_20x25: "20x25 (mini)",
};

export const PRODUCTION_FRAME_TYPE_LABELS: Record<ProductionFrameType, string> = {
  baixa: "Moldura baixa (2x2cm)",
  caixa: "Moldura caixa (2x3cm)",
  piramide: "Moldura pirâmide",
};

export const PRODUCTION_FRAME_TYPE_SHORT: Record<ProductionFrameType, string> = {
  baixa: "Baixa",
  caixa: "Caixa",
  piramide: "Pirâmide",
};

export const PRODUCTION_GLASS_TYPE_LABELS: Record<ProductionGlassType, string> = {
  vidro_vidro: "Vidro sobre vidro",
  vidro_cartao: "Vidro sobre cartão",
};

// Mapeamento do tipo de fundo (cliente) para o tipo de vidro (interno).
// "transparente" = vidro_vidro; restantes (preto/branco/cor/fotografia) = vidro_cartao.
// Valores "voces_a_escolher" / "nao_sei" retornam null (ainda indeterminado).
export function backgroundToGlassType(
  bg: string | null | undefined,
): ProductionGlassType | null {
  if (!bg) return null;
  if (bg === "transparente") return "vidro_vidro";
  if (bg === "preto" || bg === "branco" || bg === "cor" || bg === "fotografia") {
    return "vidro_cartao";
  }
  return null;
}

// Mapeamento de FrameSize (campo do cliente, 30x40/40x50/50x70) para
// a chave da nossa tabela de custos. "voces_a_escolher" / "nao_sei"
// retornam null.
export function frameSizeToCostSize(
  size: string | null | undefined,
): ProductionCostSize | null {
  if (!size) return null;
  if (size === "30x40" || size === "40x50" || size === "50x70") return size;
  return null;
}

// Tipo de moldura efectivo, dado pyramid_frame + frame_internal_type.
// - pyramid_frame=true → 'piramide' (sempre)
// - pyramid_frame=false → frame_internal_type ('baixa' | 'caixa') ou null se indeterminado.
export function effectiveFrameType(
  pyramidFrame: boolean,
  frameInternalType: string | null | undefined,
): ProductionFrameType | null {
  if (pyramidFrame) return "piramide";
  if (frameInternalType === "baixa" || frameInternalType === "caixa") {
    return frameInternalType;
  }
  return null;
}
