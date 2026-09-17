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
  commissionFullFromVoucher,
  voucherCodesWithCommission,
  orderCommissionSuppressedByVoucher,
  cogsFullFromOrder,
  cogsRecognizedFromOrder,
  orderPnL,
  aggregateExpensesByAccountingType,
  expenseAmountInPeriod,
  expensesTotalInPeriod,
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
  museum_glass: "incluido" as const,
  museum_glass_mini: "incluido" as const,
  pyramid_frame: false,
  frame_internal_type: "baixa" as const,
  extra_small_frames: null,
  extra_small_frames_qty: null,
  additional_main_frames: {},
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

describe("comissão em vales (#15 — conta uma única vez no vale)", () => {
  const baseVoucher = {
    code: "ABC123",
    partner_commission: 30,
    partner_commission_status: "a_aguardar" as const,
    payment_status: "100_pago" as const,
  };

  it("commissionFullFromVoucher: valor pleno quando 100% pago e estado conta", () => {
    expect(commissionFullFromVoucher(baseVoucher)).toBe(30);
    expect(
      commissionFullFromVoucher({ ...baseVoucher, partner_commission_status: "paga" }),
    ).toBe(30);
  });

  it("commissionFullFromVoucher: 0 quando o vale ainda não está pago", () => {
    expect(
      commissionFullFromVoucher({ ...baseVoucher, payment_status: "100_por_pagar" }),
    ).toBe(0);
  });

  it('commissionFullFromVoucher: 0 para "N/A"/"Não aceita" ou valor nulo', () => {
    expect(
      commissionFullFromVoucher({ ...baseVoucher, partner_commission_status: "na" }),
    ).toBe(0);
    expect(
      commissionFullFromVoucher({ ...baseVoucher, partner_commission_status: "nao_aceita" }),
    ).toBe(0);
    expect(
      commissionFullFromVoucher({ ...baseVoucher, partner_commission: null }),
    ).toBe(0);
  });

  it("voucherCodesWithCommission: só inclui vales pagos com comissão que conta", () => {
    const set = voucherCodesWithCommission([
      baseVoucher, // ABC123 — conta
      { ...baseVoucher, code: "UNPAID", payment_status: "100_por_pagar" }, // não pago
      { ...baseVoucher, code: "NA", partner_commission_status: "na" }, // estado não conta
      { ...baseVoucher, code: "ZERO", partner_commission: 0 }, // sem valor
    ]);
    expect(set.has("ABC123")).toBe(true);
    expect(set.has("UNPAID")).toBe(false);
    expect(set.has("NA")).toBe(false);
    expect(set.has("ZERO")).toBe(false);
    expect(set.size).toBe(1);
  });

  it("orderCommissionSuppressedByVoucher: suprime quando a encomenda veio de um vale comissionado", () => {
    const codes = new Set(["ABC123"]);
    expect(
      orderCommissionSuppressedByVoucher({ gift_voucher_code: "ABC123" }, codes),
    ).toBe(true);
    expect(
      orderCommissionSuppressedByVoucher({ gift_voucher_code: "OUTRO" }, codes),
    ).toBe(false);
    expect(
      orderCommissionSuppressedByVoucher({ gift_voucher_code: null }, codes),
    ).toBe(false);
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

// ── Despesas por período (subscrições contam todos os meses) ──
//
// Bug corrigido na sessão 174: a Faturação/Painel somavam `amount` pela
// `expense_date`, logo uma subscrição mensal só contava no mês em que
// começou. Estes testes fixam o comportamento certo.
describe("expenseAmountInPeriod", () => {
  const NOW = new Date(2026, 8, 17); // 17/09/2026
  const month = (y: number, m: number) => ({
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 0, 23, 59, 59, 999),
  });
  const year = (y: number) => ({
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31, 23, 59, 59, 999),
  });
  const ALL = { start: new Date(1970, 0, 1), end: new Date(2999, 11, 31) };

  const unica = {
    expense_date: "2026-09-05",
    amount: 40,
    is_recurring: false,
    recurrence_period: null,
    recurrence_start_date: null,
    recurrence_end_date: null,
  };
  const mensal = {
    expense_date: "2026-03-10",
    amount: 20,
    is_recurring: true,
    recurrence_period: "monthly" as const,
    recurrence_start_date: "2026-03-10",
    recurrence_end_date: null,
  };
  const anual = {
    ...mensal,
    amount: 120,
    recurrence_period: "yearly" as const,
    expense_date: "2026-01-01",
    recurrence_start_date: "2026-01-01",
  };

  it("despesa única conta inteira no mês da sua data e 0 fora dele", () => {
    const s = month(2026, 9);
    expect(expenseAmountInPeriod(unica, s.start, s.end, NOW)).toBe(40);
    const a = month(2026, 8);
    expect(expenseAmountInPeriod(unica, a.start, a.end, NOW)).toBe(0);
  });

  it("subscrição mensal conta em CADA mês activo, não só no de início", () => {
    const mar = month(2026, 3);
    const jun = month(2026, 6);
    const set = month(2026, 9);
    expect(expenseAmountInPeriod(mensal, mar.start, mar.end, NOW)).toBe(20);
    expect(expenseAmountInPeriod(mensal, jun.start, jun.end, NOW)).toBe(20);
    expect(expenseAmountInPeriod(mensal, set.start, set.end, NOW)).toBe(20);
  });

  it("subscrição não conta antes de começar nem depois do mês corrente", () => {
    const fev = month(2026, 2);
    const out = month(2026, 10);
    expect(expenseAmountInPeriod(mensal, fev.start, fev.end, NOW)).toBe(0);
    expect(expenseAmountInPeriod(mensal, out.start, out.end, NOW)).toBe(0);
  });

  it("subscrição terminada não conta depois do mês de fim", () => {
    const terminada = { ...mensal, recurrence_end_date: "2026-05-31" };
    const mai = month(2026, 5);
    const jun = month(2026, 6);
    expect(expenseAmountInPeriod(terminada, mai.start, mai.end, NOW)).toBe(20);
    expect(expenseAmountInPeriod(terminada, jun.start, jun.end, NOW)).toBe(0);
  });

  it("no ano soma só os meses activos até hoje (Mar→Set = 7 meses)", () => {
    const y = year(2026);
    expect(expenseAmountInPeriod(mensal, y.start, y.end, NOW)).toBe(140);
  });

  it("subscrição anual entra a 1/12 por mês", () => {
    const abr = month(2026, 4);
    expect(expenseAmountInPeriod(anual, abr.start, abr.end, NOW)).toBeCloseTo(10);
    const y = year(2026);
    expect(expenseAmountInPeriod(anual, y.start, y.end, NOW)).toBeCloseTo(90); // Jan→Set
  });

  it("'desde sempre' com subscrição aberta pára no mês corrente", () => {
    expect(expenseAmountInPeriod(mensal, ALL.start, ALL.end, NOW)).toBe(140);
  });

  it("intervalo específico nunca ultrapassa o total pago", () => {
    const custom = {
      ...mensal,
      amount: 41.7,
      recurrence_period: "custom" as const,
      recurrence_start_date: "2025-01-01",
      recurrence_end_date: "2026-02-28",
    };
    expect(expenseAmountInPeriod(custom, ALL.start, ALL.end, NOW)).toBeLessThanOrEqual(41.7);
    expect(expenseAmountInPeriod(custom, ALL.start, ALL.end, NOW)).toBeGreaterThan(40);
  });

  it("expensesTotalInPeriod soma únicas e subscrições", () => {
    const s = month(2026, 9);
    expect(expensesTotalInPeriod([unica, mensal, anual], s.start, s.end, NOW)).toBeCloseTo(70);
  });
});
