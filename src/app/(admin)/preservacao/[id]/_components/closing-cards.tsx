"use client";

// Cartões de fecho da coluna direita: "Entrega e feedback" (só a partir
// de Quadro pronto), "Cupão 5%" e o rodapé com as datas de criação.
// Extraídos do workbench-client.tsx (refactor sessão 128).

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { formatDateTimeLisbon } from "@/lib/format-date";
import { Package, Ticket, CalendarPlus, Flower2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order, ServiceType } from "@/types/database";
import {
  COUPON_STATUS_LABELS,
  COUPON_STATUS_COLORS,
  CLIENT_FEEDBACK_STATUS_LABELS,
  CLIENT_FEEDBACK_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  STATUS_LABELS,
  isStatusAtOrAfter,
} from "@/types/database";
import { formatEUR } from "@/lib/format";
import { Card, CardSummary, Field, inp, sel } from "./layout";
import { CouponCodeField } from "./fields";
import { toDateInput, type UpdateFn } from "./shared";

/* "Entrega e feedback" só aparece a partir do estado "Quadro pronto" — antes disso ainda
   não faz sentido editar data de entrega ou feedback do cliente. */
export function DeliveryFeedbackCard({ local, update }: { local: Order; update: UpdateFn }) {
  if (!["quadro_pronto", "quadro_enviado", "quadro_recebido"].includes(local.status)) return null;

  // Colapsa quando já está tudo tratado: quadro recebido, data registada
  // e feedback resolvido (deu feedback ou N/A).
  const autoCollapsed =
    local.status === "quadro_recebido" &&
    !!local.frame_delivery_date &&
    ["deu_feedback", "na"].includes(local.client_feedback_status);
  const summaryParts: string[] = [];
  if (local.frame_delivery_date) {
    summaryParts.push(`Entregue a ${format(parseISO(local.frame_delivery_date), "dd/MM/yyyy")}`);
  }
  summaryParts.push(CLIENT_FEEDBACK_STATUS_LABELS[local.client_feedback_status]);

  return (
    <Card
      title="Entrega e feedback"
      icon={<Package className="h-3.5 w-3.5" />}
      accent="purple"
      className="order-[13] lg:order-none"
      autoCollapsed={autoCollapsed}
      summary={<CardSummary>{summaryParts.join(" · ")}</CardSummary>}
    >
      <div className="space-y-3">
        <Field label="Data entrega do quadro">
          <Input className={inp} type="date" value={toDateInput(local.frame_delivery_date)} onChange={(e) => update("frame_delivery_date", e.target.value || null)} />
        </Field>
        <Field label="Feedback do cliente">
          <Select value={local.client_feedback_status} onValueChange={(v) => update("client_feedback_status", v as Order["client_feedback_status"])}>
            <SelectTrigger className={`${sel} font-medium ${CLIENT_FEEDBACK_STATUS_COLORS[local.client_feedback_status]}`}>
              <SelectValue labels={CLIENT_FEEDBACK_STATUS_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CLIENT_FEEDBACK_STATUS_LABELS) as Array<keyof typeof CLIENT_FEEDBACK_STATUS_LABELS>).map((k) => (
                <SelectItem key={k} value={k} className="my-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CLIENT_FEEDBACK_STATUS_COLORS[k]}`}>
                    {CLIENT_FEEDBACK_STATUS_LABELS[k]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </Card>
  );
}

export function CouponCard({ local, update }: { local: Order; update: UpdateFn }) {
  // Cupão: gerar validade = data de hoje + 2 anos
  function generateCouponExpiry() {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    update("coupon_expiry", format(d, "yyyy-MM-dd"));
  }

  // O cupão só nasce ao passar para "A ser emoldurado" — antes disso o
  // card fica colapsado; depois de utilizado também já não pede acção.
  const autoCollapsed =
    local.status === "cancelado" ||
    !isStatusAtOrAfter(local.status, "a_ser_emoldurado") ||
    local.coupon_status === "utilizado";
  const summary = (
    <CardSummary>
      {local.coupon_code
        ? `${local.coupon_code}${local.coupon_expiry ? ` · até ${format(parseISO(local.coupon_expiry), "dd/MM/yyyy")}` : ""} · ${COUPON_STATUS_LABELS[local.coupon_status]}`
        : "Gerado ao passar para “A ser emoldurado”"}
    </CardSummary>
  );

  return (
    <Card
      title="Cupão 5%"
      icon={<Ticket className="h-3.5 w-3.5" />}
      accent="yellow"
      className="order-[14] lg:order-none"
      autoCollapsed={autoCollapsed}
      summary={summary}
    >
      <div className="space-y-3">
        <CouponCodeField
          code={local.coupon_code}
          onChange={(v) => update("coupon_code", v)}
        />
        <Field label="Validade" hint="Tipicamente 2 anos após a entrega do quadro.">
          <div className="flex gap-1.5">
            <Input
              className={inp + " flex-1 min-w-0"}
              type="date"
              value={toDateInput(local.coupon_expiry)}
              onChange={(e) => update("coupon_expiry", e.target.value || null)}
            />
            <button
              onClick={generateCouponExpiry}
              className="inline-flex h-9 items-center gap-1 px-2.5 shrink-0 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 text-[11px] font-medium hover:bg-yellow-100 transition-colors"
              title="Gerar validade: hoje + 2 anos"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              +2 anos
            </button>
          </div>
        </Field>
        <Field label="Estado">
          <Select value={local.coupon_status} onValueChange={(v) => update("coupon_status", v as Order["coupon_status"])}>
            <SelectTrigger className={`${sel} font-medium ${COUPON_STATUS_COLORS[local.coupon_status]}`}>
              <SelectValue labels={COUPON_STATUS_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COUPON_STATUS_LABELS) as Array<keyof typeof COUPON_STATUS_LABELS>).map((k) => (
                <SelectItem key={k} value={k} className="my-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${COUPON_STATUS_COLORS[k]}`}>
                    {COUPON_STATUS_LABELS[k]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </Card>
  );
}

/* ── Confirmação da troca de/para "Emoldurar flores secas" ────────
   Ex.: a noiva reservou preservação mas o ramo já vinha quase todo seco —
   não faz sentido cobrar preços de preservação. Converter mexe no preço e
   no acompanhamento público, por isso mostra-se antes o que vai acontecer. */
function ServiceChangeDialog({
  from,
  to,
  order,
  onClose,
  onConfirm,
}: {
  from: ServiceType;
  to: ServiceType | null;
  order: Order;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const toDried = to === "emoldurar_secas";

  // O orçamento só se recalcula sozinho quando ainda é o automático (igual
  // ao snapshot). Editado à mão fica intocado — o valor é decisão da Maria.
  const snapshotTotal = order.pricing_snapshot?.total ?? null;
  const budgetIsAuto =
    snapshotTotal !== null &&
    order.budget !== null &&
    Math.abs(order.budget - snapshotTotal) < 0.01;

  // "Flores na prensa" não existe nas secas (as flores já vêm secas).
  const stuckInPress = toDried && order.status === "flores_na_prensa";

  return (
    <Dialog open={!!to} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <Flower2 className="h-4 w-4 text-emerald-600" />
            {toDried ? "Passar a flores secas?" : "Deixar de ser flores secas?"}
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            De <strong className="text-cocoa-900">{SERVICE_TYPE_LABELS[from]}</strong> para{" "}
            <strong className="text-cocoa-900">{to ? SERVICE_TYPE_LABELS[to] : ""}</strong>.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-1 text-xs text-cocoa-800">
          <li className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2">
            <strong className="text-cocoa-900">Preços.</strong>{" "}
            {toDried
              ? "Passa a usar a tabela de flores secas (mais barata), em Finanças → Catálogo."
              : "Volta à tabela normal da preservação, em Finanças → Catálogo."}{" "}
            {budgetIsAuto ? (
              <>O orçamento é recalculado já.</>
            ) : (
              <>
                O orçamento actual{" "}
                {order.budget !== null && (
                  <span className="tabular-nums">({formatEUR(order.budget)})</span>
                )}{" "}
                foi posto à mão, por isso fica como está — para o novo valor usa
                “Recalcular com preços actuais” no cartão Finanças.
              </>
            )}
          </li>
          <li className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2">
            <strong className="text-cocoa-900">Acompanhamento do cliente.</strong>{" "}
            {toDried
              ? "A fase “Flores na prensa” desaparece da timeline pública e do selector de estado."
              : "A fase “Flores na prensa” volta à timeline pública e ao selector de estado."}
          </li>
          {toDried && !order.dried_approach && (
            <li className="rounded-lg border border-cream-200 bg-cream-50 px-3 py-2">
              <strong className="text-cocoa-900">Campos das secas.</strong> A encomenda
              veio pelo formulário de preservação, por isso a abordagem, o estado das
              flores e as fotos ficam por preencher.
            </li>
          )}
          {stuckInPress && (
            <li className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
              Esta encomenda está em <strong>{STATUS_LABELS.flores_na_prensa}</strong>, um
              estado que deixa de existir nas secas. Escolhe-lhe outro estado a seguir.
            </li>
          )}
        </ul>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-emerald-600 text-sm text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Sim, mudar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MetaFooter({
  local,
  canEdit,
  update,
}: {
  local: Order;
  canEdit: boolean;
  update: UpdateFn;
}) {
  // Preservação ↔ Recriação é só uma etiqueta interna (mesmos preços,
  // estados e status público) — aplica-se logo. Já converter de/para
  // "Emoldurar flores secas" mexe no dinheiro (tabela de preços própria,
  // secas_*) e no acompanhamento público, por isso passa por confirmação.
  const current: ServiceType = local.service_type ?? "preservacao";
  const [pendingService, setPendingService] = useState<ServiceType | null>(null);

  function chooseService(next: ServiceType) {
    if (next === current) return;
    const touchesDried =
      next === "emoldurar_secas" || current === "emoldurar_secas";
    if (touchesDried) {
      setPendingService(next);
      return;
    }
    update("service_type", next);
  }

  return (
    <div className="order-[15] lg:order-none rounded-xl border border-cream-200 bg-surface px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cocoa-500">
          Tipo de serviço
        </span>
        {canEdit ? (
          <Select value={current} onValueChange={(v) => chooseService(v as ServiceType)}>
            <SelectTrigger className="h-7 w-44 text-xs border-cream-200 bg-cream-50 text-cocoa-900 rounded-lg">
              <SelectValue labels={SERVICE_TYPE_LABELS} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="preservacao">{SERVICE_TYPE_LABELS.preservacao}</SelectItem>
              <SelectItem value="recriacao">{SERVICE_TYPE_LABELS.recriacao}</SelectItem>
              <SelectItem value="emoldurar_secas">{SERVICE_TYPE_LABELS.emoldurar_secas}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[11px] font-medium text-cocoa-700">
            {SERVICE_TYPE_LABELS[current]}
          </span>
        )}
      </div>

      <ServiceChangeDialog
        from={current}
        to={pendingService}
        order={local}
        onClose={() => setPendingService(null)}
        onConfirm={() => {
          if (pendingService) update("service_type", pendingService);
          setPendingService(null);
        }}
      />
      <div className="space-y-1 pt-1 border-t border-cream-100">
        <p className="text-[10px] text-cocoa-500">
          Criada em {formatDateTimeLisbon(local.created_at)}
        </p>
        {local.updated_at && local.updated_at !== local.created_at && (
          <p className="text-[10px] text-cocoa-500">
            Actualizada em {formatDateTimeLisbon(local.updated_at)}
          </p>
        )}
        <p className="font-mono text-[10px] text-[#D0C4B8]">{local.order_id}</p>
      </div>
    </div>
  );
}
