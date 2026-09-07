import { describe, expect, it } from "vitest";
import { computePricingSnapshot, type OrderForPricing } from "../pricing";
import { computeProductionCost } from "../production-cost";
import { additionalFramesEntries, additionalFramesLabel } from "../additional-frames";
import type { ProductionCostSnapshot } from "@/types/production-cost";
import type { PricingItem } from "@/types/pricing";

// ============================================================
// Quadros principais adicionais (mig 107)
//
// Regra de negócio (Maria, 07/09/2026): cada quadro adicional entra pelo
// preço cheio do seu tamanho, com o mesmo fundo e a mesma escolha de
// vidro museu do principal. Encomendas antigas ({} ou coluna ausente)
// não mudam um cêntimo.
// ============================================================

function item(category: PricingItem["category"], key: string, price: number): PricingItem {
  return {
    id: `${category}-${key}`,
    created_at: "2026-09-07T00:00:00Z",
    updated_at: "2026-09-07T00:00:00Z",
    deleted_at: null,
    created_by: null,
    updated_by: null,
    category,
    key,
    label: key,
    price,
    position: 0,
    notes: null,
  };
}

const PRICING: PricingItem[] = [
  item("base_frame", "30x40", 300),
  item("base_frame", "40x50", 400),
  item("base_frame", "50x70", 500),
  item("base_frame", "secas_30x40", 200),
  item("base_frame", "secas_50x70", 360),
  item("background_supplement", "fotografia_30x40", 15),
  item("background_supplement", "fotografia_50x70", 35),
  item("background_supplement", "preto", 0),
  item("glass_supplement", "museum_glass_30x40", 45),
  item("glass_supplement", "museum_glass_50x70", 115),
];

const BASE: OrderForPricing = {
  frame_size: "30x40",
  frame_background: "preto",
  museum_glass: "nao",
  pyramid_frame: false,
  extra_small_frames: null,
  extra_small_frames_qty: null,
  christmas_ornaments: null,
  christmas_ornaments_qty: null,
  necklace_pendants: null,
  necklace_pendants_qty: null,
};

describe("additionalFramesEntries", () => {
  it("ignora lixo e quantidades inválidas, ordena pelos tamanhos", () => {
    expect(additionalFramesEntries(null)).toEqual([]);
    expect(additionalFramesEntries({})).toEqual([]);
    expect(
      additionalFramesEntries({ "50x70": 2, "30x40": 1, "40x50": 0, "20x25": 3, "30x40x": 1 } as never),
    ).toEqual([
      ["30x40", 1],
      ["50x70", 2],
    ]);
    expect(additionalFramesEntries({ "30x40": -1, "40x50": 1.5 } as never)).toEqual([]);
    expect(additionalFramesLabel({ "30x40": 1, "50x70": 2 })).toBe("1× 30×40, 2× 50×70");
    expect(additionalFramesLabel({})).toBe("");
  });
});

describe("orçamento com quadros principais adicionais", () => {
  it("sem adicionais, nada muda (ausente e {} dão o mesmo)", () => {
    const a = computePricingSnapshot(BASE, PRICING)!;
    const b = computePricingSnapshot({ ...BASE, additional_main_frames: {} }, PRICING)!;
    expect(a.total).toBe(300);
    expect(b.total).toBe(300);
    expect(b.lines.map((l) => [l.key, l.qty, l.subtotal])).toEqual(a.lines.map((l) => [l.key, l.qty, l.subtotal]));
  });

  it("soma o preço cheio de cada tamanho, multiplicado pela quantidade", () => {
    const snap = computePricingSnapshot(
      { ...BASE, additional_main_frames: { "30x40": 1, "50x70": 2 } },
      PRICING,
    )!;
    // 300 (principal) + 300 + 2×500
    expect(snap.total).toBe(1600);
    const adicionais = snap.lines.filter((l) => l.variant === "additional");
    expect(adicionais.map((l) => [l.key, l.qty, l.subtotal])).toEqual([
      ["30x40", 1, 300],
      ["50x70", 2, 1000],
    ]);
    // A linha do principal continua a ser a primeira base_frame (o site e
    // os templates contam com isso).
    expect(snap.lines[0]).toMatchObject({ category: "base_frame", key: "30x40", qty: 1 });
    expect(snap.lines[0].variant).toBeUndefined();
  });

  it("fotografia e vidro museu seguem o principal, por tamanho e quantidade", () => {
    const snap = computePricingSnapshot(
      {
        ...BASE,
        frame_background: "fotografia",
        museum_glass: "sim",
        additional_main_frames: { "50x70": 2 },
      },
      PRICING,
    )!;
    // principal: 300 + 15 + 45 = 360; adicionais: 2×(500 + 35 + 115) = 1300
    expect(snap.total).toBe(1660);
    const adicionais = snap.lines.filter((l) => l.variant === "additional");
    expect(adicionais.map((l) => [l.key, l.qty, l.subtotal])).toEqual([
      ["50x70", 2, 1000],
      ["fotografia_50x70", 2, 70],
      ["museum_glass_50x70", 2, 230],
    ]);
  });

  it("vidro 'nao'/'nao_sei' e fundos sem custo não geram linhas adicionais", () => {
    const snap = computePricingSnapshot(
      { ...BASE, museum_glass: "nao_sei", additional_main_frames: { "30x40": 1 } },
      PRICING,
    )!;
    expect(snap.lines.filter((l) => l.variant === "additional")).toHaveLength(1);
    expect(snap.total).toBe(600);
  });

  it("nas flores secas usa a tabela secas_* também nos adicionais", () => {
    const snap = computePricingSnapshot(
      { ...BASE, service_type: "emoldurar_secas", additional_main_frames: { "50x70": 1 } },
      PRICING,
    )!;
    expect(snap.total).toBe(200 + 360);
  });

  it("com o principal por decidir, os adicionais entram na mesma e o orçamento fica provisório", () => {
    const snap = computePricingSnapshot(
      { ...BASE, frame_size: "nao_sei", additional_main_frames: { "40x50": 1 } },
      PRICING,
    )!;
    expect(snap.provisional).toBe(true);
    expect(snap.total).toBe(300 + 400);
  });
});

describe("custo de produção com quadros principais adicionais", () => {
  const snapshot: ProductionCostSnapshot = {
    captured_at: "2026-09-07T00:00:00Z",
    items: [
      { kind: "frame", size_key: "30x40", frame_type: "baixa", glass_type: "vidro_cartao", cost: 40, label: null },
      { kind: "frame", size_key: "50x70", frame_type: "baixa", glass_type: "vidro_cartao", cost: 90, label: null },
      { kind: "photo_print", size_key: "50x70", frame_type: null, glass_type: null, cost: 12, label: null },
      { kind: "glass", size_key: "50x70", frame_type: null, glass_type: null, glass_grade: "museu", cost: 60, label: null },
      { kind: "glass", size_key: "50x70", frame_type: null, glass_type: null, glass_grade: "normal", cost: 20, label: null },
    ],
  };

  const order = {
    frame_size: "30x40" as const,
    frame_background: "fotografia" as const,
    museum_glass: "nao" as const,
    pyramid_frame: false,
    frame_internal_type: "baixa" as const,
    extra_small_frames: null,
    extra_small_frames_qty: null,
  };

  it("cada adicional soma a moldura, a impressão e o desconto do vidro normal, pela quantidade", () => {
    const sem = computeProductionCost(order, snapshot)!;
    const com = computeProductionCost({ ...order, additional_main_frames: { "50x70": 2 } }, snapshot)!;
    // 2 × (90 moldura + 12 impressão − 40 poupança do vidro normal)
    expect(com.total - sem.total).toBe(2 * (90 + 12 - 40));
    expect(com.lines.filter((l) => /adicional/i.test(l.label))).toHaveLength(3);
  });
});
