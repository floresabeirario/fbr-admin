-- ============================================================
-- Migration 022: Integração Google (OAuth + Drive + Calendar)
-- ============================================================
-- Fase 6 (sessão 37): foundation para Gmail/Drive/Calendar APIs.
--
-- 1. Tabela `google_integration` (singleton). Guarda:
--    - refresh_token (uma única conta info@floresabeirario.pt)
--    - IDs das pastas-mãe na Drive (FBR — Encomendas, Preservação,
--      Vale-Presente) cache para evitar pesquisar todas as vezes
--    - ID do calendário "Preservação de Flores" (sessão 38)
--    - Metadata da conexão (quem ligou, quando)
--
-- 2. Coluna `drive_folder_id` em orders/vouchers (além do
--    `drive_folder_url` que já existia, mas era texto livre).
--    O ID é necessário para criar subpastas, listar conteúdo, etc.
--
-- Permissões: só admins lêem/escrevem `google_integration`
-- (contém credenciais sensíveis); a Ana NÃO vê.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tabela google_integration (singleton)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_integration (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at                  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at                  TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- OAuth
  refresh_token               TEXT,
  google_email                TEXT,
  scopes                      TEXT[] DEFAULT '{}' NOT NULL,

  -- Drive folder IDs (cache; ficheiros e pastas têm IDs estáveis)
  drive_root_folder_id        TEXT,   -- "FBR — Encomendas"
  drive_orders_folder_id      TEXT,   -- "Preservação de Flores"
  drive_vouchers_folder_id    TEXT,   -- "Vale-Presente"

  -- Calendar ID (Fase 6 parte 2)
  calendar_id                 TEXT,   -- "Preservação de Flores"

  -- Metadata
  connected_at                TIMESTAMPTZ,
  connected_by_email          TEXT
);

-- Garante que só existe UM registo (singleton, igual a public_status_settings)
CREATE UNIQUE INDEX IF NOT EXISTS google_integration_singleton_idx
  ON google_integration((true));

-- Trigger updated_at
DROP TRIGGER IF EXISTS google_integration_updated_at ON google_integration;
CREATE TRIGGER google_integration_updated_at
  BEFORE UPDATE ON google_integration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 2. Colunas drive_folder_id em orders e vouchers
-- ------------------------------------------------------------
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

-- ------------------------------------------------------------
-- RLS — só admins (António, MJ). Ana NÃO vê (contém refresh_token).
-- ------------------------------------------------------------
ALTER TABLE google_integration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_integration_admins_all" ON google_integration;
CREATE POLICY "google_integration_admins_all" ON google_integration FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

-- ------------------------------------------------------------
-- GRANTs (lição das migrações 003/011 — RLS sem GRANT = 42501)
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON google_integration TO authenticated;

COMMIT;
