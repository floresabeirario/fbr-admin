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
  // Opcional para retro-compatibilidade: ausente = preservação. Só as
  // encomendas 'emoldurar_secas' usam a tabela de preços própria (secas_*).
  service_type?: Order["service_type"];
  frame_size: Order["frame_size"];
  frame_background: Order["frame_background"];
  // Opcional para retro-compatibilidade: ausente = trata como 'incluido'
  // (encomenda anterior à mig 104, vidro dentro do preço-base).
  museum_glass?: Order["museum_glass"];
  // Vidro dos mini-quadros, escolha própria (mig 105).
  museum_glass_mini?: Order["museum_glass_mini"];
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

  // Prefixo da chave base conforme o serviço: 'emoldurar_secas' usa a
  // tabela própria (secas_30x40 = 200€…), tudo o resto usa a base normal
  // da preservação (30x40 = 300€…). Só o preço-base difere — os
  // suplementos de fundo e os extras são partilhados.
  const baseKeyPrefix = order.service_type === "emoldurar_secas" ? "secas_" : "";

  // 1. Base por tamanho
  const base = findItem(pricing, "base_frame", `${baseKeyPrefix}${effectiveSize}`);
  // Sem base sequer → tabela mal configurada, não dá para calcular.
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

  // 2b. Suplemento do vidro museu (mig 104), por tamanho da moldura
  //     (30x40 → 45€, 40x50 → 65€, 50x70 → 115€). Só cobra quando o
  //     cliente escolheu 'sim'.
  //
  //     'incluido' é o legado: até 26/08/2026 todos os quadros levavam
  //     vidro museu dentro do preço-base, e essas encomendas NUNCA podem
  //     ganhar o suplemento — se ganhassem, decidir o tamanho da moldura
  //     na fase de design somaria +45€ a +115€ a quem já pagou. 'nao' e
  //     'nao_sei' também não cobram (vidro normal / por decidir).
  //
  //     Mesmo suplemento nos 3 serviços: o vidro é o mesmo, só o
  //     preço-base do quadro é que difere. Daí a chave sem prefixo.
  if (order.museum_glass === "sim") {
    const glass = findItem(
      pricing,
      "glass_supplement",
      `museum_glass_${effectiveSize}`,
    );
    if (glass) {
      lines.push({
        category: glass.category,
        key: glass.key,
        label: glass.label,
        qty: 1,
        unit_price: glass.price,
        subtotal: glass.price,
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

  // 3c. Vidro museu nos mini-quadros — escolha PRÓPRIA (mig 105), não
  //     herdada do quadro principal: o cliente pode querer museu no
  //     grande e normal nos pequenos, ou o inverso. Cada mini leva o seu
  //     vidro, por isso o suplemento (20€) multiplica pela quantidade,
  //     tal como o `fotografia_mini`. Em 'incluido' o vidro já vinha no
  //     preço-base também dos minis, por isso não cobra.
  if (
    order.museum_glass_mini === "sim" &&
    order.extra_small_frames === "sim" &&
    order.extra_small_frames_qty &&
    order.extra_small_frames_qty > 0
  ) {
    const miniGlass = findItem(pricing, "glass_supplement", "museum_glass_20x25");
    if (miniGlass && miniGlass.price > 0) {
      const qty = order.extra_small_frames_qty;
      lines.push({
        category: miniGlass.category,
        key: miniGlass.key,
        label: miniGlass.label,
        qty,
        unit_price: miniGlass.price,
        subtotal: miniGlass.price * qty,
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

// Valor a usar quando a tabela de preços não está disponível. Nunca deve
// acontecer em produção; existe para o formulário não ficar sem mínimo.
const VOUCHER_MIN_FALLBACK = 300;

/**
 * Valor mínimo de um vale-presente: o preço do quadro mais barato da
 * preservação, sem extras (decisão Maria 26/08/2026 — "o mínimo deve
 * corresponder sempre ao preço mais barato da preservação, sem extras
 * sem nada"). Sobe sozinho quando a moldura 30x40 subir em Finanças.
 *
 * Só afecta vales NOVOS: os já emitidos guardam o seu próprio valor.
 */
export function voucherMinAmount(pricing: PricingItem[]): number {
  const base = findItem(pricing, "base_frame", "30x40");
  const preco = Number(base?.price);
  return Number.isFinite(preco) && preco > 0 ? preco : VOUCHER_MIN_FALLBACK;
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
