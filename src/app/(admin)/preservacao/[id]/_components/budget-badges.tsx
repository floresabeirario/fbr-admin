"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Frame, Sparkles } from "lucide-react";
import { formatDateTimeLisbon } from "@/lib/format-date";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatEUR } from "@/lib/format";
import type { PricingSnapshot } from "@/types/pricing";
import type { ProductionCostSnapshot } from "@/types/production-cost";
import type { Order } from "@/types/database";
import { computeProductionCost } from "@/lib/production-cost";
import {
  recomputeOrderBudgetAction,
  captureOrderProductionCostAction,
} from "../../actions";

// ============================================================
// Badge do snapshot de preços + botão "recalcular"
// ============================================================
export function BudgetSnapshotBadge({
  orderId,
  snapshot,
  currentBudget,
  canEdit,
}: {
  orderId: string;
  snapshot: PricingSnapshot | null;
  currentBudget: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function recompute() {
    setBusy(true);
    try {
      const res = await recomputeOrderBudgetAction(orderId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Orçamento recalculado a partir dos preços actuais.");
      router.refresh();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao recalcular");
    } finally {
      setBusy(false);
    }
  }

  if (!snapshot) {
    return (
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider rounded-full bg-stone-100 text-stone-700 px-2 py-0.5 font-semibold">
          Manual
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={recompute}
            disabled={busy}
            className="text-[10px] text-emerald-700 hover:text-emerald-900 hover:underline disabled:opacity-50"
            title="Calcular o orçamento a partir da tabela de preços"
          >
            {busy ? "A calcular…" : "Calcular automaticamente"}
          </button>
        )}
      </div>
    );
  }

  // Orçamento provisório — tamanho da moldura ainda não decidido. Usa a
  // base 30x40 (300€) como referência; ajusta-se quando a Maria escolher
  // o tamanho na fase de design. Badge âmbar para se distinguir do "Auto".
  if (snapshot.provisional) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-semibold transition-colors bg-amber-100 text-amber-800 hover:bg-amber-200"
          title="Orçamento provisório — tamanho da moldura por definir"
        >
          <Sparkles className="h-2.5 w-2.5" />
          Provisório · tamanho por definir
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Sparkles className="h-4 w-4" />
              Orçamento provisório
            </div>
          </div>
          <div className="p-3 space-y-2 text-xs text-cocoa-800">
            <p>
              O tamanho da moldura ainda não foi escolhido, por isso o orçamento
              usa a <strong>30x40 (300€)</strong> como referência — o quadro mais
              barato. Já dá para pedir o sinal sem risco de cobrar a mais.
            </p>
            <p className="text-amber-700">
              Quando escolheres o tamanho (normalmente na fase de design), o
              orçamento ajusta-se sozinho. Se já tiver havido pagamento, a caixa
              Finanças avisa-te quanto pedir de diferença.
            </p>
            <div className="border-t border-cream-200 pt-1.5 flex items-center justify-between text-sm font-semibold">
              <span className="text-cocoa-900">Total provisório</span>
              <span className="text-amber-700 tabular-nums">
                {formatEUR(snapshot.total, { compact: true })}
              </span>
            </div>
          </div>
          {canEdit && (
            <div className="border-t border-cream-200 p-2">
              <button
                type="button"
                onClick={recompute}
                disabled={busy}
                className="w-full h-8 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {busy ? "A recalcular…" : "Recalcular com preços actuais"}
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  const matchesSnapshot = currentBudget !== null && Math.abs(currentBudget - snapshot.total) < 0.01;

  // Quando o orçamento corresponde ao cálculo automático, não mostramos badge
  // — a Maria considerou o "Auto-calculado" ruído visual. O cálculo continua
  // acessível através do botão "Auto · editado" quando o valor diverge.
  if (matchesSnapshot) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-semibold transition-colors bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
        title="Ver detalhe do cálculo automático"
      >
        <Sparkles className="h-2.5 w-2.5" />
        Auto · editado
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Sparkles className="h-4 w-4" />
            Cálculo automático
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">
            Snapshot feito em {formatDateTimeLisbon(snapshot.computed_at)}
          </div>
        </div>
        <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
          {snapshot.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex-1 truncate">
                <span className="text-cocoa-900">{l.label}</span>
                {l.qty > 1 && (
                  <span className="text-cocoa-700"> × {l.qty}</span>
                )}
              </div>
              <span className="text-cocoa-700 tabular-nums">
                {formatEUR(l.subtotal, { compact: true })}
              </span>
            </div>
          ))}
          <div className="border-t border-cream-200 pt-1.5 mt-1.5 flex items-center justify-between text-sm font-semibold">
            <span className="text-cocoa-900">Total calculado</span>
            <span className="text-emerald-700 tabular-nums">
              {formatEUR(snapshot.total, { compact: true })}
            </span>
          </div>
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
            O orçamento actual ({formatEUR(currentBudget, { compact: true })}) foi editado manualmente.
          </div>
        </div>
        {canEdit && (
          <div className="border-t border-cream-200 p-2 flex gap-2">
            <button
              type="button"
              onClick={recompute}
              disabled={busy}
              className="flex-1 h-8 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "A recalcular…" : "Recalcular com preços actuais"}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Badge do custo de produção + margem bruta
// ============================================================
export function ProductionCostBadge({
  orderId,
  snapshot,
  order,
  canEdit,
}: {
  orderId: string;
  snapshot: ProductionCostSnapshot | null;
  order: Order;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function capture() {
    setBusy(true);
    try {
      const res = await captureOrderProductionCostAction(orderId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Custos de produção capturados.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao capturar custos");
    } finally {
      setBusy(false);
    }
  }

  // Sem snapshot → encomenda antiga; oferece capturar agora.
  if (!snapshot) {
    if (!canEdit) return null;
    return (
      <div className="mt-1.5">
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          className="text-[10px] text-amber-700 hover:text-amber-900 hover:underline disabled:opacity-50"
          title="Capturar custos de produção vigentes para ver a margem"
        >
          {busy ? "A capturar…" : "Capturar custos de produção"}
        </button>
      </div>
    );
  }

  const breakdown = computeProductionCost(order, snapshot);
  if (!breakdown) return null;

  const budget = order.budget;
  const margin = budget !== null ? budget - breakdown.total : null;
  const marginPct =
    budget !== null && budget > 0 ? (margin! / budget) * 100 : null;

  // Cor da margem: verde >= 50%, amarela >= 25%, laranja < 25%, cinzenta sem budget.
  let marginCls = "bg-stone-100 text-stone-700";
  if (marginPct !== null) {
    if (marginPct >= 50) marginCls = "bg-emerald-100 text-emerald-800";
    else if (marginPct >= 25) marginCls = "bg-amber-100 text-amber-800";
    else marginCls = "bg-rose-100 text-rose-800";
  }

  const fmtEuro = (n: number) => formatEUR(n, { compact: true });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 font-semibold transition-colors bg-stone-100 text-stone-700 hover:bg-stone-200"
        title="Ver custo de produção e margem"
      >
        <Frame className="h-2.5 w-2.5" />
        Custo {fmtEuro(breakdown.total)}
        {margin !== null && (
          <span className={`-mr-1 ml-0.5 rounded-full px-1.5 ${marginCls}`}>
            margem {fmtEuro(margin)}
            {marginPct !== null ? ` · ${marginPct.toFixed(0)}%` : ""}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Frame className="h-4 w-4" />
            Custo de produção
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            Snapshot de {formatDateTimeLisbon(snapshot.captured_at)}
          </div>
        </div>
        <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
          {breakdown.lines.length === 0 && (
            <div className="text-[11px] text-cocoa-500 italic">
              Sem linhas (preencher tamanho, fundo e tipo de moldura).
            </div>
          )}
          {breakdown.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex-1 truncate">
                <span className="text-cocoa-900">{l.label}</span>
              </div>
              <span className="text-cocoa-700 tabular-nums">
                {formatEUR(l.subtotal, { compact: true })}
              </span>
            </div>
          ))}
          <div className="border-t border-cream-200 pt-1.5 mt-1.5 flex items-center justify-between text-sm font-semibold">
            <span className="text-cocoa-900">Custo total</span>
            <span className="text-amber-700 tabular-nums">{fmtEuro(breakdown.total)}</span>
          </div>
          {budget !== null && (
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-cocoa-900">Margem bruta</span>
              <span className={`tabular-nums px-2 py-0.5 rounded-full ${marginCls}`}>
                {fmtEuro(margin!)}{marginPct !== null ? ` · ${marginPct.toFixed(1)}%` : ""}
              </span>
            </div>
          )}
          {breakdown.missing.length > 0 && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
              Cálculo parcial — falta: {breakdown.missing.join(", ")}.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
