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
  supplier: string;
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
  supplier: string;
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
 * Normaliza uma despesa recorrente para um custo mensal equivalente.
 * - Mensal → amount
 * - Anual → amount / 12
 * - Custom (start→end) → amount * ocorrências esperadas no intervalo / nº meses
 *   (interpretação: amount é por ocorrência mensal; intervalo só limita período).
 * Se a despesa não é recorrente, devolve 0.
 */
export function monthlyEquivalent(e: Pick<Expense,
  | "is_recurring"
  | "recurrence_period"
  | "amount"
>): number {
  if (!e.is_recurring) return 0;
  const amt = Number(e.amount);
  switch (e.recurrence_period) {
    case "monthly": return amt;
    case "yearly":  return amt / 12;
    case "custom":  return amt; // tratamos como mensal dentro do intervalo
    default:        return 0;
  }
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
