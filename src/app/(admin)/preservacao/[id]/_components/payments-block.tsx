"use client";

// Livro de pagamentos de uma encomenda (mig 114), dentro do cartão
// Finanças. Mostra o que entrou, o que falta, e deixa registar/corrigir
// cada pagamento.
//
// A FASE DA COBRANÇA (payment_status) NÃO é mexida aqui: continua a ser
// decisão da Maria. Quando o dinheiro cobre o marco de uma fase mais
// adiantada, isto apenas SUGERE que ela a faça avançar — porque há casos
// legítimos em que o dinheiro não chega ao marco e a parcela está dada de
// qualquer forma (a cliente que não tinha os 50 cêntimos e combinou
// deixá-los para a parcela seguinte).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Save,
  Trash2,
  Loader2,
  Pencil,
  X,
  Info,
  Banknote,
  CreditCard,
  Smartphone,
  Gift,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderPayment, PaymentMethod, PaymentStatus } from "@/types/database";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/types/database";
import { outstandingTotal, dueAtPhase, paymentPhaseReached, paymentsIn } from "@/lib/finance";
import { formatEUR } from "@/lib/format";
import { formatDatePT } from "@/lib/format-date";
import {
  addOrderPaymentAction,
  updateOrderPaymentAction,
  deleteOrderPaymentAction,
} from "../../actions";
import { inp, sel } from "./layout";

const hoje = () => new Date().toISOString().slice(0, 10);

// Ícone por método, para se ver à vista se entrou em dinheiro ou não.
const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  transferencia: CreditCard,
  mbway: Smartphone,
  dinheiro: Banknote,
  vale: Gift,
  outro: Wallet,
};

type Draft = {
  amount: string;
  paid_at: string;
  method: PaymentMethod;
  note: string;
};

const emptyDraft = (): Draft => ({
  amount: "",
  paid_at: hoje(),
  method: "transferencia",
  note: "",
});

export function PaymentsBlock({
  orderId,
  payments,
  budget,
  phase,
  canEdit,
  onSuggestPhase,
}: {
  orderId: string;
  payments: OrderPayment[];
  budget: number | null;
  phase: PaymentStatus;
  canEdit: boolean;
  onSuggestPhase: (s: PaymentStatus) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const entrou = payments.reduce((s, p) => s + Number(p.amount), 0);
  const faltaAoTodo = outstandingTotal(budget, entrou);
  const faltaNestaFase = dueAtPhase(budget, phase, entrou);

  // Fase que o dinheiro já cobre. Só serve para sugerir, e só se for
  // mais adiantada do que a que está registada.
  const coberta = paymentPhaseReached(budget, paymentsIn(payments));
  const ordem: PaymentStatus[] = ["100_por_pagar", "30_pago", "70_pago", "100_pago"];
  const sugerirFase =
    canEdit && ordem.indexOf(coberta) > ordem.indexOf(phase) ? coberta : null;

  function startNew() {
    setEditingId(null);
    setDraft(emptyDraft());
    setOpen(true);
  }

  function startEdit(p: OrderPayment) {
    setEditingId(p.id);
    setDraft({
      amount: String(p.amount),
      paid_at: p.paid_at.slice(0, 10),
      method: p.method,
      note: p.note ?? "",
    });
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
    setEditingId(null);
  }

  function save() {
    const amount = Number(draft.amount);
    if (!draft.amount || !Number.isFinite(amount) || amount === 0) {
      toast.error("Indique um valor diferente de zero.");
      return;
    }
    startTransition(async () => {
      const res = editingId
        ? await updateOrderPaymentAction(editingId, {
            amount,
            paid_at: draft.paid_at,
            method: draft.method,
            note: draft.note,
          })
        : await addOrderPaymentAction(orderId, {
            amount,
            paid_at: draft.paid_at,
            method: draft.method,
            note: draft.note,
          });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editingId ? "Pagamento corrigido" : "Pagamento registado");
      cancel();
      router.refresh();
    });
  }

  function remove(p: OrderPayment) {
    if (!confirm(`Apagar o pagamento de ${formatEUR(p.amount, { compact: true })}?`)) return;
    startTransition(async () => {
      const res = await deleteOrderPaymentAction(p.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-cream-200 bg-cream-50/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-cocoa-700">Pagamentos recebidos</Label>
        {canEdit && !open && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={startNew}>
            <Plus className="h-3.5 w-3.5" />
            Registar
          </Button>
        )}
      </div>

      {/* Linhas do livro. Valores sempre em coluna própria, à direita. */}
      {payments.length === 0 ? (
        <p className="py-2 text-center text-xs text-cocoa-500">Sem pagamentos registados.</p>
      ) : (
        <ol className="divide-y divide-cream-200">
          {payments.map((p) => (
            <li key={p.id} className="group flex items-center gap-2 py-1.5">
              <span className="w-[72px] shrink-0 text-[11px] tabular-nums text-cocoa-600">
                {formatDatePT(p.paid_at)}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-cocoa-600">
                {(() => {
                  const Icon = METHOD_ICONS[p.method];
                  return (
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        p.method === "dinheiro" ? "text-emerald-600" : "text-cocoa-500"
                      }`}
                      aria-label={PAYMENT_METHOD_LABELS[p.method]}
                    />
                  );
                })()}
                {/* O nome do método só em desktop: no telemóvel o ícone
                    chega e a linha não parte. */}
                <span className="hidden truncate sm:inline">
                  {PAYMENT_METHOD_LABELS[p.method]}
                </span>
                {p.is_estimated && (
                  <span
                    title={
                      p.note ??
                      "Valor estimado a partir do histórico, não confirmado. Corrija a linha para o confirmar."
                    }
                    className="ml-1 inline-flex cursor-help items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-900"
                  >
                    <Info className="h-2.5 w-2.5" />
                    estimado
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 text-right text-xs font-medium tabular-nums ${
                  Number(p.amount) < 0 ? "text-rose-700" : "text-cocoa-900"
                }`}
              >
                {formatEUR(p.amount, { compact: true })}
              </span>
              {canEdit && (
                <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(p)}
                    title="Corrigir"
                    className="text-cocoa-500 hover:text-cocoa-900"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => remove(p)}
                    title="Apagar"
                    className="text-cocoa-500 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Formulário de registo / correcção */}
      {open && canEdit && (
        <div className="space-y-2 rounded-lg border border-cream-200 bg-surface p-2.5">
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-cocoa-700">
                €
              </span>
              <Input
                className={inp + " pl-6"}
                type="number"
                step={0.01}
                autoFocus
                value={draft.amount}
                onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                placeholder="Valor"
              />
            </div>
            <Input
              className={inp}
              type="date"
              value={draft.paid_at}
              onChange={(e) => setDraft((d) => ({ ...d, paid_at: e.target.value }))}
            />
          </div>
          <Select
            value={draft.method}
            onValueChange={(v) => setDraft((d) => ({ ...d, method: v as PaymentMethod }))}
          >
            <SelectTrigger className={sel + " w-full"}>
              <SelectValue labels={PAYMENT_METHOD_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className={inp}
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="Nota (opcional)"
          />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={cancel}>
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={save} disabled={pending}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {editingId ? "Corrigir" : "Registar"}
            </Button>
          </div>
        </div>
      )}

      {/* Contas: o que entrou e o que falta. É a conta que era feita de
          cabeça em cada mensagem ao cliente. */}
      {budget != null && (
        <div className="space-y-0.5 border-t border-cream-200 pt-1.5 text-xs">
          <Row label="Entrou" value={entrou} />
          {faltaNestaFase > 0 && (
            <Row
              label={`Falta para fechar "${PAYMENT_STATUS_LABELS[phase]}"`}
              value={faltaNestaFase}
              strong
            />
          )}
          <Row label="Falta ao todo" value={faltaAoTodo} muted={faltaAoTodo === 0} />
        </div>
      )}

      {sugerirFase && (
        <button
          onClick={() => onSuggestPhase(sugerirFase)}
          className="w-full rounded-lg border border-lime-300 bg-lime-50 px-2.5 py-1.5 text-left text-[11px] text-lime-900 transition-colors hover:bg-lime-100"
        >
          O valor recebido já cobre <strong>{PAYMENT_STATUS_LABELS[sugerirFase]}</strong>.
          Toque para passar a fase.
        </button>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={muted ? "text-cocoa-500" : "text-cocoa-700"}>{label}</span>
      <span
        className={`text-right tabular-nums ${
          strong ? "font-semibold text-amber-900" : muted ? "text-cocoa-500" : "font-medium text-cocoa-900"
        }`}
      >
        {formatEUR(value, { compact: true })}
      </span>
    </div>
  );
}
