"use client";

// ============================================================
// DESPESAS (únicas + subscrições) — extraído de financas-client.tsx
// ============================================================

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Euro,
  Receipt,
  TrendingUp,
  Plus,
  ExternalLink,
  Trash2,
  Search,
  Calendar as CalendarIcon,
  RotateCw,
  Paperclip,
  Upload,
  Pencil,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";
import type { Expense, ExpenseCategory, ExpensePaymentMethod, ExpenseRecurrencePeriod } from "@/types/expense";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_ORDER,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_RECURRENCE_PERIOD_LABELS,
  monthlyEquivalent,
  isSubscriptionActive,
  subscriptionTotalToDate,
} from "@/types/expense";
import {
  createExpenseAction,
  updateExpenseAction,
  archiveExpenseAction,
  uploadExpenseInvoiceAction,
} from "../actions";
import { KpiBox } from "./shared";

type DespesasSubTab = "unicas" | "subscricoes";

// Fornecedor é opcional e pode ser texto OU link. Auto-detecta URL
// (http(s):// ou www.) e renderiza clicável. Caso contrário texto puro.
function renderSupplier(s: string | null | undefined): React.ReactNode {
  const v = (s ?? "").trim();
  if (!v) return <span className="text-cocoa-500">—</span>;
  const isUrl = /^(https?:\/\/|www\.)/i.test(v);
  if (!isUrl) return <span className="text-cocoa-700">{v}</span>;
  const href = v.startsWith("http") ? v : `https://${v}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 hover:underline underline-offset-2 max-w-[220px] truncate"
      title={v}
    >
      <span className="truncate">{v.replace(/^https?:\/\//i, "").replace(/\/$/, "")}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}

export function DespesasTab({
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

  // Total desde sempre = todas as despesas únicas + acumulado estimado
  // de cada subscrição desde o seu início até hoje (ou até ao seu fim
  // se já terminou).
  const unicasEver = unicas.reduce((s, e) => s + Number(e.amount), 0);
  const subsEver = subscript.reduce((s, e) => s + subscriptionTotalToDate(e, now), 0);
  const totalEver = unicasEver + subsEver;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox
          label="Despesas únicas — este mês"
          value={formatEUR(unicasMonth)}
          icon={<Receipt className="h-4 w-4" />}
          color="rose"
        />
        <KpiBox
          label={`Subscrições activas (${activeSubs.length})`}
          value={`${formatEUR(monthlyRecurring)} / mês`}
          icon={<RotateCw className="h-4 w-4" />}
          color="violet"
        />
        <KpiBox
          label="Custo total estimado — este mês"
          value={formatEUR(totalMonth)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="amber"
        />
        <KpiBox
          label="Total desde sempre"
          value={formatEUR(totalEver)}
          icon={<Euro className="h-4 w-4" />}
          color="emerald"
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
    description: "",
    category: "materiais" as ExpenseCategory, // default Maria: materiais
    amount: "",
    supplier: "",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== "todas" && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.supplier ?? "").toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter]);

  function handleCreate() {
    const amount = parseFloat(newExpense.amount.replace(",", "."));
    if (!newExpense.description.trim() || !amount || amount <= 0) {
      toast.error("Preenche a descrição e um valor válido.");
      return;
    }
    startTransition(async () => {
      try {
        await createExpenseAction({
          expense_date: newExpense.expense_date,
          description: newExpense.description.trim(),
          category: newExpense.category,
          amount,
          supplier: newExpense.supplier.trim() || null,
          is_recurring: false,
        });
        toast.success("Despesa registada.");
        setCreating(false);
        setNewExpense({
          expense_date: format(new Date(), "yyyy-MM-dd"),
          description: "",
          category: "materiais",
          amount: "",
          supplier: "",
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
            placeholder="Pesquisar descrição ou fornecedor..."
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
              placeholder="Descrição (ex.: Caixas de cartão, almoço com cliente…)"
              value={newExpense.description}
              onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))}
              autoFocus
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
          <Input
            placeholder="Fornecedor (opcional) — texto ou link (ex.: Continente, https://amazon.es/…)"
            value={newExpense.supplier}
            onChange={(e) => setNewExpense((p) => ({ ...p, supplier: e.target.value }))}
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
            <table className="w-full text-sm min-w-[760px] xl:min-w-[920px]">
              <thead className="bg-cream-50">
                <tr className="text-left text-xs uppercase tracking-wide text-cocoa-700">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium hidden xl:table-cell">Fornecedor</th>
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
    description: "",
    category: "software" as ExpenseCategory,
    amount: "",
    supplier: "",
    recurrence_period: "monthly" as ExpenseRecurrencePeriod,
    recurrence_start_date: format(today, "yyyy-MM-dd"),
    recurrence_end_date: "",
  });

  function handleCreate() {
    const amount = parseFloat(newSub.amount.replace(",", "."));
    if (!newSub.description.trim() || !amount || amount <= 0) {
      toast.error("Preenche a descrição e um valor válido.");
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
          description: newSub.description.trim(),
          category: newSub.category,
          amount,
          supplier: newSub.supplier.trim() || null,
          is_recurring: true,
          recurrence_period: newSub.recurrence_period,
          recurrence_start_date: newSub.recurrence_start_date,
          recurrence_end_date: newSub.recurrence_end_date || null,
        });
        toast.success("Subscrição registada.");
        setCreating(false);
        setNewSub({
          description: "",
          category: "software",
          amount: "",
          supplier: "",
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
              <label className="text-xs text-cocoa-700">Descrição *</label>
              <Input
                placeholder="Ex.: Vercel Pro, Adobe CC, Spotify Family…"
                value={newSub.description}
                onChange={(e) => setNewSub((p) => ({ ...p, description: e.target.value }))}
                autoFocus
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
              <label className="text-xs text-cocoa-700">
                {newSub.recurrence_period === "monthly" && "Valor mensal"}
                {newSub.recurrence_period === "yearly" && "Valor anual"}
                {newSub.recurrence_period === "custom" && "Valor total"}
              </label>
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
          <Input
            placeholder="Fornecedor (opcional) — texto ou link (ex.: Vercel, https://vercel.com/account)"
            value={newSub.supplier}
            onChange={(e) => setNewSub((p) => ({ ...p, supplier: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-700 text-white">Registar</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-violet-800/70 italic">
            <strong>Mensal:</strong> valor cobrado em cada mês.{" "}
            <strong>Anual:</strong> valor anual, dividido por 12 para o custo mensal estimado.{" "}
            <strong>Intervalo específico:</strong> valor <em>total</em> pago pelo intervalo (ex.: 41,70 € por 14 meses = 2,98 €/mês).
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
            <table className="w-full text-sm min-w-[780px] xl:min-w-[960px]">
              <thead className="bg-cream-50">
                <tr className="text-left text-xs uppercase tracking-wide text-cocoa-700">
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Periodicidade</th>
                  <th className="px-3 py-2 font-medium hidden xl:table-cell">Início → Fim</th>
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
  const [editing, setEditing] = useState(false);

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
      <td className="px-3 py-2 text-cocoa-900 font-medium max-w-[320px]">
        <div className="truncate" title={expense.description ?? expense.supplier ?? ""}>
          {expense.description ?? <span className="text-cocoa-500 italic">(sem descrição)</span>}
        </div>
        {/* Em ecrãs estreitos o fornecedor não tem coluna própria — mostramo-lo
            por baixo da descrição para não se perder. */}
        <div className="xl:hidden text-xs mt-0.5">
          {renderSupplier(expense.supplier)}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          EXPENSE_CATEGORY_COLORS[expense.category]
        )}>
          {EXPENSE_CATEGORY_LABELS[expense.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-xs hidden xl:table-cell max-w-[240px]">
        {renderSupplier(expense.supplier)}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-rose-700 whitespace-nowrap">
        {formatEUR(Number(expense.amount))}
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
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {canEdit && (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-cocoa-500 hover:text-cocoa-900 transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleArchive}
              className="text-cocoa-500 hover:text-rose-600 transition-colors"
              title="Arquivar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {editing && (
          <EditExpenseDialog
            expense={expense}
            open={editing}
            onOpenChange={setEditing}
          />
        )}
      </td>
    </tr>
  );
}

// ── Dialog de edição (cobre despesas únicas e subscrições) ──

function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense: Expense;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isSub = expense.is_recurring;

  const [draft, setDraft] = useState({
    expense_date: expense.expense_date,
    description: expense.description ?? "",
    category: expense.category,
    amount: String(expense.amount).replace(".", ","),
    supplier: expense.supplier ?? "",
    payment_method: expense.payment_method ?? "",
    notes: expense.notes ?? "",
    recurrence_period: (expense.recurrence_period ?? "monthly") as ExpenseRecurrencePeriod,
    recurrence_start_date: expense.recurrence_start_date ?? expense.expense_date,
    recurrence_end_date: expense.recurrence_end_date ?? "",
  });

  function handleSave() {
    const amount = parseFloat(draft.amount.replace(",", "."));
    if (!draft.description.trim()) {
      toast.error("A descrição é obrigatória.");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    if (isSub && !draft.recurrence_start_date) {
      toast.error("Indica a data de início da subscrição.");
      return;
    }
    if (
      isSub &&
      draft.recurrence_period === "custom" &&
      draft.recurrence_end_date &&
      draft.recurrence_end_date < draft.recurrence_start_date
    ) {
      toast.error("A data de fim tem que ser depois do início.");
      return;
    }

    const patch: Record<string, unknown> = {
      description: draft.description.trim(),
      category: draft.category,
      amount,
      supplier: draft.supplier.trim() || null,
      notes: draft.notes.trim() || null,
      payment_method: (draft.payment_method || null) as ExpensePaymentMethod | null,
    };
    if (isSub) {
      patch.recurrence_period = draft.recurrence_period;
      patch.recurrence_start_date = draft.recurrence_start_date;
      patch.recurrence_end_date = draft.recurrence_end_date || null;
      patch.expense_date = draft.recurrence_start_date;
    } else {
      patch.expense_date = draft.expense_date;
    }

    startTransition(async () => {
      try {
        await updateExpenseAction(expense.id, patch as Partial<Expense>);
        toast.success(isSub ? "Subscrição actualizada." : "Despesa actualizada.");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isSub ? "Editar subscrição" : "Editar despesa"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft({ ...draft, category: v as ExpenseCategory })}
              >
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
            <div className="space-y-1.5">
              <Label className="text-xs">
                {isSub
                  ? draft.recurrence_period === "monthly"
                    ? "Valor mensal"
                    : draft.recurrence_period === "yearly"
                      ? "Valor anual"
                      : "Valor total"
                  : "Valor"}
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-6"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </div>
            </div>
          </div>

          {isSub ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Periodicidade</Label>
                <Select
                  value={draft.recurrence_period}
                  onValueChange={(v) => setDraft({ ...draft, recurrence_period: v as ExpenseRecurrencePeriod })}
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
              <div className="space-y-1.5">
                <Label className="text-xs">Início</Label>
                <Input
                  type="date"
                  value={draft.recurrence_start_date}
                  onChange={(e) => setDraft({ ...draft, recurrence_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Fim {draft.recurrence_period === "custom" ? "(obrigatório)" : "(opcional)"}
                </Label>
                <Input
                  type="date"
                  value={draft.recurrence_end_date}
                  onChange={(e) => setDraft({ ...draft, recurrence_end_date: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={draft.expense_date}
                onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor (opcional, texto ou link)</Label>
            <Input
              value={draft.supplier}
              onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Método de pagamento</Label>
            <Select
              value={draft.payment_method || "__none__"}
              onValueChange={(v) => setDraft({ ...draft, payment_method: !v || v === "__none__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue labels={EXPENSE_PAYMENT_METHOD_LABELS} placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {(Object.keys(EXPENSE_PAYMENT_METHOD_LABELS) as ExpensePaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{EXPENSE_PAYMENT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg">
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionRow({ expense, canEdit }: { expense: Expense; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

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
      <td className="px-3 py-2 text-cocoa-900 font-medium max-w-[260px]">
        <div className="truncate" title={expense.description ?? expense.supplier ?? ""}>
          {expense.description ?? <span className="text-cocoa-500 italic">(sem descrição)</span>}
        </div>
        {expense.supplier && (
          <div className="text-xs mt-0.5">{renderSupplier(expense.supplier)}</div>
        )}
      </td>
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
      <td className="px-3 py-2 text-xs text-cocoa-700 whitespace-nowrap hidden xl:table-cell">
        <CalendarIcon className="h-3 w-3 inline -mt-0.5 mr-1 text-cocoa-500" />
        {startStr} → {endStr}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-rose-700 whitespace-nowrap">
        {formatEUR(Number(expense.amount))}
      </td>
      <td className="px-3 py-2 text-right text-cocoa-900 whitespace-nowrap tabular-nums">
        {formatEUR(monthly)}
      </td>
      <td className="px-3 py-2">
        <InvoiceCell expense={expense} canEdit={canEdit} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {canEdit && (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-cocoa-500 hover:text-cocoa-900 transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleArchive}
              className="text-cocoa-500 hover:text-rose-600 transition-colors"
              title="Arquivar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {editing && (
          <EditExpenseDialog
            expense={expense}
            open={editing}
            onOpenChange={setEditing}
          />
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

