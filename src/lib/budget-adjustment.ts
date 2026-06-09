// ============================================================
// FBR Admin — Acerto de pagamento quando o orçamento sobe depois do sinal
// ============================================================
// Os pagamentos são guardados em PERCENTAGEM (30/70/100), não em euros.
// Quando o tamanho da moldura (antes "não sei") é decidido na fase de
// design e fica mais caro, a mesma "% paga" passa a valer mais euros do
// que o cliente realmente entregou → cria-se um buraco silencioso.
//
// Este helper compara o orçamento actual com o orçamento que existia no
// momento do 1º pagamento (orders.budget_at_first_payment) e devolve os
// números prontos para a Maria pedir a diferença ao cliente.
// ============================================================

import type { PaymentStatus } from "@/types/database";

// Fracção já paga consoante o estado do pagamento.
export const PAID_FRACTION: Record<PaymentStatus, number> = {
  "100_por_pagar": 0,
  "30_pago": 0.3,
  "70_pago": 0.7,
  "100_pago": 1,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BudgetAdjustment {
  oldBudget: number; // orçamento quando o cliente pagou o sinal
  newBudget: number; // orçamento actual (maior)
  paidFraction: number; // 0.3 | 0.7
  paidAmount: number; // € realmente pagos (paidFraction × oldBudget)
  // Marcos no valor actual:
  sinal: number; // 30% do novo
  cumul70: number; // 70% do novo
  full: number; // 100% do novo
  // Próximo marco a pedir:
  nextFraction: number; // 0.3 | 0.7 | 1
  nextDue: number; // nextFraction × newBudget (valor acumulado devido)
  missing: number; // nextDue − paidAmount (o que falta pedir agora)
}

/**
 * Detecta se o orçamento subiu depois do 1º pagamento e devolve o acerto.
 * Devolve `null` quando não há nada a ajustar (sem pagamento, já 100%
 * pago, ou orçamento não aumentou).
 */
export function computeBudgetAdjustment(
  budget: number | null | undefined,
  budgetAtFirstPayment: number | null | undefined,
  paymentStatus: PaymentStatus,
): BudgetAdjustment | null {
  if (budget == null || budgetAtFirstPayment == null) return null;
  if (paymentStatus === "100_pago") return null; // já liquidado
  if (budget <= budgetAtFirstPayment + 0.01) return null; // não subiu

  const paidFraction = PAID_FRACTION[paymentStatus];
  if (paidFraction <= 0) return null; // sem pagamento → nada a acertar

  const paidAmount = round2(paidFraction * budgetAtFirstPayment);
  const nextFraction = paidFraction < 0.3 ? 0.3 : paidFraction < 0.7 ? 0.7 : 1;
  const nextDue = round2(nextFraction * budget);

  return {
    oldBudget: budgetAtFirstPayment,
    newBudget: budget,
    paidFraction,
    paidAmount,
    sinal: round2(budget * 0.3),
    cumul70: round2(budget * 0.7),
    full: round2(budget),
    nextFraction,
    nextDue,
    missing: round2(Math.max(0, nextDue - paidAmount)),
  };
}
