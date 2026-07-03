import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com SERVICE_ROLE_KEY — bypassa RLS.
 *
 * **NUNCA** importar isto em código que possa ser executado a pedido do
 * utilizador (Server Components, server actions chamadas via formulário,
 * client-side) sem antes validar a sessão E o âmbito do pedido.
 *
 * Casos de uso legítimos:
 *  - cron jobs — verificar `Authorization: Bearer ${CRON_SECRET}` (a
 *    Vercel envia o header automaticamente em produção);
 *  - webhooks autenticados (HMAC/token) e jobs de background;
 *  - route handlers com sessão verificada onde a RLS do utilizador já
 *    validou o âmbito e só falta um dado interno fora do alcance dela
 *    (ex.: /api/whatsapp/media lê o refresh_token da Google DEPOIS de
 *    confirmar que o ficheiro pertence a uma mensagem que o utilizador
 *    pode ler).
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
