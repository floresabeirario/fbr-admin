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

// Tamanho de referência usado para o orçamento provisório quando o
// cliente ainda não escolheu a moldura. É a moldura mais barata (30x40,
// 300€) — o "valor mínimo" da spec. O sinal pedido nunca fica acima do
// que o cliente acabará por pagar.
const PROVISIONAL_FRAME_SIZE = "30x40" as const;

/**
 * Calcula um snapshot de preços para uma encomenda no momento actual.
 *
 * Quando o tamanho da moldura ainda não foi decidido (`frame_size`
 * indefinido, `voces_a_escolher` ou `nao_sei`), devolve um snapshot
 * **provisório** baseado na 30x40 (300€) — o tamanho normalmente é
 * decidido na fase de design, mas assim já é possível pedir o sinal.
 * O snapshot fica marcado `provisional: true` para a UI distinguir.
 *
 * Só devolve `null` quando nem sequer existe a base 30x40 na tabela de
 * preços (situação anómala — tabela mal configurada).
 */
export function computePricingSnapshot(
  order: OrderForPricing,
  pricing: PricingItem[],
): PricingSnapshot | null {
  const sizeUndecided =
    !order.frame_size ||
    order.frame_size === "voces_a_escolher" ||
    order.frame_size === "nao_sei";

  // Tamanho efectivo para o cálculo: o escolhido, ou a 30x40 provisória.
  // (Quando sizeUndecided é false, frame_size é garantidamente não-nulo.)
  const effectiveSize: string = sizeUndecided
    ? PROVISIONAL_FRAME_SIZE
    : (order.frame_size as string);

  const lines: PricingSnapshotLine[] = [];

  // 1. Base por tamanho
  const base = findItem(pricing, "base_frame", effectiveSize);
  // Sem base 30x40 sequer → tabela mal configurada, não dá para calcular.
  if (sizeUndecided && !base) return null;
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
        findItem(pricing, "background_supplement", `fotografia_${effectiveSize}`) ??
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

  // 3b. Suplemento foto por mini — quando o cliente tem mini-quadros E
  //     o fundo é fotografia, somar o suplemento `fotografia_mini` por
  //     cada mini. (O suplemento do quadro principal já foi somado em 2.)
  if (
    order.frame_background === "fotografia" &&
    order.extra_small_frames === "sim" &&
    order.extra_small_frames_qty &&
    order.extra_small_frames_qty > 0
  ) {
    const miniSupp = findItem(pricing, "background_supplement", "fotografia_mini");
    if (miniSupp && miniSupp.price > 0) {
      const qty = order.extra_small_frames_qty;
      lines.push({
        category: miniSupp.category,
        key: miniSupp.key,
        label: miniSupp.label,
        qty,
        unit_price: miniSupp.price,
        subtotal: miniSupp.price * qty,
      });
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
    ...(sizeUndecided ? { provisional: true } : {}),
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
