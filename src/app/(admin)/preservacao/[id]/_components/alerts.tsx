"use client";

// Alertas da coluna do meio: fatura em falta e aprovação pendente.
// Extraídos do workbench-client.tsx (refactor sessão 128).

import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, Check } from "lucide-react";
import type { Order } from "@/types/database";
import { computeInvoiceFlags, type UpdateFn } from "./shared";

/* Alerta visual de fatura em falta */
export function MissingInvoiceAlert({ local }: { local: Order }) {
  const { missingInvoice } = computeInvoiceFlags(local);
  if (!missingInvoice) return null;
  return (
    <div className="order-2 lg:order-none flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">Falta anexar fatura</p>
        <p className="text-amber-800 mt-0.5">
          Esta encomenda tem pagamento e o cliente pediu fatura com NIF, mas ainda não há anexo.
        </p>
      </div>
    </div>
  );
}

/* Alerta de aprovação pendente (estado a_aguardar_aprovacao) */
export function ApprovalPendingAlert({ local, update }: { local: Order; update: UpdateFn }) {
  if (local.status !== "a_aguardar_aprovacao" || local.approval_responded) return null;
  const daysWaiting = differenceInCalendarDays(new Date(), parseISO(local.updated_at));
  const urgent = daysWaiting >= 4;
  return (
    <div className={`order-2 lg:order-none flex items-start gap-3 rounded-xl border px-4 py-3 ${
      urgent
        ? "bg-red-50 border-red-200"
        : "bg-sky-50 border-sky-200"
    }`}>
      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${urgent ? "text-red-600" : "text-sky-600"}`} />
      <div className={`flex-1 text-xs leading-relaxed ${urgent ? "text-red-900" : "text-sky-900"}`}>
        <p className="font-semibold">
          {urgent
            ? `Cliente em silêncio há ${daysWaiting} dias`
            : "A aguardar resposta do cliente"}
        </p>
        <p className={`mt-0.5 ${urgent ? "text-red-800" : "text-sky-800"}`}>
          {urgent
            ? "Já passaram mais de 4 dias desde que se pediu aprovação. Volta a contactar."
            : "Marcar como respondida quando o cliente confirmar a proposta de composição."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => update("approval_responded", true)}
        className="shrink-0 inline-flex items-center gap-1 h-7 px-3 rounded-lg bg-surface border border-current text-xs font-medium hover:bg-current/5 transition-colors"
      >
        <Check className="h-3 w-3" />
        Cliente já respondeu
      </button>
    </div>
  );
}
