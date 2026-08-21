"use client";

// Hero unificado da coluna do meio: foto + nome do cliente + atalhos
// (pasta Drive, Google Calendar) + dados do evento. Inclui os handlers
// de Drive/Calendar (chamam Server Actions e actualizam o `local` do pai
// via setLocal). Extraído do workbench-client.tsx (refactor sessão 128).

import { useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  ExternalLink,
  Clock,
  Image as ImageIcon,
  FolderOpen,
  Globe,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Order } from "@/types/database";
import { EVENT_TYPE_LABELS } from "@/types/database";
import { toEmbeddableImageUrl } from "@/lib/drive-url";
import { effectiveCalendarDate } from "@/lib/google/calendar-date";
import {
  publicStatusUrl,
  formatPublicEstimatedDelivery,
  type PartialPublicMessages,
} from "@/lib/public-status";
import { PublicStatusMessageDialog } from "@/components/public-status-message-dialog";
import {
  createOrderDriveFolderAction,
  createOrderCalendarEventAction,
  deleteOrderCalendarEventAction,
} from "../../actions";
import { HeroField, inpSubtle, selSubtle, titleSubtle } from "./layout";
import { DriveUrlEditor, CalendarEventShortcut } from "./fields";
import { toDateInput, computeEventFlags, type UpdateFn, type ClientUpdateFn } from "./shared";

export function HeroSection({
  local,
  setLocal,
  update,
  clientUpdate,
  publicStatusDefaults = {},
  canEdit = true,
}: {
  local: Order;
  setLocal: Dispatch<SetStateAction<Order>>;
  update: UpdateFn;
  clientUpdate: ClientUpdateFn;
  publicStatusDefaults?: PartialPublicMessages;
  canEdit?: boolean;
}) {
  const router = useRouter();

  // Lápis ao lado do botão "Status público": abre o mesmo diálogo da aba
  // Status (mensagem PT/EN, idioma, data prevista). Antes era preciso ir
  // à aba Status procurar a cliente pelo nome (sessão 156).
  const [publicStatusOpen, setPublicStatusOpen] = useState(false);

  const { overdueEvent, soonEvent, isWedding, eventRelative } = computeEventFlags(local);
  const publicStatusLink = publicStatusUrl(local.order_id);
  const photoUrl = toEmbeddableImageUrl(local.flowers_photo_url);

  // Em mobile o overlay com o URL da foto fica escondido por defeito —
  // só aparece quando se toca na foto. Em desktop o hover do `group`
  // continua a controlar a visibilidade como antes.
  const [imageUrlMobileOpen, setImageUrlMobileOpen] = useState(false);

  // Edição rápida do URL da pasta Drive (popover no hero)
  const [driveUrlDraft, setDriveUrlDraft] = useState("");
  const [drivePopoverOpen, setDrivePopoverOpen] = useState(false);

  function saveDriveUrl() {
    update("drive_folder_url", driveUrlDraft.trim() || null);
    setDrivePopoverOpen(false);
  }

  const [driveAutoBusy, setDriveAutoBusy] = useState(false);
  async function autoCreateDriveFolder() {
    setDriveAutoBusy(true);
    try {
      const res = await createOrderDriveFolderAction(local.id);
      if (res?.url) {
        setLocal((prev) => ({ ...prev, drive_folder_url: res.url }));
        toast.success("Pasta criada na Drive.");
        setDrivePopoverOpen(false);
      } else {
        toast.error(
          "Não consegui criar a pasta. Verifica em Definições → Google se a integração está conectada.",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar pasta.");
    } finally {
      setDriveAutoBusy(false);
    }
  }

  const [calendarBusy, setCalendarBusy] = useState(false);
  // Inicializa com o link persistido na BD para que o botão "No Calendar"
  // funcione imediatamente após refresh (sessão 55).
  const [calendarLink, setCalendarLink] = useState<string | null>(
    local.calendar_event_html_link,
  );

  // Data que o evento vai usar: data do evento ou, nas flores secas (que
  // não têm evento), a data de entrega das flores.
  const calendarDate = effectiveCalendarDate(local);

  async function createCalendarEvent() {
    if (!calendarDate) {
      toast.error("Preenche a data do evento ou a data de entrega das flores primeiro.");
      return;
    }
    setCalendarBusy(true);
    try {
      const res = await createOrderCalendarEventAction(local.id);
      if (res) {
        setCalendarLink(res.htmlLink);
        // O ID fica persistido na BD; o `local` actualizar-se-á no próximo refresh.
        // Para reflexo imediato, recarregar a página.
        toast.success("Evento criado no Google Calendar.");
        router.refresh();
      } else {
        toast.error(
          "Não consegui criar o evento. Verifica em Definições → Google se a integração está conectada.",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar evento.");
    } finally {
      setCalendarBusy(false);
    }
  }

  async function deleteCalendarEvent() {
    if (!local.calendar_event_id) return;
    setCalendarBusy(true);
    try {
      await deleteOrderCalendarEventAction(local.id);
      setCalendarLink(null);
      setLocal((prev) => ({
        ...prev,
        calendar_event_id: null,
        calendar_event_html_link: null,
      }));
      toast.success("Evento removido do Google Calendar.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar evento.");
    } finally {
      setCalendarBusy(false);
    }
  }

  return (
    <div className="order-1 lg:order-none rounded-2xl border border-cream-200 bg-surface overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-0">
        {/* Foto 3:4 vertical (16:9 horizontal em mobile para não ocupar o ecrã todo) */}
        <div className="sm:col-span-5 relative group bg-gradient-to-br from-cream-50 to-cream-100">
          <div className="aspect-[16/9] sm:aspect-[3/4]">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={`Flores de ${local.client_name}`}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-cream-200 text-[#C4A882] mb-2">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-cocoa-900">Foto da encomenda</p>
                <p className="text-[11px] text-cocoa-700 mt-1">
                  Cole o link partilhável (Drive, Imgur, …).
                </p>
              </div>
            )}
          </div>
          {/* Tap area em mobile — toca na foto para revelar/esconder o editor de URL. */}
          {photoUrl && (
            <button
              type="button"
              onClick={() => setImageUrlMobileOpen((v) => !v)}
              className="absolute inset-0 sm:hidden z-10"
              aria-label={imageUrlMobileOpen ? "Esconder editor da foto" : "Editar URL da foto"}
            />
          )}
          {/* Overlay com o URL: hover em desktop, toggle em mobile. */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent transition-opacity p-2.5 z-20 ${
              imageUrlMobileOpen || !photoUrl ? "opacity-100" : "opacity-0 pointer-events-none"
            } sm:opacity-0 sm:pointer-events-auto sm:group-hover:opacity-100`}
          >
            <Input
              className="h-8 text-xs bg-surface/95 border-white/40 placeholder:text-cocoa-700"
              placeholder="URL da foto"
              value={local.flowers_photo_url ?? ""}
              onChange={(e) => update("flowers_photo_url", e.target.value || null)}
            />
          </div>
        </div>

        {/* Coluna direita do hero: nome em destaque + atalhos + dados do evento */}
        <div className="sm:col-span-7 p-3 sm:p-4 flex flex-col gap-3">
          {/* Nome (título) + atalhos — empilham em mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start sm:justify-between gap-2 sm:gap-3">
            <Textarea
              className={titleSubtle + " flex-1 min-w-0 resize-none overflow-hidden text-2xl sm:text-3xl"}
              value={local.client_name}
              onChange={(e) => update("client_name", e.target.value)}
              placeholder="Nome do cliente"
              rows={2}
            />
            <div className="flex flex-row sm:flex-col items-stretch gap-1.5 shrink-0 sm:pt-1.5 flex-wrap">
              {local.drive_folder_url ? (
                <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-cream-200 bg-surface">
                  <a
                    href={local.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                    title="Abrir pasta Drive"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Pasta Drive
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                  <Popover open={drivePopoverOpen} onOpenChange={(v) => { setDrivePopoverOpen(v); if (v) setDriveUrlDraft(local.drive_folder_url ?? ""); }}>
                    <PopoverTrigger
                      className="px-1.5 border-l border-cream-200 text-cocoa-700 hover:bg-cream-50 transition-colors"
                      title="Editar URL da pasta"
                    >
                      <Pencil className="h-3 w-3" />
                    </PopoverTrigger>
                    <DriveUrlEditor draft={driveUrlDraft} setDraft={setDriveUrlDraft} onSave={saveDriveUrl} onAutoCreate={autoCreateDriveFolder} autoBusy={driveAutoBusy} />
                  </Popover>
                </div>
              ) : (
                <Popover open={drivePopoverOpen} onOpenChange={(v) => { setDrivePopoverOpen(v); if (v) setDriveUrlDraft(""); }}>
                  <PopoverTrigger
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-cream-200 bg-cream-50 px-2.5 py-1.5 text-xs text-cocoa-700 hover:text-cocoa-900 hover:border-cocoa-500 transition-colors"
                    title="Definir pasta Drive"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Definir pasta Drive
                  </PopoverTrigger>
                  <DriveUrlEditor draft={driveUrlDraft} setDraft={setDriveUrlDraft} onSave={saveDriveUrl} onAutoCreate={autoCreateDriveFolder} autoBusy={driveAutoBusy} />
                </Popover>
              )}

              <CalendarEventShortcut
                eventId={local.calendar_event_id}
                eventDate={calendarDate}
                link={calendarLink}
                busy={calendarBusy}
                onCreate={createCalendarEvent}
                onDelete={deleteCalendarEvent}
              />
            </div>
          </div>

          <Separator className="bg-cream-100" />

          {/* DADOS DO EVENTO */}
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-3 gap-y-1.5">
              <HeroField label="Tipo">
                <Select value={local.event_type ?? ""} onValueChange={(v) => clientUpdate("event_type", v as Order["event_type"], "Tipo de evento", (val) => val ? EVENT_TYPE_LABELS[val] : "—")}>
                  <SelectTrigger className={selSubtle}><SelectValue placeholder="—" labels={EVENT_TYPE_LABELS} /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((t) => (
                      <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </HeroField>
              <HeroField label="Data do evento">
                <Input
                  className={`${inpSubtle} ${
                    overdueEvent
                      ? "border-red-300 bg-red-50"
                      : soonEvent
                      ? "border-amber-400 bg-amber-100"
                      : ""
                  }`}
                  type="date"
                  value={toDateInput(local.event_date)}
                  onChange={(e) => clientUpdate("event_date", e.target.value || null, "Data do evento", (v) => v ? format(parseISO(v as string), "dd/MM/yyyy") : "—")}
                />
                {eventRelative && (
                  <p className={`text-[10px] px-2 inline-flex items-center gap-1 ${
                    overdueEvent
                      ? "text-red-600 font-medium"
                      : soonEvent
                      ? "text-amber-900 font-semibold"
                      : "text-cocoa-500"
                  }`}>
                    {overdueEvent && "⚠ "}
                    {soonEvent && <Clock className="h-2.5 w-2.5" />}
                    {eventRelative}
                  </p>
                )}
              </HeroField>
              {isWedding && (
                <HeroField label="Nome dos noivos">
                  <Input className={inpSubtle} value={local.couple_names ?? ""} onChange={(e) => update("couple_names", e.target.value || null)} placeholder="—" />
                </HeroField>
              )}
              <HeroField label="Localização" span2={!isWedding}>
                <Input className={inpSubtle} value={local.event_location ?? ""} onChange={(e) => update("event_location", e.target.value || null)} placeholder="Ex: Quinta / Igreja / Cidade" />
              </HeroField>
              <HeroField label="Data prevista de entrega" span2>
                <div className="flex flex-wrap items-center gap-2">
                  <Globe className="h-3 w-3 text-sky-600 shrink-0" />
                  <Input
                    className={`${inpSubtle} flex-1 min-w-[140px]`}
                    type="date"
                    value={toDateInput(local.estimated_delivery_date)}
                    onChange={(e) => update("estimated_delivery_date", e.target.value || null)}
                    placeholder="—"
                  />
                  {local.estimated_delivery_date && (
                    <span className="text-[11px] text-cocoa-500 capitalize whitespace-nowrap">
                      {formatPublicEstimatedDelivery(local.estimated_delivery_date, "pt")}
                    </span>
                  )}
                  <div className="inline-flex items-stretch rounded-md overflow-hidden border border-sky-200 bg-sky-50 shrink-0">
                    <a
                      href={publicStatusLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 transition-colors"
                      title="Abrir status público"
                    >
                      <Globe className="h-3 w-3" />
                      Status público
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setPublicStatusOpen(true)}
                        className="px-1.5 border-l border-sky-200 text-sky-700 hover:bg-sky-100 transition-colors"
                        title="Editar o status público (mensagem, idioma, data prevista)"
                        aria-label="Editar status público"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {!local.estimated_delivery_date && (
                  <p className="text-[10px] text-cocoa-500 italic px-1.5">
                    Gerada automaticamente quando passa para <em>Flores na prensa</em>. Editável aqui ou na aba <Link href="/status" className="underline">Status</Link>.
                  </p>
                )}
              </HeroField>
            </div>
          </div>
        </div>
      </div>

      {publicStatusOpen && (
        <PublicStatusMessageDialog
          order={local}
          defaults={publicStatusDefaults}
          onClose={() => setPublicStatusOpen(false)}
          onSaved={(updates) => setLocal((prev) => ({ ...prev, ...updates }))}
        />
      )}
    </div>
  );
}
