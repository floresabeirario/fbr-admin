"use client";

// Cartão "Origem e notas": como conheceu a FBR (com campos condicionais)
// e notas adicionais. Extraído do workbench-client.tsx (refactor sessão 128).

import Link from "next/link";
import { StickyNote, Ticket, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order } from "@/types/database";
import {
  HOW_FOUND_FBR_LABELS,
  HOW_FOUND_FBR_COLORS,
} from "@/types/database";
import { HowFoundFbrLabel } from "@/components/ui/how-found-fbr-label";
import { isStatusAtOrAfter } from "@/types/database";
import { Card, CardSummary, Field, inp, sel } from "./layout";
import type { UpdateFn, ClientUpdateFn } from "./shared";

export function OriginCard({
  local,
  update,
  clientUpdate,
  linkedVoucherCode,
}: {
  local: Order;
  update: UpdateFn;
  clientUpdate: ClientUpdateFn;
  linkedVoucherCode: string | null;
}) {
  // ── Colapso automático por estado ────────────────────────────
  // "Como conheceu" + notas do formulário são administrativo inicial;
  // com as flores cá dentro deixa de pedir atenção.
  const autoCollapsed =
    local.status === "cancelado" || isStatusAtOrAfter(local.status, "flores_recebidas");
  const summaryParts: string[] = [];
  if (local.how_found_fbr) summaryParts.push(HOW_FOUND_FBR_LABELS[local.how_found_fbr]);
  if (local.gift_voucher_code) summaryParts.push(`Vale ${local.gift_voucher_code}`);
  if (local.additional_notes) summaryParts.push("com notas do cliente");

  return (
    <Card
      title="Origem e notas"
      icon={<StickyNote className="h-3.5 w-3.5" />}
      accent="slate"
      className="order-12 lg:order-none"
      autoCollapsed={autoCollapsed}
      summary={<CardSummary>{summaryParts.length > 0 ? summaryParts.join(" · ") : "Sem origem registada"}</CardSummary>}
    >
      <div className="space-y-3">
        <Field label="Como conheceu a FBR">
          <Select value={local.how_found_fbr ?? ""} onValueChange={(v) => clientUpdate("how_found_fbr", v as Order["how_found_fbr"], "Como conheceu a FBR", (val) => val ? HOW_FOUND_FBR_LABELS[val] : "—")}>
            <SelectTrigger
              className={`${sel} font-medium ${local.how_found_fbr ? HOW_FOUND_FBR_COLORS[local.how_found_fbr] : ""}`}
            >
              <SelectValue placeholder="—" labels={HOW_FOUND_FBR_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(HOW_FOUND_FBR_LABELS) as Array<keyof typeof HOW_FOUND_FBR_LABELS>).map((k) => (
                <SelectItem key={k} value={k} className="my-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${HOW_FOUND_FBR_COLORS[k]}`}>
                    <HowFoundFbrLabel value={k} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {local.how_found_fbr === "vale_presente" && (
          <Field label="Código vale-presente">
            <div className="flex gap-1.5">
              <Input className={inp + " flex-1 min-w-0"} value={local.gift_voucher_code ?? ""} onChange={(e) => update("gift_voucher_code", e.target.value || null)} placeholder="Código de 6 dígitos" />
              {linkedVoucherCode && local.gift_voucher_code && (
                <Link
                  href={`/vale-presente/${linkedVoucherCode}`}
                  className="flex h-9 items-center gap-1.5 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                  title={`Abrir vale-presente ${linkedVoucherCode}`}
                >
                  <Ticket className="h-3 w-3" />
                  Abrir vale
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </Link>
              )}
            </div>
          </Field>
        )}
        {local.how_found_fbr === "florista" && (
          <Field label="Que florista? *" hint="Obrigatório quando o cliente escolhe Florista.">
            <Input
              className={inp}
              value={local.how_found_fbr_other ?? ""}
              onChange={(e) => update("how_found_fbr_other", e.target.value || null)}
              placeholder="Nome da florista que recomendou…"
            />
          </Field>
        )}
        {local.how_found_fbr === "outro" && (
          <Field label='Especifique "Outro"' hint="O cliente preencheu este campo no formulário público.">
            <Input
              className={inp}
              value={local.how_found_fbr_other ?? ""}
              onChange={(e) => update("how_found_fbr_other", e.target.value || null)}
              placeholder="Detalha como ouviu falar da FBR…"
            />
          </Field>
        )}
        <Field label="Notas adicionais">
          <Textarea
            className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
            rows={4}
            value={local.additional_notes ?? ""}
            onChange={(e) => update("additional_notes", e.target.value || null)}
            placeholder="Pedidos especiais, informações relevantes…"
          />
        </Field>
      </div>
    </Card>
  );
}
