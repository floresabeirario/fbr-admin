"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";

// Server actions das subscrições de notificações push. Cada uma corre com
// a sessão do próprio utilizador (RLS: só mexe nas SUAS subscrições). O
// ENVIO das notificações é outra coisa e corre com service_role — ver
// src/lib/push/send.ts.

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

// Guarda (ou actualiza) a subscrição deste dispositivo. `endpoint` é único
// por browser/instalação — o upsert cobre o caso de o browser rodar as
// chaves e re-subscrever com o mesmo endpoint.
export async function savePushSubscriptionAction(
  sub: PushSubscriptionInput,
): Promise<void> {
  const email = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_email: email,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

// Remove a subscrição deste dispositivo (a pessoa desligou as notificações).
export async function deletePushSubscriptionAction(
  endpoint: string,
): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}
