"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/navigation-progress";
import { toast } from "sonner";
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
  AlertTriangle,
  Clock,
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
  Flower2,
  StickyNote,
  Wallet,
  Handshake,
  Package,
  Ticket,
  Pencil,
  CalendarPlus,
  Truck,
  Trash2,
  MapPin,
  CheckSquare,
} from "lucide-react";
import {
  updateOrderAction,
  deleteOrderAction,
  createOrderDriveFolderAction,
  createOrderCalendarEventAction,
  deleteOrderCalendarEventAction,
} from "../actions";
import { isEventAlertRelevant } from "../_styles";
import { StickyNoteButton } from "@/components/sticky-note-button";
import { PartnerCombobox, type PartnerOption } from "@/components/partner-combobox";
import AddressAutocomplete from "@/components/address-autocomplete";
import WorkbenchNavigator from "@/components/workbench-navigator";
import TemplatePicker from "@/components/template-picker";
import WhatsappLivePanel from "./_components/wa-live-panel";
import GmailPanel from "./_components/gmail-panel";
import WorkbenchTasksBlock from "@/components/workbench-tasks-block";
import { computeAmountOptionsFromBudget } from "@/lib/task-templates";
import type {
  Order,
  OrderUpdate,
  ExtrasInFrame,
  InspirationItem,
  PaymentStatus,
  FormLanguage,
} from "@/types/database";
import type { Task, TaskTemplate } from "@/types/tasks";
import {
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FLOWER_DELIVERY_METHOD_COLORS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_COLORS,
  FRAME_BACKGROUND_LABELS,
  FRAME_SIZE_LABELS,
  FRAME_SIZE_COLORS,
  HOW_FOUND_FBR_LABELS,
  HOW_FOUND_FBR_COLORS,
  PARTNER_COMMISSION_STATUS_LABELS,
  PARTNER_COMMISSION_STATUS_COLORS,
  COUPON_STATUS_LABELS,
  COUPON_STATUS_COLORS,
  CLIENT_FEEDBACK_STATUS_LABELS,
  CLIENT_FEEDBACK_STATUS_COLORS,
  SIM_NAO_LABELS,
  FORM_LANGUAGE_LABELS,
} from "@/types/database";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { pt } from "date-fns/locale";
import { relativeMonthsDays } from "@/lib/format-date";
import { formatPhone, phoneToWaMe } from "@/lib/format-phone";
import { formatEUR } from "@/lib/format";
import { computeBudgetAdjustment } from "@/lib/budget-adjustment";
import { toEmbeddableImageUrl } from "@/lib/drive-url";
import { Flag } from "@/components/ui/flag";
import { HowFoundFbrLabel } from "@/components/ui/how-found-fbr-label";
import {
  publicStatusUrl,
  formatPublicEstimatedDelivery,
} from "@/lib/public-status";
import {
  Card,
  Grid2,
  Field,
  HeroField,
  CheckRow,
  PlaceholderBox,
  inp,
  sel,
  inpSubtle,
  selSubtle,
  titleSubtle,
} from "./_components/layout";
import {
  InventorySection,
  DriveUrlEditor,
  safeHostname,
  CalendarEventShortcut,
  StatusSelect,
  ShippingRow,
  CouponCodeField,
  ExtraPieceRow,
} from "./_components/fields";
import { BudgetSnapshotBadge } from "./_components/budget-badges";

// ── Helpers ────────────────────────────────────────────────────

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  try { return format(parseISO(val), "yyyy-MM-dd"); } catch { return ""; }
}

// ── Cores e ícones por estado ─────────────────────────────────
// STATUS_COLORS, STATUS_ICONS, STATUS_GROUPS extraídos para
// ./_components/fields.tsx (usados pelo StatusSelect que vive lá).

const PAYMENT_COLORS: Record<string, string> = {
  "100_pago":      "text-green-800 bg-green-100 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  "70_pago":       "text-lime-800 bg-lime-100 border-lime-300 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-900",
  "30_pago":       "text-amber-900 bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  "100_por_pagar": "text-red-700 bg-red-100 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
};

// Paleta de acentos extraída para ./_components/layout.tsx (usada pelo Card).

// Opções de extras tal como aparecem no formulário público.
// "Não pretendo incluir extras" e "Outro (especifique abaixo)" têm
// comportamento especial (ver toggleExtra).
const EXTRAS_NONE = "Não pretendo incluir extras";
const EXTRAS_OTHER = "Outro (especifique abaixo)";

const EXTRA_OPTIONS = [
  EXTRAS_NONE,
  "Votos manuscritos",
  "Convite do casamento",
  "Fitas, tecidos ou rendas",
  "Fotografia",
  "Joia ou medalha",
  "Coleira de animal",
  "Cartas ou bilhetes",
  EXTRAS_OTHER,
];

// ── Componentes de layout (Card, Grid2, Field, HeroField, CheckRow,
//    PlaceholderBox, inp, sel, *Subtle) → ./_components/layout.tsx
// ── InventorySection, StatusSelect, ShippingRow, CouponCodeField,
//    ExtraPieceRow, DriveUrlEditor, CalendarEventShortcut → ./_components/fields.tsx
// ── BudgetSnapshotBadge, ProductionCostBadge → ./_components/budget-badges.tsx
// ── StickyNoteButton vive em src/components/.

// ── Componente principal ───────────────────────────────────────

export default function WorkbenchClient({
  order,
  canEdit,
  partners = [],
  taskTemplates = [],
  orderTasks = [],
  currentEmail = "",
  linkedVoucherCode = null,
}: {
  order: Order;
  canEdit: boolean;
  partners?: PartnerOption[];
  taskTemplates?: TaskTemplate[];
  orderTasks?: Task[];
  currentEmail?: string;
  /** Código de vale existente quando `gift_voucher_code` corresponde a um vale activo. */
  linkedVoucherCode?: string | null;
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Order>(order);
  // Padrão React: reset de estado derivado quando o prop `order` muda
  // (ex: o `router.refresh()` traz novo snapshot do servidor).
  const [trackedOrderUpdatedAt, setTrackedOrderUpdatedAt] = useState(order.updated_at);
  const pendingRef = useRef<OrderUpdate>({});
  if (order.updated_at !== trackedOrderUpdatedAt) {
    setTrackedOrderUpdatedAt(order.updated_at);
    // Não sobrescrever campos que o utilizador está a editar agora —
    // mantém local para qualquer chave em pendingRef (ainda por sincronizar).
    setLocal((current) => {
      const merged = { ...order };
      for (const key of Object.keys(pendingRef.current)) {
        (merged as unknown as Record<string, unknown>)[key] = (current as unknown as Record<string, unknown>)[key];
      }
      return merged;
    });
  }
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

  // Diálogos de lembrete de pagamento (40% / 30%) — abrem quando se passa
  // para "flores_recebidas"/"flores_na_prensa" (40%) ou "a_ser_fotografado"/
  // "quadro_pronto" (30%). A Maria responde "Já pedi" ou "Lembra-me depois".
  const [paymentReminderDialog, setPaymentReminderDialog] = useState<null | {
    kind: "40" | "30";
    nextStatus: Order["status"];
  }>(null);

  // Edição rápida do URL da pasta Drive (popover no hero)
  const [driveUrlDraft, setDriveUrlDraft] = useState("");
  const [drivePopoverOpen, setDrivePopoverOpen] = useState(false);

  // Edição do ID curto da encomenda (popover no header)
  const [orderIdDraft, setOrderIdDraft] = useState("");
  const [orderIdPopoverOpen, setOrderIdPopoverOpen] = useState(false);

  // Edição do contacto do cliente (popover na coluna de comunicações)
  // Os clientes às vezes dão um número errado e corrigem por mensagem.
  const [contactDraftPhone, setContactDraftPhone] = useState("");
  const [contactDraftEmail, setContactDraftEmail] = useState("");
  const [contactDraftPreference, setContactDraftPreference] = useState<"whatsapp" | "email" | "">("");
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  // Confirmação ao alterar campos preenchidos pelo cliente — protege contra cliques acidentais.
  const [clientEditDialog, setClientEditDialog] = useState<null | {
    label: string;
    oldDisplay: string;
    newDisplay: string;
    apply: () => void;
  }>(null);

  // Diálogo de arquivar (soft delete)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Em mobile o overlay com o URL da foto fica escondido por defeito —
  // só aparece quando se toca na foto. Em desktop o hover do `group`
  // continua a controlar a visibilidade como antes.
  const [imageUrlMobileOpen, setImageUrlMobileOpen] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    try {
      await deleteOrderAction(order.id);
      startNavigationProgress();
      router.push("/preservacao");
    } catch (err) {
      console.error(err);
      setArchiving(false);
    }
  }

  const flush = useCallback(async () => {
    const updates = { ...pendingRef.current };
    if (Object.keys(updates).length === 0) return;
    pendingRef.current = {};
    clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      const updated = await updateOrderAction(order.id, updates);
      // Mantém qualquer letra/escolha digitada DURANTE este await — pendingRef
      // já tem essas mudanças, então preservamos os valores do local actual
      // nas chaves em pendingRef (ainda por enviar).
      setLocal((current) => {
        const merged = { ...updated };
        for (const key of Object.keys(pendingRef.current)) {
          (merged as unknown as Record<string, unknown>)[key] = (current as unknown as Record<string, unknown>)[key];
        }
        return merged;
      });
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

  // Atalho para campos preenchidos pelo cliente: pede confirmação antes de aplicar.
  // Razão: evitar alterações acidentais por cliques sem querer numa dropdown/data.
  function clientUpdate<K extends keyof OrderUpdate>(
    key: K,
    newValue: OrderUpdate[K],
    label: string,
    formatter?: (v: OrderUpdate[K]) => string,
  ) {
    const oldValue = local[key as keyof Order] as unknown as OrderUpdate[K];
    if (newValue === oldValue) return;
    const fmt = formatter ?? ((v: OrderUpdate[K]) => (v === null || v === undefined || v === "" ? "—" : String(v)));
    setClientEditDialog({
      label,
      oldDisplay: fmt(oldValue),
      newDisplay: fmt(newValue),
      apply: () => update(key, newValue),
    });
  }

  function confirmClientEdit() {
    clientEditDialog?.apply();
    setClientEditDialog(null);
  }

  function onStatusChange(newStatus: Order["status"]) {
    if (newStatus === local.status) return;

    // Pedido dos 40% — quando se passa para flores_recebidas/flores_na_prensa
    if (
      (newStatus === "flores_recebidas" || newStatus === "flores_na_prensa") &&
      !local.payment_40_requested
    ) {
      setPaymentReminderDialog({ kind: "40", nextStatus: newStatus });
      return; // só aplica o status depois da resposta
    }

    // Pedido dos 30% — quando se passa para a_ser_fotografado/quadro_pronto
    if (
      (newStatus === "a_ser_fotografado" || newStatus === "quadro_pronto") &&
      !local.payment_30_requested
    ) {
      setPaymentReminderDialog({ kind: "30", nextStatus: newStatus });
      return;
    }

    if (newStatus === "quadro_recebido" && !local.frame_delivery_date) {
      setDeliveryDateDraft(toDateInput(new Date().toISOString()));
      setDeliveryDialogOpen(true);
    }
    update("status", newStatus);
  }

  function confirmPaymentReminder(alreadyAsked: boolean) {
    if (!paymentReminderDialog) return;
    const { kind, nextStatus } = paymentReminderDialog;
    const updates: OrderUpdate = { status: nextStatus };
    if (alreadyAsked) {
      if (kind === "40") updates.payment_40_requested = true;
      else updates.payment_30_requested = true;
    }
    // Aplica numa transição
    setLocal((prev) => ({ ...prev, ...updates }));
    pendingRef.current = { ...pendingRef.current, ...updates };
    clearTimeout(timerRef.current);
    setPaymentReminderDialog(null);
    flush();
    // Se for o quadro_recebido cadeia, dispara o seguinte diálogo
    if (nextStatus === "quadro_recebido" && !local.frame_delivery_date) {
      setDeliveryDateDraft(toDateInput(new Date().toISOString()));
      setDeliveryDialogOpen(true);
    }
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

  const [calendarBusy, setCalendarBusy] = useState(false);
  // Inicializa com o link persistido na BD para que o botão "No Calendar"
  // funcione imediatamente após refresh (sessão 55).
  const [calendarLink, setCalendarLink] = useState<string | null>(
    local.calendar_event_html_link,
  );

  async function createCalendarEvent() {
    if (!local.event_date) {
      toast.error("Preenche a data do evento primeiro.");
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

  function saveOrderId() {
    const v = orderIdDraft.trim().toUpperCase();
    if (!v || v === local.order_id) {
      setOrderIdPopoverOpen(false);
      return;
    }
    update("order_id", v);
    setOrderIdPopoverOpen(false);
  }

  // Cupão: gerar validade = data de hoje + 2 anos
  function generateCouponExpiry() {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    update("coupon_expiry", format(d, "yyyy-MM-dd"));
  }

  const daysUntilEvent = local.event_date
    ? differenceInCalendarDays(parseISO(local.event_date), new Date())
    : null;
  const eventAlertRelevant = isEventAlertRelevant(local.status);
  const overdueEvent =
    eventAlertRelevant && daysUntilEvent !== null && daysUntilEvent < 0;
  const soonEvent =
    eventAlertRelevant &&
    daysUntilEvent !== null &&
    daysUntilEvent >= 0 &&
    daysUntilEvent <= 5;
  const isWedding = local.event_type === "casamento";
  const eventRelative = local.event_date ? relativeMonthsDays(local.event_date) : null;

  const publicStatusLink = publicStatusUrl(local.order_id);
  const photoUrl = toEmbeddableImageUrl(local.flowers_photo_url);

  const extras: ExtrasInFrame = local.extras_in_frame ?? { options: [], notes: "" };
  function toggleExtra(opt: string) {
    const has = extras.options.includes(opt);
    let nextOptions: string[];
    if (opt === EXTRAS_NONE) {
      // "Não pretendo incluir extras" é exclusivo: limpa tudo se ligar.
      nextOptions = has ? [] : [EXTRAS_NONE];
    } else if (has) {
      nextOptions = extras.options.filter((o) => o !== opt);
    } else {
      // Ao escolher qualquer outro extra, remove o "Não pretendo incluir".
      nextOptions = [...extras.options.filter((o) => o !== EXTRAS_NONE), opt];
    }
    update("extras_in_frame", { options: nextOptions, notes: extras.notes });
  }
  function setExtraNotes(v: string) {
    update("extras_in_frame", { options: extras.options, notes: v });
  }

  const gallery: InspirationItem[] = local.inspiration_gallery ?? [];
  const [newInspirationUrl, setNewInspirationUrl] = useState("");
  function addInspiration() {
    const url = newInspirationUrl.trim();
    if (!url) return;
    const isImage = /\.(png|jpe?g|gif|webp|avif)$/i.test(url) || /(?:drive|docs)\.google\.com/.test(url);
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
  // Slots de fatura visíveis consoante o pagamento. Como o esquema de
  // pagamento real (30/40/30 vs 70/30 vs 100%) não está fixado no
  // payment_status, mostramos todos os slots possíveis no nível actual:
  //   30%  → sinal
  //   70%  → sinal + intermédio (mantém-se o intermédio mesmo no caso 70/30,
  //          a Maria simplesmente não preenche)
  //   100% → sinal + intermédio + final
  const invoiceSlotsVisible = {
    sinal: hasAnyPayment,
    intermedio: ["100_pago", "70_pago"].includes(local.payment_status),
    final: local.payment_status === "100_pago",
  };
  const missingInvoice =
    hasAnyPayment &&
    local.needs_invoice &&
    !local.invoice_url_sinal &&
    !local.invoice_url_intermedio &&
    !local.invoice_url_final;

  // Esconder custo e "pago" quando entrega/recolha é em mãos (sem custo) ou
  // "não sei" (ainda indefinido). Só faz sentido pedir o custo quando o método
  // implica transporte pago (CTT, recolha presencial).
  const hasFlowerShippingCost = local.flower_delivery_method === "ctt" || local.flower_delivery_method === "recolha_evento";
  const hasFrameShippingCost  = local.frame_delivery_method  === "ctt";
  const showFlowerShippingPaid = hasFlowerShippingCost;
  const showFrameShippingPaid  = hasFrameShippingCost;

  // ── Lembretes no cabeçalho (Contactada / 40% / 30%) ────────
  // "Contactada" só faz sentido enquanto não há pagamento — assim que o
  // cliente paga qualquer tranche, o cliente já foi obviamente contactado.
  const showContactadaPrompt = local.payment_status === "100_por_pagar";
  // "40% pedidos?" aparece quando a encomenda chegou a flores_recebidas e
  // ainda não recebemos 70%+ pago; desaparece assim que payment_status
  // passa a 70_pago / 100_pago. Estado cancelado nunca mostra.
  const reachedFloresRecebidas = (
    [
      "flores_recebidas", "flores_na_prensa", "reconstrucao_botanica",
      "a_compor_design", "a_aguardar_aprovacao", "a_finalizar_quadro",
      "a_ser_emoldurado", "emoldurado", "a_ser_fotografado",
      "quadro_pronto", "quadro_enviado", "quadro_recebido",
    ] as Order["status"][]
  ).includes(local.status);
  const reachedQuadroPronto = (
    ["quadro_pronto", "quadro_enviado", "quadro_recebido"] as Order["status"][]
  ).includes(local.status);
  const show40Prompt =
    reachedFloresRecebidas &&
    local.payment_status !== "70_pago" &&
    local.payment_status !== "100_pago";
  // "30% pedidos?" aparece em quadro_pronto+ até payment_status=100_pago.
  const show30Prompt =
    reachedQuadroPronto && local.payment_status !== "100_pago";

  // Acerto de pagamento: o orçamento subiu depois do sinal (normalmente
  // porque o tamanho da moldura foi decidido na fase de design e ficou
  // mais caro). Mostra os números para pedir a diferença ao cliente.
  const budgetAdjustment = computeBudgetAdjustment(
    local.budget,
    local.budget_at_first_payment,
    local.payment_status,
  );

  return (
    <div className="flex flex-col h-full bg-cream-50">

      {!canEdit && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Modo leitura.</strong> Não tens permissão para editar encomendas. Para alterações, fala com a MJ ou o António.
          </span>
        </div>
      )}

      <fieldset disabled={!canEdit} className="contents">

      {/* ── Header fixo ──────────────────────────────────────── */}
      <header className="shrink-0 sticky top-0 z-20 bg-surface border-b border-cream-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-1.5 sm:gap-x-3 sm:gap-y-2 sm:px-6 sm:py-3">
          <Link
            href="/preservacao"
            className="flex items-center gap-1.5 text-sm text-cocoa-700 hover:text-cocoa-900 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Preservação</span>
          </Link>

          <WorkbenchNavigator
            navKey="orders"
            currentId={local.order_id}
            basePath="/preservacao"
          />

          <Separator orientation="vertical" className="h-5 bg-cream-200 hidden sm:block" />

          {/* Nome + ID — em mobile toma a linha toda (basis-full) para o nome
              não ser truncado para "Soni..." quando "Contactada"/"Nota" o
              espremem; em sm+ partilha a linha (flex-1) como antes. */}
          <div className="basis-full sm:basis-auto sm:flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-cocoa-900 truncate leading-tight">
              {local.client_name}
            </h1>
            <div className="flex items-center gap-2 leading-tight">
              <button
                onClick={copyId}
                className="font-mono text-[10px] text-cocoa-500 hover:text-cocoa-900 transition-colors flex items-center gap-1"
                title="Copiar ID"
              >
                #{local.order_id}
                {copied && <Check className="h-3 w-3 text-green-600" />}
              </button>
              <Popover
                open={orderIdPopoverOpen}
                onOpenChange={(v) => { setOrderIdPopoverOpen(v); if (v) setOrderIdDraft(local.order_id); }}
              >
                <PopoverTrigger
                  className="text-cocoa-500 hover:text-cocoa-900 transition-colors"
                  title="Editar ID"
                >
                  <Pencil className="h-3 w-3" />
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3 space-y-2">
                  <Label className="text-xs font-medium text-cocoa-700">ID da encomenda</Label>
                  <Input
                    className={inp + " font-mono uppercase tracking-wider"}
                    value={orderIdDraft}
                    onChange={(e) => setOrderIdDraft(e.target.value)}
                    placeholder="16 caracteres alfanuméricos"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveOrderId(); } }}
                  />
                  <p className="text-[10px] text-cocoa-500 leading-relaxed">
                    Útil para encomendas antigas que já têm um ID atribuído. Tem de ser único.
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setOrderIdPopoverOpen(false)}
                      className="h-8 px-3 rounded-lg border border-cream-200 bg-surface text-xs text-cocoa-700 hover:bg-cream-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveOrderId}
                      className="h-8 px-3 rounded-lg bg-btn-primary text-btn-primary-fg text-xs font-medium hover:bg-btn-primary-hover transition-colors"
                    >
                      Guardar
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {overdueEvent && (
            <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600 font-medium shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" />
              Evento há {Math.abs(daysUntilEvent!)}d
            </div>
          )}
          {soonEvent && (
            <div className="flex items-center gap-1 rounded-lg bg-amber-200 border border-amber-400 px-2 py-1 text-xs text-amber-900 font-bold shrink-0">
              <Clock className="h-3.5 w-3.5" />
              {daysUntilEvent === 0 ? "Evento hoje" : `Evento em ${daysUntilEvent}d`}
            </div>
          )}

          <div className="flex-1 basis-full sm:basis-auto sm:flex-none sm:w-56 order-last sm:order-none">
            <StatusSelect value={local.status} onChange={onStatusChange} />
          </div>

          {showContactadaPrompt && (
            <CheckRow
              label="Contactada"
              checked={local.contacted}
              onChange={(v) => update("contacted", v)}
            />
          )}
          {show40Prompt && (
            <CheckRow
              label="40% pedidos?"
              checked={local.payment_40_requested}
              onChange={(v) => update("payment_40_requested", v)}
            />
          )}
          {show30Prompt && (
            <CheckRow
              label="30% pedidos?"
              checked={local.payment_30_requested}
              onChange={(v) => update("payment_30_requested", v)}
            />
          )}

          <div className="hidden sm:block w-24 shrink-0 text-right text-xs">
            {saveState === "saving" && (
              <span className="flex items-center justify-end gap-1 text-cocoa-500">
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

          {/* Sticky note "post-it" — botão amarelo flutuante */}
          <StickyNoteButton
            value={local.sticky_note ?? ""}
            onSave={(v) => update("sticky_note", v.trim() || null)}
            title="Nota da encomenda"
            label="Nota da encomenda"
            placeholder="Detalhe importante sobre esta encomenda…"
          />

          {canEdit && (
            <button
              type="button"
              onClick={() => setArchiveDialogOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-surface text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
              title="Arquivar esta encomenda"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Arquivar</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Corpo: 3 colunas em desktop, lista plana em mobile ──
          As 3 colunas usam `display: contents` em mobile (<lg) para deixar
          os cards individuais ficarem como filhos directos da grid. Cada
          card recebe um `order-N` em mobile (e `lg:order-none` em desktop)
          para a Maria conseguir reordenar Finanças → Comunicações → Envio
          → Flores independentemente da coluna em que vivem em desktop. */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-2 sm:p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">

            {/* ═══════════════════════════════
                COLUNA ESQUERDA — COMUNICAÇÕES + GALERIA (sticky em desktop)
                Em mobile usa `display: contents` para os cards subirem
                à grid e aceitarem os `order-N` individuais.
            ═══════════════════════════════ */}
            <aside className="contents lg:block lg:col-span-3">
              <div className="contents lg:block lg:space-y-4 lg:space-y-5 lg:sticky lg:top-2">

              <Card
                title="Comunicações"
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                accent="blue"
                className="order-4 lg:order-none"
                action={
                  <button
                    type="button"
                    onClick={() => {
                      const next: FormLanguage = local.form_language === "pt" ? "en" : "pt";
                      clientUpdate(
                        "form_language",
                        next,
                        "Idioma do formulário",
                        (v) => v ? FORM_LANGUAGE_LABELS[v as FormLanguage] : "—",
                      );
                    }}
                    className="inline-flex items-center rounded-md p-0.5 hover:bg-cream-100 transition-colors"
                    title={`Idioma do formulário: ${FORM_LANGUAGE_LABELS[local.form_language]}. Clica para trocar.`}
                  >
                    <Flag lang={local.form_language} className="h-4 w-6" />
                  </button>
                }
              >
                {/* Contactos do cliente — discreto, sem caixa pesada */}
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {local.email ? (
                        <a
                          href={`mailto:${local.email}`}
                          className={`flex items-center gap-1.5 text-[12px] hover:text-cocoa-900 transition-colors ${
                            local.contact_preference === "email"
                              ? "text-blue-700 font-medium"
                              : "text-cocoa-700"
                          }`}
                          title={local.contact_preference === "email" ? "Contacto preferido" : "Email"}
                        >
                          <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="truncate">{local.email}</span>
                          {local.contact_preference === "email" && (
                            <span className="ml-auto text-[10px] uppercase tracking-wider text-blue-600 shrink-0">★</span>
                          )}
                        </a>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[12px] text-cocoa-500 italic">
                          <Mail className="h-3.5 w-3.5 text-blue-500/60 shrink-0" />
                          <span>Sem email</span>
                        </div>
                      )}
                      {local.phone ? (
                        <a
                          href={`https://wa.me/${phoneToWaMe(local.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 text-[12px] hover:text-cocoa-900 transition-colors ${
                            local.contact_preference === "whatsapp"
                              ? "text-green-700 font-medium"
                              : "text-cocoa-700"
                          }`}
                          title={local.contact_preference === "whatsapp" ? "Contacto preferido" : "WhatsApp"}
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="truncate font-mono">{formatPhone(local.phone)}</span>
                          {local.contact_preference === "whatsapp" && (
                            <span className="ml-auto text-[10px] uppercase tracking-wider text-green-600 shrink-0">★</span>
                          )}
                        </a>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[12px] text-cocoa-500 italic">
                          <MessageCircle className="h-3.5 w-3.5 text-green-500/60 shrink-0" />
                          <span>Sem telemóvel</span>
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <Popover
                        open={contactPopoverOpen}
                        onOpenChange={(v) => {
                          setContactPopoverOpen(v);
                          if (v) {
                            setContactDraftPhone(local.phone ?? "");
                            setContactDraftEmail(local.email ?? "");
                            setContactDraftPreference(local.contact_preference ?? "");
                          }
                        }}
                      >
                        <PopoverTrigger
                          className="shrink-0 mt-0.5 p-1 rounded-md text-cocoa-500 hover:bg-cream-100 hover:text-cocoa-900 transition-colors"
                          title="Editar contactos e preferência"
                        >
                          <Pencil className="h-3 w-3" />
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 space-y-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-cocoa-700">
                            Contactos do cliente
                          </p>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-cocoa-700 flex items-center gap-1.5">
                              <MessageCircle className="h-3 w-3 text-green-500" /> Telemóvel (WhatsApp)
                            </Label>
                            <Input
                              className={inp + " font-mono"}
                              type="tel"
                              value={contactDraftPhone}
                              onChange={(e) => setContactDraftPhone(e.target.value)}
                              placeholder="+351 9XX XXX XXX"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-cocoa-700 flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-blue-500" /> Email
                            </Label>
                            <Input
                              className={inp}
                              type="email"
                              value={contactDraftEmail}
                              onChange={(e) => setContactDraftEmail(e.target.value)}
                              placeholder="nome@exemplo.pt"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-cocoa-700">Contacto preferido</Label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setContactDraftPreference("whatsapp")}
                                className={`h-8 rounded-lg border text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                                  contactDraftPreference === "whatsapp"
                                    ? "border-green-300 bg-green-50 text-green-700"
                                    : "border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-50"
                                }`}
                              >
                                <MessageCircle className="h-3 w-3 text-green-500" /> WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => setContactDraftPreference("email")}
                                className={`h-8 rounded-lg border text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                                  contactDraftPreference === "email"
                                    ? "border-blue-300 bg-blue-50 text-blue-700"
                                    : "border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-50"
                                }`}
                              >
                                <Mail className="h-3 w-3 text-blue-500" /> Email
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-cocoa-500 leading-relaxed">
                            Se o cliente deu um número errado e corrigiu por mensagem, atualiza aqui.
                          </p>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setContactPopoverOpen(false)}
                              className="h-8 px-3 rounded-lg border border-cream-200 bg-surface text-xs text-cocoa-700 hover:bg-cream-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newPhone = contactDraftPhone.trim() || null;
                                const newEmail = contactDraftEmail.trim() || null;
                                const newPref = contactDraftPreference || null;
                                if (newPhone !== (local.phone ?? null)) update("phone", newPhone);
                                if (newEmail !== (local.email ?? null)) update("email", newEmail);
                                if (newPref !== (local.contact_preference ?? null)) update("contact_preference", newPref);
                                setContactPopoverOpen(false);
                              }}
                              className="h-8 px-3 rounded-lg bg-btn-primary text-btn-primary-fg text-xs font-medium hover:bg-btn-primary-hover transition-colors"
                            >
                              Guardar
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>

                {/* Picker de templates de mensagens — sugere templates conforme estado da encomenda */}
                <div className="pt-2">
                  <TemplatePicker
                    scope="order"
                    order={local}
                    preferredLanguage={local.form_language}
                  />
                </div>

                <Tabs defaultValue={local.contact_preference === "whatsapp" ? "whatsapp" : "email"}>
                  <TabsList className="bg-cream-50 border border-cream-200 w-full">
                    <TabsTrigger value="email" className="flex-1 text-xs data-[state=active]:bg-surface data-[state=active]:text-blue-700">
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      Email
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="flex-1 text-xs data-[state=active]:bg-surface data-[state=active]:text-green-700">
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                      WhatsApp
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="email" className="mt-3">
                    <GmailPanel email={local.email} />
                  </TabsContent>
                  <TabsContent value="whatsapp" className="mt-3">
                    <WhatsappLivePanel phone={local.phone} />
                  </TabsContent>
                </Tabs>
              </Card>

              {/* Inventário das flores — secção dedicada na coluna esquerda
                  (anteriormente vivia dentro do card "Flores, quadro e extras") */}
              <Card
                title="Inventário das flores"
                icon={<Flower2 className="h-3.5 w-3.5" />}
                accent="green"
                className="order-9 lg:order-none"
                badge={
                  (local.inventory?.length ?? 0) > 0 ? (
                    <span className="text-[10px] text-green-700 font-semibold bg-green-100 px-1.5 py-0.5 rounded-full">
                      {local.inventory!.length}
                    </span>
                  ) : undefined
                }
              >
                <InventorySection
                  items={local.inventory ?? []}
                  onChange={(items) => update("inventory", items)}
                />
              </Card>

              <Card title="Assistente de resposta" icon={<Sparkles className="h-3.5 w-3.5" />} accent="violet" className="order-11 lg:order-none">
                <div className="space-y-3">
                  <Textarea
                    disabled
                    rows={4}
                    placeholder="Em breve: descreve o tipo de resposta (ex: 'agradecer feedback' ou 'confirmar agendamento') e a IA gera um rascunho com o tom da marca, em PT ou EN, baseado no contexto desta encomenda."
                    className="text-sm border-cream-200 bg-cream-50 text-cocoa-700 rounded-lg resize-none italic"
                  />
                  <button
                    disabled
                    className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg border border-cream-200 bg-cream-50 text-cocoa-500 text-xs font-medium cursor-not-allowed"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Sugerir resposta (em breve)
                  </button>
                </div>
              </Card>

              {/* Galeria de inspiração — movida para a coluna esquerda */}
              <Card
                title="Galeria de inspiração"
                icon={<Heart className="h-3.5 w-3.5" />}
                accent="pink"
                className="order-10 lg:order-none"
                badge={gallery.length > 0 ? <span className="text-[10px] text-pink-700 font-semibold bg-pink-100 px-1.5 py-0.5 rounded-full">{gallery.length}</span> : undefined}
              >
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      className={inp + " flex-1"}
                      placeholder="Cole link ou URL"
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
                    </button>
                  </div>

                  {gallery.length === 0 ? (
                    <PlaceholderBox
                      icon={<Heart className="h-4 w-4" />}
                      title="Sem inspirações"
                      description="Adicione fotos de bouquets de referência, paletas, ou ideias do cliente."
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {gallery.map((item, idx) => {
                        const embedUrl = toEmbeddableImageUrl(item.url);
                        return (
                          <div key={idx} className="group relative aspect-square rounded-lg border border-cream-200 bg-cream-50 overflow-hidden">
                            {item.type === "image" && embedUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={embedUrl} alt={item.label ?? ""} className="w-full h-full object-cover" />
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
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>

              </div>
            </aside>

            {/* ═══════════════════════════════
                COLUNA DO MEIO — DETALHES PRINCIPAIS
                Em mobile usa `display: contents` (ver nota em cima).
            ═══════════════════════════════ */}
            <main className="contents lg:block lg:col-span-6 lg:space-y-4 lg:space-y-5">

              {/* Hero unificado: foto + dados do cliente + dados do evento */}
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
                          eventDate={local.event_date}
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
                            <a
                              href={publicStatusLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 transition-colors shrink-0"
                              title="Abrir status público"
                            >
                              <Globe className="h-3 w-3" />
                              Status público
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
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
              </div>

              {/* Alerta visual de fatura em falta */}
              {missingInvoice && (
                <div className="order-2 lg:order-none flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <p className="font-semibold">Falta anexar fatura</p>
                    <p className="text-amber-800 mt-0.5">
                      Esta encomenda tem pagamento e o cliente pediu fatura com NIF, mas ainda não há anexo.
                    </p>
                  </div>
                </div>
              )}

              {/* Alerta de aprovação pendente (estado a_aguardar_aprovacao) */}
              {local.status === "a_aguardar_aprovacao" && !local.approval_responded && (() => {
                const daysWaiting = differenceInCalendarDays(new Date(), parseISO(local.updated_at));
                const urgent = daysWaiting >= 4;
                return (
                  <div className={`order-2 lg:order-none flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    urgent
                      ? "bg-red-50 border-red-200"
                      : "bg-sky-50 border-sky-200"
                  }`}>
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${urgent ? "text-red-600" : "text-sky-600"}`} />
                    <div className={`flex-1 text-xs leading-relaxed ${urgent ? "text-red-900" : "text-sky-900"}`}>
                      <p className="font-semibold">
                        {urgent
                          ? `Cliente em silêncio há ${daysWaiting} dias`
                          : "A aguardar resposta do cliente"}
                      </p>
                      <p className={`mt-0.5 ${urgent ? "text-red-800" : "text-sky-800"}`}>
                        {urgent
                          ? "Já passaram mais de 4 dias desde que se pediu aprovação. Volta a contactar."
                          : "Marcar como respondida quando o cliente confirmar a proposta de composição."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update("approval_responded", true)}
                      className="shrink-0 inline-flex items-center gap-1 h-7 px-3 rounded-lg bg-surface border border-current text-xs font-medium hover:bg-current/5 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Cliente já respondeu
                    </button>
                  </div>
                );
              })()}

              {/* Card único: Flores, quadro, extras e peças extra */}
              {/* Inventário das flores vive na coluna esquerda — secção própria */}
              <Card title="Flores, quadro e extras" icon={<Flower2 className="h-3.5 w-3.5" />} accent="emerald" className="order-6 lg:order-none">
                <Grid2>
                  <Field label="Tipo de flores" span2>
                    <Input className={inp} value={local.flower_type ?? ""} onChange={(e) => update("flower_type", e.target.value || null)} placeholder="Rosas, peónias, silvestres…" />
                  </Field>
                  <Field label="Tamanho da moldura">
                    <Select value={local.frame_size ?? ""} onValueChange={(v) => clientUpdate("frame_size", v as Order["frame_size"], "Tamanho da moldura", (val) => val ? FRAME_SIZE_LABELS[val] : "—")}>
                      <SelectTrigger
                        className={`${sel} font-medium ${local.frame_size ? FRAME_SIZE_COLORS[local.frame_size] : ""}`}
                      >
                        <SelectValue placeholder="—" labels={FRAME_SIZE_LABELS} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FRAME_SIZE_LABELS) as Array<keyof typeof FRAME_SIZE_LABELS>).map((k) => (
                          <SelectItem key={k} value={k} className="my-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${FRAME_SIZE_COLORS[k]}`}>
                              {FRAME_SIZE_LABELS[k]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Fundo do quadro">
                    <Select value={local.frame_background ?? ""} onValueChange={(v) => clientUpdate("frame_background", v as Order["frame_background"], "Fundo do quadro", (val) => val ? FRAME_BACKGROUND_LABELS[val] : "—")}>
                      <SelectTrigger className={sel}><SelectValue placeholder="—" labels={FRAME_BACKGROUND_LABELS} /></SelectTrigger>
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
                  <Field
                    label="Moldura pirâmide"
                    hint="Upgrade pago pelo cliente. Aplica suplemento ao orçamento."
                  >
                    <Select
                      value={local.pyramid_frame ? "sim" : "nao"}
                      onValueChange={(v) => update("pyramid_frame", v === "sim")}
                    >
                      <SelectTrigger
                        className={`${sel} font-medium ${
                          local.pyramid_frame
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : ""
                        }`}
                      >
                        <SelectValue labels={SIM_NAO_LABELS} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Tipo de moldura (interno)"
                    hint="Baixa (2x2cm, default) ou Caixa (2x3cm, flores altas). Cliente paga igual; afecta custo de produção."
                  >
                    {local.pyramid_frame ? (
                      <div className={`${sel} flex items-center text-cocoa-500 italic`}>
                        Pirâmide
                      </div>
                    ) : (
                      <Select
                        value={local.frame_internal_type ?? ""}
                        onValueChange={(v) =>
                          update("frame_internal_type", v as "baixa" | "caixa")
                        }
                      >
                        <SelectTrigger className={sel}>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa (2x2cm)</SelectItem>
                          <SelectItem value="caixa">Caixa (2x3cm)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                </Grid2>

                <Separator className="bg-cream-100" />

                {/* Extras a incluir no quadro */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                    Extras a incluir no quadro
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {EXTRA_OPTIONS.map((opt) => (
                      <CheckRow
                        key={opt}
                        label={opt}
                        checked={extras.options.includes(opt)}
                        onChange={() => toggleExtra(opt)}
                      />
                    ))}
                  </div>
                  {extras.options.includes(EXTRAS_OTHER) && (
                    <Field label='Especifique "Outro"'>
                      <Textarea
                        className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
                        rows={2}
                        value={extras.notes}
                        onChange={(e) => setExtraNotes(e.target.value)}
                        placeholder="Ex: pequena pena de pavão, anel da avó…"
                      />
                    </Field>
                  )}
                </div>

                <Separator className="bg-cream-100" />

                {/* Peças extra — compactas, qty estreito (max 2 algarismos típicos) */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                    Peças extra
                  </p>
                  <div className="space-y-1.5">
                    <ExtraPieceRow
                      label="Quadros extra pequenos"
                      value={local.extra_small_frames}
                      qty={local.extra_small_frames_qty}
                      onValue={(v) => update("extra_small_frames", v)}
                      onQty={(q) => update("extra_small_frames_qty", q)}
                    />
                    {(local.extra_small_frames === "sim" ||
                      local.extra_small_frames === "mais_info") && (
                      <div className="ml-2 pl-3 border-l-2 border-cream-200">
                        <Field
                          label="Fundo do quadro extra"
                          hint="Só preencher se for diferente do fundo do quadro principal."
                        >
                          <Select
                            value={local.extra_small_frames_background ?? ""}
                            onValueChange={(v) =>
                              update(
                                "extra_small_frames_background",
                                (v || null) as Order["extra_small_frames_background"],
                              )
                            }
                          >
                            <SelectTrigger className={sel}>
                              <SelectValue
                                placeholder="— (igual ao principal)"
                                labels={FRAME_BACKGROUND_LABELS}
                              />
                            </SelectTrigger>
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
                      </div>
                    )}
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
                </div>
              </Card>

              {/* Card separado: Envio das flores + Receção do quadro */}
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
                </div>
              </Card>

              {/* Origem e notas */}
              <Card title="Origem e notas" icon={<StickyNote className="h-3.5 w-3.5" />} accent="slate" className="order-12 lg:order-none">
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

            </main>

            {/* ═══════════════════════════════
                COLUNA DIREITA — FINANÇAS / PARCERIA / ENTREGA / CUPÃO
                Em mobile usa `display: contents` (ver nota em cima).
            ═══════════════════════════════ */}
            <aside className="contents lg:block lg:col-span-3 lg:space-y-4 lg:space-y-5">

              <Card
                title="Tarefas"
                icon={<CheckSquare className="h-3.5 w-3.5" />}
                accent="indigo"
                className="order-7 lg:order-none"
              >
                <WorkbenchTasksBlock
                  link={{ type: "order", id: local.id }}
                  context={{
                    client_name: local.client_name,
                    nif: local.nif,
                    partner_name: partners.find((p) => p.id === local.partner_id)?.name ?? null,
                    partner_commission: local.partner_commission,
                  }}
                  paymentOptions={computeAmountOptionsFromBudget(local.budget ?? null)}
                  templates={taskTemplates}
                  initialTasks={orderTasks}
                  currentEmail={currentEmail}
                  canEdit={canEdit}
                />
              </Card>

              <Card title="Finanças" icon={<Wallet className="h-3.5 w-3.5" />} accent="green" className="order-3 lg:order-none">
                <div className="space-y-3">
                  <div className="grid grid-cols-[2fr_3fr] gap-3">
                    <Field label="Orçamento">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
                        <Input
                          className={inp + " pl-7"}
                          type="number" min={0} step={0.01}
                          value={local.budget ?? ""}
                          onChange={(e) => update("budget", e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                      <BudgetSnapshotBadge
                        orderId={local.id}
                        snapshot={local.pricing_snapshot}
                        currentBudget={local.budget}
                        canEdit={canEdit}
                      />
                    </Field>
                    <Field label="Pagamento">
                      <Select value={local.payment_status} onValueChange={(v) => onPaymentStatusChange(v as PaymentStatus)}>
                        <SelectTrigger className={`${sel} font-medium w-full max-w-full ${PAYMENT_COLORS[local.payment_status] ?? ""}`}>
                          <SelectValue labels={PAYMENT_STATUS_LABELS} />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PAYMENT_STATUS_LABELS) as Array<keyof typeof PAYMENT_STATUS_LABELS>).map((s) => (
                            <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {/* Acerto de pagamento: orçamento subiu depois do sinal */}
                  {budgetAdjustment && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Orçamento subiu depois do 1.º pagamento
                      </div>
                      <div className="text-amber-800 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span>Antes / agora</span>
                          <span className="tabular-nums font-medium">
                            {formatEUR(budgetAdjustment.oldBudget, { compact: true })} → {formatEUR(budgetAdjustment.newBudget, { compact: true })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>Já recebido ({Math.round(budgetAdjustment.paidFraction * 100)}% × {formatEUR(budgetAdjustment.oldBudget, { compact: true })})</span>
                          <span className="tabular-nums font-medium">{formatEUR(budgetAdjustment.paidAmount, { compact: true })}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>No valor actual: 30% / 70% / 100%</span>
                          <span className="tabular-nums">
                            {formatEUR(budgetAdjustment.sinal, { compact: true })} · {formatEUR(budgetAdjustment.cumul70, { compact: true })} · {formatEUR(budgetAdjustment.full, { compact: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-amber-200 pt-1.5 font-semibold text-amber-900">
                        <span>Para chegar aos {Math.round(budgetAdjustment.nextFraction * 100)}%, pedir</span>
                        <span className="tabular-nums">{formatEUR(budgetAdjustment.missing, { compact: true })}</span>
                      </div>
                    </div>
                  )}

                  {/* Pediu fatura — Sim/Não com NIF inline à direita do Sim */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-cocoa-700">Cliente pediu fatura com NIF?</Label>
                    <div className="flex gap-2 items-stretch">
                      <Select
                        value={local.needs_invoice ? "sim" : "nao"}
                        onValueChange={(v) => update("needs_invoice", v === "sim")}
                      >
                        <SelectTrigger className={`${sel} ${local.needs_invoice ? "shrink-0 w-24" : "flex-1"}`}>
                          <SelectValue labels={SIM_NAO_LABELS} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      {local.needs_invoice && (
                        <Input
                          className={inp + " flex-1 min-w-0"}
                          value={local.nif ?? ""}
                          onChange={(e) => update("nif", e.target.value || null)}
                          placeholder="NIF (9 dígitos)"
                        />
                      )}
                    </div>
                  </div>
                  {local.needs_invoice && hasAnyPayment && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-cocoa-700">Anexos das faturas (Drive)</Label>
                      {(
                        [
                          { key: "invoice_url_sinal",      label: "Sinal",      show: invoiceSlotsVisible.sinal },
                          { key: "invoice_url_intermedio", label: "Intermédio", show: invoiceSlotsVisible.intermedio },
                          { key: "invoice_url_final",      label: "Final",      show: invoiceSlotsVisible.final },
                        ] as const
                      )
                        .filter((slot) => slot.show)
                        .map((slot) => {
                          const value = local[slot.key];
                          return (
                            <div key={slot.key} className="flex gap-1.5 items-center">
                              <span className="text-[11px] font-medium text-cocoa-600 w-20 shrink-0">{slot.label}</span>
                              <Input
                                className={inp + " flex-1 min-w-0"}
                                value={value ?? ""}
                                onChange={(e) => update(slot.key, e.target.value || null)}
                                placeholder="URL do PDF (Drive)"
                              />
                              {value && (
                                <a
                                  href={value}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cream-200 bg-cream-50 text-cocoa-700 hover:bg-btn-primary hover:text-btn-primary-fg hover:border-btn-primary transition-colors"
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </Card>

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
                        onChange={(id) => {
                          const updates: Partial<OrderUpdate> = { partner_id: id };
                          // Auto-preenche 10% do orçamento quando se escolhe um parceiro
                          // (mas só se ainda não há comissão definida — para não sobrescrever
                          // um valor que a Maria já editou manualmente).
                          if (id && (local.partner_commission === null || local.partner_commission === 0) && local.budget) {
                            updates.partner_commission = Math.round(local.budget * 0.1 * 100) / 100;
                          }
                          if (id && local.partner_commission_status === "na") {
                            updates.partner_commission_status = "a_aguardar";
                          }
                          // Aplica todos numa transição
                          setLocal((prev) => ({ ...prev, ...updates }));
                          pendingRef.current = { ...pendingRef.current, ...updates };
                          setSaveState("idle");
                          clearTimeout(timerRef.current);
                          timerRef.current = setTimeout(flush, 900);
                        }}
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

              {/* "Entrega e feedback" só aparece a partir do estado "Quadro pronto" — antes disso ainda
                  não faz sentido editar data de entrega ou feedback do cliente. */}
              {["quadro_pronto", "quadro_enviado", "quadro_recebido"].includes(local.status) && (
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
              )}

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

            </aside>

          </div>
        </div>
      </div>

      {/* ── Diálogo de mudança de pagamento ──────────────────── */}
      <Dialog open={!!paymentDialog} onOpenChange={(open) => !open && setPaymentDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cocoa-900">
              <Receipt className="h-4 w-4 text-emerald-600" />
              Pagamento atualizado
            </DialogTitle>
            <DialogDescription className="text-cocoa-700">
              Vais marcar este pagamento como{" "}
              <strong className="text-cocoa-900">
                {paymentDialog ? PAYMENT_STATUS_LABELS[paymentDialog.newStatus] : ""}
              </strong>
              . Antes de confirmar, vê estas duas coisas:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <Paperclip className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm text-cocoa-900">
                  <p className="font-medium">Anexa o comprovativo à pasta Drive</p>
                  <p className="text-xs text-cocoa-700 mt-0.5">
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
              <Label className="text-xs font-medium text-cocoa-700">O cliente pediu fatura com NIF?</Label>
              <div className="flex gap-2 items-stretch">
                <Select
                  value={dialogNeedsInvoice ? "sim" : "nao"}
                  onValueChange={(v) => setDialogNeedsInvoice(v === "sim")}
                >
                  <SelectTrigger className={`${sel} ${dialogNeedsInvoice ? "shrink-0 w-24" : "flex-1"}`}>
                    <SelectValue labels={SIM_NAO_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
                {dialogNeedsInvoice && (
                  <Input
                    className={inp + " flex-1 min-w-0"}
                    value={dialogNif}
                    onChange={(e) => setDialogNif(e.target.value)}
                    placeholder="NIF (9 dígitos)"
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setPaymentDialog(null)}
              className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmPaymentDialog}
              className="h-9 px-4 rounded-lg bg-btn-primary text-sm text-btn-primary-fg font-medium hover:bg-btn-primary-hover transition-colors"
            >
              Confirmar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo de confirmação de edição de campo do cliente ─── */}
      <Dialog open={!!clientEditDialog} onOpenChange={(open) => !open && setClientEditDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cocoa-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Confirmar alteração
            </DialogTitle>
            <DialogDescription className="text-cocoa-700">
              Este campo foi preenchido pelo <strong className="text-cocoa-900">cliente</strong> no formulário.
              Tens a certeza que queres alterar?
            </DialogDescription>
          </DialogHeader>

          {clientEditDialog && (
            <div className="space-y-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cocoa-700">
                {clientEditDialog.label}
              </p>
              <div className="rounded-lg border border-cream-200 bg-cream-50 divide-y divide-cream-200">
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="text-[10px] uppercase tracking-wider text-cocoa-500 w-12">Antes</span>
                  <span className="text-sm text-cocoa-700 line-through">{clientEditDialog.oldDisplay}</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-2 bg-amber-50/50">
                  <span className="text-[10px] uppercase tracking-wider text-amber-700 w-12">Novo</span>
                  <span className="text-sm font-medium text-cocoa-900">{clientEditDialog.newDisplay}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setClientEditDialog(null)}
              className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmClientEdit}
              className="h-9 px-4 rounded-lg bg-amber-600 text-sm text-white font-medium hover:bg-amber-700 transition-colors"
            >
              Sim, alterar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo lembrete de pagamento (40% ou 30%) ────────── */}
      <Dialog open={!!paymentReminderDialog} onOpenChange={(o) => { if (!o) setPaymentReminderDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cocoa-900">
              <Wallet className="h-4 w-4 text-amber-600" />
              {paymentReminderDialog?.kind === "40" ? "Pedir 40% ao cliente?" : "Pedir últimos 30% ao cliente?"}
            </DialogTitle>
            <DialogDescription className="text-cocoa-700">
              {paymentReminderDialog?.kind === "40"
                ? "As flores chegaram à FBR — é boa altura para pedir os 40% seguintes ao cliente. Já pediste?"
                : "O quadro está praticamente pronto — é boa altura para pedir os últimos 30%. Já pediste?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => confirmPaymentReminder(false)}
              className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
            >
              Ainda não — lembra-me depois
            </button>
            <button
              onClick={() => confirmPaymentReminder(true)}
              className="h-9 px-4 rounded-lg bg-amber-600 text-sm text-white font-medium hover:bg-amber-700 transition-colors"
            >
              {paymentReminderDialog?.kind === "40" ? "Sim, já pedi os 40%" : "Sim, já pedi os 30%"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo "Quadro recebido" → pede data de entrega ─── */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cocoa-900">
              <Package className="h-4 w-4 text-purple-600" />
              Quadro recebido
            </DialogTitle>
            <DialogDescription className="text-cocoa-700">
              Para fechar bem esta encomenda, indica em que dia o cliente recebeu o quadro.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Label className="text-xs font-medium text-cocoa-700">Data de entrega do quadro</Label>
            <Input
              className={inp + " mt-1.5"}
              type="date"
              value={deliveryDateDraft}
              onChange={(e) => setDeliveryDateDraft(e.target.value)}
              autoFocus
            />
            <p className="text-[10px] text-cocoa-500 mt-2 leading-relaxed">
              Esta data é usada para calcular a validade do cupão de 5%.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setDeliveryDialogOpen(false)}
              className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
            >
              Mais tarde
            </button>
            <button
              onClick={confirmDeliveryDialog}
              className="h-9 px-4 rounded-lg bg-btn-primary text-sm text-btn-primary-fg font-medium hover:bg-btn-primary-hover transition-colors disabled:opacity-50"
              disabled={!deliveryDateDraft}
            >
              Guardar data
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: arquivar encomenda ──────────────────────── */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cocoa-900">
              <Trash2 className="h-4 w-4 text-red-600" />
              Arquivar esta encomenda?
            </DialogTitle>
            <DialogDescription className="text-cocoa-700">
              A encomenda fica arquivada e deixa de aparecer na lista. Podes recuperá-la
              ou apagá-la definitivamente em <strong>Mostrar arquivados</strong> na listagem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setArchiveDialogOpen(false)}
              className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
              disabled={archiving}
            >
              Cancelar
            </button>
            <button
              onClick={handleArchive}
              className="h-9 px-4 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              disabled={archiving}
            >
              {archiving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Arquivar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </fieldset>
    </div>
  );
}
