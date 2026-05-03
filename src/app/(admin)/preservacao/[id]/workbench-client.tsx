"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Loader2,
  Check,
  ExternalLink,
  Copy,
  AlertTriangle,
  Image as ImageIcon,
  FolderOpen,
  Globe,
  Mail,
  MessageCircle,
  Sparkles,
  Plus,
  X,
  Link2,
  Paperclip,
  Heart,
  Receipt,
  User,
  Calendar,
  Flower2,
  Layers,
  Boxes,
  StickyNote,
  Wallet,
  Handshake,
  Package,
  Ticket,
  Pencil,
} from "lucide-react";
import { updateOrderAction } from "../actions";
import type {
  Order,
  OrderUpdate,
  ExtrasInFrame,
  InspirationItem,
  PaymentStatus,
} from "@/types/database";
import {
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
} from "@/types/database";
import { format, parseISO, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";

// ── Helpers ────────────────────────────────────────────────────

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  try { return format(parseISO(val), "yyyy-MM-dd"); } catch { return ""; }
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  try { return format(parseISO(val), "dd MMM yyyy", { locale: pt }); } catch { return "—"; }
}

const STATUS_COLORS: Record<string, string> = {
  entrega_flores_agendar: "bg-amber-100 text-amber-800 border-amber-300",
  entrega_agendada:       "bg-blue-100 text-blue-800 border-blue-300",
  flores_enviadas:        "bg-blue-100 text-blue-800 border-blue-300",
  flores_recebidas:       "bg-blue-100 text-blue-800 border-blue-300",
  flores_na_prensa:       "bg-purple-100 text-purple-800 border-purple-300",
  reconstrucao_botanica:  "bg-purple-100 text-purple-800 border-purple-300",
  a_compor_design:        "bg-purple-100 text-purple-800 border-purple-300",
  a_aguardar_aprovacao:   "bg-purple-100 text-purple-800 border-purple-300",
  a_ser_emoldurado:       "bg-orange-100 text-orange-800 border-orange-300",
  emoldurado:             "bg-orange-100 text-orange-800 border-orange-300",
  a_ser_fotografado:      "bg-orange-100 text-orange-800 border-orange-300",
  quadro_pronto:          "bg-orange-100 text-orange-800 border-orange-300",
  quadro_enviado:         "bg-orange-100 text-orange-800 border-orange-300",
  quadro_recebido:        "bg-green-100 text-green-800 border-green-300",
  cancelado:              "bg-gray-100 text-gray-500 border-gray-300",
};

const PAYMENT_COLORS: Record<string, string> = {
  "100_pago":      "text-green-700 bg-green-50 border-green-200",
  "70_pago":       "text-yellow-700 bg-yellow-50 border-yellow-200",
  "30_pago":       "text-yellow-700 bg-yellow-50 border-yellow-200",
  "30_por_pagar":  "text-red-600 bg-red-50 border-red-200",
  "100_por_pagar": "text-red-700 bg-red-50 border-red-200",
};

// Paleta de acentos por secção — discreta, só na borda esquerda + cor do ícone
type Accent =
  | "rose" | "amber" | "emerald" | "orange" | "indigo"
  | "pink" | "slate" | "green" | "sky" | "purple"
  | "yellow" | "violet" | "blue";

const ACCENTS: Record<Accent, { border: string; icon: string; bgSoft: string }> = {
  rose:    { border: "border-l-rose-300",    icon: "text-rose-500",    bgSoft: "bg-rose-50/50" },
  amber:   { border: "border-l-amber-300",   icon: "text-amber-500",   bgSoft: "bg-amber-50/50" },
  emerald: { border: "border-l-emerald-300", icon: "text-emerald-500", bgSoft: "bg-emerald-50/50" },
  orange:  { border: "border-l-orange-300",  icon: "text-orange-500",  bgSoft: "bg-orange-50/50" },
  indigo:  { border: "border-l-indigo-300",  icon: "text-indigo-500",  bgSoft: "bg-indigo-50/50" },
  pink:    { border: "border-l-pink-300",    icon: "text-pink-500",    bgSoft: "bg-pink-50/50" },
  slate:   { border: "border-l-slate-300",   icon: "text-slate-500",   bgSoft: "bg-slate-50/50" },
  green:   { border: "border-l-green-300",   icon: "text-green-600",   bgSoft: "bg-green-50/50" },
  sky:     { border: "border-l-sky-300",     icon: "text-sky-500",     bgSoft: "bg-sky-50/50" },
  purple:  { border: "border-l-purple-300",  icon: "text-purple-500",  bgSoft: "bg-purple-50/50" },
  yellow:  { border: "border-l-yellow-400",  icon: "text-yellow-600",  bgSoft: "bg-yellow-50/50" },
  violet:  { border: "border-l-violet-300",  icon: "text-violet-500",  bgSoft: "bg-violet-50/50" },
  blue:    { border: "border-l-blue-300",    icon: "text-blue-500",    bgSoft: "bg-blue-50/50" },
};

const EXTRA_OPTIONS = [
  "Convite",
  "Foto",
  "Velas",
  "Folhas e ramos",
  "Fitas",
  "Tecidos",
  "Renda",
  "Acessório pessoal",
];

// ── Componentes de layout ──────────────────────────────────────

function Card({
  title,
  icon,
  accent,
  action,
  children,
  badge,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: Accent;
  action?: React.ReactNode;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const a = accent ? ACCENTS[accent] : null;
  return (
    <div className={`rounded-2xl border border-[#E8E0D5] bg-white overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)] ${a ? `border-l-4 ${a.border}` : ""}`}>
      <div className={`flex items-center justify-between gap-2 px-5 py-3 border-b border-[#F0EAE0] ${a ? a.bgSoft : ""}`}>
        <div className="flex items-center gap-2">
          {icon && <span className={a?.icon ?? "text-[#B8A99A]"}>{icon}</span>}
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B7355]">{title}</p>
          {badge}
        </div>
        {action}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children, span2, hint }: { label: string; children: React.ReactNode; span2?: boolean; hint?: string }) {
  return (
    <div className={`space-y-1.5 ${span2 ? "col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-[#8B7355]">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-[#B8A99A]">{hint}</p>}
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="border-[#C4A882] data-[state=checked]:bg-[#3D2B1F] data-[state=checked]:border-[#3D2B1F]"
      />
      <span className="text-sm text-[#3D2B1F]">{label}</span>
    </label>
  );
}

function PlaceholderBox({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E0D5C2] bg-[#FAF8F5] px-4 py-5 text-center">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#C4A882] border border-[#E8E0D5]">
        {icon}
      </div>
      <p className="text-sm font-medium text-[#3D2B1F]">{title}</p>
      <p className="mt-0.5 text-xs text-[#8B7355] leading-relaxed max-w-md mx-auto">{description}</p>
    </div>
  );
}

const inp = "h-9 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg";
const sel = "h-9 text-sm border-[#E8E0D5] bg-[#FAF8F5] text-[#3D2B1F] rounded-lg";

// ── Componente principal ───────────────────────────────────────

export default function WorkbenchClient({ order }: { order: Order }) {
  const router = useRouter();
  const [local, setLocal] = useState<Order>(order);
  const pendingRef = useRef<OrderUpdate>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);

  // Diálogo de mudança de pagamento (alerta para comprovativo + NIF)
  const [paymentDialog, setPaymentDialog] = useState<null | { newStatus: PaymentStatus }>(null);
  const [dialogNeedsInvoice, setDialogNeedsInvoice] = useState(false);
  const [dialogNif, setDialogNif] = useState("");

  // Diálogo de "Quadro recebido" — pede data de entrega
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryDateDraft, setDeliveryDateDraft] = useState("");

  // Edição rápida do URL da pasta Drive (popover no hero)
  const [driveUrlDraft, setDriveUrlDraft] = useState("");
  const [drivePopoverOpen, setDrivePopoverOpen] = useState(false);

  useEffect(() => {
    setLocal(order);
    pendingRef.current = {};
  }, [order]);

  const flush = useCallback(async () => {
    const updates = { ...pendingRef.current };
    if (Object.keys(updates).length === 0) return;
    pendingRef.current = {};
    clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      const updated = await updateOrderAction(order.id, updates);
      setLocal(updated);
      setSaveState("saved");
      router.refresh();
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("idle");
    }
  }, [order.id, router]);

  function update<K extends keyof OrderUpdate>(key: K, value: OrderUpdate[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    pendingRef.current = { ...pendingRef.current, [key]: value };
    setSaveState("idle");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 900);
  }

  function onStatusChange(newStatus: Order["status"]) {
    if (newStatus === local.status) return;
    if (newStatus === "quadro_recebido" && !local.frame_delivery_date) {
      setDeliveryDateDraft(toDateInput(new Date().toISOString()));
      setDeliveryDialogOpen(true);
    }
    update("status", newStatus);
  }

  function confirmDeliveryDialog() {
    const date = deliveryDateDraft.trim();
    if (date) update("frame_delivery_date", date);
    setDeliveryDialogOpen(false);
  }

  function onPaymentStatusChange(newStatus: PaymentStatus) {
    if (newStatus === local.payment_status) return;
    if (newStatus === "100_pago" || newStatus === "70_pago" || newStatus === "30_pago") {
      setDialogNeedsInvoice(local.needs_invoice);
      setDialogNif(local.nif ?? "");
      setPaymentDialog({ newStatus });
    } else {
      update("payment_status", newStatus);
    }
  }

  function confirmPaymentDialog() {
    if (!paymentDialog) return;
    const updates: OrderUpdate = { payment_status: paymentDialog.newStatus };
    if (dialogNeedsInvoice !== local.needs_invoice) updates.needs_invoice = dialogNeedsInvoice;
    if (dialogNeedsInvoice && dialogNif.trim() !== (local.nif ?? "").trim()) {
      updates.nif = dialogNif.trim() || null;
    }
    setLocal((prev) => ({ ...prev, ...updates }));
    pendingRef.current = { ...pendingRef.current, ...updates };
    clearTimeout(timerRef.current);
    setPaymentDialog(null);
    flush();
  }

  function saveDriveUrl() {
    update("drive_folder_url", driveUrlDraft.trim() || null);
    setDrivePopoverOpen(false);
  }

  const daysUntilEvent = local.event_date
    ? differenceInDays(parseISO(local.event_date), new Date())
    : null;
  const urgentEvent = daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;
  const isWedding = local.event_type === "casamento";

  const publicStatusUrl = `https://status.floresabeirario.pt/?id=${local.order_id}`;

  const extras: ExtrasInFrame = local.extras_in_frame ?? { options: [], notes: "" };
  function toggleExtra(opt: string) {
    const has = extras.options.includes(opt);
    const next: ExtrasInFrame = {
      options: has ? extras.options.filter((o) => o !== opt) : [...extras.options, opt],
      notes: extras.notes,
    };
    update("extras_in_frame", next);
  }
  function setExtraNotes(v: string) {
    update("extras_in_frame", { options: extras.options, notes: v });
  }

  const gallery: InspirationItem[] = local.inspiration_gallery ?? [];
  const [newInspirationUrl, setNewInspirationUrl] = useState("");
  function addInspiration() {
    const url = newInspirationUrl.trim();
    if (!url) return;
    const isImage = /\.(png|jpe?g|gif|webp|avif)$/i.test(url);
    const item: InspirationItem = { type: isImage ? "image" : "link", url };
    update("inspiration_gallery", [...gallery, item]);
    setNewInspirationUrl("");
  }
  function removeInspiration(idx: number) {
    update("inspiration_gallery", gallery.filter((_, i) => i !== idx));
  }

  function copyId() {
    navigator.clipboard.writeText(local.order_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const hasAnyPayment = ["100_pago", "70_pago", "30_pago"].includes(local.payment_status);
  const missingInvoice = hasAnyPayment && local.needs_invoice && !local.invoice_attachment_url;

  return (
    <div className="flex flex-col h-full bg-[#F7F4F0]">

      {/* ── Header fixo ──────────────────────────────────────── */}
      <header className="shrink-0 sticky top-0 z-20 bg-white border-b border-[#E8E0D5] shadow-sm">
        <div className="flex items-center gap-4 px-6 py-3">
          <Link
            href="/preservacao"
            className="flex items-center gap-1.5 text-sm text-[#8B7355] hover:text-[#3D2B1F] transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Preservação</span>
          </Link>

          <Separator orientation="vertical" className="h-5 bg-[#E8E0D5]" />

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#3D2B1F] truncate leading-tight">
              {local.client_name}
            </h1>
            <button
              onClick={copyId}
              className="font-mono text-[10px] text-[#B8A99A] leading-tight hover:text-[#3D2B1F] transition-colors flex items-center gap-1"
              title="Copiar ID"
            >
              #{local.order_id}
              {copied && <Check className="h-3 w-3 text-green-600" />}
            </button>
          </div>

          {urgentEvent && (
            <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600 font-medium shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" />
              Evento em {daysUntilEvent}d
            </div>
          )}

          <div className="w-56 shrink-0">
            <Select
              value={local.status}
              onValueChange={(v) => onStatusChange(v as Order["status"])}
            >
              <SelectTrigger className={`h-8 text-xs font-semibold border-2 ${STATUS_COLORS[local.status] ?? ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CheckRow
            label="Contactada"
            checked={local.contacted}
            onChange={(v) => update("contacted", v)}
          />

          <div className="w-24 shrink-0 text-right text-xs">
            {saveState === "saving" && (
              <span className="flex items-center justify-end gap-1 text-[#B8A99A]">
                <Loader2 className="h-3 w-3 animate-spin" />
                A guardar…
              </span>
            )}
            {saveState === "saved" && (
              <span className="flex items-center justify-end gap-1 text-green-600">
                <Check className="h-3 w-3" />
                Guardado
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Corpo: 3 colunas (comms | principal | direita) ────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* ═══════════════════════════════
                COLUNA ESQUERDA — COMUNICAÇÕES (sticky)
            ═══════════════════════════════ */}
            <aside className="lg:col-span-3 space-y-5 lg:sticky lg:top-[68px]">

              <Card title="Comunicações" icon={<MessageCircle className="h-3.5 w-3.5" />} accent="blue">
                <Tabs defaultValue="email">
                  <TabsList className="bg-[#FAF8F5] border border-[#E8E0D5] w-full">
                    <TabsTrigger value="email" className="flex-1 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-700">
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      Email
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="flex-1 text-xs data-[state=active]:bg-white data-[state=active]:text-green-700">
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                      WhatsApp
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="email" className="mt-3">
                    <PlaceholderBox
                      icon={<Mail className="h-4 w-4" />}
                      title="Sem emails sincronizados"
                      description={`Vai puxar automaticamente os emails trocados com ${local.email ?? "o cliente"} via Gmail API.`}
                    />
                  </TabsContent>
                  <TabsContent value="whatsapp" className="mt-3">
                    <PlaceholderBox
                      icon={<MessageCircle className="h-4 w-4" />}
                      title="Sem registos de WhatsApp"
                      description="Vais poder colar screenshots ou texto das conversas. Cada entrada datada e visível aqui."
                    />
                  </TabsContent>
                </Tabs>
              </Card>

              <Card title="Assistente de resposta" icon={<Sparkles className="h-3.5 w-3.5" />} accent="violet">
                <div className="space-y-3">
                  <Textarea
                    disabled
                    rows={4}
                    placeholder="Em breve: descreve o tipo de resposta (ex: 'agradecer feedback' ou 'confirmar agendamento') e a IA gera um rascunho com o tom da marca, em PT ou EN, baseado no contexto desta encomenda."
                    className="text-sm border-[#E8E0D5] bg-[#FAF8F5] text-[#8B7355] rounded-lg resize-none italic"
                  />
                  <button
                    disabled
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg border border-[#E8E0D5] bg-[#FAF8F5] text-[#B8A99A] text-xs font-medium cursor-not-allowed"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Sugerir resposta (em breve)
                  </button>
                </div>
              </Card>

            </aside>

            {/* ═══════════════════════════════
                COLUNA DO MEIO — DETALHES PRINCIPAIS
            ═══════════════════════════════ */}
            <main className="lg:col-span-6 space-y-5">

              {/* Hero: foto vertical + sumário + atalhos */}
              <div className="rounded-2xl border border-[#E8E0D5] bg-white overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
                <div className="grid grid-cols-12 gap-0">
                  {/* Foto 3:4 vertical */}
                  <div className="col-span-5 relative group bg-gradient-to-br from-[#FAF8F5] to-[#F0E8DC]">
                    <div className="aspect-[3/4]">
                      {local.flowers_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={local.flowers_photo_url}
                          alt={`Flores de ${local.client_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#E8E0D5] text-[#C4A882] mb-2">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                          <p className="text-sm font-medium text-[#3D2B1F]">Foto da encomenda</p>
                          <p className="text-[11px] text-[#8B7355] mt-1">
                            Adiciona o link de uma foto do bouquet.
                          </p>
                        </div>
                      )}
                    </div>
                    {/* URL overlay (visível em hover) */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5">
                      <Input
                        className="h-8 text-xs bg-white/95 border-white/40 placeholder:text-[#8B7355]"
                        placeholder="URL da foto"
                        value={local.flowers_photo_url ?? ""}
                        onChange={(e) => update("flowers_photo_url", e.target.value || null)}
                      />
                    </div>
                  </div>

                  {/* Info + atalhos */}
                  <div className="col-span-7 p-5 flex flex-col">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-auto">
                      <InfoChip
                        label="Data do evento"
                        value={fmtDate(local.event_date)}
                        accent={urgentEvent ? "red" : daysUntilEvent !== null && daysUntilEvent < 0 ? "muted" : "default"}
                        sublabel={
                          daysUntilEvent === null
                            ? undefined
                            : daysUntilEvent < 0
                              ? `Há ${Math.abs(daysUntilEvent)} dias`
                              : daysUntilEvent === 0
                                ? "Hoje!"
                                : `Em ${daysUntilEvent} dias`
                        }
                      />
                      <InfoChip
                        label="Tipo de evento"
                        value={local.event_type ? EVENT_TYPE_LABELS[local.event_type] : "—"}
                      />
                      <InfoChip
                        label="Localização"
                        value={local.event_location || "—"}
                      />
                      <InfoChip
                        label="Idioma do form"
                        value={local.form_language === "pt" ? "🇵🇹 Português" : "🇬🇧 English"}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-[#F0EAE0]">
                      {/* Drive — botão + popover de edição */}
                      {local.drive_folder_url ? (
                        <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-[#E8E0D5] bg-white">
                          <a
                            href={local.drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Pasta Drive
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                          <Popover open={drivePopoverOpen} onOpenChange={(v) => { setDrivePopoverOpen(v); if (v) setDriveUrlDraft(local.drive_folder_url ?? ""); }}>
                            <PopoverTrigger
                              className="px-2 border-l border-[#E8E0D5] text-[#8B7355] hover:bg-[#FAF8F5] transition-colors"
                              title="Editar URL"
                            >
                              <Pencil className="h-3 w-3" />
                            </PopoverTrigger>
                            <DriveUrlEditor
                              draft={driveUrlDraft}
                              setDraft={setDriveUrlDraft}
                              onSave={saveDriveUrl}
                            />
                          </Popover>
                        </div>
                      ) : (
                        <Popover open={drivePopoverOpen} onOpenChange={(v) => { setDrivePopoverOpen(v); if (v) setDriveUrlDraft(""); }}>
                          <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#E0D5C2] bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-[#8B7355] hover:text-[#3D2B1F] hover:border-[#C4A882] transition-colors">
                            <FolderOpen className="h-3.5 w-3.5" />
                            Definir pasta Drive
                          </PopoverTrigger>
                          <DriveUrlEditor
                            draft={driveUrlDraft}
                            setDraft={setDriveUrlDraft}
                            onSave={saveDriveUrl}
                          />
                        </Popover>
                      )}

                      <a
                        href={publicStatusUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E0D5] bg-white px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 transition-colors"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Status público
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerta visual de fatura em falta */}
              {missingInvoice && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <p className="font-semibold">Falta anexar fatura</p>
                    <p className="text-amber-800 mt-0.5">
                      Esta encomenda tem pagamento e o cliente pediu fatura com NIF, mas ainda não há anexo.
                    </p>
                  </div>
                </div>
              )}

              {/* Cliente */}
              <Card title="Dados do cliente" icon={<User className="h-3.5 w-3.5" />} accent="rose">
                <Grid2>
                  <Field label="Nome na encomenda">
                    <Input className={inp} value={local.client_name} onChange={(e) => update("client_name", e.target.value)} />
                  </Field>
                  <Field label="Contacto preferido">
                    <Select value={local.contact_preference ?? ""} onValueChange={(v) => update("contact_preference", v as Order["contact_preference"])}>
                      <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Email">
                    <Input className={inp} type="email" value={local.email ?? ""} onChange={(e) => update("email", e.target.value || null)} />
                  </Field>
                  <Field label="Telemóvel">
                    <Input className={inp} value={local.phone ?? ""} onChange={(e) => update("phone", e.target.value || null)} />
                  </Field>
                </Grid2>
              </Card>

              {/* Evento */}
              <Card title="Dados do evento" icon={<Calendar className="h-3.5 w-3.5" />} accent="amber">
                <Grid2>
                  <Field label="Tipo de evento">
                    <Select value={local.event_type ?? ""} onValueChange={(v) => update("event_type", v as Order["event_type"])}>
                      <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((t) => (
                          <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Data do evento">
                    <Input
                      className={`${inp} ${urgentEvent ? "border-red-300 bg-red-50" : ""}`}
                      type="date"
                      value={toDateInput(local.event_date)}
                      onChange={(e) => update("event_date", e.target.value || null)}
                    />
                  </Field>
                  {isWedding && (
                    <Field label="Nome dos noivos" span2>
                      <Input className={inp} value={local.couple_names ?? ""} onChange={(e) => update("couple_names", e.target.value || null)} placeholder="Ana & João" />
                    </Field>
                  )}
                  <Field label="Localização do evento" span2>
                    <Input className={inp} value={local.event_location ?? ""} onChange={(e) => update("event_location", e.target.value || null)} placeholder="Quinta / Igreja / Cidade" />
                  </Field>
                </Grid2>
              </Card>

              {/* Flores e quadro */}
              <Card title="Flores e quadro" icon={<Flower2 className="h-3.5 w-3.5" />} accent="emerald">
                <Grid2>
                  <Field label="Tipo de flores" span2>
                    <Input className={inp} value={local.flower_type ?? ""} onChange={(e) => update("flower_type", e.target.value || null)} placeholder="Rosas, peónias, silvestres…" />
                  </Field>
                  <Field label="Tamanho da moldura">
                    <Select value={local.frame_size ?? ""} onValueChange={(v) => update("frame_size", v as Order["frame_size"])}>
                      <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30x40">30×40</SelectItem>
                        <SelectItem value="40x50">40×50</SelectItem>
                        <SelectItem value="50x70">50×70</SelectItem>
                        <SelectItem value="voces_a_escolher">Vocês a escolher</SelectItem>
                        <SelectItem value="nao_sei">Não sei</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Fundo do quadro">
                    <Select value={local.frame_background ?? ""} onValueChange={(v) => update("frame_background", v as Order["frame_background"])}>
                      <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transparente">Transparente</SelectItem>
                        <SelectItem value="preto">Preto</SelectItem>
                        <SelectItem value="branco">Branco</SelectItem>
                        <SelectItem value="fotografia">Fotografia</SelectItem>
                        <SelectItem value="cor">Cor</SelectItem>
                        <SelectItem value="voces_a_escolher">Vocês a escolher</SelectItem>
                        <SelectItem value="nao_sei">Não sei</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </Grid2>

                <Separator className="bg-[#F0EAE0]" />

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Envio das flores (cliente → FBR)</p>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <Field label="Como envia">
                      <Select value={local.flower_delivery_method ?? ""} onValueChange={(v) => update("flower_delivery_method", v as Order["flower_delivery_method"])}>
                        <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="maos">Em mãos</SelectItem>
                          <SelectItem value="ctt">CTT</SelectItem>
                          <SelectItem value="recolha_evento">Recolha no evento</SelectItem>
                          <SelectItem value="nao_sei">Não sei</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Custo (€)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B7355]">€</span>
                        <Input className={inp + " pl-7"} type="number" min={0} step={0.01} value={local.flower_shipping_cost ?? ""} onChange={(e) => update("flower_shipping_cost", e.target.value ? Number(e.target.value) : null)} />
                      </div>
                    </Field>
                    <div className="pb-2">
                      <CheckRow label="Pago" checked={local.flower_shipping_paid} onChange={(v) => update("flower_shipping_paid", v)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Receção do quadro (FBR → cliente)</p>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <Field label="Como recebe">
                      <Select value={local.frame_delivery_method ?? ""} onValueChange={(v) => update("frame_delivery_method", v as Order["frame_delivery_method"])}>
                        <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="maos">Em mãos</SelectItem>
                          <SelectItem value="ctt">CTT</SelectItem>
                          <SelectItem value="nao_sei">Não sei</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Custo (€)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B7355]">€</span>
                        <Input className={inp + " pl-7"} type="number" min={0} step={0.01} value={local.frame_shipping_cost ?? ""} onChange={(e) => update("frame_shipping_cost", e.target.value ? Number(e.target.value) : null)} />
                      </div>
                    </Field>
                    <div className="pb-2">
                      <CheckRow label="Pago" checked={local.frame_shipping_paid} onChange={(v) => update("frame_shipping_paid", v)} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Extras no quadro */}
              <Card title="Extras no quadro" icon={<Layers className="h-3.5 w-3.5" />} accent="orange">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EXTRA_OPTIONS.map((opt) => (
                      <CheckRow
                        key={opt}
                        label={opt}
                        checked={extras.options.includes(opt)}
                        onChange={() => toggleExtra(opt)}
                      />
                    ))}
                  </div>
                  <Field label="Notas / outros extras">
                    <Textarea
                      className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg resize-none"
                      rows={2}
                      value={extras.notes}
                      onChange={(e) => setExtraNotes(e.target.value)}
                      placeholder="Ex: pequena pena de pavão, anel da avó…"
                    />
                  </Field>
                </div>
              </Card>

              {/* Peças extra */}
              <Card title="Peças extra" icon={<Boxes className="h-3.5 w-3.5" />} accent="indigo">
                <div className="space-y-4">
                  <ExtraPieceRow
                    label="Quadros extra pequenos"
                    value={local.extra_small_frames}
                    qty={local.extra_small_frames_qty}
                    onValue={(v) => update("extra_small_frames", v)}
                    onQty={(q) => update("extra_small_frames_qty", q)}
                  />
                  <ExtraPieceRow
                    label="Ornamentos de Natal"
                    value={local.christmas_ornaments}
                    qty={local.christmas_ornaments_qty}
                    onValue={(v) => update("christmas_ornaments", v)}
                    onQty={(q) => update("christmas_ornaments_qty", q)}
                  />
                  <ExtraPieceRow
                    label="Pendentes para colares"
                    value={local.necklace_pendants}
                    qty={local.necklace_pendants_qty}
                    onValue={(v) => update("necklace_pendants", v)}
                    onQty={(q) => update("necklace_pendants_qty", q)}
                  />
                </div>
              </Card>

              {/* Galeria de inspiração */}
              <Card
                title="Galeria de inspiração"
                icon={<Heart className="h-3.5 w-3.5" />}
                accent="pink"
                badge={gallery.length > 0 ? <span className="text-[10px] text-pink-700 font-semibold bg-pink-100 px-1.5 py-0.5 rounded-full">{gallery.length}</span> : undefined}
              >
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      className={inp + " flex-1"}
                      placeholder="Cole link/URL (Pinterest, Drive, Instagram…)"
                      value={newInspirationUrl}
                      onChange={(e) => setNewInspirationUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInspiration(); } }}
                    />
                    <button
                      onClick={addInspiration}
                      disabled={!newInspirationUrl.trim()}
                      className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-pink-600 text-white text-xs font-medium hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </button>
                  </div>

                  {gallery.length === 0 ? (
                    <PlaceholderBox
                      icon={<Heart className="h-4 w-4" />}
                      title="Sem inspirações ainda"
                      description="Adicione fotos de bouquets de referência, paletas, ou ideias do cliente. (Vão sincronizar com a Drive automaticamente.)"
                    />
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {gallery.map((item, idx) => (
                        <div key={idx} className="group relative aspect-square rounded-lg border border-[#E8E0D5] bg-[#FAF8F5] overflow-hidden">
                          {item.type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.url} alt={item.label ?? ""} className="w-full h-full object-cover" />
                          ) : (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-full flex flex-col items-center justify-center text-center p-2 text-pink-700 hover:bg-pink-50 transition-colors"
                            >
                              <Link2 className="h-5 w-5 mb-1" />
                              <span className="text-[10px] truncate w-full">{safeHostname(item.url)}</span>
                            </a>
                          )}
                          <button
                            onClick={() => removeInspiration(idx)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Remover"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Origem e notas */}
              <Card title="Origem e notas" icon={<StickyNote className="h-3.5 w-3.5" />} accent="slate">
                <Grid2>
                  <Field label="Como conheceu a FBR" span2={local.how_found_fbr !== "vale_presente"}>
                    <Select value={local.how_found_fbr ?? ""} onValueChange={(v) => update("how_found_fbr", v as Order["how_found_fbr"])}>
                      <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="casamentos_pt">casamentos.pt</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="vale_presente">Vale-Presente</SelectItem>
                        <SelectItem value="florista">Florista</SelectItem>
                        <SelectItem value="recomendacao">Recomendação</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {local.how_found_fbr === "vale_presente" && (
                    <Field label="Código vale-presente">
                      <Input className={inp} value={local.gift_voucher_code ?? ""} onChange={(e) => update("gift_voucher_code", e.target.value || null)} placeholder="Código de 6 dígitos" />
                    </Field>
                  )}
                  <Field label="Notas adicionais" span2>
                    <Textarea
                      className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg resize-none"
                      rows={4}
                      value={local.additional_notes ?? ""}
                      onChange={(e) => update("additional_notes", e.target.value || null)}
                      placeholder="Pedidos especiais, informações relevantes…"
                    />
                  </Field>
                </Grid2>
              </Card>

            </main>

            {/* ═══════════════════════════════
                COLUNA DIREITA — FINANÇAS / PARCERIA / ENTREGA
            ═══════════════════════════════ */}
            <aside className="lg:col-span-3 space-y-5">

              <Card title="Finanças" icon={<Wallet className="h-3.5 w-3.5" />} accent="green">
                <div className="space-y-3">
                  <Field label="Orçamento" hint="Calculado a partir da tabela de preços. Editável.">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B7355]">€</span>
                      <Input
                        className={inp + " pl-7"}
                        type="number" min={0} step={0.01}
                        value={local.budget ?? ""}
                        onChange={(e) => update("budget", e.target.value ? Number(e.target.value) : null)}
                      />
                    </div>
                  </Field>
                  <Field label="Pagamento">
                    <Select value={local.payment_status} onValueChange={(v) => onPaymentStatusChange(v as PaymentStatus)}>
                      <SelectTrigger className={`${sel} font-medium ${PAYMENT_COLORS[local.payment_status] ?? ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PAYMENT_STATUS_LABELS) as Array<keyof typeof PAYMENT_STATUS_LABELS>).map((s) => (
                          <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cliente pediu fatura com NIF?">
                    <Select
                      value={local.needs_invoice ? "sim" : "nao"}
                      onValueChange={(v) => update("needs_invoice", v === "sim")}
                    >
                      <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {local.needs_invoice && (
                    <>
                      <Field label="NIF">
                        <Input className={inp} value={local.nif ?? ""} onChange={(e) => update("nif", e.target.value || null)} placeholder="9 dígitos" />
                      </Field>
                      <Field label="Anexo da fatura">
                        <div className="flex gap-1.5">
                          <Input
                            className={inp + " flex-1 min-w-0"}
                            value={local.invoice_attachment_url ?? ""}
                            onChange={(e) => update("invoice_attachment_url", e.target.value || null)}
                            placeholder="URL do PDF (Drive)"
                          />
                          {local.invoice_attachment_url && (
                            <a
                              href={local.invoice_attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E8E0D5] bg-[#FAF8F5] text-[#8B7355] hover:bg-[#3D2B1F] hover:text-white hover:border-[#3D2B1F] transition-colors"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </Field>
                    </>
                  )}
                </div>
              </Card>

              <Card title="Parceria" icon={<Handshake className="h-3.5 w-3.5" />} accent="sky">
                <div className="space-y-3">
                  <Field label="Parceiro recomendador" hint="Em breve: lista da aba Parcerias.">
                    <Select value={local.partner_id ?? ""} onValueChange={(v) => update("partner_id", v || null)} disabled>
                      <SelectTrigger className={sel + " opacity-60"}>
                        <SelectValue placeholder="Sem parceiro" />
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  </Field>
                  <Field label="Comissão (€)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B7355]">€</span>
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
                      <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na">N/A</SelectItem>
                        <SelectItem value="parceiro_informado">Parceiro informado</SelectItem>
                        <SelectItem value="a_aguardar">A aguardar</SelectItem>
                        <SelectItem value="paga">Paga</SelectItem>
                        <SelectItem value="a_aguardar_resposta">A aguardar resposta</SelectItem>
                        <SelectItem value="nao_aceita">Não aceita</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </Card>

              <Card title="Entrega e feedback" icon={<Package className="h-3.5 w-3.5" />} accent="purple">
                <div className="space-y-3">
                  <Field label="Data entrega do quadro">
                    <Input className={inp} type="date" value={toDateInput(local.frame_delivery_date)} onChange={(e) => update("frame_delivery_date", e.target.value || null)} />
                  </Field>
                  <Field label="Feedback do cliente">
                    <Select value={local.client_feedback_status} onValueChange={(v) => update("client_feedback_status", v as Order["client_feedback_status"])}>
                      <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na">N/A</SelectItem>
                        <SelectItem value="deu_feedback">Deu feedback</SelectItem>
                        <SelectItem value="ja_pedido">Já pedido</SelectItem>
                        <SelectItem value="nao_disse_nada">Não disse nada</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </Card>

              <Card title="Cupão 5%" icon={<Ticket className="h-3.5 w-3.5" />} accent="yellow">
                <div className="space-y-3">
                  {local.coupon_code ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-base tracking-[0.2em] border-yellow-400 bg-yellow-50 text-yellow-900 px-3 py-1">
                        {local.coupon_code}
                      </Badge>
                      <button
                        onClick={() => navigator.clipboard.writeText(local.coupon_code!)}
                        className="text-[#B8A99A] hover:text-[#3D2B1F] transition-colors"
                        title="Copiar"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#8B7355] italic leading-relaxed">
                      O código é gerado automaticamente quando o estado mudar para <strong>“A ser emoldurado”</strong>.
                    </p>
                  )}
                  <Field label="Validade" hint="2 anos após entrega.">
                    <Input className={inp} type="date" value={toDateInput(local.coupon_expiry)} onChange={(e) => update("coupon_expiry", e.target.value || null)} disabled={!local.coupon_code} />
                  </Field>
                  <Field label="Estado">
                    <Select value={local.coupon_status} onValueChange={(v) => update("coupon_status", v as Order["coupon_status"])} disabled={!local.coupon_code}>
                      <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na">N/A</SelectItem>
                        <SelectItem value="nao_utilizado">Não utilizado</SelectItem>
                        <SelectItem value="utilizado">Utilizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </Card>

              <div className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-3 space-y-1">
                <p className="text-[10px] text-[#B8A99A]">
                  Criada em {local.created_at ? format(parseISO(local.created_at), "dd MMM yyyy, HH:mm", { locale: pt }) : "—"}
                </p>
                {local.updated_at && local.updated_at !== local.created_at && (
                  <p className="text-[10px] text-[#B8A99A]">
                    Actualizada em {format(parseISO(local.updated_at), "dd MMM yyyy, HH:mm", { locale: pt })}
                  </p>
                )}
                <p className="font-mono text-[10px] text-[#D0C4B8]">{local.order_id}</p>
              </div>

            </aside>

          </div>
        </div>
      </div>

      {/* ── Diálogo de mudança de pagamento ──────────────────── */}
      <Dialog open={!!paymentDialog} onOpenChange={(open) => !open && setPaymentDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#3D2B1F]">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Pagamento atualizado
            </DialogTitle>
            <DialogDescription className="text-[#8B7355]">
              Vais marcar este pagamento como{" "}
              <strong className="text-[#3D2B1F]">
                {paymentDialog ? PAYMENT_STATUS_LABELS[paymentDialog.newStatus] : ""}
              </strong>
              . Antes de confirmar, vê estas duas coisas:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <Paperclip className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm text-[#3D2B1F]">
                  <p className="font-medium">Anexa o comprovativo à pasta Drive</p>
                  <p className="text-xs text-[#8B7355] mt-0.5">
                    Guarda o screenshot/PDF da transferência na pasta desta encomenda.
                  </p>
                </div>
              </div>
              {local.drive_folder_url ? (
                <a
                  href={local.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-6 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                  <FolderOpen className="h-3 w-3" />
                  Abrir pasta Drive
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              ) : (
                <p className="ml-6 text-[11px] text-amber-700 italic">
                  Esta encomenda ainda não tem pasta Drive associada.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#8B7355]">O cliente pediu fatura com NIF?</Label>
              <Select
                value={dialogNeedsInvoice ? "sim" : "nao"}
                onValueChange={(v) => setDialogNeedsInvoice(v === "sim")}
              >
                <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
              {dialogNeedsInvoice && (
                <div className="pt-2">
                  <Label className="text-xs font-medium text-[#8B7355]">NIF</Label>
                  <Input
                    className={inp + " mt-1"}
                    value={dialogNif}
                    onChange={(e) => setDialogNif(e.target.value)}
                    placeholder="9 dígitos"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setPaymentDialog(null)}
              className="h-9 px-4 rounded-lg border border-[#E8E0D5] bg-white text-sm text-[#3D2B1F] hover:bg-[#FAF8F5] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmPaymentDialog}
              className="h-9 px-4 rounded-lg bg-[#3D2B1F] text-sm text-white font-medium hover:bg-[#2C1F15] transition-colors"
            >
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo "Quadro recebido" → pede data de entrega ─── */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#3D2B1F]">
              <Package className="h-4 w-4 text-purple-600" />
              Quadro recebido
            </DialogTitle>
            <DialogDescription className="text-[#8B7355]">
              Para fechar bem esta encomenda, indica em que dia o cliente recebeu o quadro.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Label className="text-xs font-medium text-[#8B7355]">Data de entrega do quadro</Label>
            <Input
              className={inp + " mt-1.5"}
              type="date"
              value={deliveryDateDraft}
              onChange={(e) => setDeliveryDateDraft(e.target.value)}
              autoFocus
            />
            <p className="text-[10px] text-[#B8A99A] mt-2 leading-relaxed">
              Esta data é usada para calcular a validade do cupão de 5%.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setDeliveryDialogOpen(false)}
              className="h-9 px-4 rounded-lg border border-[#E8E0D5] bg-white text-sm text-[#3D2B1F] hover:bg-[#FAF8F5] transition-colors"
            >
              Mais tarde
            </button>
            <button
              onClick={confirmDeliveryDialog}
              className="h-9 px-4 rounded-lg bg-[#3D2B1F] text-sm text-white font-medium hover:bg-[#2C1F15] transition-colors disabled:opacity-50"
              disabled={!deliveryDateDraft}
            >
              Guardar data
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-componentes auxiliares ─────────────────────────────────

function safeHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url.slice(0, 20); }
}

function DriveUrlEditor({
  draft,
  setDraft,
  onSave,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <PopoverContent className="w-80 p-3 space-y-2">
      <Label className="text-xs font-medium text-[#8B7355]">URL da pasta Google Drive</Label>
      <Input
        className={inp}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="https://drive.google.com/…"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSave(); } }}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onSave}
          className="h-8 px-3 rounded-lg bg-[#3D2B1F] text-white text-xs font-medium hover:bg-[#2C1F15] transition-colors"
        >
          Guardar
        </button>
      </div>
      <p className="text-[10px] text-[#B8A99A] leading-relaxed pt-1 border-t border-[#F0EAE0]">
        Em breve: a pasta vai ser criada automaticamente ao primeiro pagamento, com a estrutura de subpastas definida.
      </p>
    </PopoverContent>
  );
}

function InfoChip({
  label,
  value,
  sublabel,
  accent = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "red" | "muted";
}) {
  const accentClass =
    accent === "red"
      ? "text-red-700"
      : accent === "muted"
        ? "text-[#B8A99A]"
        : "text-[#3D2B1F]";
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#B8A99A]">{label}</p>
      <p className={`text-sm font-medium ${accentClass} truncate`}>{value}</p>
      {sublabel && <p className={`text-[11px] ${accent === "red" ? "text-red-600" : "text-[#8B7355]"}`}>{sublabel}</p>}
    </div>
  );
}

function ExtraPieceRow({
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
  return (
    <div className="grid grid-cols-5 gap-3 items-end">
      <div className="col-span-3">
        <Label className="text-xs font-medium text-[#8B7355]">{label}</Label>
        <Select value={value ?? ""} onValueChange={(v) => onValue((v || null) as "sim" | "nao" | "mais_info" | null)}>
          <SelectTrigger className={sel + " mt-1.5"}><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sim">Sim</SelectItem>
            <SelectItem value="nao">Não</SelectItem>
            <SelectItem value="mais_info">Mais info</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label className="text-xs font-medium text-[#8B7355]">Quantidade</Label>
        <Input
          className={inp + " mt-1.5"}
          type="number"
          min={0}
          value={qty ?? ""}
          onChange={(e) => onQty(e.target.value ? Number(e.target.value) : null)}
          disabled={value !== "sim" && value !== "mais_info"}
          placeholder={value === "nao" || value === null ? "—" : "0"}
        />
      </div>
    </div>
  );
}
