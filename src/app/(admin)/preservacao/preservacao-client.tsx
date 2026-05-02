"use client";

import { useState } from "react";
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
  Rows3,
  AlertTriangle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupOrders } from "@/lib/supabase/orders";
import {
  type Order,
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
} from "@/types/database";
import NovaEncomendaSheet from "./nova-encomenda-sheet";

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
  entrega_flores_agendar: "bg-amber-50 text-amber-700 border-amber-200",
  entrega_agendada:       "bg-blue-50 text-blue-700 border-blue-200",
  flores_enviadas:        "bg-blue-50 text-blue-700 border-blue-200",
  flores_recebidas:       "bg-blue-50 text-blue-700 border-blue-200",
  flores_na_prensa:       "bg-purple-50 text-purple-700 border-purple-200",
  reconstrucao_botanica:  "bg-purple-50 text-purple-700 border-purple-200",
  a_compor_design:        "bg-purple-50 text-purple-700 border-purple-200",
  a_aguardar_aprovacao:   "bg-purple-50 text-purple-700 border-purple-200",
  a_ser_emoldurado:       "bg-orange-50 text-orange-700 border-orange-200",
  emoldurado:             "bg-orange-50 text-orange-700 border-orange-200",
  a_ser_fotografado:      "bg-orange-50 text-orange-700 border-orange-200",
  quadro_pronto:          "bg-orange-50 text-orange-700 border-orange-200",
  quadro_enviado:         "bg-orange-50 text-orange-700 border-orange-200",
  quadro_recebido:        "bg-green-50 text-green-700 border-green-200",
  cancelado:              "bg-gray-50 text-gray-500 border-gray-200",
};

const PAYMENT_COLORS: Record<string, string> = {
  "100_pago":      "bg-green-50 text-green-700 border-green-200",
  "70_pago":       "bg-yellow-50 text-yellow-700 border-yellow-200",
  "30_pago":       "bg-yellow-50 text-yellow-700 border-yellow-200",
  "30_por_pagar":  "bg-red-50 text-red-600 border-red-200",
  "100_por_pagar": "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        STATUS_COLORS[status] ?? "bg-gray-50 text-gray-500 border-gray-200"
      }`}
    >
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
    </span>
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

function OrderRow({ order, onOpen }: { order: Order; onOpen: (o: Order) => void }) {
  const daysUntilEvent =
    order.event_date
      ? differenceInDays(parseISO(order.event_date), new Date())
      : null;
  const urgentEvent =
    daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;

  return (
    <tr
      className="border-b border-[#F0EAE0] hover:bg-[#FDFAF7] cursor-pointer transition-colors"
      onClick={() => onOpen(order)}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-[#8B7355]">
          {order.order_id.slice(0, 8)}…
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#3D2B1F]">{order.client_name}</span>
          {order.email && (
            <span className="text-xs text-[#8B7355] truncate max-w-[180px]">{order.email}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {order.event_type && (
            <span className="text-xs text-[#3D2B1F]">
              {EVENT_TYPE_LABELS[order.event_type]}
            </span>
          )}
          {order.event_date && (
            <span
              className={`text-xs ${urgentEvent ? "text-red-600 font-semibold" : "text-[#8B7355]"}`}
            >
              {urgentEvent && "⚠ "}
              {formatDate(order.event_date)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-[#3D2B1F]">{formatEuro(order.budget)}</span>
      </td>
      <td className="px-4 py-3">
        <PaymentBadge status={order.payment_status} />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          className="text-[#C4A882] hover:text-[#3D2B1F] transition-colors"
          onClick={(e) => { e.stopPropagation(); onOpen(order); }}
          title="Abrir workbench"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
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
  alert?: boolean;
}

function GroupSection({
  title, orders, colorClass, isCollapsed, onToggle, onOpenOrder, alert = false,
}: GroupSectionProps) {
  if (orders.length === 0) return null;
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
      {!isCollapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-t border-[#F0EAE0] bg-[#FAF8F5]">
                {["ID", "Cliente", "Evento", "Estado", "Orçamento", "Pagamento", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide ${i === 4 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} onOpen={onOpenOrder} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────

type ViewType = "tabela" | "calendario" | "workbench";
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
    // TODO: abrir workbench
    console.log("Abrir workbench:", order.order_id);
  }

  const totalActive = initialOrders.filter(
    (o) => o.status !== "cancelado" && o.status !== "quadro_recebido"
  ).length;

  const VIEW_BUTTONS = [
    { id: "tabela" as ViewType,     label: "Tabela",     icon: <LayoutList className="h-3.5 w-3.5" /> },
    { id: "calendario" as ViewType, label: "Calendário", icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: "workbench" as ViewType,  label: "Workbench",  icon: <Rows3 className="h-3.5 w-3.5" /> },
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
            {grouped.sem_resposta.length > 0 && (
              <GroupSection
                title="Sem resposta"
                orders={grouped.sem_resposta}
                colorClass="text-red-600"
                isCollapsed={collapsedGroups.has("sem_resposta")}
                onToggle={() => toggleGroup("sem_resposta")}
                onOpenOrder={openOrder}
                alert
              />
            )}
            <GroupSection title="Pré-reservas"        orders={grouped.pre_reservas}        colorClass="text-amber-700"  isCollapsed={collapsedGroups.has("pre_reservas")}        onToggle={() => toggleGroup("pre_reservas")}        onOpenOrder={openOrder} />
            <GroupSection title="Reservas"            orders={grouped.reservas}            colorClass="text-blue-700"   isCollapsed={collapsedGroups.has("reservas")}            onToggle={() => toggleGroup("reservas")}            onOpenOrder={openOrder} />
            <GroupSection title="Preservação e design" orders={grouped.preservacao_design}  colorClass="text-purple-700" isCollapsed={collapsedGroups.has("preservacao_design")}  onToggle={() => toggleGroup("preservacao_design")}  onOpenOrder={openOrder} />
            <GroupSection title="Finalização"         orders={grouped.finalizacao}         colorClass="text-orange-700" isCollapsed={collapsedGroups.has("finalizacao")}         onToggle={() => toggleGroup("finalizacao")}         onOpenOrder={openOrder} />
            <GroupSection title="Concluídos"          orders={grouped.concluidos}          colorClass="text-green-700"  isCollapsed={collapsedGroups.has("concluidos")}          onToggle={() => toggleGroup("concluidos")}          onOpenOrder={openOrder} />
            <GroupSection title="Cancelamentos"       orders={grouped.cancelamentos}       colorClass="text-gray-500"   isCollapsed={collapsedGroups.has("cancelamentos")}       onToggle={() => toggleGroup("cancelamentos")}       onOpenOrder={openOrder} />

            {initialOrders.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#E8E0D5] bg-white p-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F0EAE0]">
                  <Clock className="h-5 w-5 text-[#C4A882]" />
                </div>
                <p className="text-sm font-medium text-[#3D2B1F]">Nenhuma encomenda ainda</p>
                <p className="mt-1 text-xs text-[#8B7355]">
                  Cria a primeira encomenda com o botão acima.
                </p>
              </div>
            )}

            {initialOrders.length > 0 && filteredOrders.length === 0 && (
              <div className="rounded-xl border border-[#E8E0D5] bg-white p-8 text-center">
                <p className="text-sm text-[#8B7355]">
                  Nenhum resultado para <strong>"{search}"</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {activeView !== "tabela" && (
          <div className="rounded-xl border border-dashed border-[#E8E0D5] bg-white p-12 text-center">
            <p className="text-sm text-[#8B7355]">
              Vista <strong>{activeView}</strong> — em construção.
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
