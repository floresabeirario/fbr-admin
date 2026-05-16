"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  ExternalLink,
  Plus,
  X,
  Pencil,
  CalendarPlus,
  CalendarClock,
  CalendarCheck,
  Send,
  PackageCheck,
  Layers,
  Palette,
  Hourglass,
  Hammer,
  Frame,
  Camera,
  Truck,
  PartyPopper,
  Ban,
  Trash2,
  Paintbrush,
  Flower2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  STATUS_LABELS,
  YES_NO_INFO_LABELS,
  SIM_NAO_LABELS,
} from "@/types/database";
import { Field, inp, sel } from "./layout";

// ── Cores e ícones por estado ─────────────────────────────────
// (Sincronizar com preservacao-client.tsx — devem coincidir.)

const STATUS_COLORS: Record<keyof typeof STATUS_LABELS, string> = {
  entrega_flores_agendar: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",
  entrega_agendada:       "bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-900",
  flores_enviadas:        "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:border-fuchsia-900",
  flores_recebidas:       "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-900",
  flores_na_prensa:       "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900",
  reconstrucao_botanica:  "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-900",
  a_compor_design:        "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900",
  a_aguardar_aprovacao:   "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900",
  a_finalizar_quadro:     "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-900",
  a_ser_emoldurado:       "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-900",
  emoldurado:             "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
  a_ser_fotografado:      "bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-950/40 dark:text-lime-200 dark:border-lime-900",
  quadro_pronto:          "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-900",
  quadro_enviado:         "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900",
  quadro_recebido:        "bg-green-100 text-green-900 border-green-300 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900",
  cancelado:              "bg-stone-200 text-stone-600 border-stone-300 dark:bg-stone-900/60 dark:text-stone-400 dark:border-stone-800",
};

const STATUS_ICONS: Record<keyof typeof STATUS_LABELS, LucideIcon> = {
  entrega_flores_agendar: CalendarClock,
  entrega_agendada:       CalendarCheck,
  flores_enviadas:        Send,
  flores_recebidas:       PackageCheck,
  flores_na_prensa:       Layers,
  reconstrucao_botanica:  Flower2,
  a_compor_design:        Palette,
  a_aguardar_aprovacao:   Hourglass,
  a_finalizar_quadro:     Paintbrush,
  a_ser_emoldurado:       Hammer,
  emoldurado:             Frame,
  a_ser_fotografado:      Camera,
  quadro_pronto:          Sparkles,
  quadro_enviado:         Truck,
  quadro_recebido:        PartyPopper,
  cancelado:              Ban,
};

const STATUS_GROUPS: Array<{ label: string; statuses: Array<keyof typeof STATUS_LABELS> }> = [
  { label: "Pré-reserva",          statuses: ["entrega_flores_agendar"] },
  { label: "Reservas",             statuses: ["entrega_agendada", "flores_enviadas", "flores_recebidas"] },
  { label: "Preservação e design", statuses: ["flores_na_prensa", "reconstrucao_botanica", "a_compor_design", "a_aguardar_aprovacao", "a_finalizar_quadro"] },
  { label: "Finalização",          statuses: ["a_ser_emoldurado", "emoldurado", "a_ser_fotografado", "quadro_pronto", "quadro_enviado"] },
  { label: "Concluído",            statuses: ["quadro_recebido"] },
  { label: "Cancelado",            statuses: ["cancelado"] },
];

// ── Inventário de flores ─────────────────────────────────────
// Linhas {qty, name} editáveis inline. Sem state local — o parent é
// a fonte da verdade; cada alteração chama onChange imediatamente. O
// auto-save do workbench (900ms debounce) trata da BD.
export function InventorySection({
  items,
  onChange,
}: {
  items: { qty: number; name: string }[];
  onChange: (items: { qty: number; name: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-cocoa-700">Inventário de flores</Label>
        <button
          type="button"
          onClick={() => onChange([...items, { qty: 1, name: "" }])}
          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 transition-colors"
        >
          <Plus className="h-3 w-3" /> Adicionar
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-cocoa-500 italic px-1.5 py-2 rounded-lg bg-cream-50 border border-dashed border-cream-200">
          Ex.: 7 rosas laranja · 3 papoilas vermelhas · 2 dálias brancas
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                className={`${inp} w-16 text-center`}
                value={row.qty}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...row, qty: Math.max(1, Number(e.target.value) || 1) };
                  onChange(next);
                }}
              />
              <Input
                className={`${inp} flex-1`}
                value={row.name}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...row, name: e.target.value };
                  onChange(next);
                }}
                placeholder="rosas laranja, papoilas vermelhas…"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="shrink-0 p-1.5 rounded-lg text-cocoa-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url.slice(0, 20); }
}
export { safeHostname };

export function DriveUrlEditor({
  draft,
  setDraft,
  onSave,
  onAutoCreate,
  autoBusy,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSave: () => void;
  onAutoCreate: () => void;
  autoBusy: boolean;
}) {
  return (
    <PopoverContent className="w-80 p-3 space-y-2">
      <button
        type="button"
        onClick={onAutoCreate}
        disabled={autoBusy}
        className="w-full h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {autoBusy ? "A criar pasta…" : "Criar automaticamente na Drive"}
      </button>
      <p className="text-[10px] text-cocoa-500 leading-relaxed">
        Cria a pasta da encomenda (com as 8 subpastas por fase) dentro de
        FBR — Encomendas / Preservação de Flores. Requer integração Google conectada
        (Definições → Google).
      </p>
      <div className="pt-1 border-t border-cream-100">
        <Label className="text-xs font-medium text-cocoa-700">… ou cola um URL manualmente</Label>
        <Input
          className={`${inp} mt-1`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://drive.google.com/…"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSave(); } }}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onSave}
            className="h-8 px-3 rounded-lg bg-btn-primary text-btn-primary-fg text-xs font-medium hover:bg-btn-primary-hover transition-colors"
          >
            Guardar URL
          </button>
        </div>
      </div>
    </PopoverContent>
  );
}

export function CalendarEventShortcut({
  eventId,
  eventDate,
  link,
  busy,
  onCreate,
  onDelete,
}: {
  eventId: string | null;
  eventDate: string | null;
  link: string | null;
  busy: boolean;
  onCreate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Sem data → não dá para criar; mostra estado neutro.
  if (!eventDate) {
    return (
      <span
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-cream-200 bg-cream-50 px-2.5 py-1.5 text-xs text-cocoa-500 cursor-not-allowed"
        title="Preenche a data do evento para poderes criar um evento no Calendar"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Evento Calendar
      </span>
    );
  }

  if (eventId) {
    return (
      <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-cream-200 bg-surface">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors"
            title="Abrir evento no Google Calendar"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            No Calendar
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        ) : (
          <span
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-700"
            title="Evento criado. Recarrega para obter o link directo."
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            No Calendar
          </span>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="px-1.5 border-l border-cream-200 text-cocoa-700 hover:bg-cream-50 transition-colors"
            title="Gerir evento Calendar"
          >
            <Pencil className="h-3 w-3" />
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3 space-y-2">
            <button
              type="button"
              onClick={() => { onCreate(); setOpen(false); }}
              disabled={busy}
              className="w-full h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {busy ? "A actualizar…" : "Re-sincronizar evento"}
            </button>
            <button
              type="button"
              onClick={() => { onDelete(); setOpen(false); }}
              disabled={busy}
              className="w-full h-9 px-3 rounded-lg border border-rose-200 bg-surface text-rose-700 text-xs font-medium hover:bg-rose-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Apagar evento
            </button>
            <p className="text-[10px] text-cocoa-500 leading-relaxed">
              O evento actualiza-se automaticamente sempre que mudares
              a data, nome do cliente ou local. Re-sincroniza se algo
              parecer desalinhado.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onCreate}
      disabled={busy}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 hover:border-violet-400 disabled:opacity-50 transition-colors"
      title="Criar evento no Google Calendar"
    >
      <CalendarPlus className="h-3.5 w-3.5" />
      {busy ? "A criar…" : "Criar no Calendar"}
    </button>
  );
}

export function StatusSelect({
  value,
  onChange,
}: {
  value: keyof typeof STATUS_LABELS;
  onChange: (v: keyof typeof STATUS_LABELS) => void;
}) {
  const colorClass = STATUS_COLORS[value] ?? "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <Select value={value} onValueChange={(v) => onChange(v as keyof typeof STATUS_LABELS)}>
      <SelectTrigger className={`h-8 text-xs font-semibold border rounded-md ${colorClass} hover:brightness-95 transition`}>
        <SelectValue>
          {(v) => {
            if (typeof v !== "string" || !(v in STATUS_LABELS)) return null;
            const key = v as keyof typeof STATUS_LABELS;
            const Icon = STATUS_ICONS[key];
            return (
              <>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {STATUS_LABELS[key]}
              </>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[420px] min-w-[280px] p-0 rounded-md border border-cream-200">
        {STATUS_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <SelectSeparator className="bg-cream-200 my-0" />}
            <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cocoa-500">
              {group.label}
            </div>
            <div className="px-1 pb-1">
              {group.statuses.map((s) => {
                const Icon = STATUS_ICONS[s];
                return (
                  <SelectItem key={s} value={s} className="my-0.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-cocoa-700" />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[s]}`}>
                      {STATUS_LABELS[s]}
                    </span>
                  </SelectItem>
                );
              })}
            </div>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ShippingRow<M extends string>({
  method, methodLabels, methodOptions, methodColors,
  cost, paid, showCost, showPaid,
  onMethod, onCost, onPaid,
}: {
  method: M | null;
  methodLabels: Record<M, string>;
  methodOptions: Array<[M, string]>;
  methodColors?: Partial<Record<M, string>>;
  cost: number | null;
  paid: boolean;
  showCost: boolean;
  showPaid: boolean;
  onMethod: (v: string | null) => void;
  onCost: (v: number | null) => void;
  onPaid: (v: boolean) => void;
}) {
  const triggerColor = method && methodColors?.[method] ? methodColors[method] : "";
  const visibleCols = 1 + (showCost ? 1 : 0) + (showPaid ? 1 : 0);
  // Mobile: 1 coluna sempre. Desktop sm:+: distribui pelas colunas calculadas.
  const colsClass = visibleCols === 3
    ? "grid-cols-1 sm:grid-cols-3"
    : visibleCols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1";
  return (
    <div className={`grid gap-3 items-end ${colsClass}`}>
      <Field label="Como">
        <Select value={method ?? ""} onValueChange={onMethod}>
          <SelectTrigger className={`${sel} font-medium ${triggerColor}`}><SelectValue placeholder="—" labels={methodLabels} /></SelectTrigger>
          <SelectContent>
            {methodOptions.map(([v, label]) => (
              <SelectItem key={v} value={v} className="my-0.5">
                {methodColors?.[v] ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${methodColors[v]}`}>
                    {label}
                  </span>
                ) : (
                  label
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {showCost && (
        <Field label="Custo (€)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
            <Input
              className={inp + " pl-7"}
              type="number" min={0} step={0.01}
              value={cost ?? ""}
              onChange={(e) => onCost(e.target.value ? Number(e.target.value) : null)}
              placeholder="0,00"
            />
          </div>
        </Field>
      )}
      {showPaid && (
        <Field label="Pago?">
          <Select value={paid ? "sim" : "nao"} onValueChange={(v) => onPaid(v === "sim")}>
            <SelectTrigger className={`${sel} ${paid ? "bg-green-50 border-green-300 text-green-800" : "bg-amber-50 border-amber-300 text-amber-800"}`}>
              <SelectValue labels={SIM_NAO_LABELS} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

export function CouponCodeField({
  code,
  onChange,
}: {
  code: string | null;
  onChange: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code ?? "");

  function startEdit() {
    setDraft(code ?? "");
    setEditing(true);
  }
  function commit() {
    const v = draft.trim().toUpperCase();
    onChange(v || null);
    setEditing(false);
  }
  function cancel() {
    setDraft(code ?? "");
    setEditing(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-cocoa-700">Código</Label>
      {editing ? (
        <div className="flex gap-1.5">
          <Input
            className={inp + " flex-1 font-mono uppercase tracking-[0.2em]"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex: F2B6R1"
            maxLength={10}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
          />
          <button
            onClick={commit}
            className="h-9 w-9 inline-flex shrink-0 items-center justify-center rounded-lg bg-btn-primary text-btn-primary-fg hover:bg-btn-primary-hover transition-colors"
            title="Guardar"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : code ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-base tracking-[0.2em] border border-yellow-400 bg-yellow-50 text-yellow-900 px-3 py-1 rounded-full">
            {code}
          </span>
          <button
            onClick={startEdit}
            className="h-7 w-7 inline-flex shrink-0 items-center justify-center rounded-md text-cocoa-700 hover:bg-cream-100 hover:text-cocoa-900 transition-colors"
            title="Editar código"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={startEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cream-200 bg-cream-50 px-3 py-1.5 text-xs text-cocoa-700 hover:text-cocoa-900 hover:border-cocoa-500 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Definir código manualmente
        </button>
      )}
      <p className="text-[10px] text-cocoa-500">
        Gerado automaticamente em &lsquo;A ser emoldurado&rsquo;.
      </p>
    </div>
  );
}

export function ExtraPieceRow({
  label,
  value,
  qty,
  onValue,
  onQty,
}: {
  label: string;
  value: "sim" | "nao" | "mais_info" | null;
  qty: number | null;
  onValue: (v: "sim" | "nao" | "mais_info" | null) => void;
  onQty: (q: number | null) => void;
}) {
  const showQty = value === "sim" || value === "mais_info";
  return (
    <div className="flex items-center gap-2">
      <Label className="flex-1 text-xs text-cocoa-900 truncate">{label}</Label>
      <Select value={value ?? ""} onValueChange={(v) => onValue((v || null) as "sim" | "nao" | "mais_info" | null)}>
        <SelectTrigger className="h-7 w-[7.5rem] text-xs border-cream-200 bg-cream-50 text-cocoa-900 rounded-md px-2"><SelectValue placeholder="—" labels={YES_NO_INFO_LABELS} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sim">Sim</SelectItem>
          <SelectItem value="nao">Não</SelectItem>
          <SelectItem value="mais_info">Mais info</SelectItem>
        </SelectContent>
      </Select>
      <Input
        className="h-7 w-12 text-xs text-center border-cream-200 bg-cream-50 text-cocoa-900 rounded-md px-1 disabled:opacity-30"
        type="number"
        min={0}
        max={99}
        value={qty ?? ""}
        onChange={(e) => onQty(e.target.value ? Number(e.target.value) : null)}
        disabled={!showQty}
        placeholder={showQty ? "0" : ""}
        title={showQty ? "Quantidade" : "Selecciona Sim/Mais info para indicar quantidade"}
      />
    </div>
  );
}
