"use client";

// Cartão "Envio das flores e receção do quadro": métodos de envio com
// custos, detalhes de recolha/entrega em mãos e prazo "Entregar até".
// Extraído do workbench-client.tsx (refactor sessão 128).

import { differenceInCalendarDays, parseISO } from "date-fns";
import { Truck, MapPin } from "lucide-react";
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
} from "@/types/database";
import { Card, Grid2, Field, inp } from "./layout";
import { ShippingRow } from "./fields";
import { toDateInput, type UpdateFn, type ClientUpdateFn } from "./shared";

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

  return (
    <Card title="Envio das flores e receção do quadro" icon={<Truck className="h-3.5 w-3.5" />} accent="orange" className="order-5 lg:order-none">
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
