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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupOrders } from "@/lib/supabase/orders";
import {
  type Order,
  type OrderStatus,
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

// ── Badges ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  entrega_flores_agendar: "bg-rose-100 text-[#3D2B1F] border-rose-200",
  entrega_agendada:       "bg-pink-100 text-[#3D2B1F] border-pink-200",
  flores_enviadas:        "bg-fuchsia-100 text-[#3D2B1F] border-fuchsia-200",
  flores_recebidas:       "bg-purple-100 text-[#3D2B1F] border-purple-200",
  flores_na_prensa:       "bg-violet-100 text-[#3D2B1F] border-violet-200",
  reconstrucao_botanica:  "bg-indigo-100 text-[#3D2B1F] border-indigo-200",
  a_compor_design:        "bg-blue-100 text-[#3D2B1F] border-blue-200",
  a_aguardar_aprovacao:   "bg-sky-100 text-[#3D2B1F] border-sky-200",
  a_ser_emoldurado:       "bg-cyan-100 text-[#3D2B1F] border-cyan-200",
  emoldurado:             "bg-teal-100 text-[#3D2B1F] border-teal-200",
  a_ser_fotografado:      "bg-emerald-100 text-[#3D2B1F] border-emerald-200",
  quadro_pronto:          "bg-lime-100 text-[#3D2B1F] border-lime-200",
  quadro_enviado:         "bg-yellow-100 text-[#3D2B1F] border-yellow-200",
  quadro_recebido:        "bg-green-100 text-[#3D2B1F] border-green-200",
  cancelado:              "bg-stone-100 text-stone-500 border-stone-200",
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

const STATUS_ITEM_COLORS: Record<OrderStatus, string> = {
  entrega_flores_agendar: "bg-rose-50 text-[#3D2B1F]",
  entrega_agendada:       "bg-pink-50 text-[#3D2B1F]",
  flores_enviadas:        "bg-fuchsia-50 text-[#3D2B1F]",
  flores_recebidas:       "bg-purple-50 text-[#3D2B1F]",
  flores_na_prensa:       "bg-violet-50 text-[#3D2B1F]",
  reconstrucao_botanica:  "bg-indigo-50 text-[#3D2B1F]",
  a_compor_design:        "bg-blue-50 text-[#3D2B1F]",
  a_aguardar_aprovacao:   "bg-sky-50 text-[#3D2B1F]",
  a_ser_emoldurado:       "bg-cyan-50 text-[#3D2B1F]",
  emoldurado:             "bg-teal-50 text-[#3D2B1F]",
  a_ser_fotografado:      "bg-emerald-50 text-[#3D2B1F]",
  quadro_pronto:          "bg-lime-50 text-[#3D2B1F]",
  quadro_enviado:         "bg-yellow-50 text-[#3D2B1F]",
  quadro_recebido:        "bg-green-50 text-[#3D2B1F]",
  cancelado:              "bg-stone-50 text-stone-500",
};

const PAYMENT_COLORS: Record<string, string> = {
  "100_pago":      "bg-green-50 text-green-700 border-green-200",
  "70_pago":       "bg-yellow-50 text-yellow-700 border-yellow-200",
  "30_pago":       "bg-yellow-50 text-yellow-700 border-yellow-200",
  "30_por_pagar":  "bg-red-50 text-red-600 border-red-200",
  "100_por_pagar": "bg-red-50 text-red-700 border-red-200",
};

function InlineStatusSelect({
  value,
  onChange,
  busy,
}: {
  value: OrderStatus;
  onChange: (s: OrderStatus) => void;
  busy: boolean;
}) {
  const colorClass = STATUS_COLORS[value] ?? "bg-gray-50 text-gray-500 border-gray-200";
  return (
    <Select value={value} onValueChange={(v) => onChange(v as OrderStatus)} disabled={busy}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-7 text-xs font-medium border rounded-full px-2.5 max-w-[200px] ${colorClass} hover:brightness-95 transition`}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue>
            {(v) => {
              if (typeof v !== "string" || !(v in STATUS_LABELS)) return null;
              const Icon = STATUS_ICONS[v as OrderStatus];
              return (
                <>
                  <Icon className="h-3 w-3 shrink-0" />
                  {STATUS_LABELS[v as OrderStatus]}
                </>
              );
            }}
          </SelectValue>
        )}
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()} className="max-h-80">
        {(Object.keys(STATUS_LABELS) as Array<OrderStatus>).map((s) => {
          const Icon = STATUS_ICONS[s];
          return (
            <SelectItem key={s} value={s} className={`text-xs font-medium ${STATUS_ITEM_COLORS[s]}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {STATUS_LABELS[s]}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function PaymentBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        PAYMENT_COLORS[status] ?? "bg-gray-50 text-gray-500 border-gray-200"
      }`}
    >
      {PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS] ?? status}
    </span>
  );
}

// ── Linha da tabela ───────────────────────────────────────────

function OrderRow({
  order,
  onOpen,
  shippingColumn,
}: {
  order: Order;
  onOpen: (o: Order) => void;
  shippingColumn: ShippingColumn;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus | null>(null);
  const [optimisticContacted, setOptimisticContacted] = useState<boolean | null>(null);

  const currentStatus = optimisticStatus ?? order.status;
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
      className="border-b border-[#F0EAE0] hover:bg-[#FDFAF7] cursor-pointer transition-colors"
      onClick={() => onOpen(order)}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col">
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
        <span className="text-sm text-[#3D2B1F] block max-w-[200px] truncate" title={order.event_location ?? undefined}>
          {order.event_location || <span className="text-[#B8A99A]">—</span>}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-[#3D2B1F]">{shippingLabel}</span>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineStatusSelect value={currentStatus} onChange={changeStatus} busy={isPending && optimisticStatus !== null} />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-[#3D2B1F]">{formatEuro(order.budget)}</span>
      </td>
      <td className="px-4 py-3">
        <PaymentBadge status={order.payment_status} />
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
  alert?: boolean;
}

function GroupSection({
  title, orders, colorClass, isCollapsed, onToggle, onOpenOrder, shippingColumn, alert = false,
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
          <table className="w-full text-left">
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
                <OrderRow key={order.id} order={order} onOpen={onOpenOrder} shippingColumn={shippingColumn} />
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openOrder(order: Order) {
    router.push(`/preservacao/${order.order_id}`);
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
            <GroupSection title="Sem resposta"         orders={grouped.sem_resposta}        colorClass="text-red-600"    isCollapsed={collapsedGroups.has("sem_resposta")}        onToggle={() => toggleGroup("sem_resposta")}        onOpenOrder={openOrder} shippingColumn="flores" alert />
            <GroupSection title="Pré-reservas"         orders={grouped.pre_reservas}        colorClass="text-amber-700"  isCollapsed={collapsedGroups.has("pre_reservas")}        onToggle={() => toggleGroup("pre_reservas")}        onOpenOrder={openOrder} shippingColumn="flores" />
            <GroupSection title="Reservas"             orders={grouped.reservas}            colorClass="text-blue-700"   isCollapsed={collapsedGroups.has("reservas")}            onToggle={() => toggleGroup("reservas")}            onOpenOrder={openOrder} shippingColumn="flores" />
            <GroupSection title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" isCollapsed={collapsedGroups.has("preservacao_design")}  onToggle={() => toggleGroup("preservacao_design")}  onOpenOrder={openOrder} shippingColumn="quadro" />
            <GroupSection title="Finalização"          orders={grouped.finalizacao}         colorClass="text-orange-700" isCollapsed={collapsedGroups.has("finalizacao")}         onToggle={() => toggleGroup("finalizacao")}         onOpenOrder={openOrder} shippingColumn="quadro" />
            <GroupSection title="Concluídos"           orders={grouped.concluidos}          colorClass="text-green-700"  isCollapsed={collapsedGroups.has("concluidos")}          onToggle={() => toggleGroup("concluidos")}          onOpenOrder={openOrder} shippingColumn="quadro" />
            <GroupSection title="Cancelamentos"        orders={grouped.cancelamentos}       colorClass="text-gray-500"   isCollapsed={collapsedGroups.has("cancelamentos")}       onToggle={() => toggleGroup("cancelamentos")}       onOpenOrder={openOrder} shippingColumn="flores" />

            {filteredOrders.length === 0 && initialOrders.length > 0 && (
              <div className="rounded-xl border border-[#E8E0D5] bg-white p-8 text-center">
                <p className="text-sm text-[#8B7355]">
                  Nenhum resultado para <strong>"{search}"</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {activeView === "cards" && (
          <div className="space-y-6">
            <CardGroup title="Sem resposta"         orders={grouped.sem_resposta}        colorClass="text-red-600"    onOpenOrder={openOrder} alert />
            <CardGroup title="Pré-reservas"         orders={grouped.pre_reservas}        colorClass="text-amber-700"  onOpenOrder={openOrder} />
            <CardGroup title="Reservas"             orders={grouped.reservas}            colorClass="text-blue-700"   onOpenOrder={openOrder} />
            <CardGroup title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" onOpenOrder={openOrder} />
            <CardGroup title="Finalização"          orders={grouped.finalizacao}         colorClass="text-orange-700" onOpenOrder={openOrder} />
            <CardGroup title="Concluídos"           orders={grouped.concluidos}          colorClass="text-green-700"  onOpenOrder={openOrder} />
            <CardGroup title="Cancelamentos"        orders={grouped.cancelamentos}       colorClass="text-gray-500"   onOpenOrder={openOrder} />
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
  alert = false,
}: {
  title: string;
  orders: Order[];
  colorClass: string;
  onOpenOrder: (o: Order) => void;
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
            <OrderCard key={o.id} order={o} onOpen={onOpenOrder} />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({ order, onOpen }: { order: Order; onOpen: (o: Order) => void }) {
  const daysUntilEvent =
    order.event_date ? differenceInDays(parseISO(order.event_date), new Date()) : null;
  const urgentEvent = daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;

  return (
    <button
      onClick={() => onOpen(order)}
      className="group text-left rounded-2xl border border-[#E8E0D5] bg-white overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)] hover:shadow-md hover:border-[#C4A882] transition-all"
    >
      <div className="relative aspect-square bg-gradient-to-br from-[#FAF8F5] to-[#F0E8DC]">
        {order.flowers_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={order.flowers_photo_url}
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
