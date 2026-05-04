"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, differenceInDays } from "date-fns";
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
  CalendarClock,
  CalendarCheck,
  Send,
  PackageCheck,
  Layers,
  Flower2,
  Palette,
  Hourglass,
  Hammer,
  Frame,
  Camera,
  Sparkles,
  Truck,
  PartyPopper,
  Ban,
  type LucideIcon,
} from "lucide-react";
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
import { updateOrderAction } from "./actions";

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

// ── Cores e ícones por estado ─────────────────────────────────

const STATUS_COLORS: Record<OrderStatus, string> = {
  entrega_flores_agendar: "bg-rose-100 text-rose-900 border-rose-300",
  entrega_agendada:       "bg-pink-100 text-pink-900 border-pink-300",
  flores_enviadas:        "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300",
  flores_recebidas:       "bg-purple-100 text-purple-900 border-purple-300",
  flores_na_prensa:       "bg-violet-100 text-violet-900 border-violet-300",
  reconstrucao_botanica:  "bg-indigo-100 text-indigo-900 border-indigo-300",
  a_compor_design:        "bg-blue-100 text-blue-900 border-blue-300",
  a_aguardar_aprovacao:   "bg-sky-100 text-sky-900 border-sky-300",
  a_ser_emoldurado:       "bg-cyan-100 text-cyan-900 border-cyan-300",
  emoldurado:             "bg-teal-100 text-teal-900 border-teal-300",
  a_ser_fotografado:      "bg-emerald-100 text-emerald-900 border-emerald-300",
  quadro_pronto:          "bg-lime-100 text-lime-900 border-lime-300",
  quadro_enviado:         "bg-yellow-100 text-yellow-900 border-yellow-300",
  quadro_recebido:        "bg-green-100 text-green-900 border-green-300",
  cancelado:              "bg-stone-200 text-stone-600 border-stone-300",
};

const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  entrega_flores_agendar: CalendarClock,
  entrega_agendada:       CalendarCheck,
  flores_enviadas:        Send,
  flores_recebidas:       PackageCheck,
  flores_na_prensa:       Layers,
  reconstrucao_botanica:  Flower2,
  a_compor_design:        Palette,
  a_aguardar_aprovacao:   Hourglass,
  a_ser_emoldurado:       Hammer,
  emoldurado:             Frame,
  a_ser_fotografado:      Camera,
  quadro_pronto:          Sparkles,
  quadro_enviado:         Truck,
  quadro_recebido:        PartyPopper,
  cancelado:              Ban,
};

// Estados agrupados por fase, para meter separadores entre grupos no dropdown
const STATUS_GROUPS: Array<{ label: string; statuses: OrderStatus[] }> = [
  { label: "Pré-reserva",        statuses: ["entrega_flores_agendar"] },
  { label: "Reservas",            statuses: ["entrega_agendada", "flores_enviadas", "flores_recebidas"] },
  { label: "Preservação e design", statuses: ["flores_na_prensa", "reconstrucao_botanica", "a_compor_design", "a_aguardar_aprovacao"] },
  { label: "Finalização",         statuses: ["a_ser_emoldurado", "emoldurado", "a_ser_fotografado", "quadro_pronto", "quadro_enviado"] },
  { label: "Concluído",           statuses: ["quadro_recebido"] },
  { label: "Cancelado",           statuses: ["cancelado"] },
];

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  "100_pago":      "bg-green-100 text-green-800 border-green-300",
  "70_pago":       "bg-yellow-100 text-yellow-800 border-yellow-300",
  "30_pago":       "bg-yellow-100 text-yellow-800 border-yellow-300",
  "30_por_pagar":  "bg-red-100 text-red-700 border-red-300",
  "100_por_pagar": "bg-red-100 text-red-700 border-red-300",
};

// ── Dropdown de estado partilhado (tabela + workbench) ────────

export function StatusSelect({
  value,
  onChange,
  busy,
  size = "sm",
}: {
  value: OrderStatus;
  onChange: (s: OrderStatus) => void;
  busy?: boolean;
  size?: "sm" | "md";
}) {
  const colorClass = STATUS_COLORS[value] ?? "bg-gray-100 text-gray-700 border-gray-300";
  const heightClass = size === "md" ? "h-8 text-xs" : "h-7 text-[11px]";

  return (
    <Select value={value} onValueChange={(v) => onChange(v as OrderStatus)} disabled={busy}>
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

const PAYMENT_DOT_COLORS: Record<PaymentStatus, string> = {
  "100_pago":      "bg-green-500",
  "70_pago":       "bg-yellow-500",
  "30_pago":       "bg-yellow-500",
  "30_por_pagar":  "bg-red-500",
  "100_por_pagar": "bg-red-600",
};

export function PaymentSelect({
  value,
  onChange,
  busy,
}: {
  value: PaymentStatus;
  onChange: (p: PaymentStatus) => void;
  busy?: boolean;
}) {
  const colorClass = PAYMENT_COLORS[value] ?? "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentStatus)} disabled={busy}>
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
}: {
  order: Order;
  onOpen: (o: Order) => void;
  shippingColumn: ShippingColumn;
  isLoading: boolean;
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
      ? differenceInDays(parseISO(order.event_date), new Date())
      : null;
  const urgentEvent =
    daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;

  const isPreReserva = currentStatus === "entrega_flores_agendar";

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
        await updateOrderAction(order.id, { contacted: true });
        router.refresh();
      } catch {
        setOptimisticContacted(null);
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
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882] shrink-0" />}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[#3D2B1F]">{order.client_name}</span>
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
      <td className="px-4 py-3">
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
      <td className="px-4 py-3">
        <span
          className="text-sm text-[#3D2B1F] block max-w-[200px] truncate"
          title={order.event_location ?? undefined}
        >
          {order.event_location || <span className="text-[#B8A99A]">—</span>}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-[#3D2B1F]">{shippingLabel}</span>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <StatusSelect
          value={currentStatus}
          onChange={changeStatus}
          busy={isPending && optimisticStatus !== null}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-[#3D2B1F]">{formatEuro(order.budget)}</span>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <PaymentSelect
          value={currentPayment}
          onChange={changePayment}
          busy={isPending && optimisticPayment !== null}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {isPreReserva && !currentContacted && (
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
  alert?: boolean;
}

function GroupSection({
  title, orders, colorClass, isCollapsed, onToggle, onOpenOrder, shippingColumn, loadingOrderId, alert = false,
}: GroupSectionProps) {
  const shippingHeader = shippingColumn === "flores" ? "Envio das flores" : "Receção do quadro";
  return (
    <div className="rounded-xl border border-[#E8E0D5] bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FDFAF7] transition-colors"
        onClick={onToggle}
      >
        {isCollapsed
          ? <ChevronRight className="h-4 w-4 text-[#8B7355] shrink-0" />
          : <ChevronDown className="h-4 w-4 text-[#8B7355] shrink-0" />
        }
        {alert && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
        <span className={`text-sm font-semibold ${colorClass}`}>{title}</span>
        <span className="ml-1 rounded-full bg-[#F0EAE0] px-2 py-0.5 text-xs font-medium text-[#8B7355]">
          {orders.length}
        </span>
      </button>
      {!isCollapsed && orders.length === 0 && (
        <p className="border-t border-[#F0EAE0] px-4 py-3 text-xs text-[#B8A99A] italic">
          Nenhuma encomenda neste grupo.
        </p>
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

type ViewType = "tabela" | "calendario" | "cards";
type GroupedOrders = ReturnType<typeof groupOrders>;

interface Props {
  initialOrders: Order[];
  initialGrouped: GroupedOrders;
}

// ── Componente principal ──────────────────────────────────────

export default function PreservacaoClient({ initialOrders, initialGrouped }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<ViewType>("tabela");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();

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
    { id: "calendario" as ViewType, label: "Calendário", icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "cards" as ViewType,      label: "Cards",      icon: <LayoutGrid className="h-3.5 w-3.5" /> },
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
          <Button
            size="sm"
            className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white h-8 gap-1.5"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova encomenda
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-6">
        {activeView === "tabela" && (
          <div className="space-y-3">
            <GroupSection title="Sem resposta"         orders={grouped.sem_resposta}        colorClass="text-red-600"    isCollapsed={collapsedGroups.has("sem_resposta")}        onToggle={() => toggleGroup("sem_resposta")}        onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} alert />
            <GroupSection title="Pré-reservas"         orders={grouped.pre_reservas}        colorClass="text-amber-700"  isCollapsed={collapsedGroups.has("pre_reservas")}        onToggle={() => toggleGroup("pre_reservas")}        onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} />
            <GroupSection title="Reservas"             orders={grouped.reservas}            colorClass="text-blue-700"   isCollapsed={collapsedGroups.has("reservas")}            onToggle={() => toggleGroup("reservas")}            onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} />
            <GroupSection title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" isCollapsed={collapsedGroups.has("preservacao_design")}  onToggle={() => toggleGroup("preservacao_design")}  onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} />
            <GroupSection title="Finalização"          orders={grouped.finalizacao}         colorClass="text-orange-700" isCollapsed={collapsedGroups.has("finalizacao")}         onToggle={() => toggleGroup("finalizacao")}         onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} />
            <GroupSection title="Concluídos"           orders={grouped.concluidos}          colorClass="text-green-700"  isCollapsed={collapsedGroups.has("concluidos")}          onToggle={() => toggleGroup("concluidos")}          onOpenOrder={openOrder} shippingColumn="quadro" loadingOrderId={navigatingId} />
            <GroupSection title="Cancelamentos"        orders={grouped.cancelamentos}       colorClass="text-gray-500"   isCollapsed={collapsedGroups.has("cancelamentos")}       onToggle={() => toggleGroup("cancelamentos")}       onOpenOrder={openOrder} shippingColumn="flores" loadingOrderId={navigatingId} />

            {filteredOrders.length === 0 && initialOrders.length > 0 && (
              <div className="rounded-xl border border-[#E8E0D5] bg-white p-8 text-center">
                <p className="text-sm text-[#8B7355]">
                  Nenhum resultado para <strong>&ldquo;{search}&rdquo;</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {activeView === "cards" && (
          <div className="space-y-6">
            <CardGroup title="Sem resposta"         orders={grouped.sem_resposta}        colorClass="text-red-600"    onOpenOrder={openOrder} loadingOrderId={navigatingId} alert />
            <CardGroup title="Pré-reservas"         orders={grouped.pre_reservas}        colorClass="text-amber-700"  onOpenOrder={openOrder} loadingOrderId={navigatingId} />
            <CardGroup title="Reservas"             orders={grouped.reservas}            colorClass="text-blue-700"   onOpenOrder={openOrder} loadingOrderId={navigatingId} />
            <CardGroup title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" onOpenOrder={openOrder} loadingOrderId={navigatingId} />
            <CardGroup title="Finalização"          orders={grouped.finalizacao}         colorClass="text-orange-700" onOpenOrder={openOrder} loadingOrderId={navigatingId} />
            <CardGroup title="Concluídos"           orders={grouped.concluidos}          colorClass="text-green-700"  onOpenOrder={openOrder} loadingOrderId={navigatingId} />
            <CardGroup title="Cancelamentos"        orders={grouped.cancelamentos}       colorClass="text-gray-500"   onOpenOrder={openOrder} loadingOrderId={navigatingId} />
          </div>
        )}

        {activeView === "calendario" && (
          <div className="rounded-xl border border-dashed border-[#E8E0D5] bg-white p-12 text-center">
            <p className="text-sm text-[#8B7355]">
              Vista <strong>Calendário</strong> — em construção.
            </p>
          </div>
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
}: {
  title: string;
  orders: Order[];
  colorClass: string;
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
  alert?: boolean;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {alert && <AlertTriangle className="h-4 w-4 text-red-500" />}
        <h2 className={`text-sm font-semibold ${colorClass}`}>{title}</h2>
        <span className="rounded-full bg-[#F0EAE0] px-2 py-0.5 text-xs font-medium text-[#8B7355]">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#E8E0D5] bg-white px-4 py-6 text-center text-xs text-[#B8A99A] italic">
          Nenhuma encomenda neste grupo.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onOpen={onOpenOrder}
              isLoading={loadingOrderId === o.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({
  order, onOpen, isLoading,
}: {
  order: Order;
  onOpen: (o: Order) => void;
  isLoading: boolean;
}) {
  const daysUntilEvent =
    order.event_date ? differenceInDays(parseISO(order.event_date), new Date()) : null;
  const urgentEvent = daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;
  const photoUrl = toEmbeddableImageUrl(order.flowers_photo_url);

  return (
    <button
      onClick={() => onOpen(order)}
      className={`group text-left rounded-2xl border bg-white overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)] hover:shadow-md transition-all ${
        isLoading ? "border-[#C4A882] ring-2 ring-[#C4A882]/30" : "border-[#E8E0D5] hover:border-[#C4A882]"
      }`}
    >
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
      <div className="px-3 py-2.5">
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
