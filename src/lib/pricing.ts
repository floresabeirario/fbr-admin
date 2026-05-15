// ============================================================
// FBR Admin — Cálculo automático do orçamento + snapshot de preços
// ============================================================

import type {
  PricingItem,
  PricingSnapshot,
  PricingSnapshotLine,
} from "@/types/pricing";
import type { Order } from "@/types/database";

// Campos da encomenda usados no cálculo (subconjunto para minimizar
// acoplamento — server actions só precisam de garantir estes campos).
export interface OrderForPricing {
  frame_size: Order["frame_size"];
  frame_background: Order["frame_background"];
  pyramid_frame: Order["pyramid_frame"];
  extra_small_frames: Order["extra_small_frames"];
  extra_small_frames_qty: Order["extra_small_frames_qty"];
  christmas_ornaments: Order["christmas_ornaments"];
  christmas_ornaments_qty: Order["christmas_ornaments_qty"];
  necklace_pendants: Order["necklace_pendants"];
  necklace_pendants_qty: Order["necklace_pendants_qty"];
}

function findItem(
  items: PricingItem[],
  category: PricingItem["category"],
  key: string,
): PricingItem | undefined {
  return items.find(
    (i) => i.deleted_at === null && i.category === category && i.key === key,
  );
}

/**
 * Calcula um snapshot de preços para uma encomenda no momento actual.
 * Retorna `null` se não há informação suficiente (sem tamanho de moldura
 * conhecido — o orçamento fica manual nesse caso).
 *
 * Encomendas com `frame_size = voces_a_escolher` ou `nao_sei` recebem
 * snapshot `null` porque o preço-base não está determinado.
 */
export function computePricingSnapshot(
  order: OrderForPricing,
  pricing: PricingItem[],
): PricingSnapshot | null {
  if (
    !order.frame_size ||
    order.frame_size === "voces_a_escolher" ||
    order.frame_size === "nao_sei"
  ) {
    return null;
  }

  const lines: PricingSnapshotLine[] = [];

  // 1. Base por tamanho
  const base = findItem(pricing, "base_frame", order.frame_size);
  if (base) {
    lines.push({
      category: base.category,
      key: base.key,
      label: base.label,
      qty: 1,
      unit_price: base.price,
      subtotal: base.price,
    });
  }

  // 2. Suplemento de fundo (linha guardada mesmo quando 0, para
  //    transparência: o snapshot mostra que considerámos o fundo).
  //
  //    Caso especial: "fotografia" tem preço por tamanho da moldura
  //    (30x40 → 15€, 40x50 → 25€, 50x70 → 35€). Procura primeiro o
  //    item específico `fotografia_<size>`; se não existir, usa o
  //    genérico `fotografia` como fallback.
  if (order.frame_background) {
    let supp: PricingItem | undefined;
    if (order.frame_background === "fotografia") {
      supp =
        findItem(pricing, "background_supplement", `fotografia_${order.frame_size}`) ??
        findItem(pricing, "background_supplement", "fotografia");
    } else {
      supp = findItem(pricing, "background_supplement", order.frame_background);
    }
    if (supp) {
      lines.push({
        category: supp.category,
        key: supp.key,
        label: supp.label,
        qty: 1,
        unit_price: supp.price,
        subtotal: supp.price,
      });
    }
  }

  // 3. Extras por unidade — só conta se a opção for "sim" E houver qty > 0
  const extras: Array<{
    key: string;
    flag: typeof order.extra_small_frames;
    qty: number | null;
  }> = [
    {
      key: "mini_frame",
      flag: order.extra_small_frames,
      qty: order.extra_small_frames_qty,
    },
    {
      key: "christmas_ornament",
      flag: order.christmas_ornaments,
      qty: order.christmas_ornaments_qty,
    },
    {
      key: "necklace_pendant",
      flag: order.necklace_pendants,
      qty: order.necklace_pendants_qty,
    },
  ];

  for (const e of extras) {
    if (e.flag === "sim" && e.qty && e.qty > 0) {
      const item = findItem(pricing, "extra", e.key);
      if (item) {
        lines.push({
          category: item.category,
          key: item.key,
          label: item.label,
          qty: e.qty,
          unit_price: item.price,
          subtotal: item.price * e.qty,
        });
      }
    }
  }

  // 4. Moldura pirâmide — upsell visível ao cliente (cobrado).
  //    O preço é editável pela Maria em Finanças (pricing_items.extra.pyramid_frame).
  //    Quando o cliente não escolhe pirâmide, este item não entra no snapshot.
  if (order.pyramid_frame) {
    const pyr = findItem(pricing, "extra", "pyramid_frame");
    if (pyr) {
      lines.push({
        category: pyr.category,
        key: pyr.key,
        label: pyr.label,
        qty: 1,
        unit_price: pyr.price,
        subtotal: pyr.price,
      });
    }
  }

  const total = lines.reduce((s, l) => s + l.subtotal, 0);

  return {
    computed_at: new Date().toISOString(),
    total,
    lines,
  };
}

/**
 * Pré-visualização do orçamento *sem* persistir snapshot — usada na sheet
 * "Nova encomenda" para mostrar o cálculo enquanto a Maria digita.
 */
export function previewBudget(
  order: OrderForPricing,
  pricing: PricingItem[],
): { total: number; lines: PricingSnapshotLine[] } | null {
  const snap = computePricingSnapshot(order, pricing);
  if (!snap) return null;
  return { total: snap.total, lines: snap.lines };
}
