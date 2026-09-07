// ============================================================
// Quadros principais adicionais (mig 107)
//
// `orders.additional_main_frames` é um objecto { tamanho: quantidade }
// com os quadros grandes que o cliente quer ALÉM do principal
// (`frame_size`). Ex.: {"30x40": 1, "50x70": 2}.
//
// Este módulo é a única leitura desse objecto: valida tamanhos e
// quantidades (a coluna é JSONB, pode vir qualquer coisa) e dá as
// formas que o resto do admin precisa. O site tem o espelho em
// app/_lib/orcamento.js (additionalFramesEntries).
// ============================================================

import type { AdditionalMainFrames, MainFrameSize } from "@/types/database";
import { FRAME_SIZE_LABELS } from "@/types/database";

export const MAIN_FRAME_SIZES: readonly MainFrameSize[] = ["30x40", "40x50", "50x70"];

/** Pares [tamanho, quantidade] válidos (inteiros > 0), na ordem dos tamanhos. */
export function additionalFramesEntries(
  value: AdditionalMainFrames | null | undefined,
): Array<[MainFrameSize, number]> {
  if (!value || typeof value !== "object") return [];
  const out: Array<[MainFrameSize, number]> = [];
  for (const size of MAIN_FRAME_SIZES) {
    const raw = (value as Record<string, unknown>)[size];
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isInteger(n) && n > 0) out.push([size, n]);
  }
  return out;
}

/** Total de quadros adicionais (0 quando não há). */
export function additionalFramesCount(value: AdditionalMainFrames | null | undefined): number {
  return additionalFramesEntries(value).reduce((s, [, q]) => s + q, 0);
}

/** "1× 30×40, 2× 50×70" ou "" quando não há. */
export function additionalFramesLabel(value: AdditionalMainFrames | null | undefined): string {
  return additionalFramesEntries(value)
    .map(([size, q]) => `${q}× ${FRAME_SIZE_LABELS[size]}`)
    .join(", ");
}
