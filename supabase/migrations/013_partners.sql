-- ============================================================
-- FBR Admin — Fase 5: Parcerias
-- Executar no Supabase SQL Editor
-- ============================================================
--
-- Cria a tabela `partners` (parceiros recomendadores: wedding planners,
-- floristas, quintas de eventos, outros) com histórico de interações,
-- ações assignáveis e localização aproximada para o mapa de Portugal.
--
-- Estabelece também a foreign key real entre orders.partner_id ↔ partners.id
-- (a coluna já existia desde a migração 001 mas sem FK porque a tabela
-- ainda não existia). Adiciona partner_id a vouchers (tinha falhado em 009).
--
-- Permissões: TODOS os 3 utilizadores podem ler/escrever (a Ana, viewer
-- nas outras abas, é editora aqui — confirmado na spec). RLS garante
-- isso. Audit log activado.
-- ============================================================

-- ============================================================
-- TABELA PRINCIPAL: partners
-- ============================================================
CREATE TABLE IF NOT EXISTS partners (

  -- Metadados
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),

  -- ── Identificação ─────────────────────────────────────────
  name            TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'outros'
                  CHECK (category IN (
                    'wedding_planners',
                    'floristas',
                    'quintas_eventos',
                    'outros'
                  )),

  -- Estado do funil de relação
  status          TEXT NOT NULL DEFAULT 'por_contactar'
                  CHECK (status IN (
                    'por_contactar',
                    'pendente',
                    'tentativa_contacto',
                    'aceite',
                    'confirmado',
                    'rejeitado'
                  )),

  -- ── Contacto ──────────────────────────────────────────────
  contact_person      TEXT,             -- nome da pessoa responsável
  email               TEXT,
  phones              TEXT[] DEFAULT '{}', -- pode ter vários
  links               TEXT[] DEFAULT '{}', -- site, instagram, facebook, etc.

  -- ── Localização ───────────────────────────────────────────
  -- Lugar/região onde actua (string livre: cidade, distrito, "Norte", etc.)
  location_label      TEXT,
  -- Coordenadas opcionais para o mapa (latitude/longitude em graus decimais)
  latitude            DECIMAL(9,6),
  longitude           DECIMAL(9,6),

  -- ── Comissão ──────────────────────────────────────────────
  -- Aceita os 10% de comissão? null = ainda por confirmar
  accepts_commission  TEXT CHECK (accepts_commission IN ('sim', 'nao', 'a_confirmar')),

  -- ── Notas ────────────────────────────────────────────────
  notes               TEXT,

  -- ── Histórico de interações ───────────────────────────────
  -- Array de { date: string ISO, channel: 'email'|'whatsapp'|'telefone'|'reuniao'|'outro',
  --            summary: string, by: string (email do user) }
  interactions        JSONB DEFAULT '[]'::jsonb NOT NULL,

  -- ── Acções pendentes ──────────────────────────────────────
  -- Array de { id: uuid, title: string, assignee_email: string|null,
  --            due_date: string|null, done: boolean,
  --            done_at: string|null, done_by: string|null,
  --            created_at: string, created_by: string }
  actions             JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS partners_category_idx ON partners(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS partners_status_idx   ON partners(status)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS partners_name_idx     ON partners(name)     WHERE deleted_at IS NULL;

-- ── Trigger: auto-actualizar updated_at ───────────────────────
DROP TRIGGER IF EXISTS partners_updated_at ON partners;
CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Excepção: na aba Parcerias, a Ana (viewer noutras tabelas) também
-- pode escrever. Por isso permite-se a TODOS os 3 utilizadores.
-- ============================================================
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_all_users" ON partners;
CREATE POLICY "partners_all_users" ON partners FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  );

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE OR REPLACE FUNCTION log_partner_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('partners', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('partners', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('partners', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS partners_audit ON partners;
CREATE TRIGGER partners_audit
  AFTER INSERT OR UPDATE OR DELETE ON partners
  FOR EACH ROW EXECUTE FUNCTION log_partner_changes();

-- ============================================================
-- PERMISSÕES (lição das migrações 003 e 011: GRANT além da RLS)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON partners TO authenticated;

-- ============================================================
-- LIGAÇÕES A OUTRAS TABELAS
-- ============================================================
-- 1) orders.partner_id já existe (migração 001) mas sem FK.
--    Adiciona-a agora que partners existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_partner_id_fkey'
      AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_partner_id_fkey
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Adicionar partner_id a vouchers (não estava na migração 009)
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vouchers_partner_id_idx ON vouchers(partner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS orders_partner_id_idx   ON orders(partner_id)   WHERE deleted_at IS NULL;
