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
