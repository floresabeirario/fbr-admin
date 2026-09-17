// ============================================================
// FBR Admin — Tipos TypeScript para despesas
// ============================================================

export type ExpenseCategory =
  | "flores"
  | "molduras"
  | "materiais"
  | "transporte"
  | "marketing"
  | "software"
  | "servicos"
  | "taxas"
  | "outros";

export type ExpensePaymentMethod =
  | "mb_way"
  | "transferencia"
  | "cartao"
  | "numerario"
  | "multibanco"
  | "outro";

export type ExpenseRecurrencePeriod = "monthly" | "yearly" | "custom";

export interface Expense {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  created_by_email: string | null;
  updated_by: string | null;

  expense_date: string;
  supplier: string | null;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  vat_rate: number | null;
  payment_method: ExpensePaymentMethod | null;
  has_invoice: boolean;
  invoice_url: string | null;
  notes: string | null;

  // Recorrência (subscrições): se is_recurring=true, expense_date é
  // tratado como referência mas o que conta para os relatórios é o
  // par {recurrence_period, recurrence_start_date, recurrence_end_date}.
  is_recurring: boolean;
  recurrence_period: ExpenseRecurrencePeriod | null;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
}

export type ExpenseInsert = Partial<Omit<Expense, "id" | "created_at" | "updated_at">> & {
  expense_date: string;
  description: string;
  amount: number;
};

export type ExpenseUpdate = Partial<Omit<Expense, "id" | "created_at">>;

// ── Labels & cores ──

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  flores: "Flores",
  molduras: "Molduras",
  materiais: "Materiais",
  transporte: "Transporte",
  marketing: "Marketing",
  software: "Software",
  servicos: "Serviços",
  taxas: "Taxas",
  outros: "Outros",
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  flores:     "bg-pink-100 text-pink-800 border-pink-300",
  molduras:   "bg-amber-100 text-amber-800 border-amber-300",
  materiais:  "bg-orange-100 text-orange-800 border-orange-300",
  transporte: "bg-sky-100 text-sky-800 border-sky-300",
  marketing:  "bg-violet-100 text-violet-800 border-violet-300",
  software:   "bg-cyan-100 text-cyan-800 border-cyan-300",
  servicos:   "bg-emerald-100 text-emerald-800 border-emerald-300",
  taxas:      "bg-rose-100 text-rose-800 border-rose-300",
  outros:     "bg-slate-100 text-slate-700 border-slate-300",
};

export const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = [
  "flores",
  "molduras",
  "materiais",
  "transporte",
  "marketing",
  "software",
  "servicos",
  "taxas",
  "outros",
];

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  mb_way: "MB Way",
  transferencia: "Transferência",
  cartao: "Cartão",
  numerario: "Numerário",
  multibanco: "Multibanco",
  outro: "Outro",
};

export const EXPENSE_RECURRENCE_PERIOD_LABELS: Record<ExpenseRecurrencePeriod, string> = {
  monthly: "Mensal",
  yearly: "Anual",
  custom: "Intervalo específico",
};

/**
 * Nº de meses (com fracção) entre duas datas. Usado para repartir um
 * pagamento "custom" ao longo do intervalo. 06/04/2026 → 06/06/2027
 * dá 14 meses exactos; dias intermédios contam como fracção (÷30).
 */
function monthsSpan(start: Date, end: Date): number {
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = (end.getDate() - start.getDate()) / 30;
  return yearDiff * 12 + monthDiff + dayDiff;
}

/**
 * Normaliza uma despesa recorrente para um custo mensal equivalente.
 * - Mensal → amount
 * - Anual → amount / 12
 * - Custom (start→end) → amount é o TOTAL pago pelo intervalo
 *   completo (ex.: paguei 41,70€ por 14 meses de uma vez → 2,98€/mês).
 * Se a despesa não é recorrente, devolve 0.
 */
export function monthlyEquivalent(e: Pick<Expense,
  | "is_recurring"
  | "recurrence_period"
  | "amount"
  | "recurrence_start_date"
  | "recurrence_end_date"
>): number {
  if (!e.is_recurring) return 0;
  const amt = Number(e.amount);
  switch (e.recurrence_period) {
    case "monthly": return amt;
    case "yearly":  return amt / 12;
    case "custom": {
      if (!e.recurrence_start_date || !e.recurrence_end_date) return amt;
      const months = monthsSpan(
        new Date(e.recurrence_start_date),
        new Date(e.recurrence_end_date),
      );
      if (months <= 0) return amt;
      return amt / months;
    }
    default: return 0;
  }
}

/**
 * Total acumulado de uma subscrição desde o início até `at` (ou até
 * `recurrence_end_date` se já terminou antes). Devolve 0 se não é
 * recorrente ou ainda não começou.
 *
 * - Custom: amount é o valor TOTAL pelo intervalo; acumula
 *   proporcionalmente ao tempo decorrido, com tecto no amount total.
 * - Mensal/Anual: usa o custo mensal equivalente × nº de meses
 *   decorridos (inclusivo no mês de início).
 */
export function subscriptionTotalToDate(
  e: Pick<Expense,
    | "is_recurring"
    | "recurrence_period"
    | "recurrence_start_date"
    | "recurrence_end_date"
    | "amount"
  >,
  at: Date,
): number {
  if (!e.is_recurring || !e.recurrence_start_date) return 0;
  const start = new Date(e.recurrence_start_date);
  if (at < start) return 0;

  if (e.recurrence_period === "custom") {
    const amt = Number(e.amount);
    if (!e.recurrence_end_date) return amt;
    const end = new Date(e.recurrence_end_date);
    const totalMs = end.getTime() - start.getTime();
    if (totalMs <= 0) return amt;
    const effectiveEnd = end < at ? end : at;
    const elapsedMs = effectiveEnd.getTime() - start.getTime();
    const ratio = Math.min(1, Math.max(0, elapsedMs / totalMs));
    return amt * ratio;
  }

  const end = e.recurrence_end_date ? new Date(e.recurrence_end_date) : at;
  const effectiveEnd = end < at ? end : at;
  if (effectiveEnd < start) return 0;
  const months =
    (effectiveEnd.getFullYear() - start.getFullYear()) * 12 +
    (effectiveEnd.getMonth() - start.getMonth()) + 1;
  return Math.max(0, months) * monthlyEquivalent(e);
}

/**
 * Datas para "o valor novo conta a partir de <mês>" (sessão 174): a
 * subscrição antiga termina no último dia do mês anterior e a nova começa
 * no dia 1 desse mês. Como as contas são feitas ao mês (início e fim
 * inclusive), não há sobreposição nem buraco: o mês anterior conta ao
 * valor antigo, o mês escolhido já conta ao novo.
 * `fromMonth` no formato "yyyy-MM" (input type=month).
 */
export function subscriptionSplitDates(fromMonth: string): {
  oldEnd: string;
  newStart: string;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(fromMonth);
  if (!m) throw new Error(`Mês inválido: ${fromMonth}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (month < 1 || month > 12) throw new Error(`Mês inválido: ${fromMonth}`);
  // Dia 0 do mês seguinte ao anterior = último dia do mês anterior.
  const prevEnd = new Date(year, month - 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    oldEnd: `${prevEnd.getFullYear()}-${pad(prevEnd.getMonth() + 1)}-${pad(prevEnd.getDate())}`,
    newStart: `${year}-${pad(month)}-01`,
  };
}

/**
 * Devolve true se uma subscrição está activa numa dada data
 * (entre start e end, inclusive; end NULL = ainda activa).
 */
export function isSubscriptionActive(
  e: Pick<Expense, "is_recurring" | "recurrence_start_date" | "recurrence_end_date">,
  at: Date,
): boolean {
  if (!e.is_recurring || !e.recurrence_start_date) return false;
  const start = new Date(e.recurrence_start_date);
  if (at < start) return false;
  if (e.recurrence_end_date) {
    const end = new Date(e.recurrence_end_date);
    if (at > end) return false;
  }
  return true;
}
