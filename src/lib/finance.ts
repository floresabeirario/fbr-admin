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

import { parseISO } from "date-fns";
import { monthlyEquivalent } from "@/types/expense";
import type { Expense, ExpenseCategory } from "@/types/expense";
import type { Order, PartnerCommissionStatus, PaymentStatus } from "@/types/database";
import type { VoucherPaymentStatus } from "@/types/voucher";
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

// ── Despesas por período ─────────────────────────────────────
//
// Uma despesa ÚNICA conta inteira no período em que cai a sua data.
// Uma SUBSCRIÇÃO não tem "uma data": custa em todos os meses em que
// está activa. Aqui conta-se o custo mensal equivalente (mensal = valor;
// anual = valor ÷ 12; intervalo = total ÷ meses) por cada mês do período
// em que a subscrição esteve activa — mês de início e mês de fim
// inclusive, como em `subscriptionTotalToDate` — e nunca para além do
// mês corrente (`now`): o que ainda não foi pago não é despesa.
//
// Antes disto (sessão 174), a Faturação e o Painel somavam `amount` pela
// `expense_date`: uma subscrição mensal contava uma única vez (no mês em
// que começou) e uma anual caía inteira num só mês, o que inflava o lucro
// de todos os outros meses. A aba Despesas já fazia as contas certas.

export type ExpenseForPeriod = Pick<
  Expense,
  | "expense_date"
  | "amount"
  | "is_recurring"
  | "recurrence_period"
  | "recurrence_start_date"
  | "recurrence_end_date"
>;

// Índice absoluto de mês (ano × 12 + mês) para contar meses entre datas.
function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

/**
 * Quanto uma despesa custa dentro do período [start, end].
 * - Única: o valor inteiro se `expense_date` cai no período, senão 0.
 * - Subscrição: custo mensal equivalente × meses do período em que está
 *   activa, sem contar meses depois do mês de `now`.
 */
export function expenseAmountInPeriod(
  e: ExpenseForPeriod,
  start: Date,
  end: Date,
  now: Date,
): number {
  if (!e.is_recurring) {
    if (!e.expense_date) return 0;
    const d = parseISO(e.expense_date);
    return d >= start && d <= end ? Number(e.amount) : 0;
  }
  if (!e.recurrence_start_date) return 0;
  const firstActive = monthIndex(parseISO(e.recurrence_start_date));
  const lastActive = Math.min(
    e.recurrence_end_date ? monthIndex(parseISO(e.recurrence_end_date)) : Infinity,
    monthIndex(now),
  );
  const from = Math.max(firstActive, monthIndex(start));
  const to = Math.min(lastActive, monthIndex(end));
  const months = to - from + 1;
  if (months <= 0) return 0;
  const total = months * monthlyEquivalent(e);
  // Intervalo específico: `amount` é o total do intervalo inteiro. A
  // contagem inclusiva de meses pode passar por excesso, daí o tecto.
  if (e.recurrence_period === "custom" && e.recurrence_end_date) {
    return Math.min(total, Number(e.amount));
  }
  return total;
}

/** Soma de `expenseAmountInPeriod` para uma lista de despesas. */
export function expensesTotalInPeriod(
  expenses: ReadonlyArray<ExpenseForPeriod>,
  start: Date,
  end: Date,
  now: Date,
): number {
  let total = 0;
  for (const e of expenses) total += expenseAmountInPeriod(e, start, end, now);
  return total;
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

// ── Comissões em vales (vouchers) ────────────────────────────
//
// Regra (decisão Maria, sessão 116): a comissão de uma recomendação que
// resulta na compra de um VALE conta uma única vez — NO VALE — e só
// quando o vale está 100% pago (sem dinheiro recebido não há comissão).
// Quando o vale vira preservação, a comissão NÃO volta a contar na
// encomenda (ver `orderCommissionSuppressedByVoucher`). É o espelho da
// receita, onde é a encomenda que conta e o vale convertido é zerado.

type VoucherCommissionInput = {
  partner_commission: number | null;
  partner_commission_status: PartnerCommissionStatus;
  payment_status: VoucherPaymentStatus;
};

/**
 * Comissão plena de um vale — valor pleno acordado, mas só quando o vale
 * está 100% pago. Devolve 0 para na/nao_aceita, valor nulo/zero, ou vale
 * ainda por pagar. (Os vales são all-or-nothing no pagamento, logo não há
 * proporção como nas encomendas.)
 */
export function commissionFullFromVoucher(v: VoucherCommissionInput): number {
  if (v.payment_status !== "100_pago") return 0;
  return commissionFullFromOrder(v);
}

/**
 * Conjunto de códigos de vale que carregam uma comissão que já conta
 * (parceiro + valor + estado que deduz + vale pago). Usado pela guarda de
 * dupla contagem: uma encomenda criada a partir de um destes vales
 * (`gift_voucher_code`) NÃO deve contar a sua própria comissão.
 */
export function voucherCodesWithCommission(
  vouchers: ReadonlyArray<VoucherCommissionInput & { code: string }>,
): Set<string> {
  const set = new Set<string>();
  for (const v of vouchers) {
    if (commissionFullFromVoucher(v) > 0) set.add(v.code);
  }
  return set;
}

/**
 * True quando a comissão desta encomenda deve ser SUPRIMIDA por já estar
 * contada no vale de origem — a encomenda foi paga com um vale que carrega
 * comissão. Evita contar a mesma comissão duas vezes.
 */
export function orderCommissionSuppressedByVoucher(
  order: Pick<Order, "gift_voucher_code">,
  voucherCommissionCodes: ReadonlySet<string>,
): boolean {
  return (
    !!order.gift_voucher_code && voucherCommissionCodes.has(order.gift_voucher_code)
  );
}

// ── Receita por data de pagamento (mig 111) ─────────────────
//
// Os clientes pagam em parcelas (30% / 40% / 30% do orçamento) e, desde a
// mig 111, a BD carimba o momento de cada uma (deposit_paid_at /
// second_paid_at / fully_paid_at). A receita conta no PERÍODO EM QUE O
// DINHEIRO ENTROU (decisão da Maria, sessão 174), e não pela data do
// evento como até aqui. Encomendas sem carimbo (anteriores à mig 111 sem
// histórico no audit_log, importadas do Monday) caem na data do evento,
// para não desaparecerem dos totais. Comissões seguem as mesmas parcelas;
// o custo de produção (tudo-ou-nada aos 100%) conta na data dos 100%.
//
// Percentagens em inteiros (30/40/30) e divisão no fim, para 30+40+30
// dar exactamente 100 (em vírgula flutuante 0.3+0.4+0.3 ≠ 1).

export type OrderForRevenueDates = Pick<Order, "budget" | "payment_status" | "status" | "event_date"> &
  Partial<Pick<Order, "deposit_paid_at" | "second_paid_at" | "fully_paid_at">>;

export interface RevenueTranche {
  /** Data que conta para o período: o carimbo, ou a data do evento se não há. */
  at: string | null;
  /** Percentagem do orçamento desta parcela (30 / 40 / 30). */
  pct: number;
  /** true = veio do carimbo da BD; false = caiu na data do evento. */
  stamped: boolean;
}

export function revenueTranches(
  o: Pick<Order, "payment_status"> &
    Partial<Pick<Order, "deposit_paid_at" | "second_paid_at" | "fully_paid_at" | "event_date">>,
): RevenueTranche[] {
  const r = paidRatio(o.payment_status);
  if (r <= 0) return [];
  const mk = (at: string | null | undefined, pct: number): RevenueTranche => ({
    at: at ?? o.event_date ?? null,
    pct,
    stamped: !!at,
  });
  const t: RevenueTranche[] = [mk(o.deposit_paid_at, 30)];
  if (r >= 0.7) t.push(mk(o.second_paid_at, 40));
  if (r >= 1) t.push(mk(o.fully_paid_at, 30));
  return t;
}

function inPeriodISO(iso: string | null, start: Date, end: Date): boolean {
  if (!iso) return false;
  const d = parseISO(iso);
  return d >= start && d <= end;
}

/** Percentagem (0-100) do orçamento cujo pagamento entrou no período. */
export function paidPctInPeriod(
  o: Parameters<typeof revenueTranches>[0],
  start: Date,
  end: Date,
): number {
  let pct = 0;
  for (const t of revenueTranches(o)) if (inPeriodISO(t.at, start, end)) pct += t.pct;
  return pct;
}

/** Receita reconhecida no período: orçamento × parcelas pagas nesse período. */
export function revenueInPeriod(o: OrderForRevenueDates, start: Date, end: Date): number {
  if (o.status === "cancelado" || !o.budget) return 0;
  return (Number(o.budget) * paidPctInPeriod(o, start, end)) / 100;
}

/** Comissão a parceiro no período, proporcional às parcelas pagas nele. */
export function commissionInPeriod(
  o: OrderForRevenueDates & Pick<Order, "partner_commission" | "partner_commission_status">,
  start: Date,
  end: Date,
): number {
  if (o.status === "cancelado") return 0;
  return (commissionFullFromOrder(o) * paidPctInPeriod(o, start, end)) / 100;
}

/** Custo de produção no período: tudo-ou-nada, na data em que ficou 100% pago. */
export function cogsInPeriod(
  o: OrderForCogs & OrderForRevenueDates,
  start: Date,
  end: Date,
): number {
  if (o.status === "cancelado" || o.payment_status !== "100_pago") return 0;
  const at = o.fully_paid_at ?? o.event_date ?? null;
  return inPeriodISO(at, start, end) ? cogsFullFromOrder(o) : 0;
}

/** Quanto falta o cliente pagar: orçamento × (1 − % pago). 0 para canceladas. */
export function outstandingFromOrder(
  o: Pick<Order, "budget" | "payment_status" | "status">,
): number {
  if (o.status === "cancelado" || !o.budget) return 0;
  return (Number(o.budget) * (100 - Math.round(paidRatio(o.payment_status) * 100))) / 100;
}

// ── COGS por encomenda ───────────────────────────────────────

type OrderForCogs = Pick<
  Order,
  | "payment_status"
  | "frame_size"
  | "frame_background"
  // Sem isto o desconto do vidro normal nunca chegava ao COGS: o campo é
  // opcional em OrderFieldsForCost (por causa das encomendas antigas), por
  // isso a omissão compilava e falhava em silêncio.
  | "museum_glass"
  | "museum_glass_mini"
  | "pyramid_frame"
  | "frame_internal_type"
  | "extra_small_frames"
  | "extra_small_frames_qty"
  | "additional_main_frames"
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
 * COGS reconhecido por encomenda — tudo-ou-nada: só conta quando a
 * encomenda está 100% paga (decisão Maria 2026-05-22). Reflecte a
 * realidade de que os materiais são gastos de uma vez e o custo só
 * "fecha" quando o cliente paga o total. Encomendas a 30%/70%/por
 * pagar não contribuem para o COGS do período.
 */
export function cogsRecognizedFromOrder(order: OrderForCogs): number {
  return order.payment_status === "100_pago" ? cogsFullFromOrder(order) : 0;
}

// ── P&L composto por encomenda ───────────────────────────────

export interface OrderPnL {
  revenue_full: number;        // budget
  revenue_recognized: number;  // budget × %pago
  cogs_full: number;
  cogs_recognized: number;     // tudo-ou-nada: cogs_full se 100% pago, senão 0
  commission_full: number;
  commission_recognized: number;
  margin_full: number;         // revenue_full − cogs_full − commission_full
  margin_recognized: number;   // revenue_recognized − cogs_recognized − commission_recognized
  margin_pct: number;          // margin_full / revenue_full × 100 (0 se receita = 0)
  paid_ratio: number;
}

type OrderForPnL = OrderForCogs &
  Pick<Order, "budget" | "partner_commission" | "partner_commission_status">;

export function orderPnL(order: OrderForPnL): OrderPnL {
  const ratio = paidRatio(order.payment_status);
  const isFullyPaid = order.payment_status === "100_pago";
  const revenue_full = Number(order.budget ?? 0);
  const cogs_full = cogsFullFromOrder(order);
  const commission_full = commissionFullFromOrder(order);
  const margin_full = revenue_full - cogs_full - commission_full;
  const revenue_recognized = revenue_full * ratio;
  const cogs_recognized = isFullyPaid ? cogs_full : 0;
  const commission_recognized = commission_full * ratio;
  return {
    revenue_full,
    revenue_recognized,
    cogs_full,
    cogs_recognized,
    commission_full,
    commission_recognized,
    margin_full,
    margin_recognized: revenue_recognized - cogs_recognized - commission_recognized,
    margin_pct: revenue_full > 0 ? (margin_full / revenue_full) * 100 : 0,
    paid_ratio: ratio,
  };
}
