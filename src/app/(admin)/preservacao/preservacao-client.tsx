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
  GripVertical,
  Truck,
  Hand,
  Package,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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
import { groupOrders, GROUP_TO_TARGET_STATUS, type OrderGroupKey } from "@/lib/supabase/orders";
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

// Ícones por método de envio — para tornar a coluna "Envio" da tabela
// visualmente legível de relance (CTT vs recolha vs em mãos vs não sei).
// Mantemos os mesmos ícones e cores da vista de calendário (Hand sky para
// entrega em mãos, Truck rose para recolha no local) para coerência visual.
// Estilo: só o ícone fica colorido; o texto permanece cinza neutro, para
// não competir visualmente com os dropdowns de Estado e Pagamento ao lado.
const SHIPPING_METHOD_ICONS: Record<string, LucideIcon> = {
  maos: Hand,
  ctt: Package,
  recolha_evento: Truck,
  nao_sei: HelpCircle,
};

const SHIPPING_METHOD_ICON_COLORS: Record<string, string> = {
  maos: "text-sky-600",
  ctt: "text-amber-600",
  recolha_evento: "text-rose-600",
  nao_sei: "text-stone-500",
};

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
        className="max-h-[420px] min-w-[280px] p-0 rounded-md border border-cream-200"
      >
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
      <SelectContent className="rounded-md border border-cream-200">
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
  isDragging = false,
}: {
  order: Order;
  onOpen: (o: Order) => void;
  shippingColumn: ShippingColumn;
  isLoading: boolean;
  canEdit: boolean;
  inSemResposta: boolean;
  voucherCodeToId: Record<string, string>;
  isDragging?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus | null>(null);
  const [optimisticPayment, setOptimisticPayment] = useState<PaymentStatus | null>(null);
  const [optimisticContacted, setOptimisticContacted] = useState<boolean | null>(null);

  // dnd-kit: o handle é o único elemento com listeners de pointer, para o resto
  // da linha continuar clicável (abre o workbench). Activação por distância de
  // 8px (configurada no sensor) evita que cliques sejam interpretados como drag.
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    isDragging: isDraggingThis,
  } = useDraggable({
    id: order.id,
    data: { order },
    disabled: !canEdit,
  });

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

  const shippingMethod: string | null =
    shippingColumn === "flores" ? order.flower_delivery_method : order.frame_delivery_method;
  const shippingLabel = shippingMethod
    ? (shippingColumn === "flores"
        ? FLOWER_DELIVERY_METHOD_LABELS[shippingMethod as keyof typeof FLOWER_DELIVERY_METHOD_LABELS]
        : FRAME_DELIVERY_METHOD_LABELS[shippingMethod as keyof typeof FRAME_DELIVERY_METHOD_LABELS])
    : null;
  const shippingIconColor = shippingMethod ? SHIPPING_METHOD_ICON_COLORS[shippingMethod] : "";
  const ShippingIcon = shippingMethod ? SHIPPING_METHOD_ICONS[shippingMethod] : null;

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
      ref={setDragNodeRef}
      {...attributes}
      className={`border-b border-cream-100 cursor-pointer transition-colors ${
        isLoading ? "bg-cream-100/60" : "hover:bg-cream-50"
      } ${isDraggingThis || isDragging ? "opacity-40" : ""}`}
      onClick={() => onOpen(order)}
    >
      <td className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <button
            {...listeners}
            type="button"
            title="Arrastar para mudar de grupo"
            aria-label={`Arrastar encomenda ${order.client_name}`}
            className="flex h-6 w-6 items-center justify-center rounded text-[#C4A882] hover:bg-cream-50 hover:text-cocoa-900 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="h-6 w-6" />
        )}
      </td>
      <td className="px-4 py-1.5">
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882] shrink-0" />}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-cocoa-900">{order.client_name}</span>
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
              <span className="text-xs text-cocoa-700">
                {EVENT_TYPE_LABELS[order.event_type]}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-1.5">
        {order.event_date ? (
          <span
            className={`text-sm ${urgentEvent ? "text-red-600 font-semibold" : "text-cocoa-900"}`}
          >
            {urgentEvent && "⚠ "}
            {formatDate(order.event_date)}
          </span>
        ) : (
          <span className="text-sm text-cocoa-500">—</span>
        )}
      </td>
      <td className="px-4 py-1.5">
        <span
          className="text-sm text-cocoa-900 block max-w-[200px] truncate"
          title={order.event_location ?? undefined}
        >
          {order.event_location || <span className="text-cocoa-500">—</span>}
        </span>
      </td>
      <td className="px-4 py-1.5">
        {shippingLabel ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-cocoa-700 whitespace-nowrap">
            {ShippingIcon && <ShippingIcon className={`h-3.5 w-3.5 shrink-0 ${shippingIconColor}`} />}
            {shippingLabel}
          </span>
        ) : (
          <span className="text-sm text-cocoa-500">—</span>
        )}
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
        <span className="text-sm text-cocoa-900">{formatEuro(order.budget)}</span>
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
              className="inline-flex items-center gap-1 rounded-full border border-cream-200 bg-surface px-2 py-1 text-[11px] font-medium text-cocoa-900 hover:bg-btn-primary hover:text-btn-primary-fg hover:border-btn-primary disabled:opacity-50 transition-colors"
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
              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-surface px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
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
              className="inline-flex items-center gap-1 rounded-full border border-cream-200 bg-surface px-2 py-1 text-[11px] font-medium text-cocoa-900 hover:bg-cream-50 disabled:opacity-50 transition-colors"
              title="Voltar para Pré-reservas"
            >
              <Undo2 className="h-3 w-3" />
              Pré-reservas
            </button>
          )}
          <button
            className="text-[#C4A882] hover:text-cocoa-900 transition-colors"
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
  /** Chave de grupo para drag-and-drop. Se omitida, a secção não é drop zone. */
  droppableId?: OrderGroupKey;
  /** ID da encomenda actualmente a ser arrastada (para opacificar a fonte). */
  draggingOrderId?: string | null;
}

function GroupSection({
  title, orders, colorClass, isCollapsed, onToggle, onOpenOrder, shippingColumn, loadingOrderId, canEdit, isSemResposta = false, alert = false, voucherCodeToId, droppableId, draggingOrderId,
}: GroupSectionProps) {
  const shippingHeader = shippingColumn === "flores" ? "Envio das flores" : "Receção do quadro";
  const isEmpty = orders.length === 0;
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: droppableId ?? `__non_droppable_${title}`,
    disabled: !droppableId || !canEdit,
  });
  // Empty groups: colapsados por default mas ABRÍVEIS (estado vem do pai).
  return (
    <div
      ref={setDropNodeRef}
      className={`rounded-xl border bg-surface overflow-hidden transition-all ${
        isOver
          ? "border-cocoa-500 ring-2 ring-[#C4A882]/40 shadow-[0_0_0_3px_rgba(196,168,130,0.15)]"
          : "border-cream-200"
      } ${isEmpty && isCollapsed && !isOver ? "opacity-60" : ""}`}
    >
      {isOver && droppableId && (
        <div className="px-4 py-1.5 bg-[#FAF4EB] border-b border-[#E8DBC6] text-[11px] font-medium text-[#8B6F3F] flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />
          Largar aqui para mover para &ldquo;{title}&rdquo;
        </div>
      )}
      <button
        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 transition-colors`}
        onClick={onToggle}
      >
        {isCollapsed
          ? <ChevronRight className="h-4 w-4 text-cocoa-700 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-cocoa-700 shrink-0" />
        }
        {alert && !isEmpty && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
        <span className={`text-sm font-semibold ${colorClass}`}>{title}</span>
        <span className="ml-1 rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-cocoa-700">
          {orders.length}
        </span>
        {isEmpty && (
          <span className="ml-2 text-[11px] text-cocoa-500 italic">sem encomendas</span>
        )}
      </button>
      {!isCollapsed && isEmpty && (
        <div className="px-4 py-4 text-center text-[11px] text-cocoa-500 italic border-t border-cream-100">
          Nenhuma encomenda neste grupo.
        </div>
      )}
      {!isCollapsed && orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left table-fixed">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="border-t border-cream-100 bg-cream-50">
                {["", "Cliente", "Data evento", "Localização", shippingHeader, "Estado", "Orçamento", "Pagamento", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide ${i === 6 ? "text-right" : ""}`}>
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
                  isDragging={draggingOrderId === order.id}
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
  // "Concluídos" e "Cancelamentos" começam SEMPRE colapsados (mesmo com
  // encomendas dentro) — são grupos de fim-de-linha, raramente precisam
  // de atenção diária. Para os ver, abre-se manualmente.
  // Excepção: "orfas" (encomendas com estado desconhecido) é renderizada
  // sempre expandida fora deste set — é a rede de segurança e tem de
  // ser visível imediatamente quando aparece.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const empty = new Set<string>();
    if (initialGrouped.sem_resposta.length === 0) empty.add("sem_resposta");
    if (initialGrouped.pre_reservas.length === 0) empty.add("pre_reservas");
    if (initialGrouped.reservas.length === 0) empty.add("reservas");
    if (initialGrouped.preservacao_design.length === 0) empty.add("preservacao_design");
    if (initialGrouped.finalizacao.length === 0) empty.add("finalizacao");
    empty.add("concluidos");
    empty.add("cancelamentos");
    return empty;
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();
  const [showArchived, setShowArchived] = useState(false);
  const [draggingOrder, setDraggingOrder] = useState<Order | null>(null);
  const [, startDropTransition] = useTransition();

  // Sensores: activação por distância (8px) deixa o click do row continuar a
  // funcionar normalmente; KeyboardSensor dá acessibilidade básica (Space para
  // pegar, setas para navegar entre droppables, Space para largar).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    const order = event.active.data.current?.order as Order | undefined;
    if (order) setDraggingOrder(order);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingOrder(null);
    const { active, over } = event;
    if (!over) return;
    const order = active.data.current?.order as Order | undefined;
    if (!order) return;

    const targetGroup = String(over.id) as OrderGroupKey;
    // Drop em zona não-droppable (orfas) ou em ID desconhecido: ignorar.
    if (!(targetGroup in GROUP_TO_TARGET_STATUS)) return;

    const targetStatus = GROUP_TO_TARGET_STATUS[targetGroup];

    // sem_resposta: especial — não muda status, só activa a flag manual.
    if (targetGroup === "sem_resposta") {
      if (order.status !== "entrega_flores_agendar") {
        // Para chegar a sem_resposta a partir de outro grupo, primeiro voltamos
        // a entrega_flores_agendar (drop em pre_reservas seria mais intuitivo).
        // Aqui forçamos o status base + activa flag manual num só update.
        startDropTransition(async () => {
          try {
            await updateOrderAction(order.id, {
              status: "entrega_flores_agendar",
              manually_no_response: true,
              contacted: false,
            });
            router.refresh();
          } catch {
            // silencioso — UI volta ao estado anterior no refresh
          }
        });
        return;
      }
      if (order.manually_no_response) return; // já lá está
      startDropTransition(async () => {
        try {
          await updateOrderAction(order.id, { manually_no_response: true });
          router.refresh();
        } catch {
          // silencioso
        }
      });
      return;
    }

    // pre_reservas: limpar flag manual se estava em sem_resposta; mudar status
    // se vinha de outro grupo.
    if (targetGroup === "pre_reservas") {
      const updates: Parameters<typeof updateOrderAction>[1] = {};
      if (order.status !== "entrega_flores_agendar") {
        updates.status = "entrega_flores_agendar";
      }
      if (order.manually_no_response) updates.manually_no_response = false;
      if (Object.keys(updates).length === 0) return; // já lá está
      startDropTransition(async () => {
        try {
          await updateOrderAction(order.id, updates);
          router.refresh();
        } catch {
          // silencioso
        }
      });
      return;
    }

    // Outros grupos: status muda para o primeiro estado do grupo destino.
    // Defensivo: limpa manually_no_response (só faz sentido em pré-reservas).
    if (order.status === targetStatus && !order.manually_no_response) return;
    startDropTransition(async () => {
      try {
        await updateOrderAction(order.id, {
          status: targetStatus,
          manually_no_response: false,
        });
        router.refresh();
      } catch {
        // silencioso
      }
    });
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-cream-200 bg-surface shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-cocoa-900">Preservação de Flores</h1>
          <p className="text-xs text-cocoa-700 mt-0.5">
            {totalActive} encomenda{totalActive !== 1 ? "s" : ""} em curso ·{" "}
            {initialOrders.length} total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
            <Input
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 sm:h-8 w-full sm:w-52 text-sm border-cream-200 bg-cream-50 focus:bg-surface"
            />
          </div>
          <div className="flex items-center rounded-lg border border-cream-200 overflow-hidden">
            {VIEW_BUTTONS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors ${
                  activeView === id
                    ? "bg-btn-primary text-btn-primary-fg"
                    : "text-cocoa-700 hover:bg-cream-50"
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
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-cream-200 bg-surface text-xs font-medium text-cocoa-900 hover:bg-cream-50 transition-colors"
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
                  : "border-cream-200 bg-surface text-cocoa-900 hover:bg-cream-50"
              }`}
              title={showArchived ? "Voltar às encomendas activas" : "Mostrar encomendas arquivadas"}
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {showArchived ? "Voltar à lista" : "Arquivados"}
              </span>
              {archivedOrders.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  showArchived ? "bg-red-200 text-red-800" : "bg-cream-100 text-cocoa-700"
                }`}>
                  {archivedOrders.length}
                </span>
              )}
            </button>
          )}
          {canEdit && !showArchived && (
            <Button
              size="sm"
              className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg h-8 gap-1.5"
              onClick={() => setSheetOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nova encomenda
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
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
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingOrder(null)}
          >
            <div className="space-y-3">
              {grouped.orfas.length > 0 && (
                <GroupSection title="Sem grupo (estado desconhecido)" orders={grouped.orfas} colorClass="text-red-700" isCollapsed={false} onToggle={() => {}} onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} alert voucherCodeToId={voucherCodeToId} draggingOrderId={draggingOrder?.id ?? null} />
              )}
              <GroupSection title="Sem resposta"         orders={grouped.sem_resposta}        colorClass="text-red-600"    isCollapsed={collapsedGroups.has("sem_resposta")}        onToggle={() => toggleGroup("sem_resposta")}        onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} isSemResposta alert voucherCodeToId={voucherCodeToId} droppableId="sem_resposta"        draggingOrderId={draggingOrder?.id ?? null} />
              <GroupSection title="Pré-reservas"         orders={grouped.pre_reservas}        colorClass="text-amber-700"  isCollapsed={collapsedGroups.has("pre_reservas")}        onToggle={() => toggleGroup("pre_reservas")}        onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} droppableId="pre_reservas"        draggingOrderId={draggingOrder?.id ?? null} />
              <GroupSection title="Reservas"             orders={grouped.reservas}            colorClass="text-blue-700"   isCollapsed={collapsedGroups.has("reservas")}            onToggle={() => toggleGroup("reservas")}            onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} droppableId="reservas"            draggingOrderId={draggingOrder?.id ?? null} />
              <GroupSection title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" isCollapsed={collapsedGroups.has("preservacao_design")}  onToggle={() => toggleGroup("preservacao_design")}  onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} droppableId="preservacao_design"  draggingOrderId={draggingOrder?.id ?? null} />
              <GroupSection title="Finalização"          orders={grouped.finalizacao}         colorClass="text-orange-700" isCollapsed={collapsedGroups.has("finalizacao")}         onToggle={() => toggleGroup("finalizacao")}         onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} droppableId="finalizacao"         draggingOrderId={draggingOrder?.id ?? null} />
              <GroupSection title="Concluídos"           orders={grouped.concluidos}          colorClass="text-green-700"  isCollapsed={collapsedGroups.has("concluidos")}          onToggle={() => toggleGroup("concluidos")}          onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} droppableId="concluidos"          draggingOrderId={draggingOrder?.id ?? null} />
              <GroupSection title="Cancelamentos"        orders={grouped.cancelamentos}       colorClass="text-gray-500"   isCollapsed={collapsedGroups.has("cancelamentos")}       onToggle={() => toggleGroup("cancelamentos")}       onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} canEdit={canEdit} voucherCodeToId={voucherCodeToId} droppableId="cancelamentos"       draggingOrderId={draggingOrder?.id ?? null} />

              {filteredOrders.length === 0 && initialOrders.length > 0 && (
                <div className="rounded-xl border border-cream-200 bg-surface p-8 text-center">
                  <p className="text-sm text-cocoa-700">
                    Nenhum resultado para <strong>&ldquo;{search}&rdquo;</strong>
                  </p>
                </div>
              )}
            </div>
            <DragOverlay dropAnimation={null}>
              {draggingOrder && (
                <div className="rounded-lg border border-cocoa-500 bg-surface shadow-lg px-3 py-2 flex items-center gap-2 max-w-[280px] cursor-grabbing">
                  <GripVertical className="h-3.5 w-3.5 text-[#C4A882] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-cocoa-900 truncate">{draggingOrder.client_name}</span>
                    <span className="text-[11px] text-cocoa-700 truncate">{draggingOrder.order_id}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-cocoa-700">
          {orders.length}
        </span>
        {isEmpty && (
          <span className="ml-1 text-[11px] text-cocoa-500 italic">sem encomendas</span>
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
      className={`group text-left rounded-2xl border bg-surface overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)] hover:shadow-md transition-all ${
        isLoading ? "border-cocoa-500 ring-2 ring-[#C4A882]/30" : "border-cream-200 hover:border-cocoa-500"
      }`}
    >
      {showPhoto && (
        <div className="relative aspect-square bg-gradient-to-br from-cream-50 to-cream-100">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Flores de ${order.client_name}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface border border-cream-200 text-[#C4A882]">
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
              <Loader2 className="h-6 w-6 animate-spin text-cocoa-900" />
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
          <Loader2 className="h-4 w-4 animate-spin text-cocoa-900 mb-1" />
        )}
        <p className="text-sm font-semibold text-cocoa-900 truncate">
          {order.client_name}
        </p>
        <p className="text-[11px] text-cocoa-700 truncate mt-0.5">
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
      <div className="rounded-xl border border-cream-200 bg-surface p-12 text-center">
        <Archive className="h-8 w-8 mx-auto text-[#C4A882] mb-3" />
        <p className="text-sm font-medium text-cocoa-900">Nenhuma encomenda arquivada</p>
        <p className="text-xs text-cocoa-700 mt-1">
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

      <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-cream-100 bg-cream-50">
              <th className="px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide">Cliente</th>
              <th className="px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide">Data evento</th>
              <th className="px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide">Estado antes</th>
              <th className="px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide">Arquivada em</th>
              <th className="px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide text-right">Acções</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isBusy = busyId === order.id;
              return (
                <tr
                  key={order.id}
                  className="border-b border-cream-100 last:border-0 hover:bg-cream-50 cursor-pointer"
                  onClick={() => onOpenOrder(order)}
                >
                  <td className="px-4 py-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-cocoa-900">{order.client_name}</span>
                      <span className="font-mono text-[10px] text-cocoa-500">#{order.order_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-cocoa-900">{formatDate(order.event_date)}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_COLORS[order.status] ?? ""}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-sm text-cocoa-700">{formatDate(order.deleted_at)}</span>
                  </td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRestore(order)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-cream-200 bg-surface text-[11px] font-medium text-cocoa-900 hover:bg-cream-50 disabled:opacity-50 transition-colors"
                        title="Restaurar para a lista activa"
                      >
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveRestore className="h-3 w-3" />}
                        Restaurar
                      </button>
                      <button
                        onClick={() => setHardDeleteTarget(order)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-red-300 bg-surface text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
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
