// ============================================================
// FBR Admin — Cálculo de custo de produção (COGS) por encomenda
// ============================================================
// O snapshot guarda TODAS as linhas vigentes no momento da criação.
// O total é calculado on-the-fly aqui, lendo o snapshot + os campos
// actuais da encomenda. Assim a Maria pode mudar tipo de moldura
// interno, fundo, ou marcar pirâmide depois da criação que o cálculo
// reflecte sem precisar de "recapturar" custos.

import type { Order } from "@/types/database";
import {
  type ProductionCostItem,
  type ProductionCostSnapshot,
  type ProductionCostSnapshotLine,
  backgroundToGlassType,
  effectiveFrameType,
  frameSizeToCostSize,
} from "@/types/production-cost";

// ── Snapshot ─────────────────────────────────────────────────

export function buildProductionCostSnapshot(
  items: ProductionCostItem[],
): ProductionCostSnapshot {
  const active = items.filter((i) => i.deleted_at === null);
  return {
    captured_at: new Date().toISOString(),
    items: active.map((i) => ({
      kind: i.kind,
      size_key: i.size_key,
      frame_type: i.frame_type,
      glass_type: i.glass_type,
      glass_grade: i.glass_grade,
      label: i.label,
      cost: i.cost,
    })),
  };
}

// ── Cálculo do total ─────────────────────────────────────────

export interface ProductionCostBreakdownLine {
  label: string;
  qty: number;
  unit_cost: number;
  subtotal: number;
}

export interface ProductionCostBreakdown {
  total: number;
  lines: ProductionCostBreakdownLine[];
  // Razões pelas quais o cálculo está parcialmente indeterminado
  // (campos em falta na encomenda). Mostradas no workbench como dica.
  missing: string[];
}

interface OrderFieldsForCost {
  frame_size: Order["frame_size"];
  frame_background: Order["frame_background"];
  // Opcional: encomendas anteriores à mig 104 não o têm, e nesse caso
  // trata-se como vidro museu (que é o que levaram).
  museum_glass?: Order["museum_glass"];
  museum_glass_mini?: Order["museum_glass_mini"];
  pyramid_frame: Order["pyramid_frame"];
  frame_internal_type: Order["frame_internal_type"];
  extra_small_frames: Order["extra_small_frames"];
  extra_small_frames_qty: Order["extra_small_frames_qty"];
}

function findFrameLine(
  snapshot: ProductionCostSnapshot,
  size: string,
  frameType: string,
  glassType: string,
): ProductionCostSnapshotLine | undefined {
  return snapshot.items.find(
    (l) =>
      l.kind === "frame" &&
      l.size_key === size &&
      l.frame_type === frameType &&
      l.glass_type === glassType,
  );
}

function findGlassLine(
  snapshot: ProductionCostSnapshot,
  size: string,
  grade: "normal" | "museu",
): ProductionCostSnapshotLine | undefined {
  return snapshot.items.find(
    (l) => l.kind === "glass" && l.size_key === size && l.glass_grade === grade,
  );
}

/**
 * Quanto se poupa num quadro deste tamanho por levar vidro normal em vez
 * de vidro museu. Zero quando o snapshot é anterior à mig 105 (não tem as
 * linhas kind='glass') — nesse caso não se inventa desconto nenhum.
 */
function glassSaving(snapshot: ProductionCostSnapshot, size: string): number {
  const museu = findGlassLine(snapshot, size, "museu");
  const normal = findGlassLine(snapshot, size, "normal");
  if (!museu || !normal) return 0;
  const diff = museu.cost - normal.cost;
  return diff > 0 ? diff : 0;
}

function findPhotoPrintLine(
  snapshot: ProductionCostSnapshot,
  size: string,
): ProductionCostSnapshotLine | undefined {
  return snapshot.items.find(
    (l) => l.kind === "photo_print" && l.size_key === size,
  );
}

export function computeProductionCost(
  order: OrderFieldsForCost,
  snapshot: ProductionCostSnapshot | null,
): ProductionCostBreakdown | null {
  if (!snapshot) return null;

  const lines: ProductionCostBreakdownLine[] = [];
  const missing: string[] = [];

  const sizeKey = frameSizeToCostSize(order.frame_size);
  const glassType = backgroundToGlassType(order.frame_background);
  const frameType = effectiveFrameType(
    order.pyramid_frame,
    order.frame_internal_type,
  );

  if (!sizeKey) missing.push("tamanho da moldura");
  if (!glassType) missing.push("tipo de fundo");
  if (!frameType) missing.push("tipo de moldura (baixa/caixa/pirâmide)");

  // 1. Moldura principal
  if (sizeKey && glassType && frameType) {
    const line = findFrameLine(snapshot, sizeKey, frameType, glassType);
    if (line) {
      lines.push({
        label: `Quadro ${sizeLabel(sizeKey)} — ${frameTypeLabel(frameType)} · ${glassLabel(glassType)}`,
        qty: 1,
        unit_cost: line.cost,
        subtotal: line.cost,
      });
    }
  }

  // 2. Impressão de fotografia (somada quando fundo=fotografia)
  if (order.frame_background === "fotografia" && sizeKey) {
    const photo = findPhotoPrintLine(snapshot, sizeKey);
    if (photo) {
      lines.push({
        label: `Impressão fotografia — ${sizeLabel(sizeKey)}`,
        qty: 1,
        unit_cost: photo.cost,
        subtotal: photo.cost,
      });
    }
  }

  // 3. Mini-quadros extra (20x25) — multiplicado pela qty escolhida pelo cliente.
  //    Usam o mesmo frame_type e glass_type do quadro principal.
  if (
    order.extra_small_frames === "sim" &&
    order.extra_small_frames_qty &&
    order.extra_small_frames_qty > 0 &&
    frameType &&
    glassType
  ) {
    const mini = findFrameLine(snapshot, "mini_20x25", frameType, glassType);
    if (mini) {
      const qty = order.extra_small_frames_qty;
      lines.push({
        label: `Mini-quadros 20x25 × ${qty} — ${frameTypeLabel(frameType)} · ${glassLabel(glassType)}`,
        qty,
        unit_cost: mini.cost,
        subtotal: mini.cost * qty,
      });
    }
  }

  // 3b. Vidro normal em vez de vidro museu (mig 105).
  //     Os custos das molduras (kind='frame') assumem vidro museu, porque
  //     até 26/08/2026 todos os quadros o levavam. Quando o cliente
  //     escolhe vidro normal, devolve-se a diferença: uma linha negativa,
  //     visível no detalhe, em vez de um número que muda sem explicação.
  //
  //     Só desconta em 'nao' (decisão firme). Em 'sim' e 'incluido' o
  //     quadro leva mesmo vidro museu; em 'nao_sei' fica o custo maior,
  //     para a margem não aparecer inflacionada antes de a escolha estar
  //     fechada. Ausente (encomenda anterior à mig 104) = levou museu.
  if (order.museum_glass === "nao" && sizeKey) {
    const saving = glassSaving(snapshot, sizeKey);
    if (saving > 0) {
      lines.push({
        label: `Vidro normal em vez de museu (${sizeLabel(sizeKey)})`,
        qty: 1,
        unit_cost: -saving,
        subtotal: -saving,
      });
    }
  }

  // 3c. O mesmo para os mini-quadros, que têm escolha de vidro PRÓPRIA
  //     (mig 105): o cliente pode querer museu no grande e normal nos
  //     pequenos, ou o inverso. Cada mini leva o seu vidro, por isso o
  //     desconto multiplica pela quantidade.
  if (
    order.museum_glass_mini === "nao" &&
    order.extra_small_frames === "sim" &&
    order.extra_small_frames_qty &&
    order.extra_small_frames_qty > 0
  ) {
    const miniSaving = glassSaving(snapshot, "mini_20x25");
    if (miniSaving > 0) {
      const qty = order.extra_small_frames_qty;
      lines.push({
        label: `Vidro normal em vez de museu (20x25) × ${qty}`,
        qty,
        unit_cost: -miniSaving,
        subtotal: -miniSaving * qty,
      });
    }
  }

  // 4. Consumíveis (caixa, autocolante, lavanda, cartão informativo,
  //    padding, sílica, sacos, etc.) — somados a TODAS as encomendas
  //    consoante o tamanho da moldura principal. Cada encomenda leva
  //    uma unidade de cada (não escalam com mini-quadros).
  if (sizeKey) {
    const consumables = snapshot.items.filter(
      (l) => l.kind === "consumable" && l.size_key === sizeKey,
    );
    for (const c of consumables) {
      if (!c.label) continue;
      lines.push({
        label: c.label,
        qty: 1,
        unit_cost: c.cost,
        subtotal: c.cost,
      });
    }
  }

  const total = lines.reduce((s, l) => s + l.subtotal, 0);

  return { total, lines, missing };
}

// ── Helpers de labels (duplicados para não importar de production-cost.ts
// indirectamente nesta camada utilitária — labels mais curtas/contextuais) ──

function sizeLabel(s: string): string {
  switch (s) {
    case "30x40": return "30x40";
    case "40x50": return "40x50";
    case "50x70": return "50x70";
    case "mini_20x25": return "20x25";
    default: return s;
  }
}

function frameTypeLabel(f: string): string {
  switch (f) {
    case "baixa": return "Baixa";
    case "caixa": return "Caixa";
    case "piramide": return "Pirâmide";
    default: return f;
  }
}

function glassLabel(g: string): string {
  switch (g) {
    case "vidro_vidro": return "vidro/vidro";
    case "vidro_cartao": return "vidro/cartão";
    default: return g;
  }
}
