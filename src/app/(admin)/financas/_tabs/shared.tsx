"use client";

// ============================================================
// FINANÇAS — tipos e componentes partilhados entre as sub-abas
// (extraído de financas-client.tsx na sessão de refactor)
// ============================================================

import React from "react";
import { parseISO } from "date-fns";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Projecções mínimas de Order/Voucher que as Finanças precisam — têm de
// bater certo com as queries de financas/page.tsx.
export type FaturacaoOrder = Pick<
  import("@/types/database").Order,
  | "id"
  | "order_id"
  | "client_name"
  | "created_at"
  | "event_date"
  | "status"
  | "payment_status"
  | "budget"
  | "frame_delivery_date"
  | "frame_size"
  | "frame_background"
  | "pyramid_frame"
  | "frame_internal_type"
  | "extra_small_frames"
  | "extra_small_frames_qty"
  | "production_cost_snapshot"
  | "partner_commission"
  | "partner_commission_status"
  | "gift_voucher_code"
>;
export type FaturacaoVoucher = Pick<
  import("@/types/voucher").Voucher,
  | "id"
  | "code"
  | "created_at"
  | "amount"
  | "payment_status"
  | "usage_status"
  | "partner_commission"
  | "partner_commission_status"
>;

export function inRangeISO(iso: string | null, start: Date, end: Date): boolean {
  if (!iso) return false;
  const d = parseISO(iso);
  return d >= start && d <= end;
}

export function KpiBox({
  label,
  value,
  icon,
  color,
  delta,
  subValue,
  subLabel,
  info,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "emerald" | "rose" | "sky" | "amber" | "slate" | "violet";
  delta?: number | null;
  subValue?: string;
  subLabel?: string;
  /** Explicação do que este valor mede (tooltip no ícone ⓘ). */
  info?: string;
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
        <p className="text-[10px] uppercase tracking-wider opacity-80 font-medium flex items-center gap-1">
          {label}
          {info && (
            <span title={info} className="cursor-help inline-flex">
              <Info className="h-3 w-3 opacity-70" />
            </span>
          )}
        </p>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {subValue && (
        <p className="text-[11px] opacity-75 tabular-nums">
          {subLabel ? <span className="opacity-80">{subLabel}: </span> : null}{subValue}
        </p>
      )}
      {delta !== undefined && delta !== null && (
        <p className={cn("text-xs font-medium", delta >= 0 ? "text-emerald-700" : "text-rose-700")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs. mês anterior
        </p>
      )}
    </div>
  );
}
