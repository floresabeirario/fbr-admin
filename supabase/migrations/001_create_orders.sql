-- ============================================================
-- FBR Admin — Fase 2: Preservação de Flores
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Função para gerar ID de encomenda alfanumérico (16 caracteres maiúsculos)
CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Função genérica para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABELA PRINCIPAL: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (

  -- Metadados do sistema
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                    TEXT UNIQUE NOT NULL DEFAULT generate_order_id(),
  created_at                  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at                  TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at                  TIMESTAMPTZ,
  created_by                  UUID REFERENCES auth.users(id),
  updated_by                  UUID REFERENCES auth.users(id),

  -- ── Campos do cliente (preenchidos no formulário público) ──

  client_name                 TEXT NOT NULL DEFAULT '',
  contact_preference          TEXT CHECK (contact_preference IN ('whatsapp', 'email')),
  email                       TEXT,
  phone                       TEXT,
  event_date                  DATE,
  event_type                  TEXT CHECK (event_type IN (
                                'casamento', 'batizado', 'funeral',
                                'pedido_casamento', 'outro'
                              )),
  couple_names                TEXT,
  event_location              TEXT,

  flower_delivery_method      TEXT CHECK (flower_delivery_method IN (
                                'maos', 'ctt', 'recolha_evento', 'nao_sei'
                              )),
  flower_type                 TEXT,

  frame_delivery_method       TEXT CHECK (frame_delivery_method IN (
                                'maos', 'ctt', 'nao_sei'
                              )),
  frame_background            TEXT CHECK (frame_background IN (
                                'transparente', 'preto', 'branco',
                                'fotografia', 'cor', 'voces_a_escolher', 'nao_sei'
                              )),
  frame_size                  TEXT CHECK (frame_size IN (
                                '30x40', '40x50', '50x70', 'voces_a_escolher', 'nao_sei'
                              )),

  -- extras_in_frame: { options: string[], notes: string }
  extras_in_frame             JSONB DEFAULT '{"options": [], "notes": ""}'::jsonb,

  extra_small_frames          TEXT CHECK (extra_small_frames IN ('sim', 'nao', 'mais_info')),
  extra_small_frames_qty      INTEGER,
  christmas_ornaments         TEXT CHECK (christmas_ornaments IN ('sim', 'nao', 'mais_info')),
  christmas_ornaments_qty     INTEGER,
  necklace_pendants           TEXT CHECK (necklace_pendants IN ('sim', 'nao', 'mais_info')),
  necklace_pendants_qty       INTEGER,

  how_found_fbr               TEXT CHECK (how_found_fbr IN (
                                'instagram', 'facebook', 'casamentos_pt', 'google',
                                'vale_presente', 'florista', 'recomendacao', 'outro'
                              )),
  gift_voucher_code           TEXT,
  additional_notes            TEXT,
  form_language               TEXT DEFAULT 'pt' CHECK (form_language IN ('pt', 'en')),

  -- ── Campos admin: estado e contacto ───────────────────────

  status                      TEXT NOT NULL DEFAULT 'entrega_flores_agendar'
                              CHECK (status IN (
                                'entrega_flores_agendar',
                                'entrega_agendada',
                                'flores_enviadas',
                                'flores_recebidas',
                                'flores_na_prensa',
                                'reconstrucao_botanica',
                                'a_compor_design',
                                'a_aguardar_aprovacao',
                                'a_ser_emoldurado',
                                'emoldurado',
                                'a_ser_fotografado',
                                'quadro_pronto',
                                'quadro_enviado',
                                'quadro_recebido',
                                'cancelado'
                              )),
  contacted                   BOOLEAN DEFAULT false NOT NULL,

  -- ── Campos admin: orçamento e pagamento ───────────────────

  budget                      DECIMAL(10,2),
  payment_status              TEXT DEFAULT '100_por_pagar'
                              CHECK (payment_status IN (
                                '100_pago', '70_pago', '30_pago',
                                '30_por_pagar', '100_por_pagar'
                              )),
  nif                         TEXT,
  needs_invoice               BOOLEAN DEFAULT false,
  invoice_attachment_url      TEXT,

  -- ── Campos admin: parceria ─────────────────────────────────

  -- partner_id referenciará a tabela partners (criada na Fase 5)
  partner_id                  UUID,
  partner_commission          DECIMAL(10,2),
  partner_commission_status   TEXT DEFAULT 'na'
                              CHECK (partner_commission_status IN (
                                'na', 'parceiro_informado', 'a_aguardar',
                                'paga', 'a_aguardar_resposta', 'nao_aceita'
                              )),

  -- ── Campos admin: envio de flores e quadro ─────────────────

  flower_shipping_cost        DECIMAL(10,2),
  flower_shipping_paid        BOOLEAN DEFAULT false,
  frame_shipping_cost         DECIMAL(10,2),
  frame_shipping_paid         BOOLEAN DEFAULT false,

  -- ── Campos admin: cupão 5% ─────────────────────────────────

  coupon_code                 TEXT UNIQUE,
  coupon_expiry               DATE,
  coupon_status               TEXT DEFAULT 'na'
                              CHECK (coupon_status IN ('utilizado', 'nao_utilizado', 'na')),

  -- ── Campos admin: feedback e entrega final ─────────────────

  client_feedback_status      TEXT DEFAULT 'na'
                              CHECK (client_feedback_status IN (
                                'deu_feedback', 'ja_pedido', 'nao_disse_nada', 'na'
                              )),
  frame_delivery_date         DATE,

  -- ── Drive, fotos e inspiração ─────────────────────────────

  drive_folder_url            TEXT,
  flowers_photo_url           TEXT,
  -- inspiration_gallery: Array de { type: 'image'|'link', url: string, label?: string }
  inspiration_gallery         JSONB DEFAULT '[]'::jsonb
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS orders_status_idx     ON orders(status)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS orders_event_date_idx ON orders(event_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_order_id_idx   ON orders(order_id);

-- ── Trigger: auto-actualizar updated_at ───────────────────────
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso total
CREATE POLICY "admins_all" ON orders FOR ALL
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

-- Viewer (Ana) só pode ler
CREATE POLICY "viewer_select" ON orders FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt'
  );

-- ============================================================
-- TABELA DE AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values  JSONB,
  new_values  JSONB,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_log_record_idx     ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON audit_log(changed_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit" ON audit_log FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

-- Trigger de audit em orders
CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('orders', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('orders', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('orders', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER orders_audit
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_changes();
