-- ============================================================
-- Migration 067: log de uso da Claude (cost tracking)
-- ============================================================
-- Para Maria ter visibilidade do gasto mensal da Claude na plataforma
-- (em vez de ir ao console.anthropic.com). Cada chamada de
-- /api/whatsapp/suggest grava uma linha aqui apos receber resposta.
--
-- Custo calculado em USD com base nos prices do modelo. EUR e
-- aproximacao no display (0.92).
--
-- RLS: admins (Antonio + MJ) podem ler. Ana (viewer) nao ve gastos.
-- service_role pode INSERT (chamada do webhook) — mig 062 padrao.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS claude_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  called_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  model TEXT NOT NULL,
  conversation_id UUID,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cache_read_tokens INT NOT NULL DEFAULT 0,
  cache_creation_tokens INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  caller_email TEXT
);

CREATE INDEX IF NOT EXISTS claude_usage_called_at_idx ON claude_usage(called_at DESC);

ALTER TABLE claude_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claude_usage_admins_read" ON claude_usage;
CREATE POLICY "claude_usage_admins_read" ON claude_usage FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

GRANT SELECT ON claude_usage TO authenticated;
GRANT SELECT, INSERT ON claude_usage TO service_role;

COMMIT;
