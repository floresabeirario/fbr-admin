import { describe, expect, it } from "vitest";
import { computePricingSnapshot, type OrderForPricing } from "../pricing";
import { computeProductionCost } from "../production-cost";
import type { ProductionCostSnapshot } from "@/types/production-cost";
import type { PricingItem } from "@/types/pricing";

// ============================================================
// Vidro museu como opção paga (mig 104)
//
// A regra que estes testes protegem é de negócio, não de código: as
// encomendas anteriores a 26/08/2026 levaram vidro museu dentro do
// preço-base e NUNCA podem ganhar o suplemento. Se ganhassem, decidir o
// tamanho da moldura na fase de design (que dispara o recálculo
// automático do orçamento) somaria +45€ a +115€ a clientes que já
// pagaram.
// ============================================================

function item(
  category: PricingItem["category"],
  key: string,
  price: number,
): PricingItem {
  return {
    id: `${category}-${key}`,
    created_at: "2026-08-26T00:00:00Z",
    updated_at: "2026-08-26T00:00:00Z",
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
  item("base_frame", "secas_40x50", 270),
  item("glass_supplement", "museum_glass_30x40", 45),
  item("glass_supplement", "museum_glass_40x50", 65),
  item("glass_supplement", "museum_glass_50x70", 115),
  item("glass_supplement", "museum_glass_20x25", 20),
  item("extra", "mini_frame", 90),
];

const BASE_ORDER: OrderForPricing = {
  frame_size: "40x50",
  frame_background: null,
  pyramid_frame: false,
  extra_small_frames: null,
  extra_small_frames_qty: null,
  christmas_ornaments: null,
  christmas_ornaments_qty: null,
  necklace_pendants: null,
  necklace_pendants_qty: null,
};

function total(order: Partial<OrderForPricing>): number {
  const snap = computePricingSnapshot({ ...BASE_ORDER, ...order }, PRICING);
  expect(snap).not.toBeNull();
  return snap!.total;
}

describe("suplemento do vidro museu", () => {
  it('soma o suplemento do tamanho certo quando é "sim"', () => {
    expect(total({ frame_size: "30x40", museum_glass: "sim" })).toBe(345);
    expect(total({ frame_size: "40x50", museum_glass: "sim" })).toBe(465);
    expect(total({ frame_size: "50x70", museum_glass: "sim" })).toBe(615);
  });

  it('NÃO soma nada quando é "incluido" (encomenda antiga já o pagou)', () => {
    expect(total({ museum_glass: "incluido" })).toBe(400);
  });

  it('NÃO soma nada quando é "nao" nem "nao_sei"', () => {
    expect(total({ museum_glass: "nao" })).toBe(400);
    expect(total({ museum_glass: "nao_sei" })).toBe(400);
  });

  it("trata a ausência do campo como encomenda antiga (não cobra)", () => {
    expect(total({})).toBe(400);
  });

  it("usa o mesmo suplemento no serviço de flores secas", () => {
    // Base própria (270€) mas o vidro é o mesmo do tamanho (65€).
    expect(
      total({
        service_type: "emoldurar_secas",
        frame_size: "40x50",
        museum_glass: "sim",
      }),
    ).toBe(335);
  });

  it("com tamanho por decidir usa o suplemento da 30x40 (o mais barato)", () => {
    // Mesma filosofia do orçamento provisório: o sinal pedido nunca fica
    // acima do que o cliente acabará por pagar.
    const snap = computePricingSnapshot(
      { ...BASE_ORDER, frame_size: "nao_sei", museum_glass: "sim" },
      PRICING,
    );
    expect(snap!.provisional).toBe(true);
    expect(snap!.total).toBe(345);
  });

  it("cobra o vidro museu por cada mini-quadro (mig 105)", () => {
    // 400 (base) + 65 (vidro do principal) + 2×90 (minis) + 2×20 (vidro dos minis)
    expect(
      total({
        museum_glass: "sim",
        museum_glass_mini: "sim",
        extra_small_frames: "sim",
        extra_small_frames_qty: 2,
      }),
    ).toBe(685);
  });

  it("o vidro dos minis é escolha independente do quadro principal", () => {
    // Museu no grande, normal nos pequenos: 400 + 65 + 2×90 = 645.
    expect(
      total({
        museum_glass: "sim",
        museum_glass_mini: "nao",
        extra_small_frames: "sim",
        extra_small_frames_qty: 2,
      }),
    ).toBe(645);
    // E o inverso: normal no grande, museu nos pequenos: 400 + 2×90 + 2×20 = 620.
    expect(
      total({
        museum_glass: "nao",
        museum_glass_mini: "sim",
        extra_small_frames: "sim",
        extra_small_frames_qty: 2,
      }),
    ).toBe(620);
  });

  it('não cobra o vidro dos minis quando é "incluido"', () => {
    // A encomenda antiga já pagou o vidro dentro do preço-base, também nos minis.
    expect(
      total({
        museum_glass: "incluido",
        museum_glass_mini: "incluido",
        extra_small_frames: "sim",
        extra_small_frames_qty: 2,
      }),
    ).toBe(580);
  });

  it("guarda uma linha própria no snapshot, para a mensagem ao cliente", () => {
    const snap = computePricingSnapshot(
      { ...BASE_ORDER, museum_glass: "sim" },
      PRICING,
    );
    const linha = snap!.lines.find((l) => l.category === "glass_supplement");
    expect(linha).toMatchObject({
      key: "museum_glass_40x50",
      qty: 1,
      subtotal: 65,
    });
  });
});

// ============================================================
// Custo de produção (mig 105)
//
// Os custos das molduras assumem vidro museu, porque até 26/08/2026 todos
// os quadros o levavam. Quando o cliente escolhe vidro normal, o cálculo
// devolve a diferença numa linha negativa.
// ============================================================

const COST_SNAPSHOT: ProductionCostSnapshot = {
  captured_at: "2026-08-26T00:00:00Z",
  items: [
    // Moldura 30x40 baixa, vidro sobre cartão (fundo opaco) — já com vidro museu.
    { kind: "frame", size_key: "30x40", frame_type: "baixa", glass_type: "vidro_cartao", glass_grade: null, label: null, cost: 50.4 },
    { kind: "frame", size_key: "mini_20x25", frame_type: "baixa", glass_type: "vidro_cartao", glass_grade: null, label: null, cost: 36.1 },
    // Vidro avulso, para saber a diferença (mig 105).
    { kind: "glass", size_key: "30x40", frame_type: null, glass_type: null, glass_grade: "normal", label: null, cost: 3.96 },
    { kind: "glass", size_key: "30x40", frame_type: null, glass_type: null, glass_grade: "museu", label: null, cost: 22.5 },
    { kind: "glass", size_key: "mini_20x25", frame_type: null, glass_type: null, glass_grade: "normal", label: null, cost: 1.65 },
    { kind: "glass", size_key: "mini_20x25", frame_type: null, glass_type: null, glass_grade: "museu", label: null, cost: 9.38 },
  ],
};

const BASE_COST_ORDER = {
  frame_size: "30x40" as const,
  frame_background: "preto" as const,
  pyramid_frame: false,
  frame_internal_type: "baixa" as const,
  extra_small_frames: null,
  extra_small_frames_qty: null,
};

function custo(o: Record<string, unknown>): number {
  const bd = computeProductionCost({ ...BASE_COST_ORDER, ...o }, COST_SNAPSHOT);
  return Math.round((bd?.total ?? 0) * 100) / 100;
}

describe("custo de produção do vidro", () => {
  it('desconta a diferença quando o cliente escolhe vidro normal', () => {
    // 50,40 menos (22,50 menos 3,96) = 31,86
    expect(custo({ museum_glass: "nao" })).toBe(31.86);
  });

  it('não desconta em "sim", "incluido" nem "nao_sei"', () => {
    expect(custo({ museum_glass: "sim" })).toBe(50.4);
    expect(custo({ museum_glass: "incluido" })).toBe(50.4);
    // "nao_sei" fica no custo maior de propósito: mais vale a margem
    // aparecer conservadora do que inflacionada antes de o cliente decidir.
    expect(custo({ museum_glass: "nao_sei" })).toBe(50.4);
  });

  it("desconta também o vidro de cada mini-quadro", () => {
    // 50,40 + 2×36,10 menos 18,54 menos 2×7,73 = 88,60
    expect(
      custo({
        museum_glass: "nao",
        museum_glass_mini: "nao",
        extra_small_frames: "sim",
        extra_small_frames_qty: 2,
      }),
    ).toBe(88.6);
  });

  it("o desconto dos minis segue a escolha deles, não a do principal", () => {
    // Museu no grande, normal nos 2 minis: 50,40 + 2×36,10 menos 2×7,73 = 107,14
    expect(
      custo({
        museum_glass: "sim",
        museum_glass_mini: "nao",
        extra_small_frames: "sim",
        extra_small_frames_qty: 2,
      }),
    ).toBe(107.14);
    // Normal no grande, museu nos minis: 50,40 + 2×36,10 menos 18,54 = 104,06
    expect(
      custo({
        museum_glass: "nao",
        museum_glass_mini: "sim",
        extra_small_frames: "sim",
        extra_small_frames_qty: 2,
      }),
    ).toBe(104.06);
  });

  it("snapshot antigo (sem linhas de vidro) não inventa desconto", () => {
    const antigo: ProductionCostSnapshot = {
      captured_at: "2026-05-01T00:00:00Z",
      items: COST_SNAPSHOT.items.filter((i) => i.kind !== "glass"),
    };
    const bd = computeProductionCost(
      { ...BASE_COST_ORDER, museum_glass: "nao" },
      antigo,
    );
    expect(bd?.total).toBe(50.4);
  });
});
