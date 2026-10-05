"use client";

// Cartão "Finanças": orçamento (com badge do snapshot), pagamento,
// dinheiro à entrega, acerto de pagamento e faturas. Extraído do
// workbench-client.tsx (refactor sessão 128).

import { Wallet, Info, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order, OrderPayment, PaymentStatus } from "@/types/database";
import { PAYMENT_STATUS_LABELS, SIM_NAO_LABELS } from "@/types/database";
import { formatEUR } from "@/lib/format";
import { outstandingTotal } from "@/lib/finance";
import { Card, CardSummary, Field, CheckRow, inp, sel } from "./layout";
import { BudgetSnapshotBadge } from "./budget-badges";
import { computeInvoiceFlags, type UpdateFn } from "./shared";
import { PaymentsBlock } from "./payments-block";

const PAYMENT_COLORS: Record<string, string> = {
  "100_pago":      "text-green-800 bg-green-100 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  "70_pago":       "text-lime-800 bg-lime-100 border-lime-300 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-900",
  "30_pago":       "text-amber-900 bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  "100_por_pagar": "text-red-700 bg-red-100 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

export function FinanceCard({
  local,
  payments,
  canEdit,
  update,
  onPaymentStatusChange,
}: {
  local: Order;
  payments: OrderPayment[];
  canEdit: boolean;
  update: UpdateFn;
  onPaymentStatusChange: (s: PaymentStatus) => void;
}) {
  const { hasAnyPayment, invoiceSlotsVisible, missingInvoice } = computeInvoiceFlags(local);

  // Quanto falta receber, a partir do livro de pagamentos (mig 114).
  // Substituiu o painel de "acerto" que calculava isto a partir do
  // orçamento no 1.º pagamento: agora o valor sai dos euros reais.
  const falta = outstandingTotal(local.budget, local.amount_paid);

  // ── Colapso automático ───────────────────────────────────────
  // Só quando não resta nada por fazer: fase fechada, sem fatura em
  // falta e sem dinheiro por receber. Cancelado também colapsa.
  const autoCollapsed =
    local.status === "cancelado" ||
    (local.payment_status === "100_pago" && !missingInvoice && falta === 0);
  const summary = (
    <CardSummary amount={local.budget != null ? formatEUR(local.budget) : undefined}>
      {PAYMENT_STATUS_LABELS[local.payment_status]}
    </CardSummary>
  );

  return (
    <Card
      title="Finanças"
      icon={<Wallet className="h-3.5 w-3.5" />}
      accent="green"
      className="order-3 lg:order-none"
      autoCollapsed={autoCollapsed}
      summary={summary}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-[2fr_3fr] gap-3">
          <Field label="Orçamento">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
              <Input
                className={inp + " pl-7"}
                type="number" min={0} step={0.01}
                value={local.budget ?? ""}
                onChange={(e) => update("budget", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <BudgetSnapshotBadge
              orderId={local.id}
              snapshot={local.pricing_snapshot}
              currentBudget={local.budget}
              canEdit={canEdit}
            />
          </Field>
          <Field label="Pagamento">
            <Select value={local.payment_status} onValueChange={(v) => onPaymentStatusChange(v as PaymentStatus)}>
              <SelectTrigger className={`${sel} font-medium w-full max-w-full ${PAYMENT_COLORS[local.payment_status] ?? ""}`}>
                <SelectValue labels={PAYMENT_STATUS_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_STATUS_LABELS) as Array<keyof typeof PAYMENT_STATUS_LABELS>).map((s) => (
                  <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Pagamento em dinheiro à entrega — marcador interno. A
            explicação foi para um tooltip (ⓘ) para poupar espaço; o
            link público funciona sem pagamento registado a partir do
            momento em que a encomenda fica agendada (ver mig 076).
            Some quando já não falta receber nada: aí o método de cada
            parcela está no livro e isto passa a ser ruído. NÃO some ao
            primeiro pagamento, porque o caso normal é o sinal vir por
            transferência e só o resto ser em mão. */}
        {falta > 0 && (
          <div className="flex items-center gap-1.5">
            <CheckRow
              label="Pagamento em dinheiro à entrega"
              checked={local.cash_on_delivery}
              onChange={(v) => update("cash_on_delivery", v)}
            />
            <span
              title="O cliente paga em mão ao entregar as flores. O link de acompanhamento já funciona assim que a encomenda fica agendada — não é preciso registar pagamento."
              className="cursor-help text-cocoa-400 shrink-0"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          </div>
        )}

        {/* Livro de pagamentos: o que entrou, o que falta, e o registo
            de cada parcela (mig 114). */}
        <PaymentsBlock
          orderId={local.id}
          payments={payments}
          budget={local.budget}
          phase={local.payment_status}
          canEdit={canEdit}
          onSuggestPhase={onPaymentStatusChange}
        />

        {/* Pediu fatura — Sim/Não com NIF inline à direita do Sim */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-cocoa-700">Cliente pediu fatura com NIF?</Label>
          <div className="flex gap-2 items-stretch">
            <Select
              value={local.needs_invoice ? "sim" : "nao"}
              onValueChange={(v) => update("needs_invoice", v === "sim")}
            >
              <SelectTrigger className={`${sel} ${local.needs_invoice ? "shrink-0 w-24" : "flex-1"}`}>
                <SelectValue labels={SIM_NAO_LABELS} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
            {local.needs_invoice && (
              <Input
                className={inp + " flex-1 min-w-0"}
                value={local.nif ?? ""}
                onChange={(e) => update("nif", e.target.value || null)}
                placeholder="NIF (9 dígitos)"
              />
            )}
          </div>
        </div>
        {local.needs_invoice && hasAnyPayment && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-cocoa-700">Anexos das faturas (Drive)</Label>
            {(
              [
                { key: "invoice_url_sinal",      label: "Sinal",      show: invoiceSlotsVisible.sinal },
                { key: "invoice_url_intermedio", label: "Intermédio", show: invoiceSlotsVisible.intermedio },
                { key: "invoice_url_final",      label: "Final",      show: invoiceSlotsVisible.final },
              ] as const
            )
              .filter((slot) => slot.show)
              .map((slot) => {
                const value = local[slot.key];
                return (
                  <div key={slot.key} className="flex gap-1.5 items-center">
                    <span className="text-[11px] font-medium text-cocoa-600 w-20 shrink-0">{slot.label}</span>
                    <Input
                      className={inp + " flex-1 min-w-0"}
                      value={value ?? ""}
                      onChange={(e) => update(slot.key, e.target.value || null)}
                      placeholder="URL do PDF (Drive)"
                    />
                    {value && (
                      <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cream-200 bg-cream-50 text-cocoa-700 hover:bg-btn-primary hover:text-btn-primary-fg hover:border-btn-primary transition-colors"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </Card>
  );
}
