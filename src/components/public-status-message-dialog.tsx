"use client";

// Diálogo do status público de uma encomenda (o que o cliente lê em
// status.floresabeirario.pt): mensagem PT, mensagem EN, idioma e data
// prevista de entrega — tudo o que a linha da aba Status deixa editar.
// Vive aqui, e não dentro da aba Status, porque é usado nos dois sítios:
// na tabela do Status e no lápis ao lado do estado no workbench (sessão
// 156 — a Maria estava a ir à aba Status procurar o nome da cliente só
// para mudar o texto, com o workbench aberto à frente).
//
// Deixar em branco = usar a mensagem default da fase (public_status_settings).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Globe, Loader2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PUBLIC_STATUS_LANGUAGE_LABELS,
  type Order,
  type PublicStatusLanguage,
} from "@/types/database";
import {
  PUBLIC_PHASE_COLORS,
  PUBLIC_PHASE_LABEL_PT,
  PUBLIC_PHASE_LABEL_EN,
  STATUS_TO_PUBLIC_PHASE,
  formatPublicEstimatedDelivery,
  publicStatusUrl,
  resolveMessage,
  type PartialPublicMessages,
} from "@/lib/public-status";
import { updateOrderPublicStatusAction } from "@/app/(admin)/status/actions";

function toDateInput(d: string | null): string {
  if (!d) return "";
  try {
    return format(parseISO(d), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

export type PublicStatusUpdates = {
  public_status_message_pt: string | null;
  public_status_message_en: string | null;
  public_status_language: PublicStatusLanguage;
  estimated_delivery_date: string | null;
};

export function PublicStatusMessageDialog({
  order,
  defaults,
  onClose,
  onSaved,
}: {
  order: Order;
  defaults: PartialPublicMessages;
  onClose: () => void;
  // Quem tem estado local da encomenda (o workbench) actualiza-o aqui, para
  // o texto novo aparecer sem esperar pelo refresh.
  onSaved?: (updates: PublicStatusUpdates) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const phase = STATUS_TO_PUBLIC_PHASE[order.status];

  const ptDefault = resolveMessage(phase, "pt", null, defaults);
  const enDefault = resolveMessage(phase, "en", null, defaults);
  const displayName = order.couple_names?.trim() || order.client_name;

  const [pt, setPt] = useState(order.public_status_message_pt ?? "");
  const [en, setEn] = useState(order.public_status_message_en ?? "");
  const [lang, setLang] = useState<PublicStatusLanguage>(order.public_status_language);
  const [estDate, setEstDate] = useState(toDateInput(order.estimated_delivery_date));

  const ptOverride = pt.trim().length > 0;
  const enOverride = en.trim().length > 0;

  function save() {
    const updates: PublicStatusUpdates = {
      public_status_message_pt: ptOverride ? pt : null,
      public_status_message_en: enOverride ? en : null,
      public_status_language: lang,
      estimated_delivery_date: estDate || null,
    };
    startTransition(async () => {
      try {
        await updateOrderPublicStatusAction(order.id, updates);
        onSaved?.(updates);
        router.refresh();
        onClose();
      } catch (err) {
        console.error(err);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-sky-600" />
            Mensagem pública — {displayName}
          </DialogTitle>
          <DialogDescription>
            Fase pública{" "}
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border ${PUBLIC_PHASE_COLORS[phase]}`}
            >
              {phase !== "cancelada" && `${phase} · `}
              {PUBLIC_PHASE_LABEL_PT[phase]} / {PUBLIC_PHASE_LABEL_EN[phase]}
            </span>
            .{" "}
            <a
              href={publicStatusUrl(order.order_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 hover:underline inline-flex items-center gap-1"
            >
              <Globe className="h-3 w-3" />
              Ver a página do cliente
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Idioma + data prevista — o resto da linha da aba Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-cocoa-700 block mb-1.5">
                Idioma que o cliente vê
              </label>
              <Select value={lang} onValueChange={(v) => setLang(v as PublicStatusLanguage)}>
                <SelectTrigger className="bg-surface">
                  <SelectValue labels={PUBLIC_STATUS_LANGUAGE_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PUBLIC_STATUS_LANGUAGE_LABELS) as PublicStatusLanguage[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PUBLIC_STATUS_LANGUAGE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-cocoa-700 block mb-1.5">
                Data prevista de entrega
              </label>
              <Input
                type="date"
                value={estDate}
                onChange={(e) => setEstDate(e.target.value)}
                className="bg-surface"
              />
              <p className="mt-1.5 text-[11px] text-cocoa-500">
                {estDate ? (
                  <>
                    Cliente vê:{" "}
                    <span className="text-cocoa-700 font-medium capitalize">
                      {formatPublicEstimatedDelivery(estDate, "pt")}
                    </span>
                  </>
                ) : (
                  "Só mês e ano são mostrados ao cliente."
                )}
              </p>
            </div>
          </div>

          {/* PT */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-cocoa-700">
                🇵🇹 Português
              </label>
              {ptOverride && (
                <button
                  onClick={() => setPt("")}
                  className="text-[11px] text-cocoa-700 hover:text-rose-600 inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Voltar ao default
                </button>
              )}
            </div>
            <Textarea
              value={pt}
              onChange={(e) => setPt(e.target.value)}
              placeholder={ptDefault}
              rows={4}
              className="text-sm"
            />
            {!ptOverride && (
              <p className="mt-1.5 text-[11px] text-cocoa-500 italic">
                A usar default: <span className="text-cocoa-700">{ptDefault}</span>
              </p>
            )}
          </div>

          {/* EN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-cocoa-700">
                🇬🇧 English
              </label>
              {enOverride && (
                <button
                  onClick={() => setEn("")}
                  className="text-[11px] text-cocoa-700 hover:text-rose-600 inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Back to default
                </button>
              )}
            </div>
            <Textarea
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder={enDefault}
              rows={4}
              className="text-sm"
            />
            {!enOverride && (
              <p className="mt-1.5 text-[11px] text-cocoa-500 italic">
                Using default: <span className="text-cocoa-700">{enDefault}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
