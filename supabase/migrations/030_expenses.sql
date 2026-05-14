-- ============================================================
-- Migration 030: Tracking de despesas
-- ============================================================
-- Alimenta a sub-aba "Despesas" da página de Finanças.
-- Cada despesa: data, fornecedor, categoria, valor, IVA opcional,
-- método de pagamento, anexo (URL do Drive), notas.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS expenses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  updated_by      UUID REFERENCES auth.users(id),

  expense_date    DATE NOT NULL,
  supplier        TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'outros' CHECK (category IN (
    'flores',
    'molduras',
    'materiais',
    'transporte',
    'marketing',
    'software',
    'servicos',
    'taxas',
    'outros'
  )),
  description     TEXT,
  amount          NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  vat_rate        NUMERIC(5, 2),                          -- ex.: 23.00 (NULL se não aplicável)
  -- amount inclui IVA. O amount_net é amount/(1+vat_rate/100) se vat_rate definido.
  payment_method  TEXT CHECK (payment_method IN (
    'mb_way', 'transferencia', 'cartao', 'numerario', 'multibanco', 'outro'
  )),
  has_invoice     BOOLEAN DEFAULT false NOT NULL,
  invoice_url     TEXT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS expenses_updated_at ON expenses;
CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY — admins escrevem, Ana só lê
-- (despesas são informação financeira sensível)
-- ============================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_admin_all" ON expenses;
CREATE POLICY "expenses_admin_all" ON expenses FOR ALL
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

DROP POLICY IF EXISTS "expenses_viewer_read" ON expenses;
CREATE POLICY "expenses_viewer_read" ON expenses FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt'
  );

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE OR REPLACE FUNCTION log_expense_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('expenses', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('expenses', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('expenses', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS expenses_audit ON expenses;
CREATE TRIGGER expenses_audit
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION log_expense_changes();

-- ============================================================
-- GRANTs
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO authenticated;

COMMIT;
