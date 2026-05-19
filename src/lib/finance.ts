// ============================================================
// FBR Admin — Helpers financeiros transversais
// ============================================================
// Estes helpers são a fonte única de verdade para:
//   1. Mapeamento das categorias granulares de despesa em tipos
//      contabilísticos (COGS variável / Operacional / Marketing /
//      Financeira / Investimento) — usado pelo Painel para
//      separar margem de contribuição de margem operacional.
//   2. Cálculo proporcional da comissão a parceiros como dedução
//      à receita (decisão Maria 2026-05-19).
//   3. Razão de pagamento (paidRatio) — duplicado do FaturacaoTab
//      para que outras abas possam reutilizar sem importar do client.
//
// IMPORTANTE: este ficheiro não importa nada de React. É 100% puro
// para poder ser usado em server actions, views SQL helpers, e tests.

import type { Expense, ExpenseCategory } from "@/types/expense";
import type { Order, PartnerCommissionStatus, PaymentStatus } from "@/types/database";
import { computeProductionCost } from "@/lib/production-cost";
import type { ProductionCostSnapshot } from "@/types/production-cost";

// ── Tipos contabilísticos ────────────────────────────────────

export type AccountingType =
  | "cogs_variavel"   // insumos directos de produção (flores, molduras, materiais)
  | "operacional"     // despesa fixa/recorrente que mantém o negócio a operar
  | "marketing"       // aquisição e visibilidade
  | "financeira"      // taxas bancárias, juros, comissões
  | "investimento";   // CAPEX — equipamento amortizável (placeholder, sem mapping ainda)

export const ACCOUNTING_TYPE_LABELS: Record<AccountingType, string> = {
  cogs_variavel: "COGS variável",
  operacional:   "Operacional",
  marketing:     "Marketing",
  financeira:    "Financeira",
  investimento:  "Investimento",
};

export const ACCOUNTING_TYPE_HELPERS: Record<AccountingType, string> = {
  cogs_variavel: "Insumos directos de produção lançados como despesa avulsa (fora do snapshot por encomenda)",
  operacional:   "Renda, software, serviços, transporte — mantém o negócio a operar",
  marketing:     "Aquisição de clientes e visibilidade",
  financeira:    "Taxas bancárias, juros, encargos financeiros",
  investimento:  "Equipamento de longa duração (amortizável)",
};

// Mapping derivado: categorias granulares → tipo contabilístico.
// Decisão Maria 2026-05-19: sem dimensão nova na BD; o mapping vive aqui
// e pode ser refinado caso a caso mais tarde com um override por linha.
const CATEGORY_TO_ACCOUNTING: Record<ExpenseCategory, AccountingType> = {
  flores:     "cogs_variavel",
  molduras:   "cogs_variavel",
  materiais:  "cogs_variavel",
  marketing:  "marketing",
  software:   "operacional",
  servicos:   "operacional",
  transporte: "operacional",
  taxas:      "financeira",
  outros:     "operacional",
};

export function expenseAccountingType(category: ExpenseCategory): AccountingType {
  return CATEGORY_TO_ACCOUNTING[category];
}

export function expenseToAccountingType(e: Pick<Expense, "category">): AccountingType {
  return expenseAccountingType(e.category);
}

/**
 * Agrega despesas por tipo contabilístico. Devolve um Record com
 * 0 para tipos sem despesas para garantir UI estável.
 */
export function aggregateExpensesByAccountingType(
  expenses: Pick<Expense, "category" | "amount">[],
): Record<AccountingType, number> {
  const totals: Record<AccountingType, number> = {
    cogs_variavel: 0,
    operacional: 0,
    marketing: 0,
    financeira: 0,
    investimento: 0,
  };
  for (const e of expenses) {
    const type = expenseAccountingType(e.category);
    totals[type] += Number(e.amount);
  }
  return totals;
}

// ── Razão de pagamento ───────────────────────────────────────

/**
 * Devolve a proporção do orçamento que já está "reconhecida" como
 * receita, dado o payment_status da encomenda. 0 / 0.3 / 0.7 / 1.
 */
export function paidRatio(status: PaymentStatus): number {
  switch (status) {
    case "100_pago": return 1;
    case "70_pago":  return 0.7;
    case "30_pago":  return 0.3;
    default:         return 0;
  }
}

// ── Comissões a parceiros como dedução à receita ─────────────

// Estados em que a comissão é considerada "obrigação pendente ou
// já paga" e portanto deduz da receita. `na` (sem parceiro) e
// `nao_aceita` (parceiro recusou) não deduzem.
const COMMISSION_COUNTS_AS_DEDUCTION: ReadonlySet<PartnerCommissionStatus> = new Set([
  "parceiro_informado",
  "a_aguardar",
  "a_aguardar_resposta",
  "paga",
]);

export function commissionCountsAsDeduction(status: PartnerCommissionStatus): boolean {
  return COMMISSION_COUNTS_AS_DEDUCTION.has(status);
}

/**
 * Comissão a parceiro plena (sem proporção do pagamento). Devolve 0
 * quando o estado da comissão não conta (na / nao_aceita) ou o valor
 * é nulo/zero. Use esta variante em listagens por encomenda onde
 * queres ver o valor "compromisso total" independentemente do %pago.
 */
export function commissionFullFromOrder(
  order: Pick<Order, "partner_commission" | "partner_commission_status">,
): number {
  if (!order.partner_commission || order.partner_commission <= 0) return 0;
  if (!commissionCountsAsDeduction(order.partner_commission_status)) return 0;
  return Number(order.partner_commission);
}

/**
 * Comissão a parceiro a ser deduzida da receita de uma encomenda,
 * proporcional ao %pago (coerente com a forma como receita e COGS
 * são contados). Devolve 0 quando o estado não conta ou o valor é
 * nulo/zero. Use esta variante para agregação por período.
 */
export function commissionFromOrder(
  order: Pick<Order, "partner_commission" | "partner_commission_status" | "payment_status">,
): number {
  return commissionFullFromOrder(order) * paidRatio(order.payment_status);
}

// ── COGS por encomenda ───────────────────────────────────────

type OrderForCogs = Pick<
  Order,
  | "payment_status"
  | "frame_size"
  | "frame_background"
  | "pyramid_frame"
  | "frame_internal_type"
  | "extra_small_frames"
  | "extra_small_frames_qty"
  | "production_cost_snapshot"
>;

/**
 * COGS pleno por encomenda — total do snapshot avaliado nos campos
 * actuais. Devolve 0 quando não há snapshot (encomendas pré-mig 034).
 */
export function cogsFullFromOrder(order: OrderForCogs): number {
  if (!order.production_cost_snapshot) return 0;
  const breakdown = computeProductionCost(
    order,
    order.production_cost_snapshot as ProductionCostSnapshot,
  );
  return breakdown?.total ?? 0;
}

/**
 * COGS reconhecido por encomenda — pleno × %pago. Coerente com a
 * forma como receita é reconhecida proporcionalmente.
 */
export function cogsRecognizedFromOrder(order: OrderForCogs): number {
  return cogsFullFromOrder(order) * paidRatio(order.payment_status);
}

// ── P&L composto por encomenda ───────────────────────────────

export interface OrderPnL {
  revenue_full: number;        // budget
  revenue_recognized: number;  // budget × %pago
  cogs_full: number;
  cogs_recognized: number;
  commission_full: number;
  commission_recognized: number;
  margin_full: number;         // revenue_full − cogs_full − commission_full
  margin_recognized: number;   // mesmo cálculo mas usando os recognized
  margin_pct: number;          // margin_full / revenue_full × 100 (0 se receita = 0)
  paid_ratio: number;
}

type OrderForPnL = OrderForCogs &
  Pick<Order, "budget" | "partner_commission" | "partner_commission_status">;

export function orderPnL(order: OrderForPnL): OrderPnL {
  const ratio = paidRatio(order.payment_status);
  const revenue_full = Number(order.budget ?? 0);
  const cogs_full = cogsFullFromOrder(order);
  const commission_full = commissionFullFromOrder(order);
  const margin_full = revenue_full - cogs_full - commission_full;
  return {
    revenue_full,
    revenue_recognized: revenue_full * ratio,
    cogs_full,
    cogs_recognized: cogs_full * ratio,
    commission_full,
    commission_recognized: commission_full * ratio,
    margin_full,
    margin_recognized: margin_full * ratio,
    margin_pct: revenue_full > 0 ? (margin_full / revenue_full) * 100 : 0,
    paid_ratio: ratio,
  };
}
