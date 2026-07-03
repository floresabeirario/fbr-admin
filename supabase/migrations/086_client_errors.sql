-- ============================================================
-- Migration 086: Monitorização de erros (item 5 do roadmap, sessão 124)
-- ============================================================
-- Hoje um crash no browser da Maria/Ana é invisível: só se sabe
-- quando alguém se queixa. Esta tabela recebe erros JavaScript da
-- app (window.onerror, promises rejeitadas, error boundary do React)
-- e o healthcheck passa a mostrar "N erros nas últimas 24h".
--
-- Sem serviços externos (Sentry etc.): 3 utilizadores não justificam
-- outra conta/custo; a BD + healthchecks que já existem chegam.
--
-- Retenção: o cron diário do healthcheck apaga erros com >30 dias.
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- colar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS client_errors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  source     TEXT NOT NULL DEFAULT 'client'
             CHECK (source IN ('client', 'boundary')),
  message    TEXT NOT NULL,
  stack      TEXT,
  path       TEXT,
  user_email TEXT
);

COMMENT ON TABLE client_errors IS
  'Erros JavaScript da app admin (onerror/unhandledrejection/error boundary). Retenção: 30 dias (limpeza no cron do healthcheck).';

CREATE INDEX IF NOT EXISTS client_errors_at_idx ON client_errors (at DESC);

ALTER TABLE client_errors ENABLE ROW LEVEL SECURITY;

-- Equipa toda pode REGISTAR erros (o erro acontece no browser de
-- qualquer um dos 3); só admins leem. Funções da mig 085.
DROP POLICY IF EXISTS "client_errors_member_insert" ON client_errors;
CREATE POLICY "client_errors_member_insert" ON client_errors FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "client_errors_admins_read" ON client_errors;
CREATE POLICY "client_errors_admins_read" ON client_errors FOR SELECT
  TO authenticated
  USING (is_team_admin(auth.jwt() ->> 'email'));

-- GRANTs — lição das migs 003/011 (RLS sem GRANT = 42501) e
-- 062/065/068/081 (service_role precisa de GRANT explícito; o cron
-- lê para o healthcheck e apaga os antigos).
GRANT SELECT, INSERT ON client_errors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_errors TO service_role;

COMMIT;

-- ── Verificação rápida (correr separadamente) ───────────────────
-- INSERT de teste + leitura (como admin no SQL Editor corre como
-- postgres, bypassa RLS — serve só para confirmar a tabela):
-- INSERT INTO client_errors (message, path) VALUES ('teste', '/dashboard');
-- SELECT * FROM client_errors ORDER BY at DESC LIMIT 5;
-- DELETE FROM client_errors WHERE message = 'teste';
