import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com SERVICE_ROLE_KEY — bypassa RLS.
 *
 * **NUNCA** importar isto em código que possa ser executado a pedido do
 * utilizador (Server Components, server actions chamadas via formulário,
 * client-side). Só pode ser usado em route handlers de servidor que
 * verifiquem `Authorization: Bearer ${CRON_SECRET}` antes de chamar
 * qualquer função que use este client.
 *
 * Casos de uso legítimos: cron jobs (Vercel Cron envia o header
 * automaticamente em produção), webhooks autenticados, jobs de background.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "createAdminClient: faltam env vars NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
