import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { getAuthenticatedClient, loadIntegration } from "./oauth";
import { createClient } from "@/lib/supabase/server";
import { EVENT_TYPE_LABELS, type Order } from "@/types/database";

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

type OrderForEvent = Pick<
  Order,
  | "id"
  | "order_id"
  | "client_name"
  | "event_date"
  | "event_type"
  | "event_location"
  | "couple_names"
>;

function buildEventBody(order: OrderForEvent): calendar_v3.Schema$Event {
  if (!order.event_date) {
    throw new Error("Encomenda sem data do evento — não dá para criar evento Calendar.");
  }

  const typeLabel = order.event_type ? EVENT_TYPE_LABELS[order.event_type] : null;
  const namePart =
    order.event_type === "casamento" && order.couple_names
      ? order.couple_names
      : order.client_name || "Sem nome";
  const summary = typeLabel ? `${typeLabel} — ${namePart}` : namePart;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const workbenchUrl = siteUrl ? `${siteUrl}/preservacao/${order.order_id}` : null;

  const descriptionLines = [
    `Encomenda #${order.order_id}`,
    workbenchUrl ? `Workbench: ${workbenchUrl}` : null,
  ].filter(Boolean) as string[];

  // Evento all-day. No Calendar all-day events o end.date é exclusivo,
  // por isso para um único dia somamos 1 dia.
  const start = order.event_date; // "YYYY-MM-DD"
  const next = new Date(`${order.event_date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10);

  return {
    summary,
    description: descriptionLines.join("\n"),
    location: order.event_location ?? undefined,
    start: { date: start },
    end: { date: end },
    transparency: "transparent", // free, não bloqueia o calendário
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
