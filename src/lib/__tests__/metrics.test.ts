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
  cityFromLocation,
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

// ── Sessão 174: receita por data de pagamento + funil + antecedência ──
describe("computeMetrics — sessão 174", () => {
  it("o sinal conta no mês em que entrou, mesmo com o evento noutro ano", () => {
    const orders = [
      makeOrder({ budget: 100, payment_status: "30_pago", event_date: "2026-12-12", deposit_paid_at: "2026-06-20T10:00:00.000Z" }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    expect(m.revenue).toBe(30);
  });

  it("funil: total, com sinal, cancelados, pendentes e por canal", () => {
    const orders = [
      makeOrder({ payment_status: "100_pago", how_found_fbr: "instagram" }),
      makeOrder({ payment_status: "30_pago", how_found_fbr: "instagram" }),
      makeOrder({ payment_status: "70_pago", how_found_fbr: "google" }),
      makeOrder({ payment_status: "100_por_pagar", status: "entrega_flores_agendar", how_found_fbr: "google" }),
      makeOrder({ payment_status: "100_por_pagar", status: "cancelado", cancelled_from_status: "entrega_agendada", how_found_fbr: "instagram" }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    expect(m.funnel.total).toBe(5);
    expect(m.funnel.confirmed).toBe(3);
    expect(m.funnel.cancelled).toBe(1);
    expect(m.funnel.pending).toBe(1);
    expect(m.funnel.confirmedPct).toBe(60);
    const ig = m.funnel.byChannel.find((c) => c.key === "instagram")!;
    expect(ig.total).toBe(3);
    expect(ig.confirmed).toBe(2);
    expect(ig.confirmedPct).toBe(67);
    expect(m.cancellations.count).toBe(1);
    expect(m.cancellations.pct).toBe(20);
    expect(m.cancellations.byPhase[0]).toMatchObject({ key: "entrega_agendada", count: 1 });
  });

  it("mediana de dias até ao sinal só usa pedidos com data de pagamento", () => {
    const orders = [
      makeOrder({ created_at: "2026-06-01T10:00:00.000Z", deposit_paid_at: "2026-06-04T10:00:00.000Z" }),
      makeOrder({ created_at: "2026-06-01T10:00:00.000Z", deposit_paid_at: "2026-06-11T10:00:00.000Z" }),
      makeOrder({ created_at: "2026-06-01T10:00:00.000Z" }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    expect(m.funnel.depositSample).toBe(2);
    expect(m.funnel.medianDaysToDeposit).toBe(7);
  });

  it("antecedência: só preservação, negativo = depois do evento, buckets e %", () => {
    const orders = [
      makeOrder({ created_at: "2026-06-05T10:00:00.000Z", event_date: "2026-06-10", consent_at: "2026-06-05T10:00:00.000Z" }), // 5 dias antes
      makeOrder({ created_at: "2026-06-05T10:00:00.000Z", event_date: "2026-05-20" }), // 16 dias depois
      makeOrder({ created_at: "2026-06-05T10:00:00.000Z", event_date: "2026-09-20" }), // ~3,5 meses antes
      makeOrder({ created_at: "2026-06-05T10:00:00.000Z", event_date: "2026-05-01", service_type: "emoldurar_secas" }), // excluída
      makeOrder({ created_at: "2026-06-05T10:00:00.000Z", event_date: null }), // sem data
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    expect(m.leadTime.sample).toBe(3);
    expect(m.leadTime.afterEventPct).toBe(33);
    expect(m.leadTime.buckets.find((b) => b.key === "depois")!.count).toBe(1);
    expect(m.leadTime.buckets.find((b) => b.key === "semana")!.count).toBe(1);
    expect(m.leadTime.buckets.find((b) => b.key === "3_6m")!.count).toBe(1);
    expect(m.leadTime.since).toBe("2026-06-05T10:00:00.000Z");
  });

  it("antecedência ignora pedidos anteriores ao 1.º consentimento (importados)", () => {
    const orders = [
      makeOrder({ created_at: "2025-01-01T10:00:00.000Z", event_date: "2024-06-10" }), // importado (created_at falso)
      makeOrder({ created_at: "2026-06-05T10:00:00.000Z", event_date: "2026-06-10", consent_at: "2026-06-05T10:00:00.000Z" }),
    ];
    const all = { start: new Date(1970, 0, 1), end: new Date(2999, 11, 31) };
    const m = computeMetrics(orders, [], all, TODAY, "desde_sempre");
    expect(m.leadTime.sample).toBe(1);
  });

  it("vales pagos sem preservação a expirar em 3 meses, ordenados pelo prazo", () => {
    const vouchers = [
      makeVoucher({ code: "AAA111", expiry_date: "2026-08-01", amount: 300 }),
      makeVoucher({ code: "BBB222", expiry_date: "2026-07-01", amount: 350 }),
      makeVoucher({ code: "CCC333", expiry_date: "2027-01-01" }),
      makeVoucher({ code: "DDD444", expiry_date: "2026-07-15", usage_status: "preservacao_agendada" }),
      makeVoucher({ code: "EEE555", expiry_date: "2026-07-15", payment_status: "100_por_pagar" }),
    ];
    const m = computeMetrics([], vouchers, RANGE, TODAY, "este_mes");
    expect(m.expiringVouchers.map((v) => v.code)).toEqual(["BBB222", "AAA111"]);
    expect(m.expiringVouchers[0].daysLeft).toBe(19);
  });

  it("parceiros calados: 2+ encomendas e nenhuma nos últimos 6 meses", () => {
    const orders = [
      makeOrder({ partner_id: "p1", created_at: "2025-09-01T10:00:00.000Z" }),
      makeOrder({ partner_id: "p1", created_at: "2025-10-01T10:00:00.000Z" }),
      makeOrder({ partner_id: "p2", created_at: "2025-10-01T10:00:00.000Z" }), // só 1
      makeOrder({ partner_id: "p3", created_at: "2025-01-01T10:00:00.000Z" }),
      makeOrder({ partner_id: "p3", created_at: "2026-05-01T10:00:00.000Z" }), // activo
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    expect(m.quietPartners.map((p) => p.partner_id)).toEqual(["p1"]);
  });
});

// ── Sessão 174, "vai tudo": funil por idioma/serviço, quando chegam os
// pedidos, cidades, repetentes, fases e resposta no WhatsApp ──
describe("computeMetrics — métricas novas", () => {
  it("funil por idioma e por serviço; estados pela ordem de produção", () => {
    const orders = [
      makeOrder({ form_language: "pt", service_type: "preservacao", payment_status: "100_pago", status: "quadro_recebido" }),
      makeOrder({ form_language: "en", service_type: "emoldurar_secas", payment_status: "100_por_pagar", status: "entrega_flores_agendar" }),
      makeOrder({ form_language: "pt", service_type: null as unknown as Order["service_type"], payment_status: "30_pago", status: "flores_na_prensa" }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    expect(m.funnel.byLanguage.find((l) => l.key === "pt")).toMatchObject({ total: 2, confirmed: 2, confirmedPct: 100 });
    expect(m.funnel.byService.find((s) => s.key === "preservacao")).toMatchObject({ total: 2 });
    expect(m.ordersByStatus.map((s) => s.status)).toEqual(["entrega_flores_agendar", "flores_na_prensa", "quadro_recebido"]);
  });

  it("cidade aproximada a partir da morada do evento", () => {
    expect(cityFromLocation("Quinta X, Rua Y, 3040-123 Coimbra, Portugal")).toBe("Coimbra");
    expect(cityFromLocation("Lisboa, Portugal")).toBe("Lisboa");
    expect(cityFromLocation("Porto")).toBe("Porto");
    expect(cityFromLocation("")).toBeNull();
    expect(cityFromLocation(null)).toBeNull();
  });

  it("clientes repetidos: mesmo email ou telemóvel", () => {
    const orders = [
      makeOrder({ email: "Ana@x.pt", created_at: "2026-01-05T10:00:00.000Z" }),
      makeOrder({ email: "ana@x.pt", created_at: "2026-06-05T10:00:00.000Z" }), // repete (email)
      makeOrder({ email: null, phone: "+351 912 345 678", created_at: "2026-02-01T10:00:00.000Z" }),
      makeOrder({ email: null, phone: "912345678", created_at: "2026-06-06T10:00:00.000Z" }), // repete (telemóvel)
      makeOrder({ email: "novo@x.pt", created_at: "2026-06-07T10:00:00.000Z" }),
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    expect(m.repeatClients.clientsTotal).toBe(3);
    expect(m.repeatClients.clientsRepeat).toBe(2);
    expect(m.repeatClients.repeatOrdersPct).toBe(67); // 2 dos 3 pedidos de Junho
  });

  it("dias em cada fase: fases concluídas e fase actual (há quanto tempo)", () => {
    // o1 já saiu de 2 fases e está na prensa desde 10/06 (TODAY = 12/06 → 2 dias).
    const o1 = makeOrder({ id: "o1", created_at: "2026-06-01T10:00:00.000Z", consent_at: "2026-06-01T10:00:00.000Z", status: "flores_na_prensa" });
    // o2 importada (created_at antes do formulário): o segmento da criação é ignorado,
    // a transição real seguinte conta.
    const o2 = makeOrder({ id: "o2", created_at: "2026-05-01T10:00:00.000Z", status: "reconstrucao_botanica" });
    const history = [
      { order_id: "o1", from_status: null, to_status: "entrega_flores_agendar", changed_at: "2026-06-01T10:00:00.000Z" },
      { order_id: "o1", from_status: "entrega_flores_agendar", to_status: "entrega_agendada", changed_at: "2026-06-03T10:00:00.000Z" },
      { order_id: "o1", from_status: "entrega_agendada", to_status: "flores_na_prensa", changed_at: "2026-06-10T10:00:00.000Z" },
      { order_id: "o2", from_status: null, to_status: "flores_na_prensa", changed_at: "2026-05-01T10:00:00.000Z" },
      { order_id: "o2", from_status: "flores_na_prensa", to_status: "reconstrucao_botanica", changed_at: "2026-06-11T10:00:00.000Z" },
    ];
    const m = computeMetrics([o1, o2], [], RANGE, TODAY, "este_mes", { statusHistory: history });
    const byStatus = Object.fromEntries(m.phaseDurations.map((p) => [p.status, p]));
    expect(byStatus.entrega_flores_agendar).toMatchObject({ doneMedianDays: 2, doneSample: 1, nowCount: 0 });
    expect(byStatus.entrega_agendada).toMatchObject({ doneMedianDays: 7, doneSample: 1, nowCount: 0 });
    // Na prensa: o1 está lá agora há ~1,5 dias (depende do fuso da máquina:
    // 10/06 10:00Z até 12/06 00:00 local); o segmento falso da o2 (desde a
    // importação) não conta como concluído.
    expect(byStatus.flores_na_prensa).toMatchObject({ doneSample: 0, nowCount: 1 });
    expect(byStatus.flores_na_prensa.nowMedianDays).toBeGreaterThan(1);
    expect(byStatus.flores_na_prensa.nowMedianDays).toBeLessThan(2.5);
    expect(byStatus.reconstrucao_botanica).toMatchObject({ nowCount: 1 });
  });

  it("tempo até à 1.ª resposta no WhatsApp: mediana e % em 1h/24h/7d, com os lentos à parte", () => {
    const orders = ["a", "b", "c", "d", "e"].map((id) => makeOrder({ id }));
    const responseTimes = [
      { order_id: "a", requested_at: "2026-06-05T10:00:00.000Z", first_reply_at: "", hours: 0.5 },
      { order_id: "b", requested_at: "2026-06-05T10:00:00.000Z", first_reply_at: "", hours: 3 },
      { order_id: "c", requested_at: "2026-06-05T10:00:00.000Z", first_reply_at: "", hours: 30 },
      { order_id: "d", requested_at: "2026-06-05T10:00:00.000Z", first_reply_at: "", hours: 1 },
      { order_id: "e", requested_at: "2026-06-05T10:00:00.000Z", first_reply_at: "", hours: 634 }, // respondeu por email; WhatsApp só semanas depois
      { order_id: "zzz", requested_at: "2026-06-05T10:00:00.000Z", first_reply_at: "", hours: 100 }, // encomenda arquivada: ignorada
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes", { responseTimes });
    expect(m.whatsappResponse.sample).toBe(5);
    expect(m.whatsappResponse.medianHours).toBe(3);
    expect(m.whatsappResponse.within1hPct).toBe(40);
    expect(m.whatsappResponse.within24hPct).toBe(60);
    expect(m.whatsappResponse.within7dPct).toBe(80);
    expect(m.whatsappResponse.over7dCount).toBe(1);
  });

  it("pedidos por mês empilhados e sazonalidade dos eventos", () => {
    const orders = [
      makeOrder({ created_at: "2026-06-05T10:00:00.000Z", consent_at: "2026-06-05T10:00:00.000Z", payment_status: "100_pago", event_date: "2026-09-12" }),
      makeOrder({ created_at: "2026-06-06T10:00:00.000Z", payment_status: "100_por_pagar", status: "entrega_flores_agendar", event_date: "2025-09-20" }),
      makeOrder({ created_at: "2026-05-06T10:00:00.000Z", payment_status: "100_por_pagar", status: "cancelado", event_date: "2026-06-01" }), // antes do formulário: fora dos meses
    ];
    const m = computeMetrics(orders, [], RANGE, TODAY, "este_mes");
    const jun = m.monthlyRequests.find((r) => r.month === "2026-06")!;
    expect(jun).toMatchObject({ confirmed: 1, pending: 1, cancelled: 0 });
    expect(m.monthlyRequests.find((r) => r.month === "2026-05")).toMatchObject({ confirmed: 0, pending: 0, cancelled: 0 });
    expect(m.eventSeasonality.years).toEqual([2025, 2026]);
    const set = m.eventSeasonality.months.find((x) => x.month === 9)!;
    expect(set.counts["2025"]).toBe(1);
    expect(set.counts["2026"]).toBe(1);
  });
});

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
