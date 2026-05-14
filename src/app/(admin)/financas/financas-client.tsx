"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Euro,
  Tags,
  Receipt,
  TrendingUp,
  Swords,
  Plus,
  ExternalLink,
  MapPin,
  Globe,
  Trash2,
  Save,
  X,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  FileText,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { pt } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import type { Competitor, CompetitorPrice } from "@/types/competitor";
import type { PricingItem, PricingCategory } from "@/types/pricing";
import {
  PRICING_CATEGORY_LABELS,
  PRICING_CATEGORY_HELPER,
} from "@/types/pricing";
import type { Expense, ExpenseCategory, ExpensePaymentMethod } from "@/types/expense";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_ORDER,
  EXPENSE_PAYMENT_METHOD_LABELS,
} from "@/types/expense";
import {
  createCompetitorAction,
  updateCompetitorAction,
  archiveCompetitorAction,
  updatePricingItemAction,
  createExpenseAction,
  updateExpenseAction,
  archiveExpenseAction,
} from "./actions";

type TabKey = "precos" | "despesas" | "faturacao" | "competicao";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { key: "precos",     label: "Tabela de preços", icon: Tags,       color: "text-sky-500" },
  { key: "despesas",   label: "Despesas",         icon: Receipt,    color: "text-rose-500" },
  { key: "faturacao",  label: "Faturação",        icon: TrendingUp, color: "text-emerald-500" },
  { key: "competicao", label: "Competição",       icon: Swords,     color: "text-violet-500" },
];

function formatEuro(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

interface Props {
  initialCompetitors: Competitor[];
  initialPricing: PricingItem[];
  initialExpenses: Expense[];
  orders: Array<Pick<import("@/types/database").Order, "id" | "order_id" | "created_at" | "status" | "payment_status" | "budget" | "frame_delivery_date">>;
  vouchers: Array<Pick<import("@/types/voucher").Voucher, "id" | "code" | "created_at" | "amount" | "payment_status" | "usage_status">>;
  canEdit: boolean;
}

export default function FinancasClient({
  initialCompetitors,
  initialPricing,
  initialExpenses,
  orders,
  vouchers,
  canEdit,
}: Props) {
  const [tab, setTab] = useState<TabKey>("precos");

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm flex items-center justify-center">
          <Euro className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
          Finanças
        </h1>
      </div>

      {/* Pill tabs (mesmo padrão visual da aba Parcerias) */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors",
                active
                  ? "bg-[#3D2B1F] text-white border-[#3D2B1F] dark:bg-[#E8D5B5] dark:text-[#1A1A1A] dark:border-[#E8D5B5]"
                  : "bg-white dark:bg-[#141414] text-[#3D2B1F] dark:text-[#E8D5B5] border-[#E8E0D5] dark:border-[#2C2C2E] hover:border-[#C4A882]",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-white dark:text-[#1A1A1A]" : t.color)} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "competicao" && (
        <CompeticaoTab competitors={initialCompetitors} canEdit={canEdit} />
      )}
      {tab === "precos"    && <PrecosTab pricing={initialPricing} canEdit={canEdit} />}
      {tab === "despesas"  && <DespesasTab expenses={initialExpenses} canEdit={canEdit} />}
      {tab === "faturacao" && <FaturacaoTab orders={orders} vouchers={vouchers} expenses={initialExpenses} />}
    </div>
  );
}

// ============================================================
// TABELA DE PREÇOS
// ============================================================

const PRICING_CATEGORY_ORDER: PricingCategory[] = [
  "base_frame",
  "background_supplement",
  "extra",
];

const PRICING_CATEGORY_COLORS: Record<PricingCategory, string> = {
  base_frame: "from-sky-50 to-blue-100 border-sky-200",
  background_supplement: "from-violet-50 to-purple-100 border-violet-200",
  extra: "from-amber-50 to-orange-100 border-amber-200",
};

function PrecosTab({
  pricing,
  canEdit,
}: {
  pricing: PricingItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<PricingCategory, PricingItem[]>();
    for (const cat of PRICING_CATEGORY_ORDER) map.set(cat, []);
    for (const item of pricing) {
      const list = map.get(item.category);
      if (list) list.push(item);
    }
    return map;
  }, [pricing]);

  function savePrice(item: PricingItem, raw: string) {
    const next = raw.trim() === "" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(next) || next < 0) {
      toast.error("Preço inválido");
      return;
    }
    if (next === item.price) return;
    setSaving(item.id);
    startTransition(async () => {
      try {
        await updatePricingItemAction(item.id, { price: next });
        toast.success(`${item.label}: ${formatEuro(next)}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
      } finally {
        setSaving(null);
      }
    });
  }

  function saveNotes(item: PricingItem, raw: string) {
    const next = raw.trim() === "" ? null : raw.trim();
    if (next === item.notes) return;
    setSaving(item.id);
    startTransition(async () => {
      try {
        await updatePricingItemAction(item.id, { notes: next });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
      } finally {
        setSaving(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Aviso explicativo */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-900 p-4 flex gap-3">
        <Tags className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-sm text-sky-900 dark:text-sky-200 leading-relaxed">
          <p className="font-semibold mb-1">Como funciona o orçamento automático</p>
          <p>
            Ao criar uma encomenda nova, o orçamento é calculado automaticamente
            a partir destes preços: base do tamanho + suplemento de fundo +
            extras × quantidade. <strong>Aumentos futuros aqui não recalculam
            encomendas antigas</strong> — cada encomenda guarda um snapshot
            congelado dos preços do dia da criação. Podes sempre editar o
            orçamento manualmente em cada workbench.
          </p>
          {!canEdit && (
            <p className="mt-2 italic text-sky-700 dark:text-sky-300">
              Modo leitura — só administradores podem editar.
            </p>
          )}
        </div>
      </div>

      {PRICING_CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat) ?? [];
        if (items.length === 0) return null;
        const color = PRICING_CATEGORY_COLORS[cat];
        return (
          <div
            key={cat}
            className={cn(
              "rounded-2xl border bg-gradient-to-br p-4 space-y-3",
              color,
            )}
          >
            <div>
              <h2 className="text-sm font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
                {PRICING_CATEGORY_LABELS[cat]}
              </h2>
              <p className="text-xs text-[#8B7355] dark:text-[#8E8E93] mt-0.5">
                {PRICING_CATEGORY_HELPER[cat]}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-[#141414] overflow-hidden border border-white/40">
              <table className="w-full text-sm">
                <thead className="bg-[#FAF8F5] dark:bg-[#1A1A1A] text-xs uppercase tracking-wide text-[#8B7355] dark:text-[#8E8E93]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-left px-3 py-2 font-medium w-32">Preço (€)</th>
                    <th className="text-left px-3 py-2 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <PriceRow
                      key={item.id}
                      item={item}
                      canEdit={canEdit}
                      saving={saving === item.id}
                      onSavePrice={(v) => savePrice(item, v)}
                      onSaveNotes={(v) => saveNotes(item, v)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PriceRow({
  item,
  canEdit,
  saving,
  onSavePrice,
  onSaveNotes,
}: {
  item: PricingItem;
  canEdit: boolean;
  saving: boolean;
  onSavePrice: (raw: string) => void;
  onSaveNotes: (raw: string) => void;
}) {
  const [priceDraft, setPriceDraft] = useState(item.price.toString().replace(".", ","));
  const [notesDraft, setNotesDraft] = useState(item.notes ?? "");

  // Padrão "store info from previous renders" — sincroniza o draft local
  // com a prop quando o item muda na BD (sem useEffect+setState).
  const [lastItemId, setLastItemId] = useState(item.id);
  const [lastPrice, setLastPrice] = useState(item.price);
  if (item.id !== lastItemId || item.price !== lastPrice) {
    setLastItemId(item.id);
    setLastPrice(item.price);
    setPriceDraft(item.price.toString().replace(".", ","));
    setNotesDraft(item.notes ?? "");
  }

  return (
    <tr className="border-t border-[#F0EAE0] dark:border-[#2C2C2E]">
      <td className="px-3 py-2 align-middle">
        <div className="font-medium text-[#3D2B1F] dark:text-[#E8D5B5]">{item.label}</div>
        <div className="text-[10px] uppercase tracking-wider text-[#B8A99A] mt-0.5">
          {item.key}
        </div>
      </td>
      <td className="px-3 py-2 align-middle">
        <Input
          value={priceDraft}
          onChange={(e) => setPriceDraft(e.target.value)}
          onBlur={() => onSavePrice(priceDraft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={!canEdit || saving}
          inputMode="decimal"
          className="h-8 w-24 text-sm font-medium"
          placeholder="0,00"
        />
      </td>
      <td className="px-3 py-2 align-middle">
        <Input
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => onSaveNotes(notesDraft)}
          disabled={!canEdit || saving}
          className="h-8 text-sm"
          placeholder="(opcional)"
        />
      </td>
    </tr>
  );
}

// ============================================================
// DESPESAS
// ============================================================

function DespesasTab({
  expenses,
  canEdit,
}: {
  expenses: Expense[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "todas">("todas");
  const [search, setSearch] = useState("");
  const [newExpense, setNewExpense] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    supplier: "",
    category: "outros" as ExpenseCategory,
    amount: "",
    description: "",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== "todas" && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.supplier.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter]);

  const totalFiltered = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalAll = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const thisMonth = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return expenses
      .filter((e) => {
        const d = parseISO(e.expense_date);
        return d >= start && d <= end;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [expenses]);

  function handleCreate() {
    const amount = parseFloat(newExpense.amount.replace(",", "."));
    if (!newExpense.supplier.trim() || !amount || amount <= 0) {
      toast.error("Preenche fornecedor e valor válido.");
      return;
    }
    startTransition(async () => {
      try {
        await createExpenseAction({
          expense_date: newExpense.expense_date,
          supplier: newExpense.supplier.trim(),
          category: newExpense.category,
          amount,
          description: newExpense.description.trim() || null,
        });
        toast.success("Despesa registada.");
        setCreating(false);
        setNewExpense({
          expense_date: format(new Date(), "yyyy-MM-dd"),
          supplier: "",
          category: "outros",
          amount: "",
          description: "",
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registar.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiBox label="Total registado" value={formatEuro(totalAll)} icon={<Receipt className="h-4 w-4" />} color="rose" />
        <KpiBox label="Este mês" value={formatEuro(thisMonth)} icon={<TrendingUp className="h-4 w-4" />} color="amber" />
        <KpiBox label={`Filtrado (${filtered.length})`} value={formatEuro(totalFiltered)} icon={<FileText className="h-4 w-4" />} color="slate" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A]" />
          <Input
            placeholder="Pesquisar fornecedor ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ExpenseCategory | "todas")}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {EXPENSE_CATEGORY_ORDER.map((c) => (
              <SelectItem key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <Button onClick={() => setCreating((v) => !v)} className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white h-9 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova despesa
          </Button>
        )}
      </div>

      {/* Form criar */}
      {creating && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-rose-900">Registar nova despesa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_180px_120px] gap-2">
            <Input
              type="date"
              value={newExpense.expense_date}
              onChange={(e) => setNewExpense((p) => ({ ...p, expense_date: e.target.value }))}
            />
            <Input
              placeholder="Fornecedor"
              value={newExpense.supplier}
              onChange={(e) => setNewExpense((p) => ({ ...p, supplier: e.target.value }))}
            />
            <Select value={newExpense.category} onValueChange={(v) => setNewExpense((p) => ({ ...p, category: v as ExpenseCategory }))}>
              <SelectTrigger>
                <SelectValue labels={EXPENSE_CATEGORY_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#8B7355]">€</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                className="pl-6"
                value={newExpense.amount}
                onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
          </div>
          <Textarea
            placeholder="Descrição (opcional)"
            value={newExpense.description}
            onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))}
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white">Registar</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E8E0D5] bg-white p-12 text-center">
          <Receipt className="h-12 w-12 mx-auto text-rose-200 mb-3" />
          <p className="text-sm text-[#8B7355]">
            {expenses.length === 0
              ? "Ainda não há despesas registadas."
              : "Nenhuma despesa corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E8E0D5] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-[#FAF8F5]">
                <tr className="text-left text-xs uppercase tracking-wide text-[#8B7355]">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium">Pagamento</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <ExpenseRow key={e.id} expense={e} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseRow({ expense, canEdit }: { expense: Expense; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleField<K extends keyof Expense>(key: K, value: Expense[K]) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await updateExpenseAction(expense.id, { [key]: value } as Partial<Expense>);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar.");
      }
    });
  }

  function handleArchive() {
    if (!confirm("Arquivar esta despesa?")) return;
    startTransition(async () => {
      try {
        await archiveExpenseAction(expense.id);
        toast.success("Despesa arquivada.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao arquivar.");
      }
    });
  }

  return (
    <tr className="border-t border-[#F0EAE0] hover:bg-[#FAF8F5]/60">
      <td className="px-3 py-2 text-[#3D2B1F] whitespace-nowrap">
        {format(parseISO(expense.expense_date), "dd/MM/yyyy")}
      </td>
      <td className="px-3 py-2 text-[#3D2B1F] font-medium">{expense.supplier}</td>
      <td className="px-3 py-2">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          EXPENSE_CATEGORY_COLORS[expense.category]
        )}>
          {EXPENSE_CATEGORY_LABELS[expense.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-[#8B7355] text-xs max-w-[300px] truncate">
        {expense.description ?? ""}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-rose-700 whitespace-nowrap">
        {formatEuro(Number(expense.amount))}
      </td>
      <td className="px-3 py-2">
        {canEdit ? (
          <Select
            value={expense.payment_method ?? ""}
            onValueChange={(v) => handleField("payment_method", (v || null) as ExpensePaymentMethod | null)}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="—" labels={EXPENSE_PAYMENT_METHOD_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EXPENSE_PAYMENT_METHOD_LABELS) as ExpensePaymentMethod[]).map((m) => (
                <SelectItem key={m} value={m}>{EXPENSE_PAYMENT_METHOD_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-[#8B7355]">
            {expense.payment_method ? EXPENSE_PAYMENT_METHOD_LABELS[expense.payment_method] : "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {canEdit && (
          <button
            onClick={handleArchive}
            className="text-[#B8A99A] hover:text-rose-600 transition-colors"
            title="Arquivar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ============================================================
// FATURAÇÃO
// ============================================================

type FaturacaoOrder = Pick<import("@/types/database").Order, "id" | "order_id" | "created_at" | "status" | "payment_status" | "budget" | "frame_delivery_date">;
type FaturacaoVoucher = Pick<import("@/types/voucher").Voucher, "id" | "code" | "created_at" | "amount" | "payment_status" | "usage_status">;

function FaturacaoTab({
  orders,
  vouchers,
  expenses,
}: {
  orders: FaturacaoOrder[];
  vouchers: FaturacaoVoucher[];
  expenses: Expense[];
}) {
  // Receita = orders com pagamento ≥ 30% + vales pagos não convertidos (evitar dupla contagem)
  const revenueFromOrder = (o: FaturacaoOrder): number => {
    if (!o.budget) return 0;
    switch (o.payment_status) {
      case "100_pago": return o.budget;
      case "70_pago":  return o.budget * 0.7;
      case "30_pago":  return o.budget * 0.3;
      default: return 0;
    }
  };
  const revenueFromVoucher = (v: FaturacaoVoucher): number => {
    if (v.payment_status !== "100_pago") return 0;
    if (v.usage_status === "preservacao_agendada") return 0; // evita dupla contagem com a encomenda
    return Number(v.amount);
  };

  // KPIs por período
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const inRange = (iso: string | null, start: Date, end: Date): boolean => {
    if (!iso) return false;
    const d = parseISO(iso);
    return d >= start && d <= end;
  };

  const revenueOrdersMonth = orders
    .filter((o) => inRange(o.created_at, monthStart, monthEnd))
    .reduce((s, o) => s + revenueFromOrder(o), 0);
  const revenueVouchersMonth = vouchers
    .filter((v) => inRange(v.created_at, monthStart, monthEnd))
    .reduce((s, v) => s + revenueFromVoucher(v), 0);
  const revenueMonth = revenueOrdersMonth + revenueVouchersMonth;

  const revenuePrevMonth =
    orders.filter((o) => inRange(o.created_at, prevMonthStart, prevMonthEnd)).reduce((s, o) => s + revenueFromOrder(o), 0) +
    vouchers.filter((v) => inRange(v.created_at, prevMonthStart, prevMonthEnd)).reduce((s, v) => s + revenueFromVoucher(v), 0);

  const revenueYear =
    orders.filter((o) => inRange(o.created_at, yearStart, now)).reduce((s, o) => s + revenueFromOrder(o), 0) +
    vouchers.filter((v) => inRange(v.created_at, yearStart, now)).reduce((s, v) => s + revenueFromVoucher(v), 0);

  const expensesMonth = expenses
    .filter((e) => inRange(e.expense_date, monthStart, monthEnd))
    .reduce((s, e) => s + Number(e.amount), 0);
  const expensesYear = expenses
    .filter((e) => inRange(e.expense_date, yearStart, now))
    .reduce((s, e) => s + Number(e.amount), 0);

  const profitMonth = revenueMonth - expensesMonth;
  const profitYear = revenueYear - expensesYear;
  const monthDelta = revenuePrevMonth > 0 ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : null;

  // Receita por mês (últimos 12)
  const monthlyData = useMemo(() => {
    const buckets: { month: string; label: string; revenue: number; expenses: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = startOfMonth(subMonths(now, i));
      const end = endOfMonth(subMonths(now, i));
      const rev =
        orders.filter((o) => inRange(o.created_at, start, end)).reduce((s, o) => s + revenueFromOrder(o), 0) +
        vouchers.filter((v) => inRange(v.created_at, start, end)).reduce((s, v) => s + revenueFromVoucher(v), 0);
      const exp = expenses.filter((e) => inRange(e.expense_date, start, end)).reduce((s, e) => s + Number(e.amount), 0);
      buckets.push({
        month: format(start, "yyyy-MM"),
        label: format(start, "MMM yy", { locale: pt }),
        revenue: rev,
        expenses: exp,
      });
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, vouchers, expenses]);

  const maxBarValue = Math.max(...monthlyData.map((m) => Math.max(m.revenue, m.expenses)), 1);

  return (
    <div className="space-y-4">
      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox
          label="Receita do mês"
          value={formatEuro(revenueMonth)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="emerald"
          delta={monthDelta}
        />
        <KpiBox label="Receita do ano" value={formatEuro(revenueYear)} icon={<ArrowUpRight className="h-4 w-4" />} color="sky" />
        <KpiBox label="Despesas do mês" value={formatEuro(expensesMonth)} icon={<ArrowDownRight className="h-4 w-4" />} color="rose" />
        <KpiBox
          label="Lucro do mês"
          value={formatEuro(profitMonth)}
          icon={<CreditCard className="h-4 w-4" />}
          color={profitMonth >= 0 ? "emerald" : "rose"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiBox label="Despesas do ano" value={formatEuro(expensesYear)} icon={<Receipt className="h-4 w-4" />} color="rose" />
        <KpiBox label="Lucro do ano" value={formatEuro(profitYear)} icon={<TrendingUp className="h-4 w-4" />} color={profitYear >= 0 ? "emerald" : "rose"} />
      </div>

      {/* Bar chart manual: últimos 12 meses */}
      <div className="rounded-xl border border-[#E8E0D5] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#3D2B1F]">
            Receita vs despesas (últimos 12 meses)
          </h3>
          <div className="flex items-center gap-3 text-xs text-[#8B7355]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-400" />Receita
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-400" />Despesas
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-48">
          {monthlyData.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5 h-40">
                <div
                  className="w-2.5 sm:w-3 bg-emerald-400 rounded-t transition-all"
                  style={{ height: `${(m.revenue / maxBarValue) * 100}%` }}
                  title={`Receita: ${formatEuro(m.revenue)}`}
                />
                <div
                  className="w-2.5 sm:w-3 bg-rose-400 rounded-t transition-all"
                  style={{ height: `${(m.expenses / maxBarValue) * 100}%` }}
                  title={`Despesas: ${formatEuro(m.expenses)}`}
                />
              </div>
              <span className="text-[10px] text-[#8B7355] capitalize">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[#8B7355] italic px-1">
        Receita = soma proporcional do orçamento das encomendas conforme o estado de pagamento (100%=100%, 70%=70%, 30%=30%) + vales 100% pagos que ainda não foram convertidos em preservação (evita dupla contagem). Para métricas mais detalhadas, ver a aba Métricas.
      </p>
    </div>
  );
}

function KpiBox({
  label,
  value,
  icon,
  color,
  delta,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "emerald" | "rose" | "sky" | "amber" | "slate" | "violet";
  delta?: number | null;
}) {
  const palette: Record<string, string> = {
    emerald: "from-emerald-50 to-emerald-100/60 border-emerald-200 text-emerald-800",
    rose:    "from-rose-50 to-rose-100/60 border-rose-200 text-rose-800",
    sky:     "from-sky-50 to-sky-100/60 border-sky-200 text-sky-800",
    amber:   "from-amber-50 to-amber-100/60 border-amber-200 text-amber-800",
    slate:   "from-slate-50 to-slate-100/60 border-slate-200 text-slate-800",
    violet:  "from-violet-50 to-violet-100/60 border-violet-200 text-violet-800",
  };
  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-4 space-y-1", palette[color])}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider opacity-80 font-medium">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {delta !== undefined && delta !== null && (
        <p className={cn("text-xs font-medium", delta >= 0 ? "text-emerald-700" : "text-rose-700")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs. mês anterior
        </p>
      )}
    </div>
  );
}

// ============================================================
// COMPETIÇÃO
// ============================================================

function CompeticaoTab({
  competitors,
  canEdit,
}: {
  competitors: Competitor[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return competitors;
    const q = search.trim().toLowerCase();
    return competitors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.location_label ?? "").toLowerCase().includes(q) ||
        c.websites.some((w) => w.toLowerCase().includes(q)),
    );
  }, [competitors, search]);

  // Estatísticas de referência: preço médio do nosso quadro mais pequeno
  // calculado a partir das tabelas dos concorrentes (referência visual).
  const stats = useMemo(() => {
    const allPrices = competitors.flatMap((c) => c.prices);
    const validPrices = allPrices.filter((p) => p.price !== null && p.price > 0);
    if (validPrices.length === 0) {
      return { count: competitors.length, avgPrice: null, minPrice: null, maxPrice: null };
    }
    const sum = validPrices.reduce((s, p) => s + (p.price ?? 0), 0);
    const prices = validPrices.map((p) => p.price!).sort((a, b) => a - b);
    return {
      count: competitors.length,
      avgPrice: sum / validPrices.length,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
    };
  }, [competitors]);

  return (
    <div className="space-y-4">
      {/* KPIs / sumário */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Concorrentes registados" value={String(stats.count)} color="from-violet-50 to-purple-100 border-violet-200" />
        <StatCard label="Preço médio (todos os produtos)" value={formatEuro(stats.avgPrice)} color="from-sky-50 to-blue-100 border-sky-200" />
        <StatCard label="Preço mais baixo" value={formatEuro(stats.minPrice)} color="from-emerald-50 to-green-100 border-emerald-200" />
        <StatCard label="Preço mais alto" value={formatEuro(stats.maxPrice)} color="from-amber-50 to-orange-100 border-amber-200" />
      </div>

      {/* Toolbar: search + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B8A99A]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por nome, localização ou site…"
            className="pl-9 h-9"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setShowNew(true)} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Novo concorrente
          </Button>
        )}
      </div>

      {showNew && canEdit && (
        <NewCompetitorForm onClose={() => setShowNew(false)} />
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E8E0D5] dark:border-[#2C2C2E] bg-[#FAF8F5] dark:bg-[#1A1A1A] p-12 text-center space-y-2">
          <Swords className="h-8 w-8 text-violet-400 mx-auto" />
          <p className="text-sm text-[#8B7355] dark:text-[#8E8E93]">
            {search.trim()
              ? `Nenhum concorrente corresponde a "${search}".`
              : "Ainda não há concorrentes registados."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <CompetitorCard key={c.id} competitor={c} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-4 space-y-1",
        color,
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[#3D2B1F]/60 dark:text-[#E8D5B5]/60">
        {label}
      </div>
      <div className="text-xl font-bold text-[#3D2B1F] dark:text-[#E8D5B5] tabular-nums">
        {value}
      </div>
    </div>
  );
}

function NewCompetitorForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    startTransition(async () => {
      try {
        await createCompetitorAction({
          name: name.trim(),
          websites: website.trim() ? [website.trim()] : [],
          location_label: location.trim() || null,
        });
        toast.success("Concorrente adicionado.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falhou.");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/30 dark:bg-violet-950/20 p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
        Novo concorrente
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[#8B7355] dark:text-[#8E8E93]">Nome *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: PressedFlowers Co." />
        </div>
        <div>
          <label className="text-xs text-[#8B7355] dark:text-[#8E8E93]">Site principal</label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="text-xs text-[#8B7355] dark:text-[#8E8E93]">Localização</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Lisboa / PT" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Save className="h-4 w-4 mr-1" />
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function CompetitorCard({
  competitor,
  canEdit,
}: {
  competitor: Competitor;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const minPrice = useMemo(() => {
    const valid = competitor.prices.filter((p) => p.price !== null && p.price > 0);
    if (valid.length === 0) return null;
    return Math.min(...valid.map((p) => p.price!));
  }, [competitor.prices]);

  async function archive() {
    if (!confirm(`Arquivar "${competitor.name}"?`)) return;
    try {
      await archiveCompetitorAction(competitor.id);
      toast.success("Concorrente arquivado.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falhou.");
    }
  }

  if (editing) {
    return (
      <EditCompetitorCard
        competitor={competitor}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
            {competitor.name}
          </h3>
          {competitor.location_label && (
            <div className="inline-flex items-center gap-1 text-xs text-[#8B7355] dark:text-[#8E8E93]">
              <MapPin className="h-3 w-3" />
              {competitor.location_label}
              {competitor.country && competitor.country !== "PT" && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                  {competitor.country}
                </span>
              )}
            </div>
          )}
        </div>
        {minPrice !== null && (
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-[#8B7355]">A partir de</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatEuro(minPrice)}
            </div>
          </div>
        )}
      </div>

      {competitor.websites.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {competitor.websites.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-950/60 transition-colors"
            >
              <Globe className="h-3 w-3" />
              {prettyDomain(url)}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ))}
        </div>
      )}

      {competitor.prices.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#8B7355]">
            Tabela de preços
          </div>
          <div className="space-y-1">
            {competitor.prices.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-1 border-b border-[#F0EAE0] dark:border-[#1F1F1F] last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[#3D2B1F] dark:text-[#E8D5B5] truncate">
                    {p.product || "—"}
                  </div>
                  {p.notes && (
                    <div className="text-[11px] text-[#8B7355] truncate">
                      {p.notes}
                    </div>
                  )}
                </div>
                <div className="tabular-nums font-semibold text-[#3D2B1F] dark:text-[#E8D5B5] shrink-0">
                  {formatEuro(p.price)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {competitor.notes && (
        <div className="text-xs text-[#8B7355] dark:text-[#8E8E93] italic border-l-2 border-amber-300 pl-2">
          {competitor.notes}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 pt-1 border-t border-[#F0EAE0] dark:border-[#1F1F1F]">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button size="sm" variant="outline" onClick={archive} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Arquivar
          </Button>
        </div>
      )}
    </div>
  );
}

function EditCompetitorCard({
  competitor,
  onClose,
}: {
  competitor: Competitor;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(competitor.name);
  const [location, setLocation] = useState(competitor.location_label ?? "");
  const [country, setCountry] = useState(competitor.country ?? "PT");
  const [websites, setWebsites] = useState<string[]>(
    competitor.websites.length ? competitor.websites : [""],
  );
  const [prices, setPrices] = useState<CompetitorPrice[]>(
    competitor.prices.length ? competitor.prices : [{ product: "", price: null, notes: null }],
  );
  const [notes, setNotes] = useState(competitor.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateCompetitorAction(competitor.id, {
          name: name.trim() || competitor.name,
          location_label: location.trim() || null,
          country: country.trim() || "PT",
          websites: websites.map((w) => w.trim()).filter(Boolean),
          prices: prices
            .filter((p) => p.product.trim() || p.price !== null)
            .map((p) => ({
              product: p.product.trim(),
              price: p.price,
              notes: p.notes?.trim() || null,
            })),
          notes: notes.trim() || null,
        });
        toast.success("Concorrente actualizado.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falhou.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-violet-300 dark:border-violet-900/60 bg-violet-50/30 dark:bg-violet-950/20 p-5 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#8B7355]">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-xs text-[#8B7355]">Localização</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Porto" />
          </div>
          <div>
            <label className="text-xs text-[#8B7355]">País</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="PT" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#8B7355]">Sites / redes</label>
        <div className="space-y-1.5 mt-1">
          {websites.map((w, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={w}
                onChange={(e) => {
                  const next = [...websites];
                  next[idx] = e.target.value;
                  setWebsites(next);
                }}
                placeholder="https://…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWebsites(websites.filter((_, i) => i !== idx))}
                disabled={websites.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWebsites([...websites, ""])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar site
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#8B7355]">Tabela de preços</label>
        <div className="space-y-1.5 mt-1">
          {prices.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-5"
                value={p.product}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = { ...p, product: e.target.value };
                  setPrices(next);
                }}
                placeholder="Produto (ex.: Quadro 30x40)"
              />
              <Input
                className="col-span-2"
                type="number"
                step="0.01"
                value={p.price ?? ""}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = {
                    ...p,
                    price: e.target.value === "" ? null : parseFloat(e.target.value),
                  };
                  setPrices(next);
                }}
                placeholder="€"
              />
              <Input
                className="col-span-4"
                value={p.notes ?? ""}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = { ...p, notes: e.target.value };
                  setPrices(next);
                }}
                placeholder="Notas (opcional)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-1"
                onClick={() => setPrices(prices.filter((_, i) => i !== idx))}
                disabled={prices.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPrices([...prices, { product: "", price: null, notes: null }])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar produto
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs text-[#8B7355]">Notas</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Save className="h-4 w-4 mr-1" />
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function prettyDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}
