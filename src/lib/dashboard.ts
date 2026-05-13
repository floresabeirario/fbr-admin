// ============================================================
// FBR Admin — Helpers do Dashboard (recolhas, entregas, alertas)
// ============================================================

import { differenceInDays, parseISO } from "date-fns";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import { isWithoutResponse } from "@/lib/supabase/orders";
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
  recolha_evento:   "bg-emerald-100 text-emerald-800 border-emerald-300",
  envio_ctt_flores: "bg-sky-100 text-sky-800 border-sky-300",
  envio_ctt_quadro: "bg-violet-100 text-violet-800 border-violet-300",
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

const STUCK_DAYS = 14;
const PRE_RESERVA_NO_CONTACT_DAYS = 4;
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

  // 2. Encomendas paradas há ≥14 dias (sem update e sem ser "Quadro recebido"/"Cancelado")
  const stuckOrders = orders.filter((o) => {
    if (o.deleted_at) return false;
    if (o.status === "cancelado" || o.status === "quadro_recebido") return false;
    const days = differenceInDays(today, parseISO(o.updated_at));
    return days >= STUCK_DAYS;
  });
  for (const o of stuckOrders.slice(0, 10)) {
    const days = differenceInDays(today, parseISO(o.updated_at));
    alerts.push({
      id: `stuck-${o.id}`,
      severity: "warn",
      label: `Parada há ${days} dias`,
      detail: `${o.client_name} — sem actualização desde ${o.updated_at.slice(0, 10)}`,
      href: `/preservacao/${o.order_id ?? o.id}`,
    });
  }

  // 3. Pré-reservas sem contacto há ≥4 dias (já capturado pelo isWithoutResponse)
  const noResponse = orders.filter((o) => isWithoutResponse(o));
  for (const o of noResponse.slice(0, 10)) {
    const days = differenceInDays(today, parseISO(o.created_at));
    alerts.push({
      id: `noresp-${o.id}`,
      severity: "danger",
      label: `Pré-reserva sem contacto há ${days} dias`,
      detail: `${o.client_name} — ${o.email ?? o.phone ?? "sem contacto"}`,
      href: `/preservacao/${o.order_id ?? o.id}`,
    });
  }

  // 4. Vales pagos sem preservação a expirar nos próximos 3 meses
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
