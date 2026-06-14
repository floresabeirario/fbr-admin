"use client";

// ============================================================
// FATURAÇÃO — extraído de financas-client.tsx
// ============================================================

import React, { useMemo, useState } from "react";
import {
  Receipt,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Calendar as CalendarIcon,
  Sparkles,
  Frame,
  Handshake,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, getYear } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/format";
import {
  commissionFromOrder,
  cogsRecognizedFromOrder,
  paidRatio as paidRatioOf,
} from "@/lib/finance";
import type { Expense } from "@/types/expense";
import { KpiBox, type FaturacaoOrder, type FaturacaoVoucher } from "./shared";

// Explicações dos KPIs (tooltips ⓘ) — para ficar claro o que cada número
// mede, sobretudo porque os clientes pagam em parcelas.
const INFO_RECEITA =
  "Dinheiro JÁ RECEBIDO no período: orçamento × % já pago (30/70/100%) de cada encomenda (sem canceladas, pela data do evento) + vales 100% pagos ainda não convertidos. NÃO é o total se todas pagassem 100%. 'Líquida' = depois de descontar comissões a parceiros.";
const INFO_DESPESAS =
  "Despesas lançadas no período (únicas + subscrições), pela data da despesa.";
const INFO_COGS =
  "Custo de produção reconhecido: só conta os materiais das encomendas 100% pagas (tudo-ou-nada). Encomendas a 30/70% ainda não entram.";
const INFO_COMISSOES =
  "Comissões a parceiros, proporcionais ao % já pago, nos estados que contam (parceiro informado / a aguardar / paga). 'N/A' e 'Não aceita' não entram.";
const INFO_LUCRO =
  "Receita recebida − despesas − custo de produção − comissões, no período.";

export function FaturacaoTab({
  orders,
  vouchers,
  expenses,
}: {
  orders: FaturacaoOrder[];
  vouchers: FaturacaoVoucher[];
  expenses: Expense[];
}) {
  // Receita = orders proporcional ao % pago + vales pagos não convertidos (evitar dupla contagem)
  // Encomendas CANCELADAS não contam (coerente com o Painel e as Métricas).
  const revenueFromOrder = (o: FaturacaoOrder): number => {
    if (o.status === "cancelado") return 0;
    if (!o.budget) return 0;
    return o.budget * paidRatioOf(o.payment_status);
  };
  const revenueFromVoucher = (v: FaturacaoVoucher): number => {
    if (v.payment_status !== "100_pago") return 0;
    if (v.usage_status === "preservacao_agendada") return 0; // evita dupla contagem com a encomenda
    return Number(v.amount);
  };
  // COGS tudo-ou-nada: só conta quando a encomenda está 100% paga
  // (decisão Maria 2026-05-22). Implementação em lib/finance.ts. Canceladas
  // não contam (alinhado com a receita).
  const cogsFromOrder = (o: FaturacaoOrder): number =>
    o.status === "cancelado" ? 0 : cogsRecognizedFromOrder(o);

  // new Date() é impuro durante o render — estabilizado com useMemo (o
  // compilador do React não conseguia preservar o useMemo de availableYears).
  const now = useMemo(() => new Date(), []);
  const currentYear = getYear(now);

  // Anos disponíveis: encomendas pela data do evento; vales pela data de criação;
  // despesas pela data da despesa. Garante que o ano actual aparece sempre.
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    for (const o of orders) {
      if (o.event_date) {
        try { years.add(getYear(parseISO(o.event_date))); } catch {}
      }
    }
    for (const v of vouchers) {
      if (v.created_at) {
        try { years.add(getYear(parseISO(v.created_at))); } catch {}
      }
    }
    for (const e of expenses) {
      if (e.expense_date) {
        try { years.add(getYear(parseISO(e.expense_date))); } catch {}
      }
    }
    return [...years].sort((a, b) => b - a); // mais recente primeiro
  }, [orders, vouchers, expenses, currentYear]);

  // "all" = totais desde sempre (sem filtro de ano)
  const [selectedYear, setSelectedYear] = useState<number | "all">(currentYear);
  const isAllTime = selectedYear === "all";
  const isCurrentYear = selectedYear === currentYear;

  // Quando "Todos": range artificial gigantesco que apanha tudo.
  // Quando ano específico: range Jan→Dez desse ano.
  const yearStart = isAllTime ? new Date(1970, 0, 1) : startOfYear(new Date(selectedYear as number, 0, 1));
  const yearEnd = isAllTime ? new Date(2999, 11, 31) : endOfYear(new Date(selectedYear as number, 11, 31));

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const inRange = (iso: string | null, start: Date, end: Date): boolean => {
    if (!iso) return false;
    const d = parseISO(iso);
    return d >= start && d <= end;
  };

  // Pipeline 4-bucket por estado da encomenda — substitui o card "Potencial total" de 3 cells.
  // Cada bucket mostra count + soma de orçamentos (potencial 100% pago) das encomendas
  // nesse bucket. Cancelado fica de fora. Sem-resposta partilha o estado `entrega_flores_agendar`.
  type PipelineBucket = "nao_confirmado" | "confirmado_por_produzir" | "em_producao" | "recebido";
  const statusToBucket = (s: import("@/types/database").OrderStatus): PipelineBucket | null => {
    switch (s) {
      case "cancelado":
        return null;
      case "entrega_flores_agendar":
        return "nao_confirmado";
      case "entrega_agendada":
      case "flores_enviadas":
      case "flores_recebidas":
        return "confirmado_por_produzir";
      case "flores_na_prensa":
      case "reconstrucao_botanica":
      case "a_compor_design":
      case "a_aguardar_aprovacao":
      case "a_finalizar_quadro":
      case "a_ser_emoldurado":
      case "emoldurado":
      case "a_ser_fotografado":
      case "quadro_pronto":
      case "quadro_enviado":
        return "em_producao";
      case "quadro_recebido":
        return "recebido";
    }
  };
  const pipelineBuckets: Record<PipelineBucket, { count: number; total: number }> = {
    nao_confirmado:          { count: 0, total: 0 },
    confirmado_por_produzir: { count: 0, total: 0 },
    em_producao:             { count: 0, total: 0 },
    recebido:                { count: 0, total: 0 },
  };
  for (const o of orders) {
    if (!inRange(o.event_date, yearStart, yearEnd)) continue;
    const b = statusToBucket(o.status);
    if (!b) continue;
    pipelineBuckets[b].count += 1;
    pipelineBuckets[b].total += Number(o.budget) || 0;
  }
  const pipelineTotal =
    pipelineBuckets.nao_confirmado.total +
    pipelineBuckets.confirmado_por_produzir.total +
    pipelineBuckets.em_producao.total +
    pipelineBuckets.recebido.total;

  // KPIs mensais: orders pela data do evento; vales pela data de criação.
  const revenueOrdersMonth = orders
    .filter((o) => inRange(o.event_date, monthStart, monthEnd))
    .reduce((s, o) => s + revenueFromOrder(o), 0);
  const revenueVouchersMonth = vouchers
    .filter((v) => inRange(v.created_at, monthStart, monthEnd))
    .reduce((s, v) => s + revenueFromVoucher(v), 0);
  const revenueMonth = revenueOrdersMonth + revenueVouchersMonth;

  const revenuePrevMonth =
    orders.filter((o) => inRange(o.event_date, prevMonthStart, prevMonthEnd)).reduce((s, o) => s + revenueFromOrder(o), 0) +
    vouchers.filter((v) => inRange(v.created_at, prevMonthStart, prevMonthEnd)).reduce((s, v) => s + revenueFromVoucher(v), 0);

  // "Receita do ano" passa a ser "Receita total" quando isAllTime.
  const revenueYear =
    orders.filter((o) => inRange(o.event_date, yearStart, yearEnd)).reduce((s, o) => s + revenueFromOrder(o), 0) +
    vouchers.filter((v) => inRange(v.created_at, yearStart, yearEnd)).reduce((s, v) => s + revenueFromVoucher(v), 0);

  const expensesMonth = expenses
    .filter((e) => inRange(e.expense_date, monthStart, monthEnd))
    .reduce((s, e) => s + Number(e.amount), 0);
  const expensesYear = expenses
    .filter((e) => inRange(e.expense_date, yearStart, yearEnd))
    .reduce((s, e) => s + Number(e.amount), 0);

  // Custo de produção (COGS) por período: atribuído à mesma janela em que a
  // receita conta, ou seja, pela data do evento da encomenda.
  const cogsMonth = orders
    .filter((o) => inRange(o.event_date, monthStart, monthEnd))
    .reduce((s, o) => s + cogsFromOrder(o), 0);
  const cogsYear = orders
    .filter((o) => inRange(o.event_date, yearStart, yearEnd))
    .reduce((s, o) => s + cogsFromOrder(o), 0);

  // Comissões a parceiros: dedução à receita (decisão Maria 2026-05-19).
  // Conta proporcional ao %pago, excluindo estados `na` e `nao_aceita` e
  // encomendas canceladas (alinhado com a receita).
  const commissionMonth = orders
    .filter((o) => o.status !== "cancelado" && inRange(o.event_date, monthStart, monthEnd))
    .reduce((s, o) => s + commissionFromOrder(o), 0);
  const commissionYear = orders
    .filter((o) => o.status !== "cancelado" && inRange(o.event_date, yearStart, yearEnd))
    .reduce((s, o) => s + commissionFromOrder(o), 0);

  // Receita líquida = bruta − comissões (mostrado como sub-texto debaixo
  // do KPI principal, sem inflar a grelha com mais um KPI por linha).
  const revenueNetMonth = revenueMonth - commissionMonth;
  const revenueNetYear = revenueYear - commissionYear;

  const profitMonth = revenueMonth - expensesMonth - cogsMonth - commissionMonth;
  const profitYear = revenueYear - expensesYear - cogsYear - commissionYear;
  const monthDelta = revenuePrevMonth > 0 ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : null;

  // Gráfico:
  //  - ano específico: 12 barras (Jan→Dez desse ano)
  //  - "Todos": 1 barra por ano disponível
  const chartData = useMemo(() => {
    if (isAllTime) {
      // Ascendente para o gráfico (mais antigo → mais recente).
      const yearsAsc = [...availableYears].sort((a, b) => a - b);
      return yearsAsc.map((y) => {
        const start = startOfYear(new Date(y, 0, 1));
        const end = endOfYear(new Date(y, 11, 31));
        const rev =
          orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + revenueFromOrder(o), 0) +
          vouchers.filter((v) => inRange(v.created_at, start, end)).reduce((s, v) => s + revenueFromVoucher(v), 0);
        const exp = expenses.filter((e) => inRange(e.expense_date, start, end)).reduce((s, e) => s + Number(e.amount), 0);
        const cogs = orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + cogsFromOrder(o), 0);
        return {
          key: String(y),
          label: String(y),
          revenue: rev,
          expenses: exp,
          cogs,
        };
      });
    }
    const buckets: { key: string; label: string; revenue: number; expenses: number; cogs: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const start = startOfMonth(new Date(selectedYear as number, m, 1));
      const end = endOfMonth(new Date(selectedYear as number, m, 1));
      const rev =
        orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + revenueFromOrder(o), 0) +
        vouchers.filter((v) => inRange(v.created_at, start, end)).reduce((s, v) => s + revenueFromVoucher(v), 0);
      const exp = expenses.filter((e) => inRange(e.expense_date, start, end)).reduce((s, e) => s + Number(e.amount), 0);
      const cogs = orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + cogsFromOrder(o), 0);
      buckets.push({
        key: format(start, "yyyy-MM"),
        label: format(start, "MMM", { locale: pt }),
        revenue: rev,
        expenses: exp,
        cogs,
      });
    }
    return buckets;
  }, [orders, vouchers, expenses, selectedYear, isAllTime, availableYears]);

  const maxBarValue = Math.max(...chartData.map((m) => Math.max(m.revenue, m.expenses, m.cogs)), 1);

  return (
    <div className="space-y-4">
      {/* Selector de ano */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-cocoa-700" />
          <span className="text-sm font-medium text-cocoa-900">Ano:</span>
          <Select
            value={isAllTime ? "all" : String(selectedYear)}
            onValueChange={(v) => setSelectedYear(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (desde sempre)</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}{y === currentYear ? " (actual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-cocoa-700 italic">
          Encomendas contam pelo ano da <strong>data do evento</strong>; vales pelo ano de <strong>criação</strong>.
        </p>
      </div>

      {/* KPIs principais — Receita / Despesas / COGS / Comissões / Lucro
          A receita mostra "líquida" (= bruta − comissões) como sub-texto. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {isCurrentYear ? (
          <>
            <KpiBox
              label="Receita do mês"
              value={formatEUR(revenueMonth)}
              icon={<TrendingUp className="h-4 w-4" />}
              color="emerald"
              info={INFO_RECEITA}
              delta={monthDelta}
              subLabel="Líquida"
              subValue={commissionMonth > 0 ? formatEUR(revenueNetMonth) : undefined}
            />
            <KpiBox label="Despesas do mês" value={formatEUR(expensesMonth)} icon={<ArrowDownRight className="h-4 w-4" />} color="rose" info={INFO_DESPESAS} />
            <KpiBox label="Custo de produção" value={formatEUR(cogsMonth)} icon={<Frame className="h-4 w-4" />} color="amber" info={INFO_COGS} />
            <KpiBox label="Comissões do mês" value={formatEUR(commissionMonth)} icon={<Handshake className="h-4 w-4" />} color="violet" info={INFO_COMISSOES} />
            <KpiBox
              label="Lucro do mês"
              value={formatEUR(profitMonth)}
              icon={<CreditCard className="h-4 w-4" />}
              color={profitMonth >= 0 ? "emerald" : "rose"}
              info={INFO_LUCRO}
            />
          </>
        ) : (
          <>
            <KpiBox
              label={isAllTime ? "Receita total" : `Receita ${selectedYear}`}
              value={formatEUR(revenueYear)}
              icon={<ArrowUpRight className="h-4 w-4" />}
              color="sky"
              info={INFO_RECEITA}
              subLabel="Líquida"
              subValue={commissionYear > 0 ? formatEUR(revenueNetYear) : undefined}
            />
            <KpiBox label={isAllTime ? "Despesas totais" : `Despesas ${selectedYear}`} value={formatEUR(expensesYear)} icon={<Receipt className="h-4 w-4" />} color="rose" info={INFO_DESPESAS} />
            <KpiBox label={isAllTime ? "Custo produção total" : `Custo produção ${selectedYear}`} value={formatEUR(cogsYear)} icon={<Frame className="h-4 w-4" />} color="amber" info={INFO_COGS} />
            <KpiBox label={isAllTime ? "Comissões totais" : `Comissões ${selectedYear}`} value={formatEUR(commissionYear)} icon={<Handshake className="h-4 w-4" />} color="violet" info={INFO_COMISSOES} />
            <KpiBox label={isAllTime ? "Lucro total" : `Lucro ${selectedYear}`} value={formatEUR(profitYear)} icon={<TrendingUp className="h-4 w-4" />} color={profitYear >= 0 ? "emerald" : "rose"} info={INFO_LUCRO} />
          </>
        )}
      </div>

      {isCurrentYear && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiBox
            label={`Receita ${selectedYear}`}
            value={formatEUR(revenueYear)}
            icon={<ArrowUpRight className="h-4 w-4" />}
            color="sky"
            info={INFO_RECEITA}
            subLabel="Líquida"
            subValue={commissionYear > 0 ? formatEUR(revenueNetYear) : undefined}
          />
          <KpiBox label={`Despesas ${selectedYear}`} value={formatEUR(expensesYear)} icon={<Receipt className="h-4 w-4" />} color="rose" info={INFO_DESPESAS} />
          <KpiBox label={`Custo produção ${selectedYear}`} value={formatEUR(cogsYear)} icon={<Frame className="h-4 w-4" />} color="amber" info={INFO_COGS} />
          <KpiBox label={`Comissões ${selectedYear}`} value={formatEUR(commissionYear)} icon={<Handshake className="h-4 w-4" />} color="violet" info={INFO_COMISSOES} />
          <KpiBox label={`Lucro ${selectedYear}`} value={formatEUR(profitYear)} icon={<TrendingUp className="h-4 w-4" />} color={profitYear >= 0 ? "emerald" : "rose"} info={INFO_LUCRO} />
        </div>
      )}

      {/* Pipeline financeiro por estado da encomenda — 4 buckets do menos para o mais certo */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 dark:border-violet-900/50 p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-violet-200/60 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-violet-700 dark:text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
                {isAllTime
                  ? "Pipeline (desde sempre) — orçamento total por fase"
                  : `Pipeline ${selectedYear} — orçamento total por fase`}
              </h3>
              <span className="text-xs text-violet-800 dark:text-violet-300 tabular-nums">
                Total: <strong>{formatEUR(pipelineTotal)}</strong>
              </span>
            </div>
            <p className="text-xs text-violet-800/80 dark:text-violet-300/80 mt-0.5">
              {isAllTime
                ? "Soma dos orçamentos por estado da encomenda, em qualquer ano. Cancelado e vales não somam aqui."
                : `Soma dos orçamentos por estado, encomendas com data de evento em ${selectedYear}. Cancelado e vales não somam aqui.`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PipelineBucket
            label="Não confirmado"
            helper="Pré-reservas e sem-resposta"
            count={pipelineBuckets.nao_confirmado.count}
            total={pipelineBuckets.nao_confirmado.total}
            color="amber"
          />
          <PipelineBucket
            label="Confirmado, por produzir"
            helper="Entrega agendada / flores em trânsito"
            count={pipelineBuckets.confirmado_por_produzir.count}
            total={pipelineBuckets.confirmado_por_produzir.total}
            color="sky"
          />
          <PipelineBucket
            label="Em produção / pronto"
            helper="Da prensa ao quadro enviado"
            count={pipelineBuckets.em_producao.count}
            total={pipelineBuckets.em_producao.total}
            color="violet"
          />
          <PipelineBucket
            label="Recebido pelo cliente"
            helper="Quadros entregues"
            count={pipelineBuckets.recebido.count}
            total={pipelineBuckets.recebido.total}
            color="emerald"
          />
        </div>
      </div>

      {/* Bar chart: 12 meses do ano ou 1 barra por ano se "Todos" */}
      <div className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-cocoa-900">
            {isAllTime ? "Receita vs despesas vs custo de produção por ano" : `Receita vs despesas vs custo de produção — ${selectedYear}`}
          </h3>
          <div className="flex items-center gap-3 text-xs text-cocoa-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-400" />Receita
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-400" />Despesas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400" />Produção
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-48">
          {chartData.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5 h-40">
                <div
                  className="w-2 sm:w-2.5 bg-emerald-400 rounded-t transition-all"
                  style={{ height: `${(m.revenue / maxBarValue) * 100}%` }}
                  title={`Receita: ${formatEUR(m.revenue)}`}
                />
                <div
                  className="w-2 sm:w-2.5 bg-rose-400 rounded-t transition-all"
                  style={{ height: `${(m.expenses / maxBarValue) * 100}%` }}
                  title={`Despesas: ${formatEUR(m.expenses)}`}
                />
                <div
                  className="w-2 sm:w-2.5 bg-amber-400 rounded-t transition-all"
                  style={{ height: `${(m.cogs / maxBarValue) * 100}%` }}
                  title={`Custo de produção: ${formatEUR(m.cogs)}`}
                />
              </div>
              <span className="text-[10px] text-cocoa-700 capitalize">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-cocoa-700 italic px-1">
        <strong>Receita (bruta)</strong> = soma proporcional do orçamento das encomendas conforme o estado de pagamento (100%=100%, 70%=70%, 30%=30%) + vales 100% pagos ainda não convertidos em preservação (evita dupla contagem). <strong>Receita líquida</strong> (mostrada por baixo quando aplicável) = receita bruta − comissões a parceiros. <strong>Custo de produção</strong> = soma do COGS de cada encomenda (snapshot capturado na criação, calculado a partir do tamanho, fundo, tipo de moldura e extras), <strong>contado apenas quando a encomenda está 100% paga</strong> (encomendas a 30%/70%/por pagar contribuem 0). <strong>Comissões</strong> = parte da receita devida a parceiros recomendadores, contada proporcional ao % pago; estados “N/A” e “Não aceita” não somam. <strong>Despesas</strong> = custos fixos (subscrições + únicos) na data da despesa. <strong>Lucro</strong> = receita bruta − despesas − custo de produção − comissões. Encomendas, comissões e custo de produção atribuídos ao período pela data do evento; vales pela data de criação. Encomendas anteriores à mig 034 não têm snapshot e não somam para o COGS. Para métricas mais detalhadas, ver a aba Métricas.
      </p>
    </div>
  );
}


function PipelineBucket({
  label,
  helper,
  count,
  total,
  color,
}: {
  label: string;
  helper: string;
  count: number;
  total: number;
  color: "amber" | "sky" | "violet" | "emerald";
}) {
  const palette: Record<string, { border: string; bg: string; text: string; subtext: string }> = {
    amber:   { border: "border-amber-200 dark:border-amber-900/40",   bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-amber-900 dark:text-amber-200",   subtext: "text-amber-700 dark:text-amber-300" },
    sky:     { border: "border-sky-200 dark:border-sky-900/40",       bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-sky-900 dark:text-sky-200",       subtext: "text-sky-700 dark:text-sky-300" },
    violet:  { border: "border-violet-200 dark:border-violet-900/40", bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-violet-900 dark:text-violet-200", subtext: "text-violet-700 dark:text-violet-300" },
    emerald: { border: "border-emerald-200 dark:border-emerald-900/40", bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-emerald-900 dark:text-emerald-200", subtext: "text-emerald-700 dark:text-emerald-300" },
  };
  const c = palette[color];
  return (
    <div className={cn("rounded-xl border p-3 space-y-1", c.bg, c.border)}>
      <div className={cn("text-[10px] uppercase tracking-wider font-medium", c.subtext)}>{label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", c.text)}>{formatEUR(total)}</div>
      <div className={cn("text-[11px]", c.subtext)}>
        {count} {count === 1 ? "encomenda" : "encomendas"} · {helper}
      </div>
    </div>
  );
}

