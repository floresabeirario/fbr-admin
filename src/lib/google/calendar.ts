import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { getAuthenticatedClient, loadIntegration } from "./oauth";
import { createClient } from "@/lib/supabase/server";
import {
  EVENT_TYPE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  type Order,
} from "@/types/database";

/**
 * Calendário "Preservação de Flores" na conta info@floresabeirario.pt.
 *
 * Sessão 38: cria/cacheia o calendário no 1º uso e mantém um evento
 * all-day por encomenda a partir do 1º pagamento. O ID do evento
 * fica em `orders.calendar_event_id`.
 *
 * Vales NÃO geram eventos (decisão da Maria — só encomendas).
 */

export const CALENDAR_NAME = "Preservação de Flores";
const TIMEZONE = "Europe/Lisbon";

async function getCalendar(): Promise<calendar_v3.Calendar> {
  const auth = await getAuthenticatedClient();
  return google.calendar({ version: "v3", auth });
}

/**
 * Garante que o calendário "Preservação de Flores" existe na conta
 * conectada e que o ID está cacheado em `google_integration`. Idempotente.
 *
 * 1. Se já há `calendar_id` no cache → confirma rápido com `calendars.get`
 *    e devolve. Se a chamada falhar com 404 (calendário foi apagado a mão)
 *    cai para o passo 2.
 * 2. Procura na `calendarList` por um calendário com summary igual a
 *    "Preservação de Flores" — útil quando a Maria já criou o calendário
 *    manualmente antes de conectar.
 * 3. Caso contrário cria um novo via `calendars.insert` e persiste o ID.
 */
export async function ensureCalendar(): Promise<string> {
  const integration = await loadIntegration();
  if (!integration) {
    throw new Error(
      "Integração Google não encontrada. Conecta primeiro em /settings/google.",
    );
  }

  const calendar = await getCalendar();

  if (integration.calendar_id) {
    try {
      const res = await calendar.calendars.get({
        calendarId: integration.calendar_id,
      });
      if (res.data.id) return res.data.id;
    } catch {
      // Calendário pode ter sido apagado a mão — refazer o lookup.
    }
  }

  // Procurar na lista (caso já exista um com este nome criado manualmente)
  const list = await calendar.calendarList.list({ maxResults: 250 });
  const existing = list.data.items?.find(
    (c) => (c.summary ?? "").trim().toLowerCase() === CALENDAR_NAME.toLowerCase(),
  );

  let calendarId: string | null = existing?.id ?? null;

  if (!calendarId) {
    const created = await calendar.calendars.insert({
      requestBody: {
        summary: CALENDAR_NAME,
        description:
          "Eventos das encomendas de preservação de flores. Gerido automaticamente pelo admin FBR.",
        timeZone: TIMEZONE,
      },
    });
    if (!created.data.id) {
      throw new Error('Falhou ao criar o calendário "Preservação de Flores".');
    }
    calendarId = created.data.id;
  }

  // Persistir o ID no cache
  if (calendarId !== integration.calendar_id) {
    const supabase = await createClient();
    await supabase
      .from("google_integration")
      .update({ calendar_id: calendarId })
      .eq("id", integration.id);
  }

  return calendarId;
}

export type CalendarEventInfo = { id: string; htmlLink: string | null };

/**
 * Constrói o URL público do evento Google Calendar a partir do
 * `eventId` e do `calendarId`. Útil como fallback para encomendas
 * cujo `htmlLink` ainda não foi persistido (criadas antes da
 * migração 037). Formato `eid` = base64url(eventId + ' ' + calendarId).
 */
export function computeEventHtmlLink(eventId: string, calendarId: string): string {
  const eid = Buffer.from(`${eventId} ${calendarId}`, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `https://www.google.com/calendar/event?eid=${eid}`;
}

type OrderForEvent = Pick<
  Order,
  | "id"
  | "order_id"
  | "client_name"
  | "event_date"
  | "event_type"
  | "event_location"
  | "couple_names"
  | "flower_delivery_method"
  | "pickup_address"
  | "pickup_date"
  | "pickup_time_from"
  | "pickup_time_to"
  | "pickup_notes"
  | "pickup_contact_name"
  | "pickup_contact_phone"
  | "email"
  | "phone"
  | "contact_preference"
>;

// Normaliza um número de telefone para exibição: garante o "+" prefixo
// (indicativo internacional). Retorna `null` quando vazio.
function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

// Formata "YYYY-MM-DD" → "15 de Maio de 2026" (mês por extenso em PT).
// Usado em sítios onde a data é a info principal da linha, como a data
// da recolha na descrição do evento Calendar.
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
function formatDateLongPt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const day = parseInt(m[3], 10);
  const monthIdx = parseInt(m[2], 10) - 1;
  const year = m[1];
  const month = MONTHS_PT[monthIdx] ?? m[2];
  return `${day} de ${month} de ${year}`;
}


// Formata HH:MM (descarta segundos vindos do Postgres TIME).
function trimSeconds(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = t.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : t;
}

// Soma 1 hora a "HH:MM" (default para end-time quando só foi preenchido o início).
function addOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const date = new Date(2000, 0, 1, h, m + 60);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildEventBody(order: OrderForEvent): calendar_v3.Schema$Event {
  if (!order.event_date) {
    throw new Error("Encomenda sem data do evento — não dá para criar evento Calendar.");
  }

  const isPickup = order.flower_delivery_method === "recolha_evento";
  const isHandDelivery = order.flower_delivery_method === "maos";

  const typeLabel = order.event_type ? EVENT_TYPE_LABELS[order.event_type] : null;
  const namePart =
    order.event_type === "casamento" && order.couple_names
      ? order.couple_names
      : order.client_name || "Sem nome";

  // Summary com prefixo logístico quando aplicável — facilita reconhecer
  // rapidamente o evento na vista de Calendar do telemóvel.
  // Formato: "🚗 RECOLHA | João & Maria | Casamento 💐"
  let prefix: string | null = null;
  if (isPickup) prefix = "🚗 RECOLHA";
  else if (isHandDelivery) prefix = "🤲 EM MÃOS";
  const summary = `${[prefix, namePart, typeLabel].filter(Boolean).join(" | ")} 💐`;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const workbenchUrl = siteUrl ? `${siteUrl}/preservacao/${order.order_id}` : null;

  // Construção da descrição. Quando é recolha, bloco dedicado no topo com
  // morada/horário; sempre seguido por contactos do cliente e link workbench.
  // O Google Calendar aceita HTML básico (<a>, <br>) em description.
  const lines: string[] = [];

  if (isPickup) {
    lines.push("🚗 RECOLHA NO LOCAL");
    if (order.pickup_address) lines.push(`📍 Morada: ${order.pickup_address}`);
    const from = trimSeconds(order.pickup_time_from);
    const to = trimSeconds(order.pickup_time_to);
    if (from || to) {
      lines.push(`🕒 Horário: ${from ?? "?"}${to ? ` – ${to}` : ""}`);
    }
    if (order.pickup_date && order.pickup_date !== order.event_date) {
      lines.push(`📅 Data de recolha: ${formatDateLongPt(order.pickup_date)}`);
    }
    if (order.pickup_contact_name || order.pickup_contact_phone) {
      const parts = [order.pickup_contact_name, formatPhone(order.pickup_contact_phone)]
        .filter(Boolean)
        .join(" — ");
      lines.push(`👥 Contacto no local: ${parts}`);
    }
    if (order.pickup_notes) {
      lines.push(`📝 Notas: ${order.pickup_notes}`);
    }
    lines.push("");
  } else if (isHandDelivery) {
    lines.push("🤲 EM MÃOS pelo cliente");
    lines.push("");
  } else if (order.flower_delivery_method) {
    lines.push(`📦 Envio: ${FLOWER_DELIVERY_METHOD_LABELS[order.flower_delivery_method]}`);
    lines.push("");
  }

  // Contactos do cliente — sempre incluídos (telemóvel apenas;
  // email e preferência de contacto são geridos no workbench)
  lines.push("👤 CLIENTE");
  lines.push(`Nome: ${order.client_name || "—"}`);
  const phoneFmt = formatPhone(order.phone);
  if (phoneFmt) lines.push(`📱 ${phoneFmt}`);
  lines.push("");

  // Evento (data + local) — só se diferente da info da recolha
  if (!isPickup && order.event_location) {
    lines.push("📍 Local do evento");
    lines.push(order.event_location);
    lines.push("");
  } else if (isPickup && order.event_location && order.event_location !== order.pickup_address) {
    lines.push("📍 Local do evento (diferente da recolha)");
    lines.push(order.event_location);
    lines.push("");
  }

  // ID da encomenda + URL do workbench. O Google Calendar elimina tags
  // <a> da descrição mas linkifica URLs em texto puro — desde que estejam
  // numa linha sozinha (caracteres não-ASCII colados ao URL quebram a
  // detecção em alguns clientes). Por isso o URL fica na sua própria linha.
  lines.push(`Encomenda #${order.order_id}`);
  if (workbenchUrl) {
    lines.push(workbenchUrl);
  }

  // Localização do evento Calendar: quando é recolha, usa a morada de
  // recolha (mais útil — abre o Maps directo para onde ir buscar).
  const location = isPickup
    ? (order.pickup_address ?? order.event_location ?? undefined)
    : (order.event_location ?? undefined);

  // Datas/horas: se for recolha COM hora definida, evento timed; senão all-day.
  let timing: Pick<calendar_v3.Schema$Event, "start" | "end">;

  const pickupHasTime = isPickup && order.pickup_time_from;
  if (pickupHasTime) {
    const dateStr = order.pickup_date ?? order.event_date;
    const startTime = trimSeconds(order.pickup_time_from)!;
    const endTime = trimSeconds(order.pickup_time_to) ?? addOneHour(startTime);
    timing = {
      start: { dateTime: `${dateStr}T${startTime}:00`, timeZone: TIMEZONE },
      end: { dateTime: `${dateStr}T${endTime}:00`, timeZone: TIMEZONE },
    };
  } else {
    const start = order.event_date; // "YYYY-MM-DD"
    const next = new Date(`${order.event_date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const end = next.toISOString().slice(0, 10);
    timing = {
      start: { date: start },
      end: { date: end },
    };
  }

  return {
    summary,
    description: lines.join("\n"),
    location,
    ...timing,
    // Recolha BLOQUEIA o calendário (alguém tem que estar lá); resto fica free
    transparency: isPickup ? "opaque" : "transparent",
  };
}

/**
 * Cria ou actualiza o evento Calendar de uma encomenda.
 * Devolve `{id, htmlLink}` ou `null` se a encomenda não tem `event_date`.
 */
export async function upsertOrderEvent(
  order: OrderForEvent & { calendar_event_id: string | null },
): Promise<CalendarEventInfo | null> {
  if (!order.event_date) return null;

  const calendarId = await ensureCalendar();
  const calendar = await getCalendar();
  const body = buildEventBody(order);

  // Se já há um eventId persistido, tentamos UPDATE — se falhar (404, evento
  // apagado a mão), caímos para INSERT.
  if (order.calendar_event_id) {
    try {
      const res = await calendar.events.update({
        calendarId,
        eventId: order.calendar_event_id,
        requestBody: body,
      });
      if (res.data.id) {
        return { id: res.data.id, htmlLink: res.data.htmlLink ?? null };
      }
    } catch (err: unknown) {
      const status = (err as { code?: number; status?: number }).code
        ?? (err as { code?: number; status?: number }).status;
      if (status !== 404 && status !== 410) {
        throw err;
      }
      // 404/410 → evento sumiu, cair para INSERT
    }
  }

  const created = await calendar.events.insert({
    calendarId,
    requestBody: body,
  });
  if (!created.data.id) {
    throw new Error("Falhou ao criar evento no Google Calendar.");
  }
  return { id: created.data.id, htmlLink: created.data.htmlLink ?? null };
}

/**
 * Apaga o evento Calendar associado a uma encomenda. No-op se já não existe.
 * Retorna true se apagou, false se não havia nada para apagar.
 */
export async function deleteOrderEvent(eventId: string): Promise<boolean> {
  const calendarId = await ensureCalendar();
  const calendar = await getCalendar();
  try {
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (err: unknown) {
    const status = (err as { code?: number; status?: number }).code
      ?? (err as { code?: number; status?: number }).status;
    if (status === 404 || status === 410) return false;
    throw err;
  }
}
