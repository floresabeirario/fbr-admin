"use client";

// Cartão "Parceria": parceiro recomendador + comissão. A escolha do
// parceiro passa pelo handler do pai (onPartnerChange) porque aplica
// vários campos numa só transição de autosave. Extraído do
// workbench-client.tsx (refactor sessão 128).

import Link from "next/link";
import { Handshake, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartnerCombobox, type PartnerOption } from "@/components/partner-combobox";
import type { Order } from "@/types/database";
import {
  PARTNER_COMMISSION_STATUS_LABELS,
  PARTNER_COMMISSION_STATUS_COLORS,
} from "@/types/database";
import { Card, Field, inp, sel } from "./layout";
import type { UpdateFn } from "./shared";

export function PartnershipCard({
  local,
  partners,
  update,
  onPartnerChange,
}: {
  local: Order;
  partners: PartnerOption[];
  update: UpdateFn;
  onPartnerChange: (id: string | null) => void;
}) {
  return (
    <Card title="Parceria" icon={<Handshake className="h-3.5 w-3.5" />} accent="sky" className="order-8 lg:order-none">
      <div className="space-y-3">
        <Field
          label="Parceiro recomendador"
          hint={partners.length === 0 ? "Adiciona parceiros na aba Parcerias." : "Escreve para pesquisar."}
        >
          <div className="flex gap-2">
            <PartnerCombobox
              partners={partners}
              value={local.partner_id}
              triggerCls={sel}
              onChange={onPartnerChange}
            />
            {local.partner_id && (
              <Link
                href={`/parcerias/${local.partner_id}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cream-200 bg-cream-50 text-cocoa-700 hover:bg-btn-primary hover:text-btn-primary-fg hover:border-btn-primary transition-colors"
                title="Abrir parceiro"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </Field>
        {local.partner_id && (
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <Field label="Comissão (€)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
                <Input
                  className={inp + " pl-7"}
                  type="number" min={0} step={0.01}
                  value={local.partner_commission ?? ""}
                  onChange={(e) => update("partner_commission", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </Field>
            <Field label="Estado da comissão">
              <Select value={local.partner_commission_status} onValueChange={(v) => update("partner_commission_status", v as Order["partner_commission_status"])}>
                <SelectTrigger className={`${sel} font-medium ${PARTNER_COMMISSION_STATUS_COLORS[local.partner_commission_status]}`}>
                  <SelectValue labels={PARTNER_COMMISSION_STATUS_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PARTNER_COMMISSION_STATUS_LABELS) as Array<keyof typeof PARTNER_COMMISSION_STATUS_LABELS>).map((k) => (
                    <SelectItem key={k} value={k} className="my-0.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PARTNER_COMMISSION_STATUS_COLORS[k]}`}>
                        {PARTNER_COMMISSION_STATUS_LABELS[k]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </div>
    </Card>
  );
}
