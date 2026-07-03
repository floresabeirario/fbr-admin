import type { Order } from "@/types/database";
import type { PushPayload } from "./send";

// ============================================================
// Notificações push DIÁRIAS (corridas pelo cron das 7h)
// ============================================================
// Lógica PURA e testável: decide o que notificar a partir das encomendas
// e da hora actual. O envio + deduplicação vivem no cron (route.ts). Só
// aqui não há Supabase nem web-push — só cálculo.
//
// Notificações (todas para os admins):
//   📦 Recolha amanhã            — recolha_evento no dia seguinte
//   💐 Flores a chegar amanhã     — entrega em mãos no dia seguinte
//   🧊 Flores no congelador 5 dias — freezer_in_at há ≥ 120h COMPLETAS
//
// Envio CTT das flores fica de fora de propósito: não há campo fiável de
// "data de chegada" (o modelo usa event_date como proxy), por isso não dá
// para prometer "amanhã" sem falsos alarmes.

export type DailyPushItem = {
  /** Chave única para não repetir o mesmo aviso em dias seguidos. */
  dedupKey: string;
  payload: PushPayload;
};

const HOURS_120_MS = 120 * 60 * 60 * 1000;

// yyyy-mm-dd de uma data na hora de Portugal (en-CA formata nesse padrão).
function lisbonYMD(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// "Amanhã" em Portugal, como yyyy-mm-dd. Usa meio-dia UTC para nunca cair
// numa fronteira de horário de verão.
export function tomorrowLisbonYMD(now: Date): string {
  const [y, m, d] = lisbonYMD(now).split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + 1);
  return lisbonYMD(base);
}

// Normaliza uma data-só (pode vir "yyyy-mm-dd" ou ISO completo) para os
// primeiros 10 caracteres (yyyy-mm-dd) para comparar com "amanhã".
function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : null;
}

const SKIP_STATUSES = new Set(["cancelado", "entrega_flores_agendar"]);

export function computeDailyPushItems(orders: Order[], now: Date): DailyPushItem[] {
  const tomorrow = tomorrowLisbonYMD(now);
  const items: DailyPushItem[] = [];

  for (const o of orders) {
    if (o.deleted_at) continue;

    // 🧊 Congelador: 5 dias COMPLETOS (120h) e ainda dentro. Independente do
    // estado — as flores já estão fisicamente lá dentro. Só uma vez por
    // entrada no congelador (a chave inclui o freezer_in_at).
    if (o.freezer_in_at && !o.freezer_out_at) {
      const elapsed = now.getTime() - new Date(o.freezer_in_at).getTime();
      if (elapsed >= HOURS_120_MS) {
        items.push({
          dedupKey: `freezer5:${o.id}:${o.freezer_in_at}`,
          payload: {
            title: "🧊 Flores no congelador há 5 dias",
            body: `${o.client_name} — já podem sair do congelador`,
            url: `/preservacao/${o.order_id}`,
            tag: `freezer-${o.id}`,
          },
        });
      }
    }

    // As notificações de logística ignoram canceladas e pré-reservas (a
    // recolha/entrega ainda não é certa numa pré-reserva).
    if (SKIP_STATUSES.has(o.status)) continue;

    // 📦 Recolha no local amanhã.
    if (o.flower_delivery_method === "recolha_evento") {
      const d = dateOnly(o.pickup_date ?? o.event_date);
      if (d === tomorrow) {
        const location = o.pickup_address ?? o.event_location ?? null;
        items.push({
          dedupKey: `recolha:${o.id}:${d}`,
          payload: {
            title: "📦 Recolha amanhã",
            body: location ? `${o.client_name} — ${location}` : o.client_name,
            url: `/preservacao/${o.order_id}`,
            tag: `recolha-${o.id}`,
          },
        });
      }
    }

    // 💐 Flores a chegar amanhã (entrega em mãos no atelier).
    if (o.flower_delivery_method === "maos") {
      const d = dateOnly(o.hand_delivery_date);
      if (d === tomorrow) {
        items.push({
          dedupKey: `flores:${o.id}:${d}`,
          payload: {
            title: "💐 Flores a chegar amanhã",
            body: `${o.client_name} — entrega em mãos no atelier`,
            url: `/preservacao/${o.order_id}`,
            tag: `flores-${o.id}`,
          },
        });
      }
    }
  }

  return items;
}
