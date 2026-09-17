"use client";

// ============================================================
// FATURAÇÃO — extraído de financas-client.tsx
// ============================================================

import React, { useCallback, useMemo, useState } from "react";
import {
  Receipt,
  TrendingUp,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Sparkles,
  Frame,
  Handshake,
  Download,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, getYear, addMonths, isBefore } from "date-fns";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/export-csv";
import { formatDatePT, formatDateLisbon } from "@/lib/format-date";
import { STATUS_LABELS } from "@/types/database";
import { VOUCHER_USAGE_STATUS_LABELS } from "@/types/voucher";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_PAYMENT_METHOD_LABELS } from "@/types/expense";
import { pt } from "date-fns/locale";
import { useTheme } from "next-themes";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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
  commissionFullFromVoucher,
  voucherCodesWithCommission,
  orderCommissionSuppressedByVoucher,
  expensesTotalInPeriod,
  expenseAmountInPeriod,
  revenueInPeriod,
  revenueTranches,
  commissionInPeriod,
  cogsInPeriod,
  outstandingFromOrder,
} from "@/lib/finance";
import type { Expense } from "@/types/expense";
import { KpiBox, type FaturacaoOrder, type FaturacaoVoucher } from "./shared";

// Explicações dos KPIs (tooltips ⓘ) — para ficar claro o que cada número
// mede, sobretudo porque os clientes pagam em parcelas.
const INFO_RECEITA =
  "Dinheiro que ENTROU no período: cada parcela (30% / 40% / 30% do orçamento) conta na data em que foi paga; encomendas antigas sem essa data contam pela data do evento. Sem canceladas. Mais vales 100% pagos ainda não convertidos (pela data de criação). NÃO é o total se todas pagassem 100%. 'Líquida' = depois de descontar comissões a parceiros.";
const INFO_DESPESAS =
  "Despesas únicas pela data da despesa + subscrições activas no período, ao custo mensal equivalente (anual ÷ 12), em cada mês até ao mês actual. A mesma base da aba Despesas.";
const INFO_COGS =
  "Custo de produção reconhecido: materiais de cada encomenda (snapshot capturado na criação: tamanho, fundo, tipo de moldura e extras), contados só quando a encomenda está 100% paga (tudo-ou-nada), na data em que ficou 100% paga (sem essa data: data do evento). Encomendas a 30/70% ainda não entram; encomendas antigas sem snapshot contam 0.";
const INFO_COMISSOES =
  "Comissões a parceiros, proporcionais às parcelas pagas no período, nos estados que contam (parceiro informado / a aguardar / paga). 'N/A' e 'Não aceita' não entram. Inclui comissões de vales recomendados (só quando o vale está 100% pago); contam uma única vez no vale e não recontam quando este vira preservação.";
const INFO_POR_RECEBER =
  "Quanto falta os clientes pagarem: orçamento × (1 − % pago) das encomendas não canceladas com evento neste período. Dinheiro que ainda vai entrar se tudo correr bem.";
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
  // Receita, comissões e custo de produção das encomendas contam pela DATA
  // DE CADA PAGAMENTO (mig 111, decisão da Maria na sessão 174); encomendas
  // sem carimbo caem na data do evento, como antes. Vales pela data de
  // criação (100% pagos e não convertidos, para não contar a dobrar com a
  // encomenda). Canceladas nunca contam. Tudo em lib/finance.ts.
  const revenueFromVoucher = (v: FaturacaoVoucher): number => {
    if (v.payment_status !== "100_pago") return 0;
    if (v.usage_status === "preservacao_agendada") return 0; // evita dupla contagem com a encomenda
    return Number(v.amount);
  };
  const ordersRevenueIn = useCallback(
    (start: Date, end: Date): number =>
      orders.reduce((s, o) => s + revenueInPeriod(o, start, end), 0),
    [orders],
  );
  const ordersCogsIn = useCallback(
    (start: Date, end: Date): number =>
      orders.reduce((s, o) => s + cogsInPeriod(o, start, end), 0),
    [orders],
  );

  // new Date() é impuro durante o render — estabilizado com useMemo (o
  // compilador do React não conseguia preservar o useMemo de availableYears).
  const now = useMemo(() => new Date(), []);
  const currentYear = getYear(now);

  // Cores do gráfico consoante o tema (mesmo padrão da Métricas).
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartGrid = isDark ? "#322821" : "#E8E0D5";
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${isDark ? "#322821" : "#E8E0D5"}`,
    background: isDark ? "#1B1611" : "#FFFFFF",
    color: isDark ? "#E8D5B5" : "#3D2B1F",
    fontSize: 12,
  } as const;

  // Anos disponíveis: encomendas pela data do evento e pelas datas de
  // pagamento; vales pela data de criação; despesas pela data da despesa.
  // Garante que o ano actual aparece sempre.
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    const add = (iso: string | null | undefined) => {
      if (!iso) return;
      try { years.add(getYear(parseISO(iso))); } catch {}
    };
    for (const o of orders) {
      add(o.event_date);
      add(o.deposit_paid_at);
      add(o.second_paid_at);
      add(o.fully_paid_at);
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

  // Quando "Todos": range artificial gigantesco que apanha tudo.
  // Quando ano específico: range Jan→Dez desse ano.
  const yearStart = isAllTime ? new Date(1970, 0, 1) : startOfYear(new Date(selectedYear as number, 0, 1));
  const yearEnd = isAllTime ? new Date(2999, 11, 31) : endOfYear(new Date(selectedYear as number, 11, 31));

  const inRange =(iso: string | null, start: Date, end: Date): boolean => {
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

  // Por receber (pedido da Maria, sessão 174): o que falta os clientes
  // pagarem das encomendas não canceladas com evento no período.
  let outstandingTotal = 0;
  let outstandingCount = 0;
  for (const o of orders) {
    if (!inRange(o.event_date, yearStart, yearEnd)) continue;
    const due = outstandingFromOrder(o);
    if (due > 0) {
      outstandingTotal += due;
      outstandingCount += 1;
    }
  }

  // ── Exportação CSV (pedido da Maria, sessão 174): receitas e despesas do
  // ano escolhido, para contabilista/IRS. Receitas = uma linha por parcela
  // paga (com a data que contou) + vales; despesas = únicas + uma linha por
  // mês de cada subscrição activa. Abre no Excel (`;` + BOM).
  const eur = (n: number) => n.toFixed(2).replace(".", ",");
  const yearLabel = isAllTime ? "todos" : String(selectedYear);
  const exportRevenueCsv = () => {
    const items: Array<{ at: Date; row: string[] }> = [];
    for (const o of orders) {
      if (o.status === "cancelado" || !o.budget) continue;
      for (const t of revenueTranches(o)) {
        if (!t.at || !inRange(t.at, yearStart, yearEnd)) continue;
        items.push({
          at: parseISO(t.at),
          row: [
            t.stamped ? formatDateLisbon(t.at) : formatDatePT(t.at),
            "Encomenda",
            o.client_name,
            o.order_id,
            `${t.pct}%`,
            eur((Number(o.budget) * t.pct) / 100),
            formatDatePT(o.event_date),
            STATUS_LABELS[o.status],
            t.stamped ? "data do pagamento" : "data do evento (sem data de pagamento)",
          ],
        });
      }
    }
    for (const v of vouchers) {
      if (revenueFromVoucher(v) <= 0 || !inRange(v.created_at, yearStart, yearEnd)) continue;
      items.push({
        at: parseISO(v.created_at),
        row: [
          formatDateLisbon(v.created_at),
          "Vale",
          v.code,
          "",
          "100%",
          eur(Number(v.amount)),
          "",
          VOUCHER_USAGE_STATUS_LABELS[v.usage_status],
          "data de criação",
        ],
      });
    }
    items.sort((a, b) => a.at.getTime() - b.at.getTime());
    downloadCsv(`fbr-receitas-${yearLabel}`, [
      ["Data", "Tipo", "Cliente / Vale", "ID", "Parcela", "Valor (€)", "Data do evento", "Estado", "Base da data"],
      ...items.map((i) => i.row),
    ]);
  };
  const exportExpensesCsv = () => {
    const items: Array<{ at: Date; row: string[] }> = [];
    const metodo = (e: Expense) => (e.payment_method ? EXPENSE_PAYMENT_METHOD_LABELS[e.payment_method] : "");
    for (const e of expenses) {
      if (!e.is_recurring) {
        if (!inRange(e.expense_date, yearStart, yearEnd)) continue;
        items.push({
          at: parseISO(e.expense_date),
          row: [formatDatePT(e.expense_date), e.description ?? "", EXPENSE_CATEGORY_LABELS[e.category], e.supplier ?? "", eur(Number(e.amount)), metodo(e), e.has_invoice ? "Sim" : "Não", "Única"],
        });
        continue;
      }
      // Subscrição: uma linha por mês activo dentro do período, até ao mês actual.
      let m = isAllTime
        ? startOfMonth(parseISO(e.recurrence_start_date ?? e.expense_date))
        : startOfMonth(yearStart);
      const last = endOfMonth(isBefore(yearEnd, now) ? yearEnd : now);
      while (!isBefore(last, m)) {
        const amt = expenseAmountInPeriod(e, m, endOfMonth(m), now);
        if (amt > 0) {
          items.push({
            at: m,
            row: [format(m, "dd/MM/yyyy"), `${e.description ?? ""} (subscrição)`, EXPENSE_CATEGORY_LABELS[e.category], e.supplier ?? "", eur(amt), metodo(e), e.has_invoice ? "Sim" : "Não", "Subscrição"],
          });
        }
        m = addMonths(m, 1);
      }
    }
    items.sort((a, b) => a.at.getTime() - b.at.getTime());
    downloadCsv(`fbr-despesas-${yearLabel}`, [
      ["Data", "Descrição", "Categoria", "Fornecedor", "Valor (€)", "Método", "Factura", "Tipo"],
      ...items.map((i) => i.row),
    ]);
  };

  // KPIs anuais (o mês corrente vive no Painel). "Receita do ano" passa a
  // ser "Receita total" quando isAllTime.
  const revenueYear =
    ordersRevenueIn(yearStart, yearEnd) +
    vouchers.filter((v) => inRange(v.created_at, yearStart, yearEnd)).reduce((s, v) => s + revenueFromVoucher(v), 0);

  // Despesas: únicas pela data + subscrições em cada mês activo (ver
  // `expenseAmountInPeriod` em lib/finance.ts — antes as subscrições só
  // contavam no mês em que começavam).
  const expensesYear = expensesTotalInPeriod(expenses, yearStart, yearEnd, now);

  // Custo de produção (COGS) por período: na data em que a encomenda ficou
  // 100% paga (sem carimbo: data do evento).
  const cogsYear = ordersCogsIn(yearStart, yearEnd);

  // Comissões a parceiros: dedução à receita (decisão Maria 2026-05-19).
  // Conta proporcional ao %pago, excluindo estados `na` e `nao_aceita` e
  // encomendas canceladas (alinhado com a receita). Inclui também as
  // comissões dos VALES com parceiro (contam uma única vez no vale, só
  // quando 100% pago — decisão Maria sessão 116); a comissão de uma
  // encomenda paga com um vale comissionado é suprimida (não recontar).
  const voucherCommissionCodes = voucherCodesWithCommission(vouchers);
  const orderCommissionInRange = (start: Date, end: Date) =>
    orders.reduce(
      (s, o) =>
        s +
        (orderCommissionSuppressedByVoucher(o, voucherCommissionCodes)
          ? 0
          : commissionInPeriod(o, start, end)),
      0,
    );
  const voucherCommissionInRange = (start: Date, end: Date) =>
    vouchers
      .filter((v) => inRange(v.created_at, start, end))
      .reduce((s, v) => s + commissionFullFromVoucher(v), 0);
  const commissionYear =
    orderCommissionInRange(yearStart, yearEnd) +
    voucherCommissionInRange(yearStart, yearEnd);

  // Receita líquida = bruta − comissões (mostrado como sub-texto debaixo
  // do KPI principal, sem inflar a grelha com mais um KPI por linha).
  const revenueNetYear = revenueYear - commissionYear;
  const profitYear = revenueYear - expensesYear - cogsYear - commissionYear;

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
          ordersRevenueIn(start, end) +
          vouchers.filter((v) => inRange(v.created_at, start, end)).reduce((s, v) => s + revenueFromVoucher(v), 0);
        const exp = expensesTotalInPeriod(expenses, start, end, now);
        const cogs = ordersCogsIn(start, end);
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
        ordersRevenueIn(start, end) +
        vouchers.filter((v) => inRange(v.created_at, start, end)).reduce((s, v) => s + revenueFromVoucher(v), 0);
      const exp = expensesTotalInPeriod(expenses, start, end, now);
      const cogs = ordersCogsIn(start, end);
      const monthLabel = format(start, "MMM", { locale: pt });
      buckets.push({
        key: format(start, "yyyy-MM"),
        label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        revenue: rev,
        expenses: exp,
        cogs,
      });
    }
    return buckets;
  }, [vouchers, expenses, selectedYear, isAllTime, availableYears, now, ordersRevenueIn, ordersCogsIn]);

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
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={exportRevenueCsv} title="Uma linha por parcela paga (com a data que contou) e por vale">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV receitas
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={exportExpensesCsv} title="Despesas únicas e uma linha por mês de cada subscrição">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV despesas
          </Button>
        </div>
        <p className="text-xs text-cocoa-700 italic">
          Receita, comissões e custo de produção contam pela <strong>data de cada pagamento</strong> (sem essa data, pela data do evento); vales pela data de <strong>criação</strong>; o pipeline pela data do evento.
        </p>
      </div>

      {/* KPIs do ano (ou totais) — Receita / Despesas / Custo de produção /
          Comissões / Lucro. O mês corrente vive no Painel; aqui só a série
          anual, para não mostrar o mesmo número em dois sítios com nomes
          diferentes (sessão 174). A receita é a bruta; a líquida (= bruta −
          comissões) aparece como sub-texto, como no Painel ao contrário. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiBox
          label={isAllTime ? "Receita bruta total" : `Receita bruta ${selectedYear}`}
          value={formatEUR(revenueYear)}
          icon={<ArrowUpRight className="h-4 w-4" />}
          color="sky"
          info={INFO_RECEITA}
          subLabel="Líquida"
          subValue={commissionYear > 0 ? formatEUR(revenueNetYear) : undefined}
        />
        <KpiBox label={isAllTime ? "Despesas totais" : `Despesas ${selectedYear}`} value={formatEUR(expensesYear)} icon={<Receipt className="h-4 w-4" />} color="rose" info={INFO_DESPESAS} />
        <KpiBox label={isAllTime ? "Custo de produção total" : `Custo de produção ${selectedYear}`} value={formatEUR(cogsYear)} icon={<Frame className="h-4 w-4" />} color="amber" info={INFO_COGS} />
        <KpiBox label={isAllTime ? "Comissões totais" : `Comissões ${selectedYear}`} value={formatEUR(commissionYear)} icon={<Handshake className="h-4 w-4" />} color="violet" info={INFO_COMISSOES} />
        <KpiBox label={isAllTime ? "Lucro total" : `Lucro ${selectedYear}`} value={formatEUR(profitYear)} icon={<TrendingUp className="h-4 w-4" />} color={profitYear >= 0 ? "emerald" : "rose"} info={INFO_LUCRO} />
      </div>

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
          <PipelineBucket
            label="Por receber"
            helper="orçamento × (1 − % pago)"
            count={outstandingCount}
            total={outstandingTotal}
            color="rose"
            info={INFO_POR_RECEBER}
          />
        </div>
      </div>

      {/* Gráfico: 12 meses do ano ou 1 barra por ano se "Todos". Recharts
          como na Métricas (eixos, valores e tooltip), em vez das barras em
          divs sem escala. As explicações de cada número vivem nos ⓘ dos
          cartões em cima. */}
      <div className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-cocoa-900">
          {isAllTime ? "Receita vs despesas vs custo de produção por ano" : `Receita vs despesas vs custo de produção — ${selectedYear}`}
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barGap={2} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => formatEUR(Number(v), { rounded: true })}
              tick={{ fontSize: 11 }}
              width={72}
            />
            <Tooltip
              formatter={(v: unknown) => formatEUR(Number(v))}
              contentStyle={tooltipStyle}
              cursor={{ fill: chartGrid, opacity: 0.4 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="Receita" fill="#34d399" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#fb7185" radius={[3, 3, 0, 0]} />
            <Bar dataKey="cogs" name="Custo de produção" fill="#fbbf24" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function PipelineBucket({
  label,
  helper,
  count,
  total,
  color,
  info,
}: {
  label: string;
  helper: string;
  count: number;
  total: number;
  color: "amber" | "sky" | "violet" | "emerald" | "rose";
  /** Explicação (tooltip no título). */
  info?: string;
}) {
  const palette: Record<string, { border: string; bg: string; text: string; subtext: string }> = {
    amber:   { border: "border-amber-200 dark:border-amber-900/40",   bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-amber-900 dark:text-amber-200",   subtext: "text-amber-700 dark:text-amber-300" },
    sky:     { border: "border-sky-200 dark:border-sky-900/40",       bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-sky-900 dark:text-sky-200",       subtext: "text-sky-700 dark:text-sky-300" },
    violet:  { border: "border-violet-200 dark:border-violet-900/40", bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-violet-900 dark:text-violet-200", subtext: "text-violet-700 dark:text-violet-300" },
    emerald: { border: "border-emerald-200 dark:border-emerald-900/40", bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-emerald-900 dark:text-emerald-200", subtext: "text-emerald-700 dark:text-emerald-300" },
    rose:    { border: "border-rose-200 dark:border-rose-900/40",     bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-rose-900 dark:text-rose-200",     subtext: "text-rose-700 dark:text-rose-300" },
  };
  const c = palette[color];
  return (
    <div className={cn("rounded-xl border p-3 space-y-1", c.bg, c.border)} title={info}>
      <div className={cn("text-[10px] uppercase tracking-wider font-medium", c.subtext)}>{label}{info ? " ⓘ" : ""}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", c.text)}>{formatEUR(total)}</div>
      <div className={cn("text-[11px]", c.subtext)}>
        {count} {count === 1 ? "encomenda" : "encomendas"} · {helper}
      </div>
    </div>
  );
}

