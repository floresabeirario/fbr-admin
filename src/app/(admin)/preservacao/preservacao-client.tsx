"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, differenceInDays, differenceInCalendarDays } from "date-fns";
import { pt } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  LayoutList,
  CalendarDays,
  LayoutGrid,
  AlertTriangle,
  ExternalLink,
  Check,
  Loader2,
  Image as ImageIcon,
  Download,
  ListOrdered,
  Clock,
  Undo2,
  Archive,
  ArchiveRestore,
  Trash2,
  Gift,
} from "lucide-react";
import HardDeleteDialog from "@/components/hard-delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupOrders } from "@/lib/supabase/orders";
import { exportOrdersToCsv } from "@/lib/export-csv";
import { toEmbeddableImageUrl } from "@/lib/drive-url";
import {
  type Order,
  type OrderStatus,
  type PaymentStatus,
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
} from "@/types/database";

type ShippingColumn = "flores" | "quadro";
import NovaEncomendaSheet from "./nova-encomenda-sheet";
import {
  updateOrderAction,
  restoreOrderAction,
  hardDeleteOrderAction,
} from "./actions";
import {
  STATUS_COLORS,
  STATUS_ICONS,
  STATUS_GROUPS,
  PAYMENT_COLORS,
  PAYMENT_DOT_COLORS,
} from "./_styles";
import CalendarView from "./calendar-view";
import TimelineView from "./timeline-view";

// ── Formatação ────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: pt });
  } catch {
    return "—";
  }
}

function formatEuro(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

// ── Dropdown de estado partilhado (tabela + workbench) ────────

export function StatusSelect({
  value,
  onChange,
  busy,
  size = "sm",
  disabled = false,
}: {
  value: OrderStatus;
  onChange: (s: OrderStatus) => void;
  busy?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const colorClass = STATUS_COLORS[value] ?? "bg-gray-100 text-gray-700 border-gray-300";
  const heightClass = size === "md" ? "h-8 text-xs" : "h-7 text-[11px]";

  return (
    <Select value={value} onValueChange={(v) => onChange(v as OrderStatus)} disabled={busy || disabled}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`${heightClass} font-semibold border rounded-md px-2.5 max-w-[220px] ${colorClass} hover:brightness-95 transition`}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue>
            {(v) => {
              if (typeof v !== "string" || !(v in STATUS_LABELS)) return null;
              const key = v as OrderStatus;
              const Icon = STATUS_ICONS[key];
              return (
                <>
                  <Icon className="h-3 w-3 shrink-0" />
                  {STATUS_LABELS[key]}
                </>
              );
            }}
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent
        onClick={(e) => e.stopPropagation()}
        className="max-h-[420px] min-w-[280px] p-0 rounded-md border border-[#E8E0D5]"
      >
        {STATUS_GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <SelectSeparator className="bg-[#E8E0D5] my-0" />}
            <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#B8A99A]">
              {group.label}
            </div>
            <div className="px-1 pb-1">
              {group.statuses.map((s) => {
                const Icon = STATUS_ICONS[s];
                return (
                  <SelectItem key={s} value={s} className="my-0.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[#8B7355]" />
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

// ── Dropdown de pagamento partilhado ──────────────────────────

export function PaymentSelect({
  value,
  onChange,
  busy,
  disabled = false,
}: {
  value: PaymentStatus;
  onChange: (p: PaymentStatus) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const colorClass = PAYMENT_COLORS[value] ?? "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentStatus)} disabled={busy || disabled}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-7 text-[11px] font-semibold border rounded-md px-2.5 ${colorClass} hover:brightness-95 transition`}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue labels={PAYMENT_STATUS_LABELS} />
        )}
      </SelectTrigger>
      <SelectContent className="rounded-md border border-[#E8E0D5]">
        {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((s) => (
          <SelectItem key={s} value={s} className="text-xs font-medium rounded-md">
            <span className={`h-2 w-2 rounded-full shrink-0 ${PAYMENT_DOT_COLORS[s]}`} />
            {PAYMENT_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Linha da tabela ───────────────────────────────────────────

function OrderRow({
  order,
  onOpen,
  shippingColumn,
  isLoading,
  canEdit,
  inSemResposta,
  voucherCodeToId,
}: {
  order: Order;
  onOpen: (o: Order) => void;
  shippingColumn: ShippingColumn;
  isLoading: boolean;
  canEdit: boolean;
  inSemResposta: boolean;
  voucherCodeToId: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus | null>(null);
  const [optimisticPayment, setOptimisticPayment] = useState<PaymentStatus | null>(null);
  const [optimisticContacted, setOptimisticContacted] = useState<boolean | null>(null);

  const currentStatus = optimisticStatus ?? order.status;
  const currentPayment = optimisticPayment ?? order.payment_status;
  const currentContacted = optimisticContacted ?? order.contacted;

  const daysUntilEvent =
    order.event_date
      ? differenceInCalendarDays(parseISO(order.event_date), new Date())
      : null;
  const urgentEvent =
    daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;

  const isPreReserva = currentStatus === "entrega_flores_agendar";
  const daysSinceCreated = differenceInDays(new Date(), new Date(order.created_at));
  const autoFlaggedSemResposta = isPreReserva && !currentContacted && daysSinceCreated >= 4;

  const shippingLabel =
    shippingColumn === "flores"
      ? order.flower_delivery_method
        ? FLOWER_DELIVERY_METHOD_LABELS[order.flower_delivery_method]
        : "—"
      : order.frame_delivery_method
        ? FRAME_DELIVERY_METHOD_LABELS[order.frame_delivery_method]
        : "—";

  function changeStatus(newStatus: OrderStatus) {
    if (newStatus === currentStatus) return;
    setOptimisticStatus(newStatus);
    startTransition(async () => {
      try {
        await updateOrderAction(order.id, { status: newStatus });
        router.refresh();
      } catch {
        setOptimisticStatus(null);
      }
    });
  }

  function changePayment(newPayment: PaymentStatus) {
    if (newPayment === currentPayment) return;
    setOptimisticPayment(newPayment);
    startTransition(async () => {
      try {
        await updateOrderAction(order.id, { payment_status: newPayment });
        router.refresh();
      } catch {
        setOptimisticPayment(null);
      }
    });
  }

  function markContacted() {
    setOptimisticContacted(true);
    startTransition(async () => {
      try {
        await updateOrderAction(order.id, {
          contacted: true,
          manually_no_response: false,
        });
        router.refresh();
      } catch {
        setOptimisticContacted(null);
      }
    });
  }

  function moveToSemResposta() {
    startTransition(async () => {
      try {
        await updateOrderAction(order.id, { manually_no_response: true });
        router.refresh();
      } catch {
        // silencioso — UI volta ao estado anterior no refresh
      }
    });
  }

  function moveOutOfSemResposta() {
    startTransition(async () => {
      try {
        await updateOrderAction(order.id, { manually_no_response: false });
        router.refresh();
      } catch {
        // silencioso
      }
    });
  }

  return (
    <tr
      className={`border-b border-[#F0EAE0] cursor-pointer transition-colors ${
        isLoading ? "bg-[#F0EAE0]/60" : "hover:bg-[#FDFAF7]"
      }`}
      onClick={() => onOpen(order)}
    >
      <td className="px-4 py-1.5">
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882] shrink-0" />}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[#3D2B1F]">{order.client_name}</span>
              {/* Ícone presente: aparece quando a encomenda veio de um vale-presente
                  cujo código existe ainda nos vales activos. Click → abre o vale. */}
              {order.gift_voucher_code && voucherCodeToId[order.gift_voucher_code] && (
                <a
                  href={`/vale-presente/${order.gift_voucher_code}`}
                  onClick={(e) => e.stopPropagation()}
                  title={`Encomenda originada do vale ${order.gift_voucher_code}`}
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <Gift className="h-2.5 w-2.5" />
                  Vale
                </a>
              )}
              {currentContacted && isPreReserva && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 border border-green-200 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                  <Check className="h-2.5 w-2.5" />
                  Contactada
                </span>
              )}
            </div>
            {order.event_type && (
              <span className="text-xs text-[#8B7355]">
                {EVENT_TYPE_LABELS[order.event_type]}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-1.5">
        {order.event_date ? (
          <span
            className={`text-sm ${urgentEvent ? "text-red-600 font-semibold" : "text-[#3D2B1F]"}`}
          >
            {urgentEvent && "⚠ "}
            {formatDate(order.event_date)}
          </span>
        ) : (
          <span className="text-sm text-[#B8A99A]">—</span>
        )}
      </td>
      <td className="px-4 py-1.5">
        <span
          className="text-sm text-[#3D2B1F] block max-w-[200px] truncate"
          title={order.event_location ?? undefined}
        >
          {order.event_location || <span className="text-[#B8A99A]">—</span>}
        </span>
      </td>
      <td className="px-4 py-1.5">
        <span className="text-sm text-[#3D2B1F]">{shippingLabel}</span>
      </td>
      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
        <StatusSelect
          value={currentStatus}
          onChange={changeStatus}
          busy={isPending && optimisticStatus !== null}
          disabled={!canEdit}
        />
      </td>
      <td className="px-4 py-1.5 text-right">
        <span className="text-sm text-[#3D2B1F]">{formatEuro(order.budget)}</span>
      </td>
      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
        <PaymentSelect
          value={currentPayment}
          onChange={changePayment}
          busy={isPending && optimisticPayment !== null}
          disabled={!canEdit}
        />
      </td>
      <td className="px-4 py-1.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {canEdit && isPreReserva && !currentContacted && (
            <button
              onClick={(e) => { e.stopPropagation(); markContacted(); }}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-full border border-[#E8E0D5] bg-white px-2 py-1 text-[11px] font-medium text-[#3D2B1F] hover:bg-[#3D2B1F] hover:text-white hover:border-[#3D2B1F] disabled:opacity-50 transition-colors"
              title="Marcar como contactada"
            >
              {isPending && optimisticContacted ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Marcar contactada
            </button>
          )}
          {canEdit && isPreReserva && !inSemResposta && !autoFlaggedSemResposta && (
            <button
              onClick={(e) => { e.stopPropagation(); moveToSemResposta(); }}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
              title="Mover para Sem resposta"
            >
              <Clock className="h-3 w-3" />
              Sem resposta
            </button>
          )}
          {canEdit && inSemResposta && order.manually_no_response && !autoFlaggedSemResposta && (
            <button
              onClick={(e) => { e.stopPropagation(); moveOutOfSemResposta(); }}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-full border border-[#E8E0D5] bg-white px-2 py-1 text-[11px] font-medium text-[#3D2B1F] hover:bg-[#FAF8F5] disabled:opacity-50 transition-colors"
              title="Voltar para Pré-reservas"
            >
              <Undo2 className="h-3 w-3" />
              Pré-reservas
            </button>
          )}
          <button
            className="text-[#C4A882] hover:text-[#3D2B1F] transition-colors"
            onClick={(e) => { e.stopPropagation(); onOpen(order); }}
            title="Abrir workbench"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Secção de grupo ───────────────────────────────────────────

interface GroupSectionProps {
  title: string;
  orders: Order[];
  colorClass: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onOpenOrder: (o: Order) => void;
  shippingColumn: ShippingColumn;
  loadingOrderId: string | null;
  canEdit: boolean;
  isSemResposta?: boolean;
  alert?: boolean;
  voucherCodeToId: Record<string, string>;
}

function GroupSection({
  title, orders, colorClass, isCollapsed, onToggle, onOpenOrder, shippingColumn, loadingOrderId, canEdit, isSemResposta = false, alert = false, voucherCodeToId,
}: GroupSectionProps) {
  const shippingHeader = shippingColumn === "flores" ? "Envio das flores" : "Receção do quadro";
  const isEmpty = orders.length === 0;
  // Empty groups: colapsados por default mas ABRÍVEIS (estado vem do pai).
  return (
    <div className={`rounded-xl border border-[#E8E0D5] bg-white overflow-hidden ${isEmpty && isCollapsed ? "opacity-60" : ""}`}>
      <button
        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#FDFAF7] transition-colors`}
        onClick={onToggle}
      >
        {isCollapsed
          ? <ChevronRight className="h-4 w-4 text-[#8B7355] shrink-0" />
          : <ChevronDown className="h-4 w-4 text-[#8B7355] shrink-0" />
        }
        {alert && !isEmpty && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
        <span className={`text-sm font-semibold ${colorClass}`}>{title}</span>
        <span className="ml-1 rounded-full bg-[#F0EAE0] px-2 py-0.5 text-xs font-medium text-[#8B7355]">
          {orders.length}
        </span>
        {isEmpty && (
          <span className="ml-2 text-[11px] text-[#B8A99A] italic">sem encomendas</span>
        )}
      </button>
      {!isCollapsed && isEmpty && (
        <div className="px-4 py-4 text-center text-[11px] text-[#B8A99A] italic border-t border-[#F0EAE0]">
          Nenhuma encomenda neste grupo.
        </div>
      )}
      {!isCollapsed && orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="border-t border-[#F0EAE0] bg-[#FAF8F5]">
                {["Cliente", "Data evento", "Localização", shippingHeader, "Estado", "Orçamento", "Pagamento", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide ${i === 5 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onOpen={onOpenOrder}
                  shippingColumn={shippingColumn}
                  isLoading={loadingOrderId === order.id}
                  canEdit={canEdit}
                  inSemResposta={isSemResposta}
                  voucherCodeToId={voucherCodeToId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────

type ViewType = "tabela" | "cards" | "calendario" | "timeline";
type GroupedOrders = ReturnType<typeof groupOrders>;

interface Props {
  initialOrders: Order[];
  initialGrouped: GroupedOrders;
  archivedOrders: Order[];
  canEdit: boolean;
  voucherCodeToId: Record<string, string>;
}

// ── Componente principal ──────────────────────────────────────

export default function PreservacaoClient({ initialOrders, initialGrouped, archivedOrders, canEdit, voucherCodeToId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<ViewType>("tabela");
  // Grupos vazios começam colapsados por default; o utilizador pode abrir.
  // Excepção: "orfas" (encomendas com estado desconhecido) começa SEMPRE
  // aberta e nunca é incluída em `collapsedGroups` — é a rede de segurança,
  // tem de ser visível imediatamente quando aparece.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const empty = new Set<string>();
    if (initialGrouped.sem_resposta.length === 0) empty.add("sem_resposta");
    if (initialGrouped.pre_reservas.length === 0) empty.add("pre_reservas");
    if (initialGrouped.reservas.length === 0) empty.add("reservas");
    if (initialGrouped.preservacao_design.length === 0) empty.add("preservacao_design");
    if (initialGrouped.finalizacao.length === 0) empty.add("finalizacao");
    if (initialGrouped.concluidos.length === 0) empty.add("concluidos");
    if (initialGrouped.cancelamentos.length === 0) empty.add("cancelamentos");
    return empty;
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();
  const [showArchived, setShowArchived] = useState(false);

  const filteredOrders = search.trim()
    ? initialOrders.filter(
        (o) =>
          o.client_name.toLowerCase().includes(search.toLowerCase()) ||
          o.order_id.toLowerCase().includes(search.toLowerCase()) ||
          o.email?.toLowerCase().includes(search.toLowerCase()) ||
          o.event_location?.toLowerCase().includes(search.toLowerCase())
      )
    : initialOrders;

  const grouped = search.trim() ? groupOrders(filteredOrders) : initialGrouped;

  // Calendário e timeline só mostram encomendas com data agendada (excluem
  // pré-reservas "por agendar" e canceladas — não fazem sentido na grelha temporal).
  const scheduledOrders = filteredOrders.filter(
    (o) => o.status !== "entrega_flores_agendar" && o.status !== "cancelado"
  );

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openOrder(order: Order) {
    if (navigatingId) return;
    setNavigatingId(order.id);
    startNavTransition(() => {
      router.push(`/preservacao/${order.order_id}`);
    });
  }

  const totalActive = initialOrders.filter(
    (o) => o.status !== "cancelado" && o.status !== "quadro_recebido"
  ).length;

  const VIEW_BUTTONS = [
    { id: "tabela" as ViewType,     label: "Tabela",     icon: <LayoutList className="h-3.5 w-3.5" /> },
    { id: "cards" as ViewType,      label: "Cards",      icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: "calendario" as ViewType, label: "Calendário", icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "timeline" as ViewType,   label: "Timeline",   icon: <ListOrdered className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E8E0D5] bg-white shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#3D2B1F]">Preservação de Flores</h1>
          <p className="text-xs text-[#8B7355] mt-0.5">
            {totalActive} encomenda{totalActive !== 1 ? "s" : ""} em curso ·{" "}
            {initialOrders.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A]" />
            <Input
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white"
            />
          </div>
          <div className="flex items-center rounded-lg border border-[#E8E0D5] overflow-hidden">
            {VIEW_BUTTONS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors ${
                  activeView === id
                    ? "bg-[#3D2B1F] text-white"
                    : "text-[#8B7355] hover:bg-[#FAF8F5]"
                }`}
                title={label}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => exportOrdersToCsv(initialOrders)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E8E0D5] bg-white text-xs font-medium text-[#3D2B1F] hover:bg-[#FAF8F5] transition-colors"
            title="Exportar todas as encomendas para Excel/CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          {canEdit && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                showArchived
                  ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-[#E8E0D5] bg-white text-[#3D2B1F] hover:bg-[#FAF8F5]"
              }`}
              title={showArchived ? "Voltar às encomendas activas" : "Mostrar encomendas arquivadas"}
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {showArchived ? "Voltar à lista" : "Arquivados"}
              </span>
              {archivedOrders.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  showArchived ? "bg-red-200 text-red-800" : "bg-[#F0EAE0] text-[#8B7355]"
                }`}>
                  {archivedOrders.length}
                </span>
              )}
            </button>
          )}
          {canEdit && !showArchived && (
            <Button
              size="sm"
              className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white h-8 gap-1.5"
              onClick={() => setSheetOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nova encomenda
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-6">
        {/* Rede de segurança: aviso global se houver encomendas com estado
            desconhecido. Aparece em todas as vistas (tabela, cards, calendário,
            timeline) para a Maria notar imediatamente que algo está fora do
            mapa. Não deve ser ignorável visualmente. */}
        {!showArchived && grouped.orfas.length > 0 && (
          <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">
                  {grouped.orfas.length} encomenda{grouped.orfas.length !== 1 ? "s" : ""} com estado desconhecido
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Estas encomendas têm um estado na base de dados que o código
                  ainda não reconhece. Continuam visíveis abaixo no grupo
                  &ldquo;Sem grupo&rdquo; para nunca se perderem. Avisa o
                  programador para mapear o estado.
                </p>
              </div>
            </div>
          </div>
        )}

        {showArchived && (
          <ArchivedOrdersView orders={archivedOrders} onOpenOrder={openOrder} />
        )}

        {!showArchived && activeView === "tabela" && (
          <div className="space-y-3">
            {grouped.orfas.length > 0 && (
              <GroupSection title="Sem grupo (estado desconhecido)" orders={grouped.orfas} colorClass="text-red-700" isCollapsed={false} onToggle={() => {}} onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} alert voucherCodeToId={voucherCodeToId} />
            )}
            <GroupSection title="Sem resposta"         orders={grouped.sem_resposta}        colorClass="text-red-600"    isCollapsed={collapsedGroups.has("sem_resposta")}        onToggle={() => toggleGroup("sem_resposta")}        onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} isSemResposta alert voucherCodeToId={voucherCodeToId} />
            <GroupSection title="Pré-reservas"         orders={grouped.pre_reservas}        colorClass="text-amber-700"  isCollapsed={collapsedGroups.has("pre_reservas")}        onToggle={() => toggleGroup("pre_reservas")}        onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} />
            <GroupSection title="Reservas"             orders={grouped.reservas}            colorClass="text-blue-700"   isCollapsed={collapsedGroups.has("reservas")}            onToggle={() => toggleGroup("reservas")}            onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} />
            <GroupSection title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" isCollapsed={collapsedGroups.has("preservacao_design")}  onToggle={() => toggleGroup("preservacao_design")}  onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} />
            <GroupSection title="Finalização"          orders={grouped.finalizacao}         colorClass="text-orange-700" isCollapsed={collapsedGroups.has("finalizacao")}         onToggle={() => toggleGroup("finalizacao")}         onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} />
            <GroupSection title="Concluídos"           orders={grouped.concluidos}          colorClass="text-green-700"  isCollapsed={collapsedGroups.has("concluidos")}          onToggle={() => toggleGroup("concluidos")}          onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} />
            <GroupSection title="Cancelamentos"        orders={grouped.cancelamentos}       colorClass="text-gray-500"   isCollapsed={collapsedGroups.has("cancelamentos")}       onToggle={() => toggleGroup("cancelamentos")}       onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} />

            {filteredOrders.length === 0 && initialOrders.length > 0 && (
              <div className="rounded-xl border border-[#E8E0D5] bg-white p-8 text-center">
                <p className="text-sm text-[#8B7355]">
                  Nenhum resultado para <strong>&ldquo;{search}&rdquo;</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {!showArchived && activeView === "cards" && (
          <div className="space-y-6">
            {grouped.orfas.length > 0 && (
              <CardGroup title="Sem grupo (estado desconhecido)" orders={grouped.orfas} colorClass="text-red-700" onOpenOrder={openOrder} loadingOrderId={navigatingId} alert showPhoto={false} />
            )}
            <CardGroup title="Sem resposta"         orders={grouped.sem_resposta}        colorClass="text-red-600"    onOpenOrder={openOrder} loadingOrderId={navigatingId} alert showPhoto={false} />
            <CardGroup title="Pré-reservas"         orders={grouped.pre_reservas}        colorClass="text-amber-700"  onOpenOrder={openOrder} loadingOrderId={navigatingId} showPhoto={false} />
            <CardGroup title="Reservas"             orders={grouped.reservas}            colorClass="text-blue-700"   onOpenOrder={openOrder} loadingOrderId={navigatingId} showPhoto={false} />
            <CardGroup title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" onOpenOrder={openOrder} loadingOrderId={navigatingId} showPhoto />
            <CardGroup title="Finalização"          orders={grouped.finalizacao}         colorClass="text-orange-700" onOpenOrder={openOrder} loadingOrderId={navigatingId} showPhoto />
            <CardGroup title="Concluídos"           orders={grouped.concluidos}          colorClass="text-green-700"  onOpenOrder={openOrder} loadingOrderId={navigatingId} showPhoto />
            <CardGroup title="Cancelamentos"        orders={grouped.cancelamentos}       colorClass="text-gray-500"   onOpenOrder={openOrder} loadingOrderId={navigatingId} showPhoto={false} />
          </div>
        )}

        {!showArchived && activeView === "calendario" && (
          <CalendarView
            orders={scheduledOrders}
            onOpenOrder={openOrder}
            loadingOrderId={navigatingId}
          />
        )}

        {!showArchived && activeView === "timeline" && (
          <TimelineView
            orders={scheduledOrders}
            onOpenOrder={openOrder}
            loadingOrderId={navigatingId}
          />
        )}
      </div>

      <NovaEncomendaSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => {
          setSheetOpen(false);
          router.refresh();
        }}
      />

    </div>
  );
}

// ── Vista de cards ────────────────────────────────────────────

function CardGroup({
  title,
  orders,
  colorClass,
  onOpenOrder,
  loadingOrderId,
  alert = false,
  showPhoto = true,
}: {
  title: string;
  orders: Order[];
  colorClass: string;
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
  alert?: boolean;
  showPhoto?: boolean;
}) {
  const isEmpty = orders.length === 0;
  return (
    <section className={isEmpty ? "opacity-60" : ""}>
      <div className="flex items-center gap-2 mb-3">
        {alert && !isEmpty && <AlertTriangle className="h-4 w-4 text-red-500" />}
        <h2 className={`text-sm font-semibold ${colorClass}`}>{title}</h2>
        <span className="rounded-full bg-[#F0EAE0] px-2 py-0.5 text-xs font-medium text-[#8B7355]">
          {orders.length}
        </span>
        {isEmpty && (
          <span className="ml-1 text-[11px] text-[#B8A99A] italic">sem encomendas</span>
        )}
      </div>
      {!isEmpty && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onOpen={onOpenOrder}
              isLoading={loadingOrderId === o.id}
              showPhoto={showPhoto}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({
  order, onOpen, isLoading, showPhoto = true,
}: {
  order: Order;
  onOpen: (o: Order) => void;
  isLoading: boolean;
  showPhoto?: boolean;
}) {
  const daysUntilEvent =
    order.event_date ? differenceInCalendarDays(parseISO(order.event_date), new Date()) : null;
  const urgentEvent = daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;
  const photoUrl = showPhoto ? toEmbeddableImageUrl(order.flowers_photo_url) : null;

  return (
    <button
      onClick={() => onOpen(order)}
      className={`group text-left rounded-2xl border bg-white overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)] hover:shadow-md transition-all ${
        isLoading ? "border-[#C4A882] ring-2 ring-[#C4A882]/30" : "border-[#E8E0D5] hover:border-[#C4A882]"
      }`}
    >
      {showPhoto && (
        <div className="relative aspect-square bg-gradient-to-br from-[#FAF8F5] to-[#F0E8DC]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Flores de ${order.client_name}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E8E0D5] text-[#C4A882]">
                <ImageIcon className="h-4 w-4" />
              </div>
            </div>
          )}
          {urgentEvent && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-red-600/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
              <AlertTriangle className="h-2.5 w-2.5" />
              {daysUntilEvent}d
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-[#3D2B1F]" />
            </div>
          )}
        </div>
      )}
      <div className="px-3 py-2.5">
        {!showPhoto && urgentEvent && (
          <div className="inline-flex items-center gap-1 rounded-full bg-red-600/95 px-2 py-0.5 text-[10px] font-semibold text-white mb-1.5">
            <AlertTriangle className="h-2.5 w-2.5" />
            {daysUntilEvent}d
          </div>
        )}
        {!showPhoto && isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-[#3D2B1F] mb-1" />
        )}
        <p className="text-sm font-semibold text-[#3D2B1F] truncate">
          {order.client_name}
        </p>
        <p className="text-[11px] text-[#8B7355] truncate mt-0.5">
          {order.event_date ? formatDate(order.event_date) : "Sem data"}
          {order.event_type && ` · ${EVENT_TYPE_LABELS[order.event_type]}`}
        </p>
      </div>
    </button>
  );
}

// ── Vista de arquivados ───────────────────────────────────────

function ArchivedOrdersView({
  orders,
  onOpenOrder,
}: {
  orders: Order[];
  onOpenOrder: (o: Order) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Order | null>(null);

  async function handleRestore(order: Order) {
    setBusyId(order.id);
    try {
      await restoreOrderAction(order.id);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleHardDelete(justification: string) {
    if (!hardDeleteTarget) return;
    await hardDeleteOrderAction(hardDeleteTarget.id, justification);
    setHardDeleteTarget(null);
    router.refresh();
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-[#E8E0D5] bg-white p-12 text-center">
        <Archive className="h-8 w-8 mx-auto text-[#C4A882] mb-3" />
        <p className="text-sm font-medium text-[#3D2B1F]">Nenhuma encomenda arquivada</p>
        <p className="text-xs text-[#8B7355] mt-1">
          Encomendas arquivadas aparecem aqui. Podes restaurá-las ou apagá-las definitivamente.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-red-200 bg-red-50/30 px-4 py-3 mb-4">
        <p className="text-xs text-red-800">
          <strong>{orders.length}</strong> encomenda{orders.length !== 1 ? "s" : ""} arquivada{orders.length !== 1 ? "s" : ""}.
          Restaura para voltar à lista normal, ou apaga definitivamente (irreversível).
        </p>
      </div>

      <div className="rounded-xl border border-[#E8E0D5] bg-white overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#F0EAE0] bg-[#FAF8F5]">
              <th className="px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide">Cliente</th>
              <th className="px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide">Data evento</th>
              <th className="px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide">Estado antes</th>
              <th className="px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide">Arquivada em</th>
              <th className="px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide text-right">Acções</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isBusy = busyId === order.id;
              return (
                <tr
                  key={order.id}
                  className="border-b border-[#F0EAE0] last:border-0 hover:bg-[#FDFAF7] cursor-pointer"
                  onClick={() => onOpenOrder(order)}
                >
                  <td className="px-4 py-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-[#3D2B1F]">{order.client_name}</span>
                      <span className="font-mono text-[10px] text-[#B8A99A]">#{order.order_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-[#3D2B1F]">{formatDate(order.event_date)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_COLORS[order.status] ?? ""}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-[#8B7355]">{formatDate(order.deleted_at)}</span>
                  </td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRestore(order)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#E8E0D5] bg-white text-[11px] font-medium text-[#3D2B1F] hover:bg-[#FAF8F5] disabled:opacity-50 transition-colors"
                        title="Restaurar para a lista activa"
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveRestore className="h-3 w-3" />}
                        Restaurar
                      </button>
                      <button
                        onClick={() => setHardDeleteTarget(order)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-red-300 bg-white text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        title="Apagar definitivamente"
                      >
                        <Trash2 className="h-3 w-3" />
                        Apagar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HardDeleteDialog
        open={!!hardDeleteTarget}
        onOpenChange={(open) => !open && setHardDeleteTarget(null)}
        itemLabel={
          hardDeleteTarget
            ? `a encomenda de ${hardDeleteTarget.client_name} (#${hardDeleteTarget.order_id})`
            : ""
        }
        onConfirm={handleHardDelete}
      />
    </>
  );
}
