// ============================================================
// FBR Admin — Helpers do Dashboard (recolhas, entregas, alertas)
// ============================================================

import { differenceInDays, parseISO } from "date-fns";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import { isExpiringSoon } from "@/lib/supabase/vouchers";

// ── Recolhas e entregas no horizonte próximo ─────────────────

export interface PickupItem {
  order: Order;
  /** Data relevante (event_date para recolhas, frame_delivery_date para entregas) */
  date: string;
  /** Tipo de movimento — recolha de flores ou entrega do quadro */
  kind: "recolha_evento" | "envio_ctt_flores" | "envio_ctt_quadro";
  /** Localização legível (event_location ou cidade) */
  location: string;
}

const PICKUP_HORIZON_DAYS = 30;

export function getUpcomingPickups(orders: Order[]): PickupItem[] {
  const today = new Date();
  const items: PickupItem[] = [];

  for (const o of orders) {
    if (o.deleted_at) continue;
    if (o.status === "cancelado") continue;
    // Pré-reserva = encomenda não confirmada; a recolha/envio ainda não é
    // certa, por isso não entra no planeamento (aparece na página Entregas
    // e Recolhas como "Por confirmar").
    if (o.status === "entrega_flores_agendar") continue;

    // Recolha no local (data = pickup_date se existir, senão event_date;
    // localização = pickup_address se existir, senão event_location)
    if (
      o.flower_delivery_method === "recolha_evento" &&
      (o.pickup_date ?? o.event_date)
    ) {
      const pickupDate = o.pickup_date ?? o.event_date!;
      const days = differenceInDays(parseISO(pickupDate), today);
      if (days >= -1 && days <= PICKUP_HORIZON_DAYS) {
        items.push({
          order: o,
          date: pickupDate,
          kind: "recolha_evento",
          location: o.pickup_address ?? o.event_location ?? "—",
        });
      }
    }

    // Envio CTT das flores (data = event_date como referência)
    if (
      o.flower_delivery_method === "ctt" &&
      o.event_date &&
      ["entrega_agendada"].includes(o.status)
    ) {
      const days = differenceInDays(parseISO(o.event_date), today);
      if (days >= -1 && days <= PICKUP_HORIZON_DAYS) {
        items.push({
          order: o,
          date: o.event_date,
          kind: "envio_ctt_flores",
          location: o.event_location ?? "—",
        });
      }
    }

    // Envio CTT do quadro (data = frame_delivery_date OU estimated_delivery_date)
    const frameSendDate = o.frame_delivery_date ?? o.estimated_delivery_date;
    if (
      o.frame_delivery_method === "ctt" &&
      frameSendDate &&
      ["quadro_pronto", "quadro_enviado"].includes(o.status)
    ) {
      const days = differenceInDays(parseISO(frameSendDate), today);
      if (days >= -7 && days <= PICKUP_HORIZON_DAYS) {
        items.push({
          order: o,
          date: frameSendDate,
          kind: "envio_ctt_quadro",
          location: o.event_location ?? "—",
        });
      }
    }
  }

  // Ordena pela data ascendente
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export const PICKUP_KIND_LABELS: Record<PickupItem["kind"], string> = {
  recolha_evento: "Recolha no local",
  envio_ctt_flores: "Envio CTT (flores)",
  envio_ctt_quadro: "Envio CTT (quadro)",
};

export const PICKUP_KIND_COLORS: Record<PickupItem["kind"], string> = {
  recolha_evento:   "bg-violet-100 text-violet-800 border-violet-300",
  envio_ctt_flores: "bg-sky-100 text-sky-800 border-sky-300",
  envio_ctt_quadro: "bg-rose-100 text-rose-800 border-rose-300",
};

// ── Alertas visuais ──────────────────────────────────────────

export type AlertSeverity = "info" | "warn" | "danger";

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  label: string;
  detail: string;
  href?: string;
}

const EVENT_HORIZON_DAYS = 7;

export function getDashboardAlerts(
  orders: Order[],
  vouchers: Voucher[],
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const today = new Date();

  // 1. Eventos nos próximos 7 dias (não cancelados, com flores por receber/preservadas)
  const upcomingEvents = orders.filter((o) => {
    if (o.deleted_at) return false;
    if (o.status === "cancelado" || o.status === "quadro_recebido") return false;
    if (!o.event_date) return false;
    const days = differenceInDays(parseISO(o.event_date), today);
    return days >= 0 && days <= EVENT_HORIZON_DAYS;
  });
  for (const o of upcomingEvents) {
    const days = differenceInDays(parseISO(o.event_date!), today);
    alerts.push({
      id: `event-${o.id}`,
      severity: days <= 2 ? "danger" : "warn",
      label: `Evento em ${days === 0 ? "hoje" : days === 1 ? "1 dia" : `${days} dias`}`,
      detail: `${o.client_name} — ${o.event_location ?? "sem localização"}`,
      href: `/preservacao/${o.order_id ?? o.id}`,
    });
  }

  // 1b. Flores prontas a sair do congelador (5 dias anti-insectos, mig 079).
  // Só alerta quando os 5 dias já passaram e a saída ainda não foi marcada.
  const freezerReady = orders.filter((o) => {
    if (o.deleted_at || o.status === "cancelado") return false;
    if (!o.freezer_in_at || o.freezer_out_at) return false;
    return differenceInDays(today, parseISO(o.freezer_in_at)) >= 5;
  });
  for (const o of freezerReady) {
    const days = differenceInDays(today, parseISO(o.freezer_in_at!));
    alerts.push({
      id: `freezer-${o.id}`,
      severity: "warn",
      label: `❄ Pronta a sair do congelador (${days} dias)`,
      detail: `${o.client_name} — entrou a ${o.freezer_in_at!.slice(0, 10).split("-").reverse().join("/")}`,
      href: `/preservacao/${o.order_id ?? o.id}`,
    });
  }

  // 1c. "Entregar até" — prazo de entrega pedido pelo cliente (mig 082).
  // Alerta quando faltam ≤30 dias e o quadro ainda não foi enviado/recebido;
  // danger quando faltam ≤14 dias ou o prazo já passou.
  const deadlineOrders = orders.filter((o) => {
    if (o.deleted_at || o.status === "cancelado") return false;
    if (["quadro_enviado", "quadro_recebido"].includes(o.status)) return false;
    if (!o.delivery_deadline) return false;
    return differenceInDays(parseISO(o.delivery_deadline), today) <= 30;
  });
  for (const o of deadlineOrders) {
    const days = differenceInDays(parseISO(o.delivery_deadline!), today);
    const overdue = days < 0;
    alerts.push({
      id: `deadline-${o.id}`,
      severity: overdue || days <= 14 ? "danger" : "warn",
      label: overdue
        ? `⏰ Prazo de entrega passou há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}`
        : `⏰ Entregar até ${o.delivery_deadline!.slice(0, 10).split("-").reverse().join("/")} (${days === 0 ? "hoje" : `${days} dia${days === 1 ? "" : "s"}`})`,
      detail: `${o.client_name}${o.delivery_deadline_reason ? ` — ${o.delivery_deadline_reason}` : ""}`,
      href: `/preservacao/${o.order_id ?? o.id}`,
    });
  }

  // 2. Pré-reservas sem contacto há ≥4 dias — lembrete para contactar.
  // Critério próprio (não confundir com o grupo "Sem resposta", que é só ghost
  // manual via isWithoutResponse): pré-reserva ainda não contactada há ≥4 dias.
  const uncontactedPreReservas = orders.filter((o) => {
    if (o.deleted_at) return false;
    if (o.status !== "entrega_flores_agendar") return false;
    if (o.contacted) return false;
    return differenceInDays(today, parseISO(o.created_at)) >= 4;
  });
  for (const o of uncontactedPreReservas.slice(0, 10)) {
    const days = differenceInDays(today, parseISO(o.created_at));
    alerts.push({
      id: `noresp-${o.id}`,
      severity: "danger",
      label: `Pré-reserva sem contacto há ${days} dias`,
      detail: `${o.client_name} — ${o.email ?? o.phone ?? "sem contacto"}`,
      href: `/preservacao/${o.order_id ?? o.id}`,
    });
  }

  // 3. Vales pagos sem preservação a expirar nos próximos 3 meses
  const expiringVouchers = vouchers.filter(
    (v) =>
      !v.deleted_at &&
      v.payment_status === "100_pago" &&
      v.usage_status === "preservacao_nao_agendada" &&
      isExpiringSoon(v.expiry_date),
  );
  for (const v of expiringVouchers) {
    alerts.push({
      id: `voucher-${v.id}`,
      severity: "warn",
      label: `Vale a expirar`,
      detail: `${v.code} — ${v.recipient_name || v.sender_name} expira em ${v.expiry_date.slice(0, 10)}`,
      href: `/vale-presente/${v.code}`,
    });
  }

  return alerts;
}
