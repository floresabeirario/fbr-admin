import { describe, expect, it } from "vitest";
import { computePricingSnapshot, type OrderForPricing } from "../pricing";
import type { PricingItem } from "@/types/pricing";

// ============================================================
// Moldura pirâmide: suplemento POR TAMANHO (mig 110)
//
// Correcção da Maria na sessão 174: "moldura pirâmide tem suplemento por
// tamanho". Até à mig 110 havia um único item `pyramid_frame` por
// encomenda; passa a haver `pyramid_frame_<size>`, e o genérico fica só
// como fallback enquanto a migração não corre.
// ============================================================

function item(
  category: PricingItem["category"],
  key: string,
  price: number,
): PricingItem {
  return {
    id: `${category}-${key}`,
    created_at: "2026-09-17T00:00:00Z",
    updated_at: "2026-09-17T00:00:00Z",
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

const BASES: PricingItem[] = [
  item("base_frame", "30x40", 300),
  item("base_frame", "40x50", 400),
  item("base_frame", "50x70", 500),
];
const GENERICO = item("extra", "pyramid_frame", 50);
const POR_TAMANHO: PricingItem[] = [
  item("extra", "pyramid_frame_30x40", 40),
  item("extra", "pyramid_frame_40x50", 60),
  item("extra", "pyramid_frame_50x70", 80),
];
const PRICING: PricingItem[] = [...BASES, GENERICO, ...POR_TAMANHO];

const BASE_ORDER: OrderForPricing = {
  frame_size: "40x50",
  frame_background: null,
  pyramid_frame: true,
  extra_small_frames: null,
  extra_small_frames_qty: null,
  christmas_ornaments: null,
  christmas_ornaments_qty: null,
  necklace_pendants: null,
  necklace_pendants_qty: null,
};

function snap(order: Partial<OrderForPricing>, pricing: PricingItem[] = PRICING) {
  const s = computePricingSnapshot({ ...BASE_ORDER, ...order }, pricing);
  expect(s).not.toBeNull();
  return s!;
}

describe("suplemento da moldura pirâmide por tamanho", () => {
  it("soma o suplemento do tamanho da moldura, não o genérico", () => {
    expect(snap({ frame_size: "30x40" }).total).toBe(340);
    expect(snap({ frame_size: "40x50" }).total).toBe(460);
    expect(snap({ frame_size: "50x70" }).total).toBe(580);
    const keys = snap({ frame_size: "40x50" }).lines.map((l) => l.key);
    expect(keys).toContain("pyramid_frame_40x50");
    expect(keys).not.toContain("pyramid_frame");
  });

  it("sem pirâmide não entra nada", () => {
    const s = snap({ pyramid_frame: false });
    expect(s.total).toBe(400);
    expect(s.lines.some((l) => l.key.startsWith("pyramid_frame"))).toBe(false);
  });

  it("tamanho por decidir usa o 30x40 provisório, também no suplemento", () => {
    const s = snap({ frame_size: null });
    expect(s.provisional).toBe(true);
    expect(s.total).toBe(340);
  });

  it("antes da mig 110 (sem itens por tamanho) cai no genérico", () => {
    const s = snap({ frame_size: "50x70" }, [...BASES, GENERICO]);
    expect(s.total).toBe(550);
    expect(s.lines.map((l) => l.key)).toContain("pyramid_frame");
  });

  // Decisão da Maria (sessão 174): cada quadro adicional paga o suplemento
  // pirâmide do SEU tamanho, como já acontece com a fotografia e o vidro.
  it("cada quadro principal adicional paga o suplemento do seu tamanho", () => {
    const s = snap({ frame_size: "30x40", additional_main_frames: { "50x70": 2 } });
    // 300 + 40 (principal) + 2 × (500 + 80) (adicionais)
    expect(s.total).toBe(1500);
    const extra = s.lines.find((l) => l.key === "pyramid_frame_50x70");
    expect(extra).toBeDefined();
    expect(extra!.qty).toBe(2);
    expect(extra!.subtotal).toBe(160);
    expect(extra!.variant).toBe("additional");
  });

  it("suplemento a 0 não gera linha nos adicionais (como a fotografia e o vidro)", () => {
    const zero = [...BASES, item("extra", "pyramid_frame_30x40", 40), item("extra", "pyramid_frame_50x70", 0)];
    const s = snap({ frame_size: "30x40", additional_main_frames: { "50x70": 1 } }, zero);
    expect(s.total).toBe(840);
    expect(s.lines.filter((l) => l.key === "pyramid_frame_50x70")).toHaveLength(0);
  });
});
