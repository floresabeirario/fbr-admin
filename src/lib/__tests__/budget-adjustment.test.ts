// ============================================================
// Testes do acerto de pagamento quando o orçamento sobe depois
// do sinal (sessão 110). Inclui o caso real da Maria: sinal de
// 90€ sobre 300€, tamanho decidido sobe para 500€ → faltam 260€
// para chegar aos 70%.
// ============================================================

import { describe, it, expect } from "vitest";
import { computeBudgetAdjustment } from "@/lib/budget-adjustment";

describe("computeBudgetAdjustment", () => {
  it("caso real: 300€→500€ com 30% pago → faltam 260€ para os 70%", () => {
    const adj = computeBudgetAdjustment(500, 300, "30_pago");
    expect(adj).not.toBeNull();
    expect(adj!.paidAmount).toBeCloseTo(90); // 30% de 300
    expect(adj!.nextFraction).toBe(0.7);
    expect(adj!.nextDue).toBeCloseTo(350); // 70% de 500
    expect(adj!.missing).toBeCloseTo(260); // 350 − 90
    expect(adj!.sinal).toBeCloseTo(150);
    expect(adj!.cumul70).toBeCloseTo(350);
    expect(adj!.full).toBeCloseTo(500);
  });

  it("com 70% pago o próximo marco é os 100%", () => {
    const adj = computeBudgetAdjustment(500, 300, "70_pago");
    expect(adj!.paidAmount).toBeCloseTo(210); // 70% de 300
    expect(adj!.nextFraction).toBe(1);
    expect(adj!.missing).toBeCloseTo(500 - 210);
  });

  it("devolve null quando não há nada a acertar", () => {
    // Sem pagamento ainda
    expect(computeBudgetAdjustment(500, 300, "100_por_pagar")).toBeNull();
    // Já liquidado
    expect(computeBudgetAdjustment(500, 300, "100_pago")).toBeNull();
    // Orçamento não subiu
    expect(computeBudgetAdjustment(300, 300, "30_pago")).toBeNull();
    expect(computeBudgetAdjustment(250, 300, "30_pago")).toBeNull();
    // Sem dados
    expect(computeBudgetAdjustment(null, 300, "30_pago")).toBeNull();
    expect(computeBudgetAdjustment(500, null, "30_pago")).toBeNull();
  });

  it("tolerância de cêntimos: subida de 1 cêntimo não dispara aviso", () => {
    expect(computeBudgetAdjustment(300.01, 300, "30_pago")).toBeNull();
  });
});
