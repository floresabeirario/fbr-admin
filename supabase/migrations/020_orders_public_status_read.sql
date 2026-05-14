-- ============================================================
-- FBR Admin — Fase 6 (parte 1): Site público status.floresabeirario.pt
-- Permite que o repo `fbr-tracking` leia o estado de uma encomenda
-- directamente do Supabase, em vez do Google Sheets manual.
--
-- Lógica de segurança:
--   1) Mostra apenas encomendas com pelo menos 1 pagamento parcial
--      (payment_status != '100_por_pagar'). O link só é enviado ao
--      cliente depois do primeiro pagamento — quem não pagou nunca
--      teve acesso ao link e não deve ver nada.
--   2) Ignora encomendas arquivadas (deleted_at IS NOT NULL).
--   3) Exposição column-level: o role `anon` só vê as colunas
--      estritamente necessárias para o site público (sem email,
--      telemóvel, NIF, orçamento, comissão, notas, etc.).
--   4) O site usa `order_id` (16 chars alfanuméricos) como chave —
--      difícil de adivinhar; mesmo que alguém faça scraping, a
--      column-level GRANT só revela o nome do cliente + estado.
--
-- Migração 017 já deu GRANT SELECT (id, order_id) ao anon (para o
-- RETURNING do form público de Reserva). Aqui estendemos para os
-- campos públicos restantes.
--
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── 1. Column-level GRANT SELECT em orders para anon ────────────
-- Mantém o GRANT da 017 (id, order_id) e acrescenta os campos
-- necessários para alimentar o site status.floresabeirario.pt.
GRANT SELECT (
  id,
  order_id,
  client_name,
  status,
  public_status_message_pt,
  public_status_message_en,
  public_status_language,
  estimated_delivery_date,
  public_status_updated_at
) ON orders TO anon;

-- ── 2. Policy SELECT para o site de status ──────────────────────
-- (Os múltiplos policies SELECT para `anon` em `orders` são OR'd:
-- esta corre em paralelo com `orders_public_select_recent` da 017.)
DROP POLICY IF EXISTS "orders_public_status_read" ON orders;
CREATE POLICY "orders_public_status_read" ON orders
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND payment_status <> '100_por_pagar'
  );

-- ── 3. Acesso anónimo a public_status_settings (read-only) ──────
-- O site precisa de ler as mensagens default globais para resolver
-- a mensagem efectiva (per-order override → global default →
-- fallback hardcoded). Só há 1 linha (singleton id=1), sem PII.
GRANT SELECT ON public_status_settings TO anon;

DROP POLICY IF EXISTS "public_status_settings_anon_read" ON public_status_settings;
CREATE POLICY "public_status_settings_anon_read" ON public_status_settings
  FOR SELECT
  TO anon
  USING (true);

-- ── 4. Verificação rápida (opcional, comentada) ─────────────────
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy
--   WHERE polrelid IN ('orders'::regclass, 'public_status_settings'::regclass)
--   ORDER BY polrelid, polname;
--
-- SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_name = 'orders' AND grantee = 'anon'
--   ORDER BY column_name;
