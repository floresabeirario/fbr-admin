-- ============================================================
-- FBR Admin — Fase 3: Vale-Presente
-- Executar no Supabase SQL Editor
-- ============================================================

-- Função para gerar código de vale alfanumérico (6 caracteres)
-- Sem 0 (zero) nem O (letra), sem I nem 1 — evita confusão na leitura.
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  i INTEGER;
  attempts INTEGER := 0;
  exists_already BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;

    -- Garantir unicidade
    SELECT EXISTS(SELECT 1 FROM vouchers WHERE code = result) INTO exists_already;
    EXIT WHEN NOT exists_already;

    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Não foi possível gerar código único após 10 tentativas';
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABELA PRINCIPAL: vouchers
-- ============================================================
CREATE TABLE IF NOT EXISTS vouchers (

  -- Metadados
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),

  -- ── Remetente (quem compra o vale) ────────────────────────

  sender_name           TEXT NOT NULL DEFAULT '',
  sender_contact_pref   TEXT CHECK (sender_contact_pref IN ('whatsapp', 'email')),
  sender_email          TEXT,
  sender_phone          TEXT,

  -- ── O vale ────────────────────────────────────────────────

  recipient_name        TEXT NOT NULL DEFAULT '',
  message               TEXT,
  amount                DECIMAL(10,2) NOT NULL DEFAULT 300
                        CHECK (amount >= 300),

  -- ── Entrega do vale ───────────────────────────────────────

  -- Para quem vai entregue: para o próprio remetente ou para o destinatário
  delivery_recipient    TEXT CHECK (delivery_recipient IN ('remetente', 'destinatario')),
  -- Formato: digital (email/WA) ou físico (cartão postal)
  delivery_format       TEXT CHECK (delivery_format IN ('digital', 'fisico')),
  -- Se digital: por email ou whatsapp
  delivery_channel      TEXT CHECK (delivery_channel IN ('email', 'whatsapp')),
  -- Se físico: 9€ base + portes
  delivery_shipping_cost DECIMAL(10,2),

  -- ── Outros (preenchidos pelo cliente) ─────────────────────

  comments              TEXT,
  how_found_fbr         TEXT CHECK (how_found_fbr IN (
                          'instagram', 'facebook', 'casamentos_pt', 'google',
                          'vale_presente', 'florista', 'recomendacao', 'outro'
                        )),
  how_found_fbr_other   TEXT,
  form_language         TEXT DEFAULT 'pt' CHECK (form_language IN ('pt', 'en')),

  -- ── Estado admin ──────────────────────────────────────────

  -- Pagamento: vales só têm dois estados (vs. encomendas com 4)
  payment_status        TEXT NOT NULL DEFAULT '100_por_pagar'
                        CHECK (payment_status IN ('100_pago', '100_por_pagar')),

  -- Envio do vale (admin marca quando envia)
  send_status           TEXT NOT NULL DEFAULT 'nao_agendado'
                        CHECK (send_status IN ('enviado', 'agendado', 'nao_agendado')),
  scheduled_send_date   DATE,

  -- Utilização: cliente já agendou preservação com este vale?
  usage_status          TEXT NOT NULL DEFAULT 'preservacao_nao_agendada'
                        CHECK (usage_status IN (
                          'preservacao_agendada',
                          'preservacao_nao_agendada'
                        )),

  -- Validade — default 2 anos após criação
  expiry_date           DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '2 years'),

  -- NIF / fatura
  nif                   TEXT,
  needs_invoice         BOOLEAN DEFAULT false,
  invoice_attachment_url TEXT
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS vouchers_code_idx          ON vouchers(code);
CREATE INDEX IF NOT EXISTS vouchers_payment_idx       ON vouchers(payment_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vouchers_expiry_idx        ON vouchers(expiry_date)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vouchers_created_at_idx    ON vouchers(created_at DESC);

-- ── Trigger: auto-actualizar updated_at ───────────────────────
CREATE TRIGGER vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Trigger: gerar código automaticamente antes de inserir ────
CREATE OR REPLACE FUNCTION set_voucher_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_voucher_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vouchers_set_code
  BEFORE INSERT ON vouchers
  FOR EACH ROW EXECUTE FUNCTION set_voucher_code();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso total
CREATE POLICY "vouchers_admins_all" ON vouchers FOR ALL
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

-- Viewer (Ana) só lê
CREATE POLICY "vouchers_viewer_select" ON vouchers FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt'
  );

-- ============================================================
-- AUDIT LOG: usar a tabela audit_log já existente
-- ============================================================

CREATE OR REPLACE FUNCTION log_voucher_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('vouchers', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('vouchers', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('vouchers', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER vouchers_audit
  AFTER INSERT OR UPDATE OR DELETE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION log_voucher_changes();

-- ============================================================
-- PERMISSÕES
-- ============================================================
GRANT EXECUTE ON FUNCTION generate_voucher_code() TO authenticated;
