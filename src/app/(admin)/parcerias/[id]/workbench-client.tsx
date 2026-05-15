"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/navigation-progress";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon,
  StickyNote,
  Loader2,
  Plus,
  X,
  Trash2,
  ListChecks,
  Sparkles,
  MessageSquare,
  Save,
  Archive,
  ExternalLink,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  User,
  Users,
  Gift,
  Flower2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
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
import {
  type Partner,
  type PartnerCategory,
  type PartnerStatus,
  type PartnerAcceptsCommission,
  type PartnerPhone,
  type InteractionChannel,
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORY_COLORS,
  PARTNER_STATUS_LABELS,
  PARTNER_STATUS_COLORS,
  PARTNER_STATUS_ORDER,
  PARTNER_ACCEPTS_COMMISSION_LABELS,
  PARTNER_ACCEPTS_COMMISSION_COLORS,
  INTERACTION_CHANNEL_LABELS,
  INTERACTION_CHANNEL_COLORS,
} from "@/types/partner";
import {
  STATUS_LABELS as ORDER_STATUS_LABELS,
  type OrderStatus,
  type Order,
} from "@/types/database";
import { STATUS_DOT_COLORS as ORDER_STATUS_DOTS } from "@/app/(admin)/preservacao/_styles";
import type { Voucher } from "@/types/voucher";
import {
  updatePartnerAction,
  archivePartnerAction,
  addInteractionAction,
  deleteInteractionAction,
  addActionAction,
  toggleActionAction,
  deleteActionAction,
} from "../actions";

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

function formatEuro(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

// ── Tipos ────────────────────────────────────────────────────

type RecommendedOrder = Pick<Order, "id" | "order_id" | "client_name" | "event_date" | "status" | "budget" | "created_at">;
type RecommendedVoucher = Pick<Voucher, "id" | "code" | "sender_name" | "recipient_name" | "amount" | "payment_status" | "usage_status" | "created_at">;

interface Props {
  partner: Partner;
  recommendedOrders: RecommendedOrder[];
  recommendedVouchers: RecommendedVoucher[];
}

// ── Componente principal ─────────────────────────────────────

export default function PartnerWorkbenchClient({
  partner: initial,
  recommendedOrders,
  recommendedVouchers,
}: Props) {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner>(initial);
  const [isPending, startTransition] = useTransition();
  const [savingField, setSavingField] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Sincroniza quando a server prop muda (ex: depois do router.refresh).
  // Padrão "store info from previous renders" — evita useEffect+setState
  // ([[feedback-react-set-state-in-effect]]).
  const [trackedUpdatedAt, setTrackedUpdatedAt] = useState(initial.updated_at);
  if (initial.updated_at !== trackedUpdatedAt) {
    setTrackedUpdatedAt(initial.updated_at);
    setPartner(initial);
  }

  // Auto-save um campo no blur
  function saveField<K extends keyof Partner>(key: K, value: Partner[K]) {
    if (partner[key] === value) return;
    setSavingField(key as string);
    setPartner((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      try {
        await updatePartnerAction(partner.id, { [key]: value } as Partial<Partner>);
        router.refresh();
      } catch (err) {
        console.error(err);
      } finally {
        setSavingField(null);
      }
    });
  }

  const pendingActions = partner.actions.filter((a) => !a.done);
  const doneActions = partner.actions.filter((a) => a.done);

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
            navKey="partners"
            currentId={partner.id}
            basePath="/parcerias"
          />
          <span className="text-cream-200">·</span>
          <span className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r",
            PARTNER_CATEGORY_COLORS[partner.category],
          )}>
            {PARTNER_CATEGORY_LABELS[partner.category]}
          </span>
          <h1 className="font-['TanMemories'] text-xl text-cocoa-900 truncate">
            {partner.name || "Sem nome"}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
          {/* ── ESQUERDA: histórico + acções ─────────────── */}
          <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-4 self-start">
            <InteractionsCard
              partnerId={partner.id}
              interactions={partner.interactions}
              onChange={() => router.refresh()}
            />
            <ActionsCard
              partnerId={partner.id}
              pending={pendingActions}
              done={doneActions}
              onChange={() => router.refresh()}
            />
          </aside>

          {/* ── MEIO: campos editáveis ───────────────────── */}
          <main className="lg:col-span-5 space-y-4">
            {/* Identificação + estado */}
            <Card icon={Building2} title="Identificação" color="border-l-rose-400">
              <Field label="Nome">
                <Input
                  defaultValue={partner.name}
                  onBlur={(e) => saveField("name", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Categoria">
                  <Select
                    value={partner.category}
                    onValueChange={(v) => saveField("category", v as PartnerCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue labels={PARTNER_CATEGORY_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PARTNER_CATEGORY_LABELS) as PartnerCategory[]).map((k) => (
                        <SelectItem key={k} value={k}>{PARTNER_CATEGORY_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Estado">
                  <Select
                    value={partner.status}
                    onValueChange={(v) => saveField("status", v as PartnerStatus)}
                  >
                    <SelectTrigger
                      className={cn("border", PARTNER_STATUS_COLORS[partner.status])}
                    >
                      <SelectValue labels={PARTNER_STATUS_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTNER_STATUS_ORDER.map((k) => (
                        <SelectItem key={k} value={k} className="my-0.5">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                            PARTNER_STATUS_COLORS[k]
                          )}>
                            {PARTNER_STATUS_LABELS[k]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Card>

            {/* Contacto */}
            <Card icon={User} title="Contacto" color="border-l-sky-400">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Pessoa responsável">
                  <Input
                    defaultValue={partner.contact_person ?? ""}
                    onBlur={(e) => saveField("contact_person", e.target.value || null)}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    defaultValue={partner.email ?? ""}
                    onBlur={(e) => saveField("email", e.target.value || null)}
                  />
                </Field>
              </div>

              <PhonesField
                phones={partner.phones}
                onChange={(phones) => saveField("phones", phones)}
              />

              <LinksField
                links={partner.links}
                onChange={(links) => saveField("links", links)}
              />
            </Card>

            {/* Localização — agora com autocomplete (Nominatim/OSM) */}
            <LocationCard
              partner={partner}
              onChange={async (loc) => {
                setSavingField("location");
                setPartner((p) => ({ ...p, ...loc }));
                try {
                  await updatePartnerAction(partner.id, loc);
                  router.refresh();
                } catch (err) {
                  console.error(err);
                } finally {
                  setSavingField(null);
                }
              }}
            />


            {/* Comissão */}
            <Card icon={Sparkles} title="Comissão" color="border-l-amber-400">
              <Field label="Aceita 10% de comissão?">
                <Select
                  value={partner.accepts_commission ?? "a_confirmar"}
                  onValueChange={(v) => saveField("accepts_commission", v as PartnerAcceptsCommission)}
                >
                  <SelectTrigger
                    className={cn(
                      "border",
                      PARTNER_ACCEPTS_COMMISSION_COLORS[partner.accepts_commission ?? "a_confirmar"],
                    )}
                  >
                    <SelectValue labels={PARTNER_ACCEPTS_COMMISSION_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PARTNER_ACCEPTS_COMMISSION_LABELS) as PartnerAcceptsCommission[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                          PARTNER_ACCEPTS_COMMISSION_COLORS[k]
                        )}>
                          {PARTNER_ACCEPTS_COMMISSION_LABELS[k]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Card>

            {/* Notas */}
            <Card icon={StickyNote} title="Notas" color="border-l-slate-400">
              <Textarea
                defaultValue={partner.notes ?? ""}
                onBlur={(e) => saveField("notes", e.target.value || null)}
                placeholder="Notas internas sobre este parceiro…"
                rows={5}
              />
            </Card>
          </main>

          {/* ── DIREITA: clientes recomendados + metadata ── */}
          <aside className="lg:col-span-3 space-y-4">
            <RecommendedClients
              orders={recommendedOrders}
              vouchers={recommendedVouchers}
            />

            <Card icon={CalendarIcon} title="Metadata" color="border-l-indigo-400">
              <MetaRow label="Criado em" value={formatDateTime(partner.created_at)} />
              <MetaRow label="Última atualização" value={formatDateTime(partner.updated_at)} />
            </Card>
          </aside>
        </div>
      </div>

      {/* Diálogo de arquivar */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar parceiro?</AlertDialogTitle>
            <AlertDialogDescription>
              O parceiro fica oculto da lista mas pode ser recuperado pelo admin.
              As ligações às encomendas e vales não são apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-700 hover:bg-rose-800"
              onClick={async () => {
                await archivePartnerAction(partner.id);
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

// ── Card genérico ────────────────────────────────────────────

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
        <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">
          {title}
        </span>
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

// ── Telemóveis editáveis ─────────────────────────────────────

function PhonesField({
  phones,
  onChange,
}: {
  phones: PartnerPhone[];
  onChange: (phones: PartnerPhone[]) => void;
}) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftNumber, setDraftNumber] = useState("");
  function add() {
    const num = draftNumber.trim();
    if (!num) return;
    const lbl = draftLabel.trim();
    onChange([...phones, { label: lbl || null, number: num }]);
    setDraftLabel("");
    setDraftNumber("");
  }
  function remove(i: number) {
    onChange(phones.filter((_, idx) => idx !== i));
  }
  function updateLabel(i: number, value: string) {
    onChange(
      phones.map((p, idx) =>
        idx === i ? { ...p, label: value.trim() || null } : p
      )
    );
  }
  function updateNumber(i: number, value: string) {
    onChange(
      phones.map((p, idx) => (idx === i ? { ...p, number: value } : p))
    );
  }
  return (
    <Field label="Telemóveis">
      <div className="space-y-1.5">
        {phones.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-md border border-cream-200 bg-cream-50 px-2 py-1.5"
          >
            <Phone className="h-3 w-3 text-cocoa-700 shrink-0" />
            <Input
              defaultValue={p.label ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if ((p.label ?? "") !== v) updateLabel(i, v);
              }}
              placeholder="Etiqueta"
              className="h-7 text-xs w-28 shrink-0"
            />
            <Input
              defaultValue={p.number}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (p.number !== v && v) updateNumber(i, v);
              }}
              placeholder="Número"
              className="h-7 text-sm flex-1"
            />
            <button
              type="button"
              className="text-cocoa-500 hover:text-rose-600 shrink-0"
              onClick={() => remove(i)}
              aria-label="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <Input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="Etiqueta (opcional)"
            className="h-8 text-xs w-32 shrink-0"
          />
          <Input
            value={draftNumber}
            onChange={(e) => setDraftNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
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

// ── Links editáveis ──────────────────────────────────────────

function LinksField({
  links,
  onChange,
}: {
  links: string[];
  onChange: (links: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (!t) return;
    onChange([...links, t]);
    setDraft("");
  }
  function remove(i: number) {
    onChange(links.filter((_, idx) => idx !== i));
  }
  return (
    <Field label="Links">
      <div className="space-y-1.5">
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-cream-200 bg-cream-50 px-2.5 py-1.5">
            <LinkIcon className="h-3 w-3 text-cocoa-700 shrink-0" />
            <a
              href={l.startsWith("http") ? l : `https://${l}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-sm text-sky-700 hover:underline truncate"
            >
              {l}
            </a>
            <button
              type="button"
              className="text-cocoa-500 hover:text-rose-600"
              onClick={() => remove(i)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="https://…"
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Field>
  );
}

// ── Histórico de interações ──────────────────────────────────

function InteractionsCard({
  partnerId,
  interactions,
  onChange,
}: {
  partnerId: string;
  interactions: Partner["interactions"];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<InteractionChannel>("email");
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!summary.trim()) return;
    setBusy(true);
    try {
      await addInteractionAction(partnerId, {
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

  async function remove(id: string) {
    await deleteInteractionAction(partnerId, id);
    onChange();
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-violet-400 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-cocoa-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">
            Histórico de interações
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus className="h-3.5 w-3.5" />
          {open ? "Cancelar" : "Registar"}
        </Button>
      </div>

      {open && (
        <div className="border-b border-cream-100 bg-violet-50/40 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Select value={channel} onValueChange={(v) => setChannel(v as InteractionChannel)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue labels={INTERACTION_CHANNEL_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INTERACTION_CHANNEL_LABELS) as InteractionChannel[]).map((k) => (
                  <SelectItem key={k} value={k}>{INTERACTION_CHANNEL_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="O que foi falado…"
            rows={3}
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={busy || !summary.trim()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Registar
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[420px] overflow-y-auto">
        {interactions.length === 0 ? (
          <div className="p-6 text-center text-xs text-cocoa-500">
            Sem interações registadas.
          </div>
        ) : (
          <ol className="divide-y divide-cream-100">
            {interactions.map((i) => (
              <li key={i.id} className="p-3 group hover:bg-cream-50">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
                    INTERACTION_CHANNEL_COLORS[i.channel],
                  )}>
                    {INTERACTION_CHANNEL_LABELS[i.channel]}
                  </span>
                  <span className="text-[10px] text-cocoa-500">{formatDateTime(i.date)}</span>
                  <button
                    onClick={() => remove(i.id)}
                    className="opacity-0 group-hover:opacity-100 text-cocoa-500 hover:text-rose-600 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs text-cocoa-900 whitespace-pre-wrap">{i.summary}</p>
                {i.by && (
                  <p className="mt-1 text-[10px] text-cocoa-500">por {nameForEmail(i.by)}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── Acções pendentes ─────────────────────────────────────────

function ActionsCard({
  partnerId,
  pending,
  done,
  onChange,
}: {
  partnerId: string;
  pending: Partner["actions"];
  done: Partner["actions"];
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
      await addActionAction(partnerId, {
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

  async function toggle(id: string, isDone: boolean) {
    await toggleActionAction(partnerId, id, isDone);
    onChange();
  }

  async function remove(id: string) {
    await deleteActionAction(partnerId, id);
    onChange();
  }

  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-amber-400 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-cocoa-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">
            Acções
          </span>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
              {pending.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus className="h-3.5 w-3.5" />
          {open ? "Cancelar" : "Adicionar"}
        </Button>
      </div>

      {open && (
        <div className="border-b border-cream-100 bg-amber-50/40 p-3 space-y-2.5">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="O que é preciso fazer?"
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={assignee} onValueChange={(v) => setAssignee(v ?? "none")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Atribuir a..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém</SelectItem>
                {ASSIGNEES.map((a) => (
                  <SelectItem key={a.email} value={a.email}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-xs"
            />
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
          <div className="p-6 text-center text-xs text-cocoa-500">
            Sem acções pendentes.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-cream-100">
              {pending.map((a) => (
                <ActionItem
                  key={a.id}
                  action={a}
                  onToggle={(d) => toggle(a.id, d)}
                  onDelete={() => remove(a.id)}
                />
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
                      <ActionItem
                        key={a.id}
                        action={a}
                        onToggle={(d) => toggle(a.id, d)}
                        onDelete={() => remove(a.id)}
                      />
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
  action,
  onToggle,
  onDelete,
}: {
  action: Partner["actions"][number];
  onToggle: (done: boolean) => void;
  onDelete: () => void;
}) {
  const overdue = !action.done && action.due_date && new Date(action.due_date) < new Date();
  return (
    <li className="p-3 group hover:bg-cream-50 flex items-start gap-2">
      <button
        onClick={() => onToggle(!action.done)}
        className="mt-0.5 shrink-0 text-cocoa-500 hover:text-emerald-600"
      >
        {action.done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs",
          action.done ? "text-cocoa-500 line-through" : "text-cocoa-900"
        )}>
          {action.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-cocoa-700">
          {action.assignee_email && (
            <span className="inline-flex items-center gap-0.5">
              <User className="h-2.5 w-2.5" />
              {nameForEmail(action.assignee_email)}
            </span>
          )}
          {action.due_date && (
            <span className={cn(
              "inline-flex items-center gap-0.5",
              overdue ? "text-rose-700 font-semibold" : ""
            )}>
              <CalendarIcon className="h-2.5 w-2.5" />
              {formatDate(action.due_date)}
              {overdue && " ⚠"}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-cocoa-500 hover:text-rose-600 transition-opacity shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}

// ── Clientes recomendados ────────────────────────────────────

function RecommendedClients({
  orders,
  vouchers,
}: {
  orders: RecommendedOrder[];
  vouchers: RecommendedVoucher[];
}) {
  const total = orders.length + vouchers.length;
  const totalRevenue =
    orders.reduce((s, o) => s + (o.budget ?? 0), 0) +
    vouchers
      .filter((v) => v.payment_status === "100_pago")
      .reduce((s, v) => s + (v.amount ?? 0), 0);

  return (
    <div className="rounded-xl border border-cream-200 bg-surface border-l-4 border-l-emerald-400 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <Users className="h-3.5 w-3.5 text-cocoa-700" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-700">
          Clientes recomendados
        </span>
      </div>

      {total === 0 ? (
        <div className="p-4 text-center text-xs text-cocoa-500">
          Ainda nenhum cliente recomendado.
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-cream-100 bg-emerald-50/30">
            <div className="text-[11px] text-cocoa-700 uppercase tracking-wider">Total</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-cocoa-900">{total}</span>
              <span className="text-[11px] text-cocoa-700">·</span>
              <span className="text-sm font-medium text-emerald-700">{formatEuro(totalRevenue)}</span>
            </div>
          </div>

          {orders.length > 0 && (
            <div className="border-b border-cream-100">
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-cocoa-700 bg-cream-50">
                Encomendas ({orders.length})
              </div>
              <ul className="divide-y divide-cream-100">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/preservacao/${o.order_id}`}
                      className="flex items-start gap-2 p-3 hover:bg-cream-50 group"
                    >
                      <span className={cn(
                        "h-2 w-2 mt-1 rounded-full shrink-0",
                        ORDER_STATUS_DOTS[o.status as OrderStatus],
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-cocoa-900 truncate">
                          {o.client_name}
                        </div>
                        <div className="text-[10px] text-cocoa-700">
                          {ORDER_STATUS_LABELS[o.status as OrderStatus]}
                          {o.event_date && ` · ${formatDate(o.event_date)}`}
                        </div>
                        {o.budget && (
                          <div className="text-[10px] text-emerald-700 font-medium">
                            {formatEuro(o.budget)}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="h-3 w-3 text-cocoa-500 opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vouchers.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-cocoa-700 bg-cream-50">
                Vales ({vouchers.length})
              </div>
              <ul className="divide-y divide-cream-100">
                {vouchers.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/vale-presente/${v.code}`}
                      className="flex items-start gap-2 p-3 hover:bg-cream-50 group"
                    >
                      <Gift className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-cocoa-900 truncate">
                          {v.sender_name} → {v.recipient_name}
                        </div>
                        <div className="text-[10px] text-cocoa-700">
                          {v.payment_status === "100_pago" ? "Pago" : "Por pagar"}
                          {" · "}
                          {v.usage_status === "preservacao_agendada" ? "Agendado" : "Por usar"}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium">
                          {formatEuro(v.amount)}
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 text-cocoa-500 opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Card "Localização" com autocomplete de morada ─────────────
// Usa o Nominatim (OpenStreetMap) para procurar moradas e devolver
// label + coordenadas. Permite ainda edição manual de lat/long no
// fundo, mas escondida atrás de um toggle.

function LocationCard({
  partner,
  onChange,
}: {
  partner: Partner;
  onChange: (loc: { location_label: string | null; latitude: number | null; longitude: number | null }) => void | Promise<void>;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <Card icon={MapPin} title="Localização" color="border-l-emerald-400">
      <Field label="Procurar morada">
        <AddressAutocomplete
          value={partner.location_label}
          onSelect={(sel) =>
            onChange({
              location_label: sel.label,
              latitude: sel.latitude,
              longitude: sel.longitude,
            })
          }
          onClear={() =>
            onChange({
              location_label: null,
              latitude: null,
              longitude: null,
            })
          }
          placeholder="Ex.: Rua Mouzinho, Porto"
        />
      </Field>

      {(partner.latitude !== null || partner.longitude !== null) && (
        <p className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span className="tabular-nums">
            {partner.latitude?.toFixed(4)}, {partner.longitude?.toFixed(4)}
          </span>
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[11px] text-cocoa-700 hover:text-cocoa-900 underline"
      >
        {showAdvanced ? "Esconder edição manual" : "Editar coordenadas manualmente"}
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Field label="Latitude">
            <Input
              type="number"
              step="0.000001"
              defaultValue={partner.latitude ?? ""}
              onBlur={(e) =>
                onChange({
                  location_label: partner.location_label,
                  latitude: e.target.value === "" ? null : parseFloat(e.target.value),
                  longitude: partner.longitude,
                })
              }
            />
          </Field>
          <Field label="Longitude">
            <Input
              type="number"
              step="0.000001"
              defaultValue={partner.longitude ?? ""}
              onBlur={(e) =>
                onChange({
                  location_label: partner.location_label,
                  latitude: partner.latitude,
                  longitude: e.target.value === "" ? null : parseFloat(e.target.value),
                })
              }
            />
          </Field>
        </div>
      )}
    </Card>
  );
}

