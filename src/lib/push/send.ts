import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS_LIST } from "@/lib/auth/roles";

// ============================================================
// Envio de notificações push internas (Web Push / VAPID)
// ============================================================
// Corre SEMPRE no servidor (webhook, cron, server action com `after`)
// com um cliente Supabase service_role — as subscrições de push são de
// servidor e o envio precisa de as ler de qualquer utilizador (não só do
// próprio). Nunca importar em código de cliente.

export type PushPayload = {
  /** Título em negrito da notificação. */
  title: string;
  /** Corpo (1-2 linhas). */
  body: string;
  /** Rota a abrir ao clicar. Default "/". */
  url?: string;
  /** Agrupa/substitui notificações do mesmo tipo no telemóvel. */
  tag?: string;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let configured: boolean | null = null;

// Configura o web-push com as chaves VAPID uma única vez. Devolve false
// (e a app segue sem push) se as env vars ainda não estiverem definidas —
// nunca deixamos a falta de configuração rebentar um webhook ou um cron.
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:info@floresabeirario.pt";
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY em falta — push desligado.");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

// Envia `payload` a todos os dispositivos subscritos pelos emails dados.
// Best-effort: uma falha num dispositivo nunca interrompe os outros nem a
// operação que despoletou o envio. Subscrições expiradas (404/410) são
// apagadas para a tabela não acumular lixo.
export async function sendPushToEmails(
  supabase: SupabaseClient,
  emails: string[],
  payload: PushPayload,
): Promise<void> {
  if (emails.length === 0) return;
  if (!ensureConfigured()) return;

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_email", emails);

  if (error) {
    console.error("[push] falha a ler subscrições:", error.message);
    return;
  }
  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);
  const expiredIds: string[] = [];

  await Promise.allSettled(
    (subs as SubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscrição morta (app desinstalada / permissão revogada).
          expiredIds.push(sub.id);
        } else {
          console.error("[push] envio falhou", { endpoint: sub.endpoint.slice(0, 40), statusCode });
        }
      }
    }),
  );

  if (expiredIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", expiredIds);
  }
}

// Atalho: envia aos dois admins (António e MJ). A Ana (viewer) só recebe
// notificações de tarefas atribuídas a ela — nunca por este atalho.
export async function sendPushToAdmins(
  supabase: SupabaseClient,
  payload: PushPayload,
): Promise<void> {
  await sendPushToEmails(supabase, [...ADMIN_EMAILS_LIST], payload);
}

// Reserva uma chave de deduplicação para as notificações diárias do cron.
// Devolve `true` se a chave é nova (podes enviar) e `false` se já foi
// enviada antes. Assim uma encomenda com flores no congelador há vários
// dias não recebe o mesmo aviso repetido todas as manhãs.
export async function claimDedupKey(
  supabase: SupabaseClient,
  key: string,
): Promise<boolean> {
  const { error } = await supabase.from("push_dedup").insert({ key });
  if (!error) return true;
  if (error.code === "23505") return false; // já existe
  // Qualquer outra falha: por segurança não repetimos (não enviamos).
  console.error("[push] claimDedupKey falhou", { key, err: error.message });
  return false;
}
