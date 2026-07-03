-- ============================================================
-- Migration 088: Notificações push internas da PWA (item 2 do roadmap 124)
-- ============================================================
-- Guarda as subscrições Web Push de cada dispositivo dos 3 utilizadores
-- (endpoint do serviço de push do browser + chaves de encriptação). O
-- servidor usa-as para enviar notificações mesmo com a app fechada:
--   • nova encomenda do formulário            → admins
--   • tarefa atribuída a ti                    → a pessoa atribuída
--   • data de entrega das flores preenchida    → admins
--   • recolha amanhã / flores a chegar amanhã  → admins (cron 7h)
--   • flores no congelador há 5 dias completos → admins (cron 7h)
--   • healthcheck a vermelho                   → admins (cron 7h)
--
-- Nada disto envia seja o que for a clientes — é tudo interno.
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- colar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

-- ── Subscrições de push (1 linha por dispositivo/browser) ───────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   TEXT NOT NULL,
  endpoint     TEXT NOT NULL UNIQUE,   -- URL única do serviço de push do browser
  p256dh       TEXT NOT NULL,          -- chave pública do cliente (encriptação)
  auth         TEXT NOT NULL,          -- segredo de autenticação do cliente
  user_agent   TEXT,                   -- só para a pessoa reconhecer o dispositivo
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE push_subscriptions IS
  'Subscrições Web Push por dispositivo (notificações internas da PWA). endpoint é único; subscrições expiradas são podadas no envio (404/410).';

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_email);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada membro da equipa gere apenas as SUAS subscrições (o browser regista
-- e apaga com a sessão do próprio). O envio corre com service_role
-- (bypassa RLS) — lê as subscrições de quem for o destinatário.
-- Funções is_team_member/is_team_admin: mig 085.
DROP POLICY IF EXISTS "push_subscriptions_own_select" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_select" ON push_subscriptions FOR SELECT
  TO authenticated
  USING (
    is_team_member(auth.jwt() ->> 'email')
    AND user_email = auth.jwt() ->> 'email'
  );

DROP POLICY IF EXISTS "push_subscriptions_own_insert" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_insert" ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_team_member(auth.jwt() ->> 'email')
    AND user_email = auth.jwt() ->> 'email'
  );

DROP POLICY IF EXISTS "push_subscriptions_own_update" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_update" ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (
    is_team_member(auth.jwt() ->> 'email')
    AND user_email = auth.jwt() ->> 'email'
  )
  WITH CHECK (
    is_team_member(auth.jwt() ->> 'email')
    AND user_email = auth.jwt() ->> 'email'
  );

DROP POLICY IF EXISTS "push_subscriptions_own_delete" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_delete" ON push_subscriptions FOR DELETE
  TO authenticated
  USING (
    is_team_member(auth.jwt() ->> 'email')
    AND user_email = auth.jwt() ->> 'email'
  );

-- ── Anti-duplicação das notificações diárias ────────────────────
-- As notificações do cron (recolha amanhã, congelador 120h, etc.) correm
-- todos os dias; sem isto, uma encomenda com flores no congelador há
-- vários dias receberia o mesmo aviso repetido. Antes de enviar, o cron
-- tenta inserir uma chave única (ex.: "freezer5:<order_id>:<data_entrada>");
-- se já existe, salta. Só o service_role lhe toca.
CREATE TABLE IF NOT EXISTS push_dedup (
  key     TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE push_dedup IS
  'Chaves de notificações push já enviadas (anti-repetição das notificações diárias do cron). Limpeza: >60 dias no cron do healthcheck.';

CREATE INDEX IF NOT EXISTS push_dedup_sent_idx ON push_dedup (sent_at);

ALTER TABLE push_dedup ENABLE ROW LEVEL SECURITY;
-- Sem policies para authenticated: tabela puramente de servidor.

-- ── GRANTs ──────────────────────────────────────────────────────
-- Lição das migs 003/011 (RLS sem GRANT = 42501) e 062/065/068/081
-- (service_role precisa de GRANT explícito).
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO service_role;
GRANT SELECT, INSERT, DELETE ON push_dedup TO service_role;

COMMIT;

-- ── Verificação rápida (correr separadamente) ───────────────────
-- SELECT user_email, left(endpoint, 40) AS endpoint, user_agent, created_at
--   FROM push_subscriptions ORDER BY created_at DESC;
