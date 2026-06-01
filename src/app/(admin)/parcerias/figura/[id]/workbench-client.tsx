"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/navigation-progress";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  ArrowLeft,
  Star,
  AtSign,
  Users2,
  CalendarHeart,
  Gift,
  User,
  StickyNote,
  Loader2,
  Plus,
  X,
  Trash2,
  ListChecks,
  MessageSquare,
  Save,
  Archive,
  ExternalLink,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Tag,
  Image as ImageIcon,
  Copy,
  Megaphone,
  AlertTriangle,
  Link as LinkIcon,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import WorkbenchNavigator from "@/components/workbench-navigator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/format";
import {
  type PublicFigure,
  type FigureType,
  type FigureStatus,
  type FigurePriority,
  type FigureEventType,
  type FigureOfferType,
  type FigureContactChannel,
  type FigurePhone,
  FIGURE_TYPE_LABELS,
  FIGURE_STATUS_LABELS,
  FIGURE_STATUS_COLORS,
  FIGURE_STATUS_ORDER,
  FIGURE_PRIORITY_LABELS,
  FIGURE_PRIORITY_COLORS,
  FIGURE_EVENT_TYPE_LABELS,
  FIGURE_OFFER_TYPE_LABELS,
  FIGURE_CONTACT_CHANNEL_LABELS,
} from "@/types/public-figure";
import {
  type InteractionChannel,
  INTERACTION_CHANNEL_LABELS,
  INTERACTION_CHANNEL_COLORS,
} from "@/types/partner";
import {
  FRAME_SIZE_LABELS,
  STATUS_LABELS as ORDER_STATUS_LABELS,
  type FrameSize,
  type OrderStatus,
} from "@/types/database";
import {
  OUTREACH_TEMPLATES,
  fillOutreachTemplate,
} from "@/lib/outreach-templates";
import type { TemplateLanguage } from "@/types/message-template";
import { daysUntilEvent } from "@/lib/supabase/public-figures";
import type { LinkableOrder } from "./page";
import {
  updateFigureAction,
  archiveFigureAction,
  addFigureInteractionAction,
  deleteFigureInteractionAction,
  addFigureActionItemAction,
  toggleFigureActionItemAction,
  deleteFigureActionItemAction,
  addFigureDeliverableAction,
  updateFigureDeliverableAction,
  deleteFigureDeliverableAction,
} from "../../figuras-actions";

// ── Constantes ───────────────────────────────────────────────

const ASSIGNEES = [
  { email: "info+antonio@floresabeirario.pt", name: "António" },
  { email: "info+mj@floresabeirario.pt", name: "MJ" },
  { email: "info+ana@floresabeirario.pt", name: "Ana" },
];

function nameForEmail(email: string | null): string {
  if (!email) return "—";
  return ASSIGNEES.find((a) => a.email === email)?.name ?? email;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: pt });
  } catch {
    return "—";
  }
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy, HH:mm", { locale: pt });
  } catch {
    return "—";
  }
}

// ── Componente principal ─────────────────────────────────────

interface Props {
  figure: PublicFigure;
  costBySize: Record<string, number>;
  orders: LinkableOrder[];
}

export default function FiguraWorkbenchClient({ figure: initial, costBySize, orders }: Props) {
  const router = useRouter();
  const [figure, setFigure] = useState<PublicFigure>(initial);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Sincroniza com a server prop (padrão "store info from previous renders").
  const [trackedUpdatedAt, setTrackedUpdatedAt] = useState(initial.updated_at);
  if (initial.updated_at !== trackedUpdatedAt) {
    setTrackedUpdatedAt(initial.updated_at);
    setFigure(initial);
  }

  function saveField<K extends keyof PublicFigure>(key: K, value: PublicFigure[K]) {
    if (figure[key] === value) return;
    setSavingField(key as string);
    setFigure((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      try {
        await updateFigureAction(figure.id, { [key]: value } as Partial<PublicFigure>);
        router.refresh();
      } catch (err) {
        console.error(err);
      } finally {
        setSavingField(null);
      }
    });
  }

  const pendingActions = figure.actions.filter((a) => !a.done);
  const doneActions = figure.actions.filter((a) => a.done);

  // Alertas
  const days = daysUntilEvent(figure.event_date);
  const inPlay = figure.status === "aceitou" || figure.status === "em_producao";
  const eventSoon = inPlay && days !== null && days >= 0 && days <= 14;
  const daysSinceUpdate = Math.round(
    (Date.now() - new Date(figure.updated_at).getTime()) / 86_400_000,
  );
  const staleContact = figure.status === "contactada" && daysSinceUpdate >= 7;

  return (
    <div className="flex flex-col h-full bg-cream-50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 sm:px-6 py-3 border-b border-cream-200 bg-surface shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/parcerias"
            className="inline-flex items-center gap-1 text-sm text-cocoa-700 hover:text-cocoa-900 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
          <WorkbenchNavigator
            navKey="public_figures"
            currentId={figure.id}
            basePath="/parcerias/figura"
          />
          <span className="text-cream-200">·</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r from-rose-100 to-amber-100 text-rose-700">
            <Star className="h-3 w-3" />
            {FIGURE_TYPE_LABELS[figure.figure_type]}
          </span>
          <h1 className="font-['TanMemories'] text-xl text-cocoa-900 truncate">
            {figure.name || "Sem nome"}
          </h1>
          {savingField && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-cocoa-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              A guardar…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-rose-700 border-rose-200 hover:bg-rose-50"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="h-3.5 w-3.5" />
            Arquivar
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {/* Alertas */}
        {(eventSoon || staleContact) && (
          <div className="px-4 pt-4 space-y-2">
            {eventSoon && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 flex items-center gap-2 text-sm text-rose-800">
                <CalendarHeart className="h-4 w-4 shrink-0" />
                Casamento em <strong>{days} dia{days !== 1 ? "s" : ""}</strong> ({formatDate(figure.event_date)}) — confirmar recolha das flores.
              </div>
            )}
            {staleContact && (
              <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 flex items-center gap-2 text-sm text-orange-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Contactada há <strong>{daysSinceUpdate} dias</strong> sem resposta — considera um follow-up.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
          {/* ── ESQUERDA: histórico + acções + contrapartida ── */}
          <aside className="lg:col-span-4 space-y-4">
            <InteractionsCard
              figureId={figure.id}
              interactions={figure.interactions}
              onChange={() => router.refresh()}
            />
            <DeliverablesCard
              figureId={figure.id}
              deliverables={figure.deliverables}
              onChange={() => router.refresh()}
            />
            <ActionsCard
              figureId={figure.id}
              pending={pendingActions}
              done={doneActions}
              onChange={() => router.refresh()}
            />
          </aside>

          {/* ── MEIO: campos editáveis ───────────────────── */}
          <main className="lg:col-span-5 space-y-4">
            {/* Identificação + estado */}
            <Card icon={Star} title="Identificação" color="border-l-rose-400">
              <Field label="Nome">
                <Input defaultValue={figure.name} onBlur={(e) => saveField("name", e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Tipo">
                  <Select value={figure.figure_type} onValueChange={(v) => saveField("figure_type", v as FigureType)}>
                    <SelectTrigger><SelectValue labels={FIGURE_TYPE_LABELS} /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FIGURE_TYPE_LABELS) as FigureType[]).map((k) => (
                        <SelectItem key={k} value={k}>{FIGURE_TYPE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Prioridade">
                  <Select value={figure.priority} onValueChange={(v) => saveField("priority", v as FigurePriority)}>
                    <SelectTrigger className={cn("border", FIGURE_PRIORITY_COLORS[figure.priority])}>
                      <SelectValue labels={FIGURE_PRIORITY_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FIGURE_PRIORITY_LABELS) as FigurePriority[]).map((k) => (
                        <SelectItem key={k} value={k}>{FIGURE_PRIORITY_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Estado">
                  <Select value={figure.status} onValueChange={(v) => saveField("status", v as FigureStatus)}>
                    <SelectTrigger className={cn("border", FIGURE_STATUS_COLORS[figure.status])}>
                      <SelectValue labels={FIGURE_STATUS_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {FIGURE_STATUS_ORDER.map((k) => (
                        <SelectItem key={k} value={k} className="my-0.5">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FIGURE_STATUS_COLORS[k])}>
                            {FIGURE_STATUS_LABELS[k]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Card>

            {/* Redes sociais */}
            <Card icon={AtSign} title="Redes sociais & audiência" color="border-l-violet-400">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Instagram (@)">
                  <Input
                    defaultValue={figure.instagram_handle ?? ""}
                    onBlur={(e) => saveField("instagram_handle", e.target.value.trim().replace(/^@/, "") || null)}
                    placeholder="sofiacosta"
                  />
                </Field>
                <Field label="TikTok (@)">
                  <Input
                    defaultValue={figure.tiktok_handle ?? ""}
                    onBlur={(e) => saveField("tiktok_handle", e.target.value.trim().replace(/^@/, "") || null)}
                    placeholder="sofiacosta"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nº de seguidores">
                  <Input
                    type="number"
                    defaultValue={figure.followers ?? ""}
                    onBlur={(e) => saveField("followers", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                  />
                </Field>
                <div />
              </div>
              <TagsField tags={figure.tags} onChange={(t) => saveField("tags", t)} />
              <Field label="Nota de fit (qualidade da audiência)">
                <Textarea
                  defaultValue={figure.fit_note ?? ""}
                  onBlur={(e) => saveField("fit_note", e.target.value || null)}
                  placeholder="Ex: audiência muito envolvida, nicho de casamentos no Norte…"
                  rows={2}
                />
              </Field>
            </Card>

            {/* Evento */}
            <Card icon={CalendarHeart} title="Evento" color="border-l-pink-400">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tipo de evento">
                  <Select value={figure.event_type} onValueChange={(v) => saveField("event_type", v as FigureEventType)}>
                    <SelectTrigger><SelectValue labels={FIGURE_EVENT_TYPE_LABELS} /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FIGURE_EVENT_TYPE_LABELS) as FigureEventType[]).map((k) => (
                        <SelectItem key={k} value={k}>{FIGURE_EVENT_TYPE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Data do evento">
                  <Input
                    type="date"
                    defaultValue={figure.event_date ?? ""}
                    onBlur={(e) => saveField("event_date", e.target.value || null)}
                  />
                </Field>
              </div>
            </Card>

            {/* Oferta */}
            <OfferCard figure={figure} costBySize={costBySize} onSave={saveField} />

            {/* Brief / kit */}
            <Card icon={Megaphone} title="Brief / kit" color="border-l-teal-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={figure.brief_sent}
                  onCheckedChange={(c) => saveField("brief_sent", c === true)}
                />
                <span className="text-sm text-cocoa-900">Brief enviado</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="@ a marcar">
                  <Input
                    defaultValue={figure.brief_mention ?? ""}
                    onBlur={(e) => saveField("brief_mention", e.target.value || null)}
                    placeholder="@floresabeirario"
                  />
                </Field>
                <Field label="# a usar">
                  <Input
                    defaultValue={figure.brief_hashtag ?? ""}
                    onBlur={(e) => saveField("brief_hashtag", e.target.value || null)}
                    placeholder="#floresabeirario"
                  />
                </Field>
              </div>
            </Card>

            {/* Contacto */}
            <Card icon={User} title="Contacto" color="border-l-sky-400">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Canal preferido">
                  <Select value={figure.contact_channel ?? "instagram_dm"} onValueChange={(v) => saveField("contact_channel", v as FigureContactChannel)}>
                    <SelectTrigger><SelectValue labels={FIGURE_CONTACT_CHANNEL_LABELS} /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FIGURE_CONTACT_CHANNEL_LABELS) as FigureContactChannel[]).map((k) => (
                        <SelectItem key={k} value={k}>{FIGURE_CONTACT_CHANNEL_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    defaultValue={figure.email ?? ""}
                    onBlur={(e) => saveField("email", e.target.value || null)}
                  />
                </Field>
              </div>
              <PhonesField phones={figure.phones} onChange={(p) => saveField("phones", p)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Agência / manager">
                  <Input
                    defaultValue={figure.agency_name ?? ""}
                    onBlur={(e) => saveField("agency_name", e.target.value || null)}
                    placeholder="Nome da agência"
                  />
                </Field>
                <Field label="Contacto da agência">
                  <Input
                    defaultValue={figure.agency_contact ?? ""}
                    onBlur={(e) => saveField("agency_contact", e.target.value || null)}
                    placeholder="Email / telefone"
                  />
                </Field>
              </div>
            </Card>

            {/* Notas */}
            <Card icon={StickyNote} title="Notas" color="border-l-slate-400">
              <Textarea
                defaultValue={figure.notes ?? ""}
                onBlur={(e) => saveField("notes", e.target.value || null)}
                placeholder="Notas internas sobre esta figura…"
                rows={4}
              />
            </Card>
          </main>

          {/* ── DIREITA: templates + screenshots + encomenda + meta ── */}
          <aside className="lg:col-span-3 space-y-4">
            <OutreachCard figure={figure} />
            <ScreenshotsField
              screenshots={figure.story_screenshots}
              onChange={(s) => saveField("story_screenshots", s)}
            />
            <LinkedOrderCard
              figure={figure}
              orders={orders}
              onSave={(orderId) => saveField("order_id", orderId)}
            />
            <Card icon={CalendarIcon} title="Metadata" color="border-l-indigo-400">
              <MetaRow label="Criado em" value={formatDateTime(figure.created_at)} />
              <MetaRow label="Última atualização" value={formatDateTime(figure.updated_at)} />
            </Card>
          </aside>
        </div>
      </div>

      {/* Diálogo de arquivar */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar figura?</AlertDialogTitle>
            <AlertDialogDescription>
              A figura fica oculta da lista mas pode ser recuperada pelo admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-700 hover:bg-rose-800"
              onClick={async () => {
                await archiveFigureAction(figure.id);
                startNavigationProgress();
                router.push("/parcerias");
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

function Card({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-cream-200 bg-surface border-l-4 overflow-hidden", color)}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <Icon className="h-3.5 w-3.5 text-cocoa-700" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">{title}</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-cocoa-700">{label}</Label>
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-cocoa-700">{label}</span>
      <span className="text-cocoa-900 font-medium">{value}</span>
    </div>
  );
}

// ── Tags / nicho ─────────────────────────────────────────────

function TagsField({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (!t || tags.includes(t)) { setDraft(""); return; }
    onChange([...tags, t]);
    setDraft("");
  }
  return (
    <Field label="Tags / nicho">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-cream-100 border border-cream-200 px-2 py-0.5 text-[11px] text-cocoa-900">
            <Tag className="h-2.5 w-2.5 text-cocoa-500" />
            {t}
            <button type="button" className="text-cocoa-500 hover:text-rose-600" onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Ex: moda, lifestyle…"
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Field>
  );
}

// ── Telemóveis editáveis (igual às Parcerias) ────────────────

function PhonesField({ phones, onChange }: { phones: FigurePhone[]; onChange: (phones: FigurePhone[]) => void }) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftNumber, setDraftNumber] = useState("");
  function add() {
    const num = draftNumber.trim();
    if (!num) return;
    onChange([...phones, { label: draftLabel.trim() || null, number: num }]);
    setDraftLabel("");
    setDraftNumber("");
  }
  return (
    <Field label="Telemóveis">
      <div className="space-y-1.5">
        {phones.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5 rounded-md border border-cream-200 bg-cream-50 px-2 py-1.5">
            <Phone className="h-3 w-3 text-cocoa-700 shrink-0" />
            <span className="flex-1 text-sm">
              {p.label && <span className="text-cocoa-700">{p.label}: </span>}
              {p.number}
            </span>
            <button type="button" className="text-cocoa-500 hover:text-rose-600 shrink-0" onClick={() => onChange(phones.filter((_, idx) => idx !== i))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="Etiqueta" className="h-8 text-xs w-28 shrink-0" />
          <Input
            value={draftNumber}
            onChange={(e) => setDraftNumber(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="+351 …"
            className="h-8 text-sm flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Field>
  );
}

// ── Oferta (com custo estimado por tamanho) ──────────────────

function OfferCard({
  figure,
  costBySize,
  onSave,
}: {
  figure: PublicFigure;
  costBySize: Record<string, number>;
  onSave: <K extends keyof PublicFigure>(key: K, value: PublicFigure[K]) => void;
}) {
  const suggested = figure.frame_size ? costBySize[figure.frame_size] : undefined;
  return (
    <Card icon={Gift} title="Oferta" color="border-l-emerald-400">
      <Field label="O que oferecemos">
        <Select
          value={figure.offer_type ?? "preservacao_gratis"}
          onValueChange={(v) => onSave("offer_type", v as FigureOfferType)}
        >
          <SelectTrigger><SelectValue labels={FIGURE_OFFER_TYPE_LABELS} /></SelectTrigger>
          <SelectContent>
            {(Object.keys(FIGURE_OFFER_TYPE_LABELS) as FigureOfferType[]).map((k) => (
              <SelectItem key={k} value={k}>{FIGURE_OFFER_TYPE_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tamanho de moldura">
          <Select
            value={figure.frame_size ?? "none"}
            onValueChange={(v) => onSave("frame_size", v === "none" ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {(Object.keys(FRAME_SIZE_LABELS) as FrameSize[]).map((k) => (
                <SelectItem key={k} value={k}>{FRAME_SIZE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Custo estimado (€)">
          <Input
            type="number"
            step="0.01"
            defaultValue={figure.estimated_cost ?? ""}
            onBlur={(e) => onSave("estimated_cost", e.target.value === "" ? null : parseFloat(e.target.value))}
            className="text-right"
          />
        </Field>
      </div>
      {suggested !== undefined && (
        <button
          type="button"
          onClick={() => onSave("estimated_cost", suggested)}
          className="text-[11px] text-emerald-700 hover:text-emerald-900 underline"
        >
          Custo de produção estimado: {formatEUR(suggested)} — usar
        </button>
      )}
      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <Checkbox
          checked={figure.is_courtesy}
          onCheckedChange={(c) => onSave("is_courtesy", c === true)}
        />
        <span className="text-sm text-cocoa-900">Cortesia (não conta na faturação)</span>
      </label>
    </Card>
  );
}

// ── Templates de abordagem ───────────────────────────────────

function OutreachCard({ figure }: { figure: PublicFigure }) {
  const [lang, setLang] = useState<TemplateLanguage>("pt");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const templates = OUTREACH_TEMPLATES.filter(
    (t) => t.language === lang && t.suggested_statuses.includes(figure.status),
  );
  const others = OUTREACH_TEMPLATES.filter(
    (t) => t.language === lang && !t.suggested_statuses.includes(figure.status),
  );

  async function copy(body: string, slug: string) {
    const text = fillOutreachTemplate(body, {
      nome: figure.name.split(" ")[0] || figure.name,
      arroba: figure.brief_mention,
      hashtag: figure.brief_hashtag,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1500);
    } catch {
      console.error("clipboard falhou");
    }
  }

  function renderItem(t: (typeof OUTREACH_TEMPLATES)[number], suggested: boolean) {
    return (
      <button
        key={t.slug}
        type="button"
        onClick={() => copy(t.body, t.slug)}
        className={cn(
          "w-full text-left rounded-lg border px-3 py-2 hover:bg-cream-50 transition-colors",
          suggested ? "border-rose-200 bg-rose-50/40" : "border-cream-200",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-cocoa-900">{t.name}</span>
          {copiedSlug === t.slug ? (
            <span className="text-[10px] text-emerald-700">copiado!</span>
          ) : (
            <Copy className="h-3 w-3 text-cocoa-500" />
          )}
        </div>
        <p className="mt-1 text-[11px] text-cocoa-700 line-clamp-2">
          {fillOutreachTemplate(t.body, { nome: figure.name.split(" ")[0] || figure.name, arroba: figure.brief_mention, hashtag: figure.brief_hashtag })}
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-rose-400 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-cocoa-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">Abordagem</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-cream-200 p-0.5">
          {(["pt", "en"] as TemplateLanguage[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
                lang === l ? "bg-btn-primary text-btn-primary-fg" : "text-cocoa-700",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 space-y-2">
        {templates.length === 0 && others.length === 0 ? (
          <p className="text-xs text-cocoa-500 text-center py-2">Sem templates nesta língua.</p>
        ) : (
          <>
            {templates.map((t) => renderItem(t, true))}
            {others.map((t) => renderItem(t, false))}
          </>
        )}
        <p className="text-[10px] text-cocoa-500 pt-1">Toca para copiar (já preenchido com o nome).</p>
      </div>
    </div>
  );
}

// ── Screenshots das stories (Drive) ──────────────────────────

function ScreenshotsField({ screenshots, onChange }: { screenshots: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (!t) return;
    onChange([...screenshots, t]);
    setDraft("");
  }
  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-amber-400 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <ImageIcon className="h-3.5 w-3.5 text-cocoa-700" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">Screenshots das stories</span>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[10px] text-cocoa-500">As stories expiram em 24h — guarda o screenshot na Drive e cola o link.</p>
        {screenshots.map((s, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-2.5 py-1.5">
            <LinkIcon className="h-3 w-3 text-cocoa-700 shrink-0" />
            <a href={s.startsWith("http") ? s : `https://${s}`} target="_blank" rel="noreferrer" className="flex-1 text-xs text-sky-700 hover:underline truncate">
              {s}
            </a>
            <button type="button" className="text-cocoa-500 hover:text-rose-600" onClick={() => onChange(screenshots.filter((_, idx) => idx !== i))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Link da Drive…"
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Encomenda de Preservação ligada ──────────────────────────

function LinkedOrderCard({
  figure,
  orders,
  onSave,
}: {
  figure: PublicFigure;
  orders: LinkableOrder[];
  onSave: (orderId: string | null) => void;
}) {
  const linked = orders.find((o) => o.id === figure.order_id) ?? null;
  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-emerald-400 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <Gift className="h-3.5 w-3.5 text-cocoa-700" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">Encomenda ligada</span>
      </div>
      <div className="p-3 space-y-2">
        {linked ? (
          <Link
            href={`/preservacao/${linked.order_id}`}
            className="flex items-start gap-2 p-2 rounded-lg border border-cream-200 hover:bg-cream-50 group"
          >
            <Gift className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-cocoa-900 truncate">{linked.client_name}</div>
              <div className="text-[10px] text-cocoa-700">
                {ORDER_STATUS_LABELS[linked.status as OrderStatus]}
                {linked.event_date && ` · ${formatDate(linked.event_date)}`}
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-cocoa-500 opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
          </Link>
        ) : (
          <p className="text-[11px] text-cocoa-500">Quando a figura aceitar, liga a encomenda de Preservação que vai produzir o quadro.</p>
        )}
        <Select
          value={figure.order_id ?? "none"}
          onValueChange={(v) => onSave(v === "none" ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Ligar a encomenda…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="none">Sem encomenda ligada</SelectItem>
            {orders.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.client_name} · {ORDER_STATUS_LABELS[o.status as OrderStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── Histórico de interações ──────────────────────────────────

function InteractionsCard({
  figureId,
  interactions,
  onChange,
}: {
  figureId: string;
  interactions: PublicFigure["interactions"];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<InteractionChannel>("whatsapp");
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!summary.trim()) return;
    setBusy(true);
    try {
      await addFigureInteractionAction(figureId, {
        date: new Date(date).toISOString(),
        channel,
        summary: summary.trim(),
      });
      setSummary("");
      setOpen(false);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-violet-400 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-cocoa-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">Histórico de interações</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" />
          {open ? "Cancelar" : "Registar"}
        </Button>
      </div>

      {open && (
        <div className="border-b border-cream-100 bg-violet-50/40 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Select value={channel} onValueChange={(v) => setChannel(v as InteractionChannel)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue labels={INTERACTION_CHANNEL_LABELS} /></SelectTrigger>
              <SelectContent>
                {(Object.keys(INTERACTION_CHANNEL_LABELS) as InteractionChannel[]).map((k) => (
                  <SelectItem key={k} value={k}>{INTERACTION_CHANNEL_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="O que foi falado…" rows={3} className="text-sm" />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={busy || !summary.trim()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Registar
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[360px] overflow-y-auto">
        {interactions.length === 0 ? (
          <div className="p-6 text-center text-xs text-cocoa-500">Sem interações registadas.</div>
        ) : (
          <ol className="divide-y divide-cream-100">
            {interactions.map((i) => (
              <li key={i.id} className="p-3 group hover:bg-cream-50">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", INTERACTION_CHANNEL_COLORS[i.channel])}>
                    {INTERACTION_CHANNEL_LABELS[i.channel]}
                  </span>
                  <span className="text-[10px] text-cocoa-500">{formatDateTime(i.date)}</span>
                  <button
                    onClick={async () => { await deleteFigureInteractionAction(figureId, i.id); onChange(); }}
                    className="opacity-0 group-hover:opacity-100 text-cocoa-500 hover:text-rose-600 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs text-cocoa-900 whitespace-pre-wrap">{i.summary}</p>
                {i.by && <p className="mt-1 text-[10px] text-cocoa-500">por {nameForEmail(i.by)}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── Contrapartida (entregáveis) ──────────────────────────────

function DeliverablesCard({
  figureId,
  deliverables,
  onChange,
}: {
  figureId: string;
  deliverables: PublicFigure["deliverables"];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = deliverables.filter((d) => !d.done).length;

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addFigureDeliverableAction(figureId, { title: title.trim(), due_date: dueDate || null });
      setTitle("");
      setDueDate("");
      setOpen(false);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-teal-400 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <Megaphone className="h-3.5 w-3.5 text-cocoa-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">Contrapartida</span>
          {pending > 0 && (
            <span className="rounded-full bg-teal-100 px-1.5 text-[10px] font-semibold text-teal-800">{pending}</span>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" />
          {open ? "Cancelar" : "Adicionar"}
        </Button>
      </div>

      {open && (
        <div className="border-b border-cream-100 bg-teal-50/40 p-3 space-y-2.5">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: 2 stories + 1 reel" className="text-sm" />
          <div className="flex items-center gap-2">
            <Label className="text-[10px] uppercase text-cocoa-700 shrink-0">Data prevista</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={busy || !title.trim()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      <div>
        {deliverables.length === 0 ? (
          <div className="p-6 text-center text-xs text-cocoa-500">Sem entregáveis combinados.</div>
        ) : (
          <ul className="divide-y divide-cream-100">
            {deliverables.map((d) => (
              <DeliverableItem key={d.id} figureId={figureId} deliverable={d} onChange={onChange} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeliverableItem({
  figureId,
  deliverable: d,
  onChange,
}: {
  figureId: string;
  deliverable: PublicFigure["deliverables"][number];
  onChange: () => void;
}) {
  const overdue = !d.done && d.due_date && new Date(d.due_date) < new Date();
  return (
    <li className="p-3 group hover:bg-cream-50">
      <div className="flex items-start gap-2">
        <button
          onClick={async () => { await updateFigureDeliverableAction(figureId, d.id, { done: !d.done }); onChange(); }}
          className="mt-0.5 shrink-0 text-cocoa-500 hover:text-emerald-600"
        >
          {d.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs", d.done ? "text-cocoa-500 line-through" : "text-cocoa-900")}>{d.title}</p>
          {d.due_date && (
            <span className={cn("mt-0.5 inline-flex items-center gap-0.5 text-[10px]", overdue ? "text-rose-700 font-semibold" : "text-cocoa-700")}>
              <CalendarIcon className="h-2.5 w-2.5" />
              {formatDate(d.due_date)}{overdue && " ⚠"}
            </span>
          )}
        </div>
        <button
          onClick={async () => { await deleteFigureDeliverableAction(figureId, d.id); onChange(); }}
          className="opacity-0 group-hover:opacity-100 text-cocoa-500 hover:text-rose-600 transition-opacity shrink-0"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {d.done && (
        <div className="mt-1.5 pl-6">
          <Input
            defaultValue={d.published_url ?? ""}
            onBlur={async (e) => {
              const v = e.target.value.trim() || null;
              if (v !== (d.published_url ?? null)) {
                await updateFigureDeliverableAction(figureId, d.id, { published_url: v });
                onChange();
              }
            }}
            placeholder="Link da publicação…"
            className="h-7 text-xs"
          />
        </div>
      )}
    </li>
  );
}

// ── Acções ───────────────────────────────────────────────────

function ActionsCard({
  figureId,
  pending,
  done,
  onChange,
}: {
  figureId: string;
  pending: PublicFigure["actions"];
  done: PublicFigure["actions"];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string>("none");
  const [dueDate, setDueDate] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addFigureActionItemAction(figureId, {
        title: title.trim(),
        assignee_email: assignee === "none" ? null : assignee,
        due_date: dueDate || null,
      });
      setTitle("");
      setAssignee("none");
      setDueDate("");
      setOpen(false);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-amber-400 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-cocoa-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">Acções</span>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">{pending.length}</span>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" />
          {open ? "Cancelar" : "Adicionar"}
        </Button>
      </div>

      {open && (
        <div className="border-b border-cream-100 bg-amber-50/40 p-3 space-y-2.5">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que é preciso fazer?" className="text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={assignee} onValueChange={(v) => setAssignee(v ?? "none")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Atribuir a..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém</SelectItem>
                {ASSIGNEES.map((a) => (
                  <SelectItem key={a.email} value={a.email}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={busy || !title.trim()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      <div>
        {pending.length === 0 && done.length === 0 ? (
          <div className="p-6 text-center text-xs text-cocoa-500">Sem acções pendentes.</div>
        ) : (
          <>
            <ul className="divide-y divide-cream-100">
              {pending.map((a) => (
                <ActionItem key={a.id} figureId={figureId} action={a} onChange={onChange} />
              ))}
            </ul>
            {done.length > 0 && (
              <>
                <button
                  onClick={() => setShowDone((s) => !s)}
                  className="w-full px-4 py-2 text-left text-[11px] text-cocoa-700 hover:bg-cream-50 border-t border-cream-100"
                >
                  {showDone ? "Esconder" : "Mostrar"} {done.length} feita{done.length !== 1 ? "s" : ""}
                </button>
                {showDone && (
                  <ul className="divide-y divide-cream-100">
                    {done.map((a) => (
                      <ActionItem key={a.id} figureId={figureId} action={a} onChange={onChange} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ActionItem({
  figureId,
  action,
  onChange,
}: {
  figureId: string;
  action: PublicFigure["actions"][number];
  onChange: () => void;
}) {
  const overdue = !action.done && action.due_date && new Date(action.due_date) < new Date();
  return (
    <li className="p-3 group hover:bg-cream-50 flex items-start gap-2">
      <button
        onClick={async () => { await toggleFigureActionItemAction(figureId, action.id, !action.done); onChange(); }}
        className="mt-0.5 shrink-0 text-cocoa-500 hover:text-emerald-600"
      >
        {action.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs", action.done ? "text-cocoa-500 line-through" : "text-cocoa-900")}>{action.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-cocoa-700">
          {action.assignee_email && (
            <span className="inline-flex items-center gap-0.5">
              <User className="h-2.5 w-2.5" />
              {nameForEmail(action.assignee_email)}
            </span>
          )}
          {action.due_date && (
            <span className={cn("inline-flex items-center gap-0.5", overdue ? "text-rose-700 font-semibold" : "")}>
              <CalendarIcon className="h-2.5 w-2.5" />
              {formatDate(action.due_date)}{overdue && " ⚠"}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={async () => { await deleteFigureActionItemAction(figureId, action.id); onChange(); }}
        className="opacity-0 group-hover:opacity-100 text-cocoa-500 hover:text-rose-600 transition-opacity shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}
