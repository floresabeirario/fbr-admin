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
  Calendar as CalendarIcon,
  RotateCw,
  Paperclip,
  Upload,
  Sparkles,
  Frame,
  Camera,
  Package,
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
import type {
  ProductionCostItem,
  ProductionCostSize,
  ProductionFrameType,
  ProductionGlassType,
} from "@/types/production-cost";
import {
  PRODUCTION_SIZE_LABELS,
  PRODUCTION_FRAME_TYPE_LABELS,
  PRODUCTION_FRAME_TYPE_SHORT,
  PRODUCTION_GLASS_TYPE_LABELS,
} from "@/types/production-cost";
import type { Expense, ExpenseCategory, ExpensePaymentMethod, ExpenseRecurrencePeriod } from "@/types/expense";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_ORDER,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_RECURRENCE_PERIOD_LABELS,
  monthlyEquivalent,
  isSubscriptionActive,
} from "@/types/expense";
import {
  createCompetitorAction,
  updateCompetitorAction,
  archiveCompetitorAction,
  updatePricingItemAction,
  updateProductionCostItemAction,
  createConsumableAction,
  archiveConsumableAction,
  renameConsumableAction,
  createExpenseAction,
  updateExpenseAction,
  archiveExpenseAction,
  uploadExpenseInvoiceAction,
} from "./actions";

type TabKey = "despesas" | "precos" | "custos" | "faturacao" | "competicao";

interface TabDef {
  key: TabKey;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind classes para o ícone quando inactivo
  bgInactive: string; // background do ícone quando inactivo
}

const TABS: TabDef[] = [
  {
    key: "despesas",
    label: "Despesas",
    helper: "Subscrições e gastos únicos",
    icon: Receipt,
    accent: "text-rose-600",
    bgInactive: "bg-rose-100",
  },
  {
    key: "precos",
    label: "Tabela de preços",
    helper: "Base de cálculo do orçamento",
    icon: Tags,
    accent: "text-sky-600",
    bgInactive: "bg-sky-100",
  },
  {
    key: "custos",
    label: "Custos de produção",
    helper: "Custo real de cada quadro",
    icon: Frame,
    accent: "text-amber-600",
    bgInactive: "bg-amber-100",
  },
  {
    key: "faturacao",
    label: "Faturação",
    helper: "Receita e lucro mensal",
    icon: TrendingUp,
    accent: "text-emerald-600",
    bgInactive: "bg-emerald-100",
  },
  {
    key: "competicao",
    label: "Competição",
    helper: "Concorrentes e preços",
    icon: Swords,
    accent: "text-violet-600",
    bgInactive: "bg-violet-100",
  },
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
  initialProductionCosts: ProductionCostItem[];
  initialExpenses: Expense[];
  orders: Array<Pick<import("@/types/database").Order, "id" | "order_id" | "created_at" | "status" | "payment_status" | "budget" | "frame_delivery_date">>;
  vouchers: Array<Pick<import("@/types/voucher").Voucher, "id" | "code" | "created_at" | "amount" | "payment_status" | "usage_status">>;
  canEdit: boolean;
}

export default function FinancasClient({
  initialCompetitors,
  initialPricing,
  initialProductionCosts,
  initialExpenses,
  orders,
  vouchers,
  canEdit,
}: Props) {
  const [tab, setTab] = useState<TabKey>("despesas");

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm flex items-center justify-center">
          <Euro className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-cocoa-900">
          Finanças
        </h1>
      </div>

      {/* Tabs como cartões grandes — visíveis e claros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {TABS.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "group relative flex items-center gap-3 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all",
                active
                  ? "border-cocoa-900 bg-cocoa-900 text-surface shadow-md dark:border-[#E8D5B5] dark:bg-[#E8D5B5] dark:text-[#1B1611]"
                  : "border-cream-200 bg-surface text-cocoa-900 hover:border-cocoa-500 hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                  active
                    ? "bg-surface/15 dark:bg-[#1B1611]/15"
                    : t.bgInactive,
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 sm:h-6 sm:w-6",
                    active ? "text-surface dark:text-[#1B1611]" : t.accent,
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-semibold leading-tight">
                  {t.label}
                </div>
                <div
                  className={cn(
                    "text-[11px] sm:text-xs mt-0.5 leading-tight truncate",
                    active ? "opacity-80" : "text-cocoa-700",
                  )}
                >
                  {t.helper}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {tab === "despesas"  && <DespesasTab expenses={initialExpenses} canEdit={canEdit} />}
      {tab === "precos"    && <PrecosTab pricing={initialPricing} canEdit={canEdit} />}
      {tab === "custos"    && <CustosTab items={initialProductionCosts} canEdit={canEdit} />}
      {tab === "faturacao" && <FaturacaoTab orders={orders} vouchers={vouchers} expenses={initialExpenses} />}
      {tab === "competicao" && (
        <CompeticaoTab competitors={initialCompetitors} canEdit={canEdit} />
      )}
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
          <p className="mt-2 text-xs text-sky-800 dark:text-sky-300">
            <strong>Suplemento de fundo:</strong> só a fotografia custa ao cliente.
            O suplemento varia por tamanho (30x40 / 40x50 / 50x70) — escolhido
            automaticamente conforme a moldura. Moldura pirâmide é um upsell
            aplicado manualmente.
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
        // Maria pediu: molduras (base_frame) não precisam de notas.
        const showNotes = cat !== "base_frame";
        return (
          <div
            key={cat}
            className={cn(
              "rounded-2xl border bg-gradient-to-br p-4 space-y-3",
              color,
            )}
          >
            <div>
              <h2 className="text-sm font-semibold text-cocoa-900">
                {PRICING_CATEGORY_LABELS[cat]}
              </h2>
              <p className="text-xs text-cocoa-700 mt-0.5">
                {PRICING_CATEGORY_HELPER[cat]}
              </p>
            </div>
            <div className="rounded-xl bg-surface overflow-hidden border border-white/40">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 text-xs uppercase tracking-wide text-cocoa-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Item</th>
                    <th className="text-left px-3 py-2 font-medium w-32">Preço (€)</th>
                    {showNotes && <th className="text-left px-3 py-2 font-medium">Notas</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <PriceRow
                      key={item.id}
                      item={item}
                      canEdit={canEdit}
                      saving={saving === item.id}
                      showNotes={showNotes}
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
  showNotes,
  onSavePrice,
  onSaveNotes,
}: {
  item: PricingItem;
  canEdit: boolean;
  saving: boolean;
  showNotes: boolean;
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
    <tr className="border-t border-cream-100">
      <td className="px-3 py-2 align-middle">
        <div className="font-medium text-cocoa-900">{item.label}</div>
        <div className="text-[10px] uppercase tracking-wider text-cocoa-500 mt-0.5">
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
      {showNotes && (
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
      )}
    </tr>
  );
}

// ============================================================
// DESPESAS — Únicas (default) + Subscrições
// ============================================================

type DespesasSubTab = "unicas" | "subscricoes";

function DespesasTab({
  expenses,
  canEdit,
}: {
  expenses: Expense[];
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<DespesasSubTab>("unicas");

  // Separa as despesas em duas listas (excluí soft-deleted no servidor).
  const unicas    = useMemo(() => expenses.filter((e) => !e.is_recurring), [expenses]);
  const subscript = useMemo(() => expenses.filter((e) =>  e.is_recurring), [expenses]);

  // KPIs globais — visíveis em ambos os modos.
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const unicasMonth = unicas
    .filter((e) => {
      const d = parseISO(e.expense_date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((s, e) => s + Number(e.amount), 0);

  // Para subscrições, conta as activas e soma o custo mensal equivalente.
  const activeSubs = subscript.filter((e) => isSubscriptionActive(e, now));
  const monthlyRecurring = activeSubs.reduce((s, e) => s + monthlyEquivalent(e), 0);
  const totalMonth = unicasMonth + monthlyRecurring;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiBox
          label="Despesas únicas — este mês"
          value={formatEuro(unicasMonth)}
          icon={<Receipt className="h-4 w-4" />}
          color="rose"
        />
        <KpiBox
          label={`Subscrições activas (${activeSubs.length})`}
          value={`${formatEuro(monthlyRecurring)} / mês`}
          icon={<RotateCw className="h-4 w-4" />}
          color="violet"
        />
        <KpiBox
          label="Custo total estimado — este mês"
          value={formatEuro(totalMonth)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="amber"
        />
      </div>

      {/* Sub-tabs Únicas / Subscrições */}
      <div className="inline-flex rounded-xl border border-cream-200 bg-surface p-1 gap-1">
        <SubTabButton
          active={sub === "unicas"}
          onClick={() => setSub("unicas")}
          icon={<Receipt className="h-4 w-4" />}
          label="Despesas únicas"
          count={unicas.length}
        />
        <SubTabButton
          active={sub === "subscricoes"}
          onClick={() => setSub("subscricoes")}
          icon={<RotateCw className="h-4 w-4" />}
          label="Subscrições"
          count={subscript.length}
        />
      </div>

      {sub === "unicas" && (
        <DespesasUnicas expenses={unicas} canEdit={canEdit} />
      )}
      {sub === "subscricoes" && (
        <DespesasSubscricoes expenses={subscript} canEdit={canEdit} />
      )}
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-cocoa-900 text-surface dark:bg-[#E8D5B5] dark:text-[#1B1611]"
          : "text-cocoa-700 hover:bg-cream-100 hover:text-cocoa-900",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums",
          active
            ? "bg-surface/15 dark:bg-[#1B1611]/15"
            : "bg-cream-200 text-cocoa-700",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ── Despesas únicas ─────────────────────────────────────────

function DespesasUnicas({
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
    category: "materiais" as ExpenseCategory, // default Maria: materiais
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
          is_recurring: false,
        });
        toast.success("Despesa registada.");
        setCreating(false);
        setNewExpense({
          expense_date: format(new Date(), "yyyy-MM-dd"),
          supplier: "",
          category: "materiais",
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
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
          <Button
            onClick={() => setCreating((v) => !v)}
            className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova despesa
          </Button>
        )}
      </div>

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
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
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
            <Button onClick={handleCreate} className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg">Registar</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-rose-800/70 italic">
            Podes anexar a factura depois de guardar — botão no fim da linha.
          </p>
        </div>
      )}

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cream-200 bg-surface p-12 text-center">
          <Receipt className="h-12 w-12 mx-auto text-rose-200 mb-3" />
          <p className="text-sm text-cocoa-700">
            {expenses.length === 0
              ? "Ainda não há despesas únicas registadas."
              : "Nenhuma despesa corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[920px]">
              <thead className="bg-cream-50">
                <tr className="text-left text-xs uppercase tracking-wide text-cocoa-700">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium">Pagamento</th>
                  <th className="px-3 py-2 font-medium">Factura</th>
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

// ── Subscrições ─────────────────────────────────────────────

function DespesasSubscricoes({
  expenses,
  canEdit,
}: {
  expenses: Expense[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const today = new Date();
  const [newSub, setNewSub] = useState({
    supplier: "",
    category: "software" as ExpenseCategory,
    amount: "",
    description: "",
    recurrence_period: "monthly" as ExpenseRecurrencePeriod,
    recurrence_start_date: format(today, "yyyy-MM-dd"),
    recurrence_end_date: "",
  });

  function handleCreate() {
    const amount = parseFloat(newSub.amount.replace(",", "."));
    if (!newSub.supplier.trim() || !amount || amount <= 0) {
      toast.error("Preenche fornecedor e valor válido.");
      return;
    }
    if (!newSub.recurrence_start_date) {
      toast.error("Indica a data de início da subscrição.");
      return;
    }
    if (
      newSub.recurrence_period === "custom" &&
      newSub.recurrence_end_date &&
      newSub.recurrence_end_date < newSub.recurrence_start_date
    ) {
      toast.error("A data de fim tem que ser depois do início.");
      return;
    }
    startTransition(async () => {
      try {
        await createExpenseAction({
          // expense_date guarda a data de referência (1º pagamento) para
          // a tabela aparecer no relatório do mês de início.
          expense_date: newSub.recurrence_start_date,
          supplier: newSub.supplier.trim(),
          category: newSub.category,
          amount,
          description: newSub.description.trim() || null,
          is_recurring: true,
          recurrence_period: newSub.recurrence_period,
          recurrence_start_date: newSub.recurrence_start_date,
          recurrence_end_date: newSub.recurrence_end_date || null,
        });
        toast.success("Subscrição registada.");
        setCreating(false);
        setNewSub({
          supplier: "",
          category: "software",
          amount: "",
          description: "",
          recurrence_period: "monthly",
          recurrence_start_date: format(new Date(), "yyyy-MM-dd"),
          recurrence_end_date: "",
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registar.");
      }
    });
  }

  // Ordena: activas primeiro (por start desc), depois terminadas.
  const ordered = useMemo(() => {
    const now = new Date();
    return [...expenses].sort((a, b) => {
      const aActive = isSubscriptionActive(a, now) ? 1 : 0;
      const bActive = isSubscriptionActive(b, now) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aStart = a.recurrence_start_date ?? a.expense_date;
      const bStart = b.recurrence_start_date ?? b.expense_date;
      return bStart.localeCompare(aStart);
    });
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-cocoa-700">
          Subscrições mensais, anuais ou de intervalo específico (start &amp; end).
          O custo total mensal estimado aparece nos KPIs em cima.
        </p>
        {canEdit && (
          <Button
            onClick={() => setCreating((v) => !v)}
            className="bg-violet-600 hover:bg-violet-700 text-white h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova subscrição
          </Button>
        )}
      </div>

      {creating && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 dark:bg-violet-950/20 dark:border-violet-900/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            Registar nova subscrição
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-cocoa-700">Fornecedor *</label>
              <Input
                placeholder="Ex.: Vercel, Adobe, Spotify…"
                value={newSub.supplier}
                onChange={(e) => setNewSub((p) => ({ ...p, supplier: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-cocoa-700">Categoria</label>
              <Select value={newSub.category} onValueChange={(v) => setNewSub((p) => ({ ...p, category: v as ExpenseCategory }))}>
                <SelectTrigger>
                  <SelectValue labels={EXPENSE_CATEGORY_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[180px_180px_180px_120px] gap-2">
            <div>
              <label className="text-xs text-cocoa-700">Periodicidade</label>
              <Select
                value={newSub.recurrence_period}
                onValueChange={(v) => setNewSub((p) => ({ ...p, recurrence_period: v as ExpenseRecurrencePeriod }))}
              >
                <SelectTrigger>
                  <SelectValue labels={EXPENSE_RECURRENCE_PERIOD_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXPENSE_RECURRENCE_PERIOD_LABELS) as ExpenseRecurrencePeriod[]).map((p) => (
                    <SelectItem key={p} value={p}>{EXPENSE_RECURRENCE_PERIOD_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-cocoa-700">Início *</label>
              <Input
                type="date"
                value={newSub.recurrence_start_date}
                onChange={(e) => setNewSub((p) => ({ ...p, recurrence_start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-cocoa-700">
                Fim {newSub.recurrence_period === "custom" ? "*" : "(opcional)"}
              </label>
              <Input
                type="date"
                value={newSub.recurrence_end_date}
                onChange={(e) => setNewSub((p) => ({ ...p, recurrence_end_date: e.target.value }))}
                placeholder="—"
              />
            </div>
            <div>
              <label className="text-xs text-cocoa-700">Valor / ocorrência</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="pl-6"
                  value={newSub.amount}
                  onChange={(e) => setNewSub((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <Textarea
            placeholder="Notas (opcional) — ex.: plano Pro, conta partilhada com…"
            value={newSub.description}
            onChange={(e) => setNewSub((p) => ({ ...p, description: e.target.value }))}
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-700 text-white">Registar</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-violet-800/70 italic">
            <strong>Mensal:</strong> conta {formatEuro(parseFloat(newSub.amount.replace(",", ".")) || 0)} por mês.{" "}
            <strong>Anual:</strong> ÷12.{" "}
            <strong>Intervalo:</strong> activa só entre as datas indicadas.
          </p>
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cream-200 bg-surface p-12 text-center">
          <RotateCw className="h-12 w-12 mx-auto text-violet-200 mb-3" />
          <p className="text-sm text-cocoa-700">
            Ainda não há subscrições registadas.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="bg-cream-50">
                <tr className="text-left text-xs uppercase tracking-wide text-cocoa-700">
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Periodicidade</th>
                  <th className="px-3 py-2 font-medium">Início → Fim</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium text-right">≈ por mês</th>
                  <th className="px-3 py-2 font-medium">Factura</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((e) => (
                  <SubscriptionRow key={e.id} expense={e} canEdit={canEdit} />
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
    <tr className="border-t border-cream-100 hover:bg-cream-50/60">
      <td className="px-3 py-2 text-cocoa-900 whitespace-nowrap">
        {format(parseISO(expense.expense_date), "dd/MM/yyyy")}
      </td>
      <td className="px-3 py-2 text-cocoa-900 font-medium">{expense.supplier}</td>
      <td className="px-3 py-2">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          EXPENSE_CATEGORY_COLORS[expense.category]
        )}>
          {EXPENSE_CATEGORY_LABELS[expense.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-cocoa-700 text-xs max-w-[300px] truncate">
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
          <span className="text-xs text-cocoa-700">
            {expense.payment_method ? EXPENSE_PAYMENT_METHOD_LABELS[expense.payment_method] : "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <InvoiceCell expense={expense} canEdit={canEdit} />
      </td>
      <td className="px-3 py-2 text-right">
        {canEdit && (
          <button
            onClick={handleArchive}
            className="text-cocoa-500 hover:text-rose-600 transition-colors"
            title="Arquivar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function SubscriptionRow({ expense, canEdit }: { expense: Expense; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const active = isSubscriptionActive(expense, new Date());
  const monthly = monthlyEquivalent(expense);

  function handleArchive() {
    if (!confirm("Arquivar esta subscrição?")) return;
    startTransition(async () => {
      try {
        await archiveExpenseAction(expense.id);
        toast.success("Subscrição arquivada.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao arquivar.");
      }
    });
  }

  const startStr = expense.recurrence_start_date
    ? format(parseISO(expense.recurrence_start_date), "dd/MM/yyyy")
    : "—";
  const endStr = expense.recurrence_end_date
    ? format(parseISO(expense.recurrence_end_date), "dd/MM/yyyy")
    : "∞";

  return (
    <tr className={cn("border-t border-cream-100 hover:bg-cream-50/60", !active && "opacity-60")}>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          active
            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
            : "bg-slate-100 text-slate-700 border-slate-300",
        )}>
          {active ? "Activa" : "Terminada"}
        </span>
      </td>
      <td className="px-3 py-2 text-cocoa-900 font-medium">{expense.supplier}</td>
      <td className="px-3 py-2">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          EXPENSE_CATEGORY_COLORS[expense.category]
        )}>
          {EXPENSE_CATEGORY_LABELS[expense.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-cocoa-700 text-xs">
        {expense.recurrence_period
          ? EXPENSE_RECURRENCE_PERIOD_LABELS[expense.recurrence_period]
          : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-cocoa-700 whitespace-nowrap">
        <CalendarIcon className="h-3 w-3 inline -mt-0.5 mr-1 text-cocoa-500" />
        {startStr} → {endStr}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-rose-700 whitespace-nowrap">
        {formatEuro(Number(expense.amount))}
      </td>
      <td className="px-3 py-2 text-right text-cocoa-900 whitespace-nowrap tabular-nums">
        {formatEuro(monthly)}
      </td>
      <td className="px-3 py-2">
        <InvoiceCell expense={expense} canEdit={canEdit} />
      </td>
      <td className="px-3 py-2 text-right">
        {canEdit && (
          <button
            onClick={handleArchive}
            className="text-cocoa-500 hover:text-rose-600 transition-colors"
            title="Arquivar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Anexo de factura (upload para Drive) ────────────────────

function InvoiceCell({ expense, canEdit }: { expense: Expense; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Ficheiro demasiado grande (limite 25 MB).");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.set("expense_id", expense.id);
    fd.set("file", file);
    startTransition(async () => {
      try {
        await uploadExpenseInvoiceAction(fd);
        toast.success("Factura anexada ao Drive.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao anexar.");
      } finally {
        setUploading(false);
      }
    });
  }

  if (expense.invoice_url) {
    return (
      <div className="inline-flex items-center gap-1">
        <a
          href={expense.invoice_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
          title="Abrir factura no Drive"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Ver
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
        {canEdit && (
          <label className="text-cocoa-500 hover:text-cocoa-900 cursor-pointer ml-1" title="Substituir">
            <input
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              disabled={uploading}
            />
            <Upload className="h-3.5 w-3.5" />
          </label>
        )}
      </div>
    );
  }

  if (!canEdit) {
    return <span className="text-xs text-cocoa-500 italic">—</span>;
  }

  return (
    <label className={cn(
      "inline-flex items-center gap-1 text-xs text-cocoa-700 hover:text-cocoa-900 cursor-pointer",
      uploading && "opacity-50 pointer-events-none",
    )} title="Carregar factura para o Drive">
      <input
        type="file"
        className="hidden"
        accept="application/pdf,image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={uploading}
      />
      <Upload className="h-3.5 w-3.5" />
      {uploading ? "A enviar…" : "Anexar"}
    </label>
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

  // Potencial 100% pago: total das encomendas activas (não canceladas)
  // se todas estivessem 100% pagas. Mostra o "topo" possível da receita
  // já comprometida. Vales não somam aqui — só encomendas.
  const potentialFullPay = orders
    .filter((o) => o.status !== "cancelado" && o.budget && o.budget > 0)
    .reduce((s, o) => s + (Number(o.budget) || 0), 0);
  const alreadyCollected = orders.reduce((s, o) => s + revenueFromOrder(o), 0);
  const stillOpen = Math.max(0, potentialFullPay - alreadyCollected);

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

      {/* Potencial se todas as encomendas activas estivessem 100% pagas */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 dark:border-violet-900/50 p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-violet-200/60 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-violet-700 dark:text-violet-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              Potencial total — se todas as encomendas activas estivessem 100% pagas
            </h3>
            <p className="text-xs text-violet-800/80 dark:text-violet-300/80 mt-0.5">
              Exclui encomendas canceladas. Vales não somam aqui. Indicativo do
              tecto de receita já comprometido.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-surface/80 dark:bg-[#1B1611]/40 border border-violet-200/60 dark:border-violet-900/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300 font-medium">
              Potencial total
            </div>
            <div className="text-2xl font-semibold text-violet-900 dark:text-violet-100 tabular-nums">
              {formatEuro(potentialFullPay)}
            </div>
          </div>
          <div className="rounded-xl bg-surface/80 dark:bg-[#1B1611]/40 border border-emerald-200/60 dark:border-emerald-900/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-medium">
              Já cobrado
            </div>
            <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatEuro(alreadyCollected)}
            </div>
          </div>
          <div className="rounded-xl bg-surface/80 dark:bg-[#1B1611]/40 border border-amber-200/60 dark:border-amber-900/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-medium">
              Por receber
            </div>
            <div className="text-2xl font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
              {formatEuro(stillOpen)}
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart manual: últimos 12 meses */}
      <div className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-cocoa-900">
            Receita vs despesas (últimos 12 meses)
          </h3>
          <div className="flex items-center gap-3 text-xs text-cocoa-700">
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
              <span className="text-[10px] text-cocoa-700 capitalize">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-cocoa-700 italic px-1">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-500" />
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
        <div className="rounded-2xl border border-dashed border-cream-200 bg-cream-50 p-12 text-center space-y-2">
          <Swords className="h-8 w-8 text-violet-400 mx-auto" />
          <p className="text-sm text-cocoa-700">
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
      <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-900/60 dark:text-[#E8D5B5]/60">
        {label}
      </div>
      <div className="text-xl font-bold text-cocoa-900 tabular-nums">
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
      <h3 className="text-sm font-semibold text-cocoa-900">
        Novo concorrente
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-cocoa-700">Nome *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: PressedFlowers Co." />
        </div>
        <div>
          <label className="text-xs text-cocoa-700">Site principal</label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="text-xs text-cocoa-700">Localização</label>
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
    <div className="rounded-2xl border border-cream-200 bg-surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-cocoa-900">
            {competitor.name}
          </h3>
          {competitor.location_label && (
            <div className="inline-flex items-center gap-1 text-xs text-cocoa-700">
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
            <div className="text-[10px] uppercase tracking-wider text-cocoa-700">A partir de</div>
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
          <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-700">
            Tabela de preços
          </div>
          <div className="space-y-1">
            {competitor.prices.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-1 border-b border-cream-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-cocoa-900 truncate">
                    {p.product || "—"}
                  </div>
                  {p.notes && (
                    <div className="text-[11px] text-cocoa-700 truncate">
                      {p.notes}
                    </div>
                  )}
                </div>
                <div className="tabular-nums font-semibold text-cocoa-900 shrink-0">
                  {formatEuro(p.price)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {competitor.notes && (
        <div className="text-xs text-cocoa-700 italic border-l-2 border-amber-300 pl-2">
          {competitor.notes}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 pt-1 border-t border-cream-100">
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
          <label className="text-xs text-cocoa-700">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-xs text-cocoa-700">Localização</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Porto" />
          </div>
          <div>
            <label className="text-xs text-cocoa-700">País</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="PT" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-cocoa-700">Sites / redes</label>
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
        <label className="text-xs text-cocoa-700">Tabela de preços</label>
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
        <label className="text-xs text-cocoa-700">Notas</label>
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

// ============================================================
// CUSTOS DE PRODUÇÃO (COGS) — Custo real por quadro completo
// ============================================================
// Distinto da tabela de preços (que é o preço de venda ao cliente).
// Aqui guardamos o custo da Maria a produzir cada quadro: moldura,
// embalagem, cartão informativo, enchimento, autocolante, etc.
//
// 3 variáveis: tamanho × tipo de moldura × tipo de vidro.
//   - Tamanhos: 30x40 (A3), 40x50, 50x70, mini 20x25.
//   - Tipo de moldura: baixa (2x2cm), caixa (2x3cm), pirâmide.
//     Baixa vs caixa é decisão INTERNA (consoante a altura das flores).
//     Pirâmide é a única visível ao cliente (upgrade pago).
//   - Tipo de vidro: vidro sobre vidro (fundo transparente) ou
//     vidro sobre cartão (preto/branco/cor/fotografia).
//
// Bonus: tabela "Impressão de fotografia" — somada ao custo do quadro
// quando o cliente escolhe fundo fotografia.

const PRODUCTION_SIZES_ORDER: ProductionCostSize[] = [
  "30x40",
  "40x50",
  "50x70",
  "mini_20x25",
];

const PRODUCTION_FRAME_TYPES_ORDER: ProductionFrameType[] = [
  "baixa",
  "caixa",
  "piramide",
];

const PRODUCTION_GLASS_TYPES_ORDER: ProductionGlassType[] = [
  "vidro_vidro",
  "vidro_cartao",
];

function CustosTab({
  items,
  canEdit,
}: {
  items: ProductionCostItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);

  // Index para lookup rápido.
  const frameByKey = useMemo(() => {
    const map = new Map<string, ProductionCostItem>();
    for (const it of items) {
      if (it.kind !== "frame") continue;
      map.set(`${it.size_key}|${it.frame_type}|${it.glass_type}`, it);
    }
    return map;
  }, [items]);

  const photoBySize = useMemo(() => {
    const map = new Map<string, ProductionCostItem>();
    for (const it of items) {
      if (it.kind !== "photo_print") continue;
      map.set(it.size_key, it);
    }
    return map;
  }, [items]);

  // Consumables agrupados por label. Mantemos a ordem pela menor
  // `position` do grupo (o seed posicionou os 3 tamanhos lado a lado).
  const consumableGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; minPosition: number; items: Map<string, ProductionCostItem> }
    >();
    for (const it of items) {
      if (it.kind !== "consumable" || !it.label) continue;
      const g = groups.get(it.label) ?? {
        label: it.label,
        minPosition: it.position,
        items: new Map<string, ProductionCostItem>(),
      };
      g.minPosition = Math.min(g.minPosition, it.position);
      g.items.set(it.size_key, it);
      groups.set(it.label, g);
    }
    return [...groups.values()].sort((a, b) => a.minPosition - b.minPosition);
  }, [items]);

  function saveCost(item: ProductionCostItem, raw: string) {
    const next = raw.trim() === "" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(next) || next < 0) {
      toast.error("Custo inválido");
      return;
    }
    if (next === item.cost) return;
    setSaving(item.id);
    startTransition(async () => {
      try {
        await updateProductionCostItemAction(item.id, { cost: next });
        toast.success(`${describe(item)}: ${formatEuro(next)}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
      } finally {
        setSaving(null);
      }
    });
  }

  function createConsumable(label: string, onDone: () => void) {
    startTransition(async () => {
      try {
        await createConsumableAction(label);
        toast.success(`"${label}" adicionado.`);
        onDone();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
      }
    });
  }

  function archiveConsumable(label: string) {
    if (!window.confirm(`Remover "${label}"? Encomendas antigas não são afectadas.`)) return;
    startTransition(async () => {
      try {
        await archiveConsumableAction(label);
        toast.success(`"${label}" removido.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao remover");
      }
    });
  }

  function renameConsumable(oldLabel: string, newLabel: string) {
    if (newLabel.trim() === oldLabel || newLabel.trim().length === 0) return;
    startTransition(async () => {
      try {
        await renameConsumableAction(oldLabel, newLabel.trim());
        toast.success(`"${oldLabel}" → "${newLabel.trim()}"`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao renomear");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Aviso explicativo */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex gap-3">
        <Frame className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
          <p className="font-semibold mb-1">Como funcionam os custos de produção</p>
          <p>
            Estes são os custos REAIS de produzir cada quadro (moldura,
            embalagem, cartão, enchimento, autocolante, etc.) — distintos
            das despesas únicas. Cada encomenda guarda um snapshot dos
            custos vigentes no dia da criação; <strong>alterações aqui não
            recalculam encomendas antigas</strong>.
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
            <strong>Vidro sobre vidro</strong> = cliente escolheu fundo transparente.{" "}
            <strong>Vidro sobre cartão</strong> = preto, branco, cor ou fotografia.{" "}
            Baixa vs caixa é decisão interna (consoante a altura das flores);
            o cliente paga o mesmo, só a margem muda. Pirâmide é o único upgrade
            que o cliente também paga.
          </p>
          {!canEdit && (
            <p className="mt-2 italic text-amber-700 dark:text-amber-300">
              Modo leitura — só administradores podem editar.
            </p>
          )}
        </div>
      </div>

      {/* Grelha 4 cards: um por tamanho */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
        {PRODUCTION_SIZES_ORDER.map((size) => (
          <div
            key={size}
            className="rounded-2xl border bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 p-3 sm:p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Frame className="h-4 w-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-cocoa-900">
                {PRODUCTION_SIZE_LABELS[size]}
              </h2>
            </div>
            <div className="rounded-xl bg-surface overflow-hidden border border-white/40">
              <table className="w-full text-xs">
                <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium" />
                    {PRODUCTION_GLASS_TYPES_ORDER.map((g) => (
                      <th key={g} className="text-left px-2 py-1.5 font-medium">
                        {g === "vidro_vidro" ? "Vidro" : "Cartão"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTION_FRAME_TYPES_ORDER.map((ft) => (
                    <tr key={ft} className="border-t border-cream-100">
                      <td className="px-2 py-1.5 align-middle text-xs font-medium text-cocoa-900">
                        {PRODUCTION_FRAME_TYPE_SHORT[ft]}
                      </td>
                      {PRODUCTION_GLASS_TYPES_ORDER.map((gt) => {
                        const item = frameByKey.get(`${size}|${ft}|${gt}`);
                        return (
                          <td key={gt} className="px-1 py-1 align-middle">
                            {item ? (
                              <CostInput
                                item={item}
                                canEdit={canEdit}
                                saving={saving === item.id}
                                onSave={(v) => saveCost(item, v)}
                              />
                            ) : (
                              <span className="text-cocoa-500 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-amber-800 leading-relaxed px-1">
              Vidro = fundo transparente · Cartão = preto / branco / cor / fotografia
            </p>
          </div>
        ))}
      </div>

      {/* Card: Impressão de fotografia */}
      <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 p-3 sm:p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-violet-700" />
          <h2 className="text-sm font-semibold text-cocoa-900">
            Impressão de fotografia
          </h2>
          <span className="text-[11px] text-cocoa-700">
            Somado ao custo do quadro quando o cliente escolhe fundo fotografia
          </span>
        </div>
        <div className="rounded-xl bg-surface border border-white/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
              <tr>
                {PRODUCTION_SIZES_ORDER.map((s) => (
                  <th key={s} className="text-left px-3 py-1.5 font-medium">
                    {PRODUCTION_SIZE_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {PRODUCTION_SIZES_ORDER.map((s) => {
                  const it = photoBySize.get(s);
                  return (
                    <td key={s} className="px-2 py-2 align-middle">
                      {it ? (
                        <CostInput
                          item={it}
                          canEdit={canEdit}
                          saving={saving === it.id}
                          onSave={(v) => saveCost(it, v)}
                        />
                      ) : (
                        <span className="text-cocoa-500 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Card: Outros custos recorrentes (consumíveis por encomenda) */}
      <ConsumablesSection
        groups={consumableGroups}
        canEdit={canEdit}
        saving={saving}
        onSaveCost={saveCost}
        onCreate={createConsumable}
        onArchive={archiveConsumable}
        onRename={renameConsumable}
      />
    </div>
  );
}

function ConsumablesSection({
  groups,
  canEdit,
  saving,
  onSaveCost,
  onCreate,
  onArchive,
  onRename,
}: {
  groups: Array<{ label: string; items: Map<string, ProductionCostItem> }>;
  canEdit: boolean;
  saving: string | null;
  onSaveCost: (item: ProductionCostItem, raw: string) => void;
  onCreate: (label: string, onDone: () => void) => void;
  onArchive: (label: string) => void;
  onRename: (oldLabel: string, newLabel: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");

  // Tamanhos visíveis na tabela. Mini 20x25 fica de fora por agora —
  // quando a Maria decidir embalar mini-quadros separadamente, adiciona
  // linhas no Supabase com size_key='mini_20x25' e este array passa a
  // incluí-lo (ou expande para 4 colunas).
  const sizes: ProductionCostSize[] = ["30x40", "40x50", "50x70"];

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-rose-50 to-pink-100 border-rose-200 p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-rose-700" />
        <h2 className="text-sm font-semibold text-cocoa-900">
          Outros custos recorrentes
        </h2>
        <span className="text-[11px] text-cocoa-700">
          Aplicados a cada encomenda consoante o tamanho da moldura
        </span>
      </div>
      <div className="rounded-xl bg-surface border border-white/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">Item</th>
              {sizes.map((s) => (
                <th key={s} className="text-left px-3 py-1.5 font-medium w-32">
                  {PRODUCTION_SIZE_LABELS[s]}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={sizes.length + 2} className="px-3 py-4 text-xs text-cocoa-500 italic text-center">
                  Sem consumíveis ainda. Adiciona em baixo.
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <tr key={g.label} className="border-t border-cream-100">
                <td className="px-3 py-1.5 align-middle">
                  <ConsumableLabelInput
                    label={g.label}
                    canEdit={canEdit}
                    onRename={(v) => onRename(g.label, v)}
                  />
                </td>
                {sizes.map((s) => {
                  const item = g.items.get(s);
                  return (
                    <td key={s} className="px-2 py-1 align-middle">
                      {item ? (
                        <CostInput
                          item={item}
                          canEdit={canEdit}
                          saving={saving === item.id}
                          onSave={(v) => onSaveCost(item, v)}
                        />
                      ) : (
                        <span className="text-cocoa-500 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1 align-middle text-right">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onArchive(g.label)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-rose-600 hover:bg-rose-100 transition-colors"
                      title={`Remover "${g.label}"`}
                      aria-label={`Remover ${g.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {canEdit && (
              <tr className="border-t border-cream-100 bg-rose-50/50">
                <td colSpan={sizes.length + 2} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Plus className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newLabel.trim().length > 0) {
                          e.preventDefault();
                          onCreate(newLabel.trim(), () => setNewLabel(""));
                        }
                      }}
                      placeholder="Novo item (ex: Cartão de visita)"
                      className="h-7 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      disabled={newLabel.trim().length === 0}
                      onClick={() =>
                        onCreate(newLabel.trim(), () => setNewLabel(""))
                      }
                      className="h-7 px-3 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConsumableLabelInput({
  label,
  canEdit,
  onRename,
}: {
  label: string;
  canEdit: boolean;
  onRename: (v: string) => void;
}) {
  const [draft, setDraft] = useState(label);
  const [lastLabel, setLastLabel] = useState(label);
  if (label !== lastLabel) {
    setLastLabel(label);
    setDraft(label);
  }
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed.length === 0) {
          setDraft(label); // não permite vazio — reverte
          return;
        }
        if (trimmed !== label) onRename(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(label);
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={!canEdit}
      className="h-7 text-xs font-medium border-transparent hover:border-cream-200 focus:border-rose-300 bg-transparent focus:bg-surface transition-colors"
    />
  );
}

function CostInput({
  item,
  canEdit,
  saving,
  onSave,
}: {
  item: ProductionCostItem;
  canEdit: boolean;
  saving: boolean;
  onSave: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(item.cost.toString().replace(".", ","));
  // Padrão "store info from previous renders" — re-sincroniza o draft local
  // quando a BD muda (ex: outro admin editou) sem useEffect+setState.
  const [lastItemId, setLastItemId] = useState(item.id);
  const [lastCost, setLastCost] = useState(item.cost);
  if (item.id !== lastItemId || item.cost !== lastCost) {
    setLastItemId(item.id);
    setLastCost(item.cost);
    setDraft(item.cost.toString().replace(".", ","));
  }
  return (
    <div className="relative inline-block w-full max-w-[100px]">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        disabled={!canEdit || saving}
        inputMode="decimal"
        className="h-7 w-full pr-5 text-xs font-medium tabular-nums"
        placeholder="0,00"
      />
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-cocoa-500">
        €
      </span>
    </div>
  );
}

// Descrição curta usada nas notificações toast.
function describe(item: ProductionCostItem): string {
  if (item.kind === "photo_print") {
    return `Impressão fotografia ${PRODUCTION_SIZE_LABELS[item.size_key]}`;
  }
  const ft = item.frame_type ?? "";
  const gt = item.glass_type ?? "";
  return `${PRODUCTION_SIZE_LABELS[item.size_key]} · ${PRODUCTION_FRAME_TYPE_LABELS[ft as ProductionFrameType] ?? ft} · ${PRODUCTION_GLASS_TYPE_LABELS[gt as ProductionGlassType] ?? gt}`;
}
