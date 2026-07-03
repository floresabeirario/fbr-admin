"use client";

// Cartões de fecho da coluna direita: "Entrega e feedback" (só a partir
// de Quadro pronto), "Cupão 5%" e o rodapé com as datas de criação.
// Extraídos do workbench-client.tsx (refactor sessão 128).

import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Package, Ticket, CalendarPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order } from "@/types/database";
import {
  COUPON_STATUS_LABELS,
  COUPON_STATUS_COLORS,
  CLIENT_FEEDBACK_STATUS_LABELS,
  CLIENT_FEEDBACK_STATUS_COLORS,
} from "@/types/database";
import { Card, Field, inp, sel } from "./layout";
import { CouponCodeField } from "./fields";
import { toDateInput, type UpdateFn } from "./shared";

/* "Entrega e feedback" só aparece a partir do estado "Quadro pronto" — antes disso ainda
   não faz sentido editar data de entrega ou feedback do cliente. */
export function DeliveryFeedbackCard({ local, update }: { local: Order; update: UpdateFn }) {
  if (!["quadro_pronto", "quadro_enviado", "quadro_recebido"].includes(local.status)) return null;
  return (
    <Card title="Entrega e feedback" icon={<Package className="h-3.5 w-3.5" />} accent="purple" className="order-[13] lg:order-none">
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

  return (
    <Card title="Cupão 5%" icon={<Ticket className="h-3.5 w-3.5" />} accent="yellow" className="order-[14] lg:order-none">
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

export function MetaFooter({ local }: { local: Order }) {
  return (
    <div className="order-[15] lg:order-none rounded-xl border border-cream-200 bg-surface px-4 py-3 space-y-1">
      <p className="text-[10px] text-cocoa-500">
        Criada em {local.created_at ? format(parseISO(local.created_at), "dd/MM/yyyy, HH:mm", { locale: pt }) : "—"}
      </p>
      {local.updated_at && local.updated_at !== local.created_at && (
        <p className="text-[10px] text-cocoa-500">
          Actualizada em {format(parseISO(local.updated_at), "dd/MM/yyyy, HH:mm", { locale: pt })}
        </p>
      )}
      <p className="font-mono text-[10px] text-[#D0C4B8]">{local.order_id}</p>
    </div>
  );
}
