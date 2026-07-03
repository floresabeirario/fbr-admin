-- ============================================================
-- Migration 087: Analytics do site (Microsoft Clarity)
-- ============================================================
-- O site (fbr-website) passou a ter analytics privados de tráfego.
-- A API gratuita do Clarity só devolve os últimos 3 dias de cada vez,
-- por isso uma rota de cron do site (/api/cron/clarity-snapshot, a
-- cada ~3 dias) guarda aqui um "snapshot" cru e apaga os que já têm
-- mais de 45 dias. Assim os crus NÃO se acumulam (rondam ~15 linhas).
--
--   analytics_snapshots — dados crus de 3/3 dias; auto-limpam (>45 dias).
--   analytics_monthly   — resumo compilado, 1 linha por mês. Permanente
--                         e minúsculo; serve para comparar ano a ano.
--
-- Quem escreve é o cron do site com a SERVICE_ROLE_KEY (o mesmo Supabase
-- serve admin + site). Admins podem ler (futuro painel de métricas).
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- colar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL DEFAULT 'clarity',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_days INTEGER NOT NULL DEFAULT 3,
  data        JSONB NOT NULL
);

COMMENT ON TABLE analytics_snapshots IS
  'Snapshots crus do Clarity (3 dias cada), gravados pelo cron do site. Retenção: 45 dias (o próprio cron apaga os antigos).';

CREATE INDEX IF NOT EXISTS analytics_snapshots_captured_at_idx
  ON analytics_snapshots (captured_at);

CREATE TABLE IF NOT EXISTS analytics_monthly (
  month       DATE NOT NULL,          -- primeiro dia do mês (ex.: 2026-07-01)
  source      TEXT NOT NULL DEFAULT 'clarity',
  summary     JSONB NOT NULL,
  compiled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, source)
);

COMMENT ON TABLE analytics_monthly IS
  'Resumo mensal compilado a partir dos snapshots. 1 linha por mês; permanente.';

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_monthly   ENABLE ROW LEVEL SECURITY;

-- Só admins leem (futuro painel de métricas). Funções da mig 085.
-- A escrita é feita só pelo cron via service_role (bypassa RLS).
DROP POLICY IF EXISTS "analytics_snapshots_admins_read" ON analytics_snapshots;
CREATE POLICY "analytics_snapshots_admins_read" ON analytics_snapshots FOR SELECT
  TO authenticated
  USING (is_team_admin(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "analytics_monthly_admins_read" ON analytics_monthly;
CREATE POLICY "analytics_monthly_admins_read" ON analytics_monthly FOR SELECT
  TO authenticated
  USING (is_team_admin(auth.jwt() ->> 'email'));

-- GRANTs — lição das migs 003/011 (RLS sem GRANT = 42501) e 081/086
-- (service_role precisa de GRANT explícito; é ele que o cron usa).
GRANT SELECT ON analytics_snapshots TO authenticated;
GRANT SELECT ON analytics_monthly   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON analytics_monthly   TO service_role;

COMMIT;

-- ── Verificação rápida (correr separadamente) ───────────────────
-- SELECT count(*) FROM analytics_snapshots;
-- SELECT month, compiled_at FROM analytics_monthly ORDER BY month DESC;
