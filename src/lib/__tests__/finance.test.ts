// ============================================================
// Testes dos helpers financeiros — fonte única de verdade para
// receita/COGS/comissões. Se algum destes falhar, os números do
// Painel/Faturação/Métricas deixaram de bater certo.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  paidRatio,
  commissionFromOrder,
  commissionFullFromOrder,
  cogsFullFromOrder,
  cogsRecognizedFromOrder,
  orderPnL,
  aggregateExpensesByAccountingType,
} from "@/lib/finance";
import type { ProductionCostSnapshot } from "@/types/production-cost";

// Snapshot mínimo com uma moldura 30x40 baixa/vidro-vidro a 55€.
const SNAPSHOT: ProductionCostSnapshot = {
  captured_at: "2026-01-01T00:00:00.000Z",
  items: [
    {
      kind: "frame",
      size_key: "30x40",
      frame_type: "baixa",
      glass_type: "vidro_vidro",
      label: null,
      cost: 55,
    },
  ],
};

// Encomenda-base para os testes de COGS/P&L (campos relevantes apenas).
const baseOrder = {
  payment_status: "100_pago" as const,
  frame_size: "30x40" as const,
  frame_background: "transparente" as const,
  pyramid_frame: false,
  frame_internal_type: "baixa" as const,
  extra_small_frames: null,
  extra_small_frames_qty: null,
  production_cost_snapshot: SNAPSHOT,
};

describe("paidRatio", () => {
  it("devolve a proporção certa por estado de pagamento", () => {
    expect(paidRatio("100_pago")).toBe(1);
    expect(paidRatio("70_pago")).toBe(0.7);
    expect(paidRatio("30_pago")).toBe(0.3);
    expect(paidRatio("100_por_pagar")).toBe(0);
  });
});

describe("commissionFromOrder", () => {
  it("é proporcional ao % pago", () => {
    const o = {
      partner_commission: 100,
      partner_commission_status: "a_aguardar" as const,
      payment_status: "30_pago" as const,
    };
    expect(commissionFromOrder(o)).toBeCloseTo(30);
    expect(commissionFromOrder({ ...o, payment_status: "70_pago" })).toBeCloseTo(70);
    expect(commissionFromOrder({ ...o, payment_status: "100_pago" })).toBeCloseTo(100);
  });

  it('estados "N/A" e "Não aceita" não contam (bug da sessão 113)', () => {
    const o = {
      partner_commission: 100,
      partner_commission_status: "na" as const,
      payment_status: "100_pago" as const,
    };
    expect(commissionFromOrder(o)).toBe(0);
    expect(
      commissionFromOrder({ ...o, partner_commission_status: "nao_aceita" }),
    ).toBe(0);
  });

  it("comissão nula ou zero devolve 0", () => {
    expect(
      commissionFromOrder({
        partner_commission: null,
        partner_commission_status: "paga",
        payment_status: "100_pago",
      }),
    ).toBe(0);
    expect(
      commissionFullFromOrder({
        partner_commission: 0,
        partner_commission_status: "paga",
      }),
    ).toBe(0);
  });
});

describe("COGS por encomenda", () => {
  it("cogsFullFromOrder lê o snapshot (moldura 30x40 a 55€)", () => {
    expect(cogsFullFromOrder(baseOrder)).toBe(55);
  });

  it("sem snapshot (encomendas pré-mig 034) devolve 0", () => {
    expect(
      cogsFullFromOrder({ ...baseOrder, production_cost_snapshot: null }),
    ).toBe(0);
  });

  it("cogsRecognizedFromOrder é tudo-ou-nada: só conta a 100% pago", () => {
    expect(cogsRecognizedFromOrder(baseOrder)).toBe(55);
    expect(
      cogsRecognizedFromOrder({ ...baseOrder, payment_status: "70_pago" }),
    ).toBe(0);
    expect(
      cogsRecognizedFromOrder({ ...baseOrder, payment_status: "30_pago" }),
    ).toBe(0);
    expect(
      cogsRecognizedFromOrder({ ...baseOrder, payment_status: "100_por_pagar" }),
    ).toBe(0);
  });
});

describe("orderPnL", () => {
  const pnlOrder = {
    ...baseOrder,
    budget: 300,
    partner_commission: 30,
    partner_commission_status: "a_aguardar" as const,
  };

  it("a 100% pago reconhece tudo", () => {
    const p = orderPnL(pnlOrder);
    expect(p.revenue_full).toBe(300);
    expect(p.revenue_recognized).toBe(300);
    expect(p.cogs_recognized).toBe(55);
    expect(p.commission_recognized).toBe(30);
    expect(p.margin_full).toBe(300 - 55 - 30);
    expect(p.margin_recognized).toBe(300 - 55 - 30);
    expect(p.margin_pct).toBeCloseTo(((300 - 85) / 300) * 100);
  });

  it("a 30% pago reconhece receita/comissão proporcionais e COGS 0", () => {
    const p = orderPnL({ ...pnlOrder, payment_status: "30_pago" });
    expect(p.revenue_recognized).toBeCloseTo(90);
    expect(p.cogs_recognized).toBe(0);
    expect(p.commission_recognized).toBeCloseTo(9);
    expect(p.margin_recognized).toBeCloseTo(90 - 0 - 9);
  });

  it("orçamento nulo não rebenta e dá margem 0%", () => {
    const p = orderPnL({ ...pnlOrder, budget: null });
    expect(p.revenue_full).toBe(0);
    expect(p.margin_pct).toBe(0);
  });
});

describe("aggregateExpensesByAccountingType", () => {
  it("mapeia categorias para tipos contabilísticos e soma", () => {
    const totals = aggregateExpensesByAccountingType([
      { category: "flores", amount: 10 },
      { category: "molduras", amount: 20 },
      { category: "software", amount: 5 },
      { category: "marketing", amount: 7 },
      { category: "taxas", amount: 1.5 },
    ]);
    expect(totals.cogs_variavel).toBe(30);
    expect(totals.operacional).toBe(5);
    expect(totals.marketing).toBe(7);
    expect(totals.financeira).toBe(1.5);
    expect(totals.investimento).toBe(0);
  });
});
