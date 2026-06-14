"use client";

// ============================================================
// FINANÇAS — shell com as 6 sub-abas. Cada aba vive no seu
// próprio ficheiro em ./_tabs/ (refactor da sessão 114; antes
// este ficheiro tinha ~4000 linhas).
// ============================================================

import React, { useState } from "react";
import {
  Euro,
  Tags,
  Receipt,
  TrendingUp,
  Swords,
  Sparkles,
  Frame,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Competitor } from "@/types/competitor";
import type { PricingItem } from "@/types/pricing";
import type { ProductionCostItem } from "@/types/production-cost";
import type { Expense } from "@/types/expense";

import type { FaturacaoOrder, FaturacaoVoucher } from "./_tabs/shared";
import { PainelTab } from "./_tabs/painel-tab";
import { PnLTab } from "./_tabs/pnl-tab";
import { CatalogoTab } from "./_tabs/catalogo-tab";
import { DespesasTab } from "./_tabs/despesas-tab";
import { FaturacaoTab } from "./_tabs/faturacao-tab";
import { CompeticaoTab } from "./_tabs/competicao-tab";

type TabKey = "painel" | "pnl" | "catalogo" | "despesas" | "faturacao" | "competicao";

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
    key: "painel",
    label: "Painel",
    helper: "Resumo executivo do mês",
    icon: Sparkles,
    accent: "text-emerald-600",
    bgInactive: "bg-emerald-100",
  },
  {
    key: "pnl",
    label: "P&L por encomenda",
    helper: "Margem por quadro",
    icon: Frame,
    accent: "text-amber-600",
    bgInactive: "bg-amber-100",
  },
  {
    key: "catalogo",
    label: "Catálogo",
    helper: "Preços, custos e margem teórica",
    icon: Tags,
    accent: "text-sky-600",
    bgInactive: "bg-sky-100",
  },
  {
    key: "despesas",
    label: "Despesas",
    helper: "Subscrições e gastos únicos",
    icon: Receipt,
    accent: "text-rose-600",
    bgInactive: "bg-rose-100",
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

interface Props {
  initialCompetitors: Competitor[];
  initialPricing: PricingItem[];
  initialProductionCosts: ProductionCostItem[];
  initialExpenses: Expense[];
  orders: FaturacaoOrder[];
  vouchers: FaturacaoVoucher[];
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
  const [tab, setTab] = useState<TabKey>("painel");

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
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
                    "text-[11px] sm:text-xs mt-0.5 leading-tight",
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

      {tab === "painel"    && <PainelTab orders={orders} vouchers={vouchers} expenses={initialExpenses} />}
      {tab === "pnl"       && <PnLTab orders={orders} />}
      {tab === "catalogo"  && <CatalogoTab pricing={initialPricing} productionCosts={initialProductionCosts} canEdit={canEdit} />}
      {tab === "despesas"  && <DespesasTab expenses={initialExpenses} canEdit={canEdit} />}
      {tab === "faturacao" && <FaturacaoTab orders={orders} vouchers={vouchers} expenses={initialExpenses} />}
      {tab === "competicao" && (
        <CompeticaoTab competitors={initialCompetitors} canEdit={canEdit} />
      )}
    </div>
  );
}
