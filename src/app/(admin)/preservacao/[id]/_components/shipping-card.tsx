"use client";

// Cartão "Envio das flores e receção do quadro": métodos de envio com
// custos, detalhes de recolha/entrega em mãos e prazo "Entregar até".
// Extraído do workbench-client.tsx (refactor sessão 128).

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Truck, MapPin, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import AddressAutocomplete from "@/components/address-autocomplete";
import type { Order } from "@/types/database";
import {
  FLOWER_DELIVERY_METHOD_LABELS,
  FLOWER_DELIVERY_METHOD_COLORS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_COLORS,
  isStatusAtOrAfter,
} from "@/types/database";
import { formatEUR } from "@/lib/format";
import { Card, CardSummary, Grid2, Field, inp } from "./layout";
import { ShippingRow } from "./fields";
import { toDateInput, type UpdateFn, type ClientUpdateFn } from "./shared";

/** Link público de tracking dos CTT para um código de registo. */
export function cttTrackingUrl(code: string): string {
  return `https://appserver.ctt.pt/CustomerArea/PublicArea_Detail?ObjectCodeInput=${encodeURIComponent(code.trim())}&SearchInput=${encodeURIComponent(code.trim())}`;
}

export function ShippingCard({
  local,
  update,
  clientUpdate,
}: {
  local: Order;
  update: UpdateFn;
  clientUpdate: ClientUpdateFn;
}) {
  // Esconder custo e "pago" quando entrega/recolha é em mãos (sem custo) ou
  // "não sei" (ainda indefinido). Só faz sentido pedir o custo quando o método
  // implica transporte pago (CTT, recolha presencial).
  const hasFlowerShippingCost = local.flower_delivery_method === "ctt" || local.flower_delivery_method === "recolha_evento";
  const hasFrameShippingCost  = local.frame_delivery_method  === "ctt";
  const showFlowerShippingPaid = hasFlowerShippingCost;
  const showFrameShippingPaid  = hasFrameShippingCost;

  // Campos de tracking CTT do quadro: aparecem quando o quadro segue por
  // CTT e a encomenda já está na recta final (ou quando já há valores —
  // p.ex. preenchidos pelo diálogo do "Quadro enviado").
  const showFrameTracking =
    local.frame_delivery_method === "ctt" &&
    (isStatusAtOrAfter(local.status, "quadro_pronto") ||
      !!local.frame_tracking_code ||
      !!local.frame_shipped_date);

  // ── Colapso automático por estado ────────────────────────────
  // Com as flores cá (Flores recebidas em diante) a parte do envio já
  // não pede acção; o card volta a abrir quando o quadro está pronto a
  // sair (Quadro pronto/enviado) e fecha de vez no fim.
  const framePhaseHot = ["quadro_pronto", "quadro_enviado"].includes(local.status);
  const autoCollapsed =
    local.status === "cancelado" ||
    local.status === "quadro_recebido" ||
    (isStatusAtOrAfter(local.status, "flores_recebidas") && !framePhaseHot);

  const totalPortes = (local.flower_shipping_cost ?? 0) + (local.frame_shipping_cost ?? 0);
  const summaryParts: string[] = [];
  if (local.flower_delivery_method) {
    const portesPorPagar = hasFlowerShippingCost && (local.flower_shipping_cost ?? 0) > 0 && !local.flower_shipping_paid;
    summaryParts.push(`Flores: ${FLOWER_DELIVERY_METHOD_LABELS[local.flower_delivery_method]}${portesPorPagar ? " (portes por pagar)" : ""}`);
  }
  if (local.frame_delivery_method) {
    summaryParts.push(`Quadro: ${FRAME_DELIVERY_METHOD_LABELS[local.frame_delivery_method]}`);
  }
  if (local.delivery_deadline) {
    summaryParts.push(`Entregar até ${format(parseISO(local.delivery_deadline), "dd/MM/yyyy")}`);
  }
  const summary = (
    <CardSummary amount={totalPortes > 0 ? formatEUR(totalPortes) : undefined}>
      {summaryParts.length > 0 ? summaryParts.join(" · ") : "Sem métodos de envio definidos"}
    </CardSummary>
  );

  return (
    <Card
      title="Envio das flores e receção do quadro"
      icon={<Truck className="h-3.5 w-3.5" />}
      accent="orange"
      className="order-5 lg:order-none"
      autoCollapsed={autoCollapsed}
      summary={summary}
    >
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700">Envio das flores (cliente → FBR)</p>
        <ShippingRow
          method={local.flower_delivery_method}
          methodLabels={FLOWER_DELIVERY_METHOD_LABELS}
          methodColors={FLOWER_DELIVERY_METHOD_COLORS}
          cost={local.flower_shipping_cost}
          paid={local.flower_shipping_paid}
          showCost={hasFlowerShippingCost}
          showPaid={showFlowerShippingPaid}
          onMethod={(v) => clientUpdate("flower_delivery_method", v as Order["flower_delivery_method"], "Envio das flores", (val) => val ? FLOWER_DELIVERY_METHOD_LABELS[val] : "—")}
          onCost={(v) => update("flower_shipping_cost", v)}
          onPaid={(v) => update("flower_shipping_paid", v)}
          methodOptions={[
            ["maos", "Em mãos"],
            ["ctt", "CTT"],
            ["recolha_evento", "Recolha no local"],
            ["nao_sei", "Não sei"],
          ]}
        />

        {/* Campos condicionais para "Recolha no local" — morada,
            data e janela horária (alimentam Entregas e Recolhas) */}
        {local.flower_delivery_method === "recolha_evento" && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Detalhes da recolha
            </p>
            <Field label="Morada da recolha" span2>
              <AddressAutocomplete
                value={local.pickup_address ?? ""}
                onChange={(v) => update("pickup_address", v || null)}
                placeholder="Começa a escrever a morada…"
                className={inp + " pr-7"}
                hint="Sugestões do Google Maps."
              />
            </Field>
            <Grid2>
              <Field label="Data da recolha">
                <Input
                  className={inp}
                  type="date"
                  value={toDateInput(local.pickup_date)}
                  onChange={(e) => update("pickup_date", e.target.value || null)}
                />
              </Field>
              <Field label="Janela horária">
                <div className="flex items-center gap-1.5">
                  <Input
                    className={inp}
                    type="time"
                    value={local.pickup_time_from ?? ""}
                    onChange={(e) => update("pickup_time_from", e.target.value || null)}
                    placeholder="—"
                  />
                  <span className="text-xs text-cocoa-700">→</span>
                  <Input
                    className={inp}
                    type="time"
                    value={local.pickup_time_to ?? ""}
                    onChange={(e) => update("pickup_time_to", e.target.value || null)}
                    placeholder="—"
                  />
                </div>
              </Field>
            </Grid2>
            <Grid2>
              <Field label="Contacto no local — nome">
                <Input
                  className={inp}
                  value={local.pickup_contact_name ?? ""}
                  onChange={(e) => update("pickup_contact_name", e.target.value || null)}
                  placeholder="Ex: Pai da noiva"
                />
              </Field>
              <Field label="Contacto no local — telemóvel">
                <Input
                  className={inp}
                  type="tel"
                  value={local.pickup_contact_phone ?? ""}
                  onChange={(e) => update("pickup_contact_phone", e.target.value || null)}
                  placeholder="+351 …"
                />
              </Field>
            </Grid2>
            <Field label="Notas sobre a recolha" span2>
              <Textarea
                className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
                rows={2}
                value={local.pickup_notes ?? ""}
                onChange={(e) => update("pickup_notes", e.target.value || null)}
                placeholder="Indicações úteis para a recolha — parqueamento, código do prédio, observações…"
              />
            </Field>
          </div>
        )}

        {/* Campos condicionais para "Em mãos" — quem traz as flores ao
            atelier, dia, janela horária e notas (alimentam Google
            Calendar). Sem morada (é sempre no atelier FBR). */}
        {local.flower_delivery_method === "maos" && (
          <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Detalhes da entrega em mãos
            </p>
            <Grid2>
              <Field label="Data da entrega">
                <Input
                  className={inp}
                  type="date"
                  value={toDateInput(local.hand_delivery_date)}
                  onChange={(e) => update("hand_delivery_date", e.target.value || null)}
                />
              </Field>
              <Field label="Janela horária">
                <div className="flex items-center gap-1.5">
                  <Input
                    className={inp}
                    type="time"
                    value={local.hand_delivery_time_from ?? ""}
                    onChange={(e) => update("hand_delivery_time_from", e.target.value || null)}
                    placeholder="—"
                  />
                  <span className="text-xs text-cocoa-700">→</span>
                  <Input
                    className={inp}
                    type="time"
                    value={local.hand_delivery_time_to ?? ""}
                    onChange={(e) => update("hand_delivery_time_to", e.target.value || null)}
                    placeholder="—"
                  />
                </div>
              </Field>
            </Grid2>
            <Grid2>
              <Field label="Quem traz as flores — nome">
                <Input
                  className={inp}
                  value={local.hand_delivery_contact_name ?? ""}
                  onChange={(e) => update("hand_delivery_contact_name", e.target.value || null)}
                  placeholder="Ex: O próprio cliente, irmã, …"
                />
              </Field>
              <Field label="Quem traz as flores — telemóvel">
                <Input
                  className={inp}
                  type="tel"
                  value={local.hand_delivery_contact_phone ?? ""}
                  onChange={(e) => update("hand_delivery_contact_phone", e.target.value || null)}
                  placeholder="+351 …"
                />
              </Field>
            </Grid2>
            <Field label="Notas sobre a entrega" span2>
              <Textarea
                className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
                rows={2}
                value={local.hand_delivery_notes ?? ""}
                onChange={(e) => update("hand_delivery_notes", e.target.value || null)}
                placeholder="Detalhes úteis — confirma se chegou bem, observações…"
              />
            </Field>
          </div>
        )}
      </div>

      <Separator className="bg-cream-100" />

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700">Receção do quadro (FBR → cliente)</p>
        <ShippingRow
          method={local.frame_delivery_method}
          methodLabels={FRAME_DELIVERY_METHOD_LABELS}
          methodColors={FRAME_DELIVERY_METHOD_COLORS}
          cost={local.frame_shipping_cost}
          paid={local.frame_shipping_paid}
          showCost={hasFrameShippingCost}
          showPaid={showFrameShippingPaid}
          onMethod={(v) => clientUpdate("frame_delivery_method", v as Order["frame_delivery_method"], "Receção do quadro", (val) => val ? FRAME_DELIVERY_METHOD_LABELS[val] : "—")}
          onCost={(v) => update("frame_shipping_cost", v)}
          onPaid={(v) => update("frame_shipping_paid", v)}
          methodOptions={[
            ["maos", "Em mãos"],
            ["ctt", "CTT"],
            ["nao_sei", "Não sei"],
          ]}
        />

        {/* Tracking CTT do quadro (mig 093) — preenchido no diálogo ao
            passar para "Quadro enviado", editável aqui. */}
        {showFrameTracking && (
          <Grid2>
            <Field label="Registo CTT do quadro">
              <div className="flex gap-1.5">
                <Input
                  className={inp + " flex-1 min-w-0 font-mono"}
                  value={local.frame_tracking_code ?? ""}
                  onChange={(e) => update("frame_tracking_code", e.target.value || null)}
                  placeholder="Ex: RR123456789PT"
                />
                {local.frame_tracking_code && (
                  <a
                    href={cttTrackingUrl(local.frame_tracking_code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 items-center gap-1 shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-[11px] font-medium text-sky-800 hover:bg-sky-100 transition-colors"
                    title="Seguir o objecto no site dos CTT"
                  >
                    Seguir
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </a>
                )}
              </div>
            </Field>
            <Field label="Data de envio do quadro">
              <Input
                className={inp}
                type="date"
                value={toDateInput(local.frame_shipped_date)}
                onChange={(e) => update("frame_shipped_date", e.target.value || null)}
              />
            </Field>
          </Grid2>
        )}

        {/* "Entregar até" — data-limite pedida pelo cliente (mig 082).
            Alimenta a pill ⏰ na tabela e o alerta do Dashboard. */}
        <Grid2>
          <Field label="Entregar até" hint="Data-limite pedida pelo cliente. Vazio = sem prazo especial.">
            <Input
              className={inp}
              type="date"
              value={toDateInput(local.delivery_deadline)}
              onChange={(e) => update("delivery_deadline", e.target.value || null)}
            />
          </Field>
          <Field label="Motivo do prazo">
            <Input
              className={inp}
              value={local.delivery_deadline_reason ?? ""}
              onChange={(e) => update("delivery_deadline_reason", e.target.value || null)}
              placeholder="Ex: aniversário da mãe a 15/09"
            />
          </Field>
        </Grid2>
        {local.delivery_deadline &&
          !["quadro_enviado", "quadro_recebido", "cancelado"].includes(local.status) && (() => {
            const dias = differenceInCalendarDays(parseISO(local.delivery_deadline!), new Date());
            if (dias > 30) return null;
            const atrasado = dias < 0;
            return (
              <div className={`rounded-lg border p-2.5 text-xs font-medium ${
                atrasado || dias <= 14
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                ⏰ {atrasado
                  ? `O prazo de entrega pedido pelo cliente passou há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}.`
                  : dias === 0
                    ? "O prazo de entrega pedido pelo cliente é HOJE."
                    : `Faltam ${dias} dia${dias === 1 ? "" : "s"} para o prazo de entrega pedido pelo cliente.`}
              </div>
            );
          })()}
      </div>
    </Card>
  );
}
