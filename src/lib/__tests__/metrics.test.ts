// ============================================================
// Testes das Métricas — fixam as 4 correcções da auditoria da
// sessão 113 (canceladas fora da receita, janela pela data do
// evento, comissões dos parceiros, baseline por preset).
// ============================================================

import { describe, it, expect } from "vitest";
import {
  computeMetrics,
  rangeFromPreset,
  baselineRangeForPreset,
  pctChange,
  type DateRange,
} from "@/lib/metrics";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";

// Junho de 2026 como período de teste.
const RANGE: DateRange = {
  start: new Date(2026, 5, 1),
  end: new Date(2026, 5, 30, 23, 59, 59),
};
const TODAY = new Date(2026, 5, 12);

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: "2026-06-05T10:00:00.000Z",
    updated_at: "2026-06-05T10:00:00.000Z",
    event_date: "2026-06-10",
    status: "flores_na_prensa",
    payment_status: "100_pago",
    budget: 100,
    partner_id: null,
    partner_commission: null,
    partner_commission_status: "na",
    coupon_status: "na",
    extras_in_frame: null,
    extra_small_frames: null,
    christmas_ornaments: null,
    necklace_pendants: null,
    ...partial,
  } as unknown as Order;
}

function makeVoucher(partial: Partial<Voucher>): Voucher {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: "2026-06-05T10:00:00.000Z",
    payment_status: "100_pago",
    usage_status: "preservacao_nao_agendada",
    amount: 300,
    ...partial,
  } as unknown as Voucher;
}

describe("computeMetrics — receita", () => {
  it("encomendas canceladas NÃO contam para a receita (bug sessão 113)", () => {
    const orders = [
      makeOrder({ budget: 100, payment_status: "100_pago" }),
      makeOrder({ budget: 999, payment_status: "100_pago", status: "cancelado" }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "personalizado");
    expect(m.revenue).toBe(100);
  });

  it("a janela da receita é pela DATA DO EVENTO, não pela criação (bug sessão 113)", () => {
    const orders = [
      // Criada fora do range mas evento dentro → conta
      makeOrder({ created_at: "2026-01-01T00:00:00.000Z", event_date: "2026-06-15", budget: 100 }),
      // Criada dentro do range mas evento fora → NÃO conta
      makeOrder({ created_at: "2026-06-05T00:00:00.000Z", event_date: "2026-09-20", budget: 999 }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "personalizado");
    expect(m.revenue).toBe(100);
  });

  it("receita é proporcional ao % pago", () => {
    const orders = [
      makeOrder({ budget: 100, payment_status: "100_pago" }),
      makeOrder({ budget: 100, payment_status: "70_pago" }),
      makeOrder({ budget: 100, payment_status: "30_pago" }),
      makeOrder({ budget: 100, payment_status: "100_por_pagar" }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "personalizado");
    expect(m.revenue).toBeCloseTo(100 + 70 + 30 + 0);
  });

  it("vales: 100% pagos contam, excepto os já convertidos em preservação (dupla contagem)", () => {
    const vouchers = [
      makeVoucher({ amount: 300 }), // conta
      makeVoucher({ amount: 400, usage_status: "preservacao_agendada" }), // NÃO conta
      makeVoucher({ amount: 500, payment_status: "100_por_pagar" }), // NÃO conta
    ];
    const m = computeMetrics([], vouchers, RANGE, TODAY, "personalizado");
    expect(m.revenue).toBe(300);
  });
});

describe("computeMetrics — top parceiros", () => {
  it("comissões em valor pleno, separadas entre paga e por pagar, a excluir N/A / Não aceita", () => {
    const orders = [
      makeOrder({
        partner_id: "p1",
        budget: 200,
        payment_status: "30_pago",
        partner_commission: 100,
        partner_commission_status: "a_aguardar", // por pagar
      }),
      makeOrder({
        partner_id: "p1",
        budget: 100,
        payment_status: "100_pago",
        partner_commission: 50,
        partner_commission_status: "nao_aceita", // não soma
      }),
      makeOrder({
        partner_id: "p1",
        budget: 100,
        payment_status: "100_pago",
        partner_commission: 40,
        partner_commission_status: "paga", // já paga
      }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "personalizado");
    expect(m.topPartners).toHaveLength(1);
    expect(m.topPartners[0].partner_id).toBe("p1");
    // Receita (proporcional ao %pago): 200×0.3 + 100×1 + 100×1 = 260
    expect(m.topPartners[0].revenue).toBeCloseTo(260);
    // Comissões PLENAS (não proporcionais): paga = 40; por pagar = 100; nao_aceita = 0
    expect(m.topPartners[0].commissionsPaid).toBeCloseTo(40);
    expect(m.topPartners[0].commissionsDue).toBeCloseTo(100);
    expect(m.topPartners[0].commissionsTotal).toBeCloseTo(140);
  });

  it("encomendas canceladas não entram no top parceiros", () => {
    const orders = [
      makeOrder({
        partner_id: "p1",
        status: "cancelado",
        budget: 999,
        partner_commission: 99,
        partner_commission_status: "paga",
      }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "personalizado");
    expect(m.topPartners).toHaveLength(0);
  });
});

describe("computeMetrics — comparações", () => {
  it('"desde sempre" não mostra comparação', () => {
    const m = computeMetrics([], [], rangeFromPreset("desde_sempre")!, TODAY, "desde_sempre");
    expect(m.showComparison).toBe(false);
    expect(m.comparisonLabel).toBe("");
  });

  it("baseline por preset: mensal→mês anterior, anual→ano anterior, janela→período equivalente", () => {
    const june: DateRange = { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) };
    const prevM = baselineRangeForPreset("este_mes", june);
    expect(prevM.start.getMonth()).toBe(4); // Maio

    const year: DateRange = { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) };
    const prevY = baselineRangeForPreset("este_ano", year);
    expect(prevY.start.getFullYear()).toBe(2025);

    const window: DateRange = { start: new Date(2026, 3, 1), end: new Date(2026, 5, 30) };
    const prevW = baselineRangeForPreset("ultimos_3_meses", window);
    // Janela anterior termina imediatamente antes do início da actual
    expect(prevW.end.getTime()).toBe(window.start.getTime() - 1);
  });
});

describe("pctChange", () => {
  it("variação normal, zero e infinito", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(10, 0)).toBeNull(); // "novo" — sem baseline
  });
});
