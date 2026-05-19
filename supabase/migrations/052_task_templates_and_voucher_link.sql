-- ============================================================
-- Migration 052: Templates de tarefas + ligação tasks↔vouchers
-- ============================================================
-- Contexto (sessão 88, fase 6 parte 31):
-- Maria quer poder criar tarefas a partir do workbench de uma
-- encomenda ou de um vale-presente, com templates pré-feitos
-- (ex.: "Passar fatura para {nome_cliente} — NIF: {nif}") que
-- evitam reescrever o mesmo texto vezes sem conta.
--
-- Já existia:
--   • `tasks.order_id` (mig 012) — FK opcional para `orders.id`,
--     mas nunca foi populada via UI; vai passar a ser populada
--     pelo botão "+ nova tarefa" do workbench Preservação.
--
-- Esta migração adiciona:
--   1. `tasks.voucher_id` — FK opcional para `vouchers.id`,
--      simétrica a `order_id`, para tarefas criadas a partir
--      do workbench de Vale-Presente.
--   2. `task_templates` — biblioteca de templates editáveis
--      (CRUD em Sistema → Templates de tarefas, na sessão D).
--      Suporta variáveis no título/descrição (ex.: {nome_cliente},
--      {nif}, {valor}) e um flag `needs_amount` para templates
--      que precisam de um diálogo a perguntar quanto faturar.
--   3. Seed de 4 templates por defeito (`is_seed=true`).
--
-- A interpolação de variáveis e o diálogo de valor são tratados
-- no cliente (sessão B). Esta migração só prepara o schema.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. tasks.voucher_id
-- ────────────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_order_id_idx
  ON tasks(order_id) WHERE deleted_at IS NULL AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_voucher_id_idx
  ON tasks(voucher_id) WHERE deleted_at IS NULL AND voucher_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. tasks.amount — valor associado à tarefa (€), opcional
-- ────────────────────────────────────────────────────────────
-- Usado pelos templates com `needs_amount=true` (ex.: fatura)
-- para guardar o montante escolhido no diálogo. É mostrado
-- alinhado à direita na lista do workbench e no kanban do
-- Dashboard. Nada a ver com pagamentos da encomenda em si.
-- ────────────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);

-- ────────────────────────────────────────────────────────────
-- 3. TABELA task_templates
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_templates (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id),
  updated_by    UUID REFERENCES auth.users(id),

  -- Identificação
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,

  -- Conteúdo do template (com variáveis tipo {nome_cliente}, {nif}, {valor})
  title_template       TEXT NOT NULL,
  description_template TEXT,

  -- Defaults aplicados às tarefas criadas a partir deste template
  default_category TEXT NOT NULL DEFAULT 'outros'
                    CHECK (default_category IN (
                      'packaging', 'flores', 'presenca_online',
                      'estudio', 'administrativo', 'outros'
                    )),
  default_priority TEXT NOT NULL DEFAULT 'media'
                    CHECK (default_priority IN (
                      'baixa', 'media', 'alta', 'urgente'
                    )),

  -- Pede valor na criação (diálogo com 30%/40%/70%/100%/outro
  -- calculados a partir do orçamento da encomenda, ou simples
  -- input para o caso dos vales).
  needs_amount BOOLEAN NOT NULL DEFAULT false,
  amount_label TEXT,

  -- Onde este template aparece: só workbench de encomendas,
  -- só vales, ou ambos.
  scope        TEXT NOT NULL DEFAULT 'order'
                CHECK (scope IN ('order', 'voucher', 'both')),

  position     INT NOT NULL DEFAULT 0,

  -- Templates do seed inicial. UI pode permitir arquivar mas
  -- não apagar definitivamente (igual a message_templates).
  is_seed      BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS task_templates_slug_unique
  ON task_templates(slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS task_templates_scope_idx
  ON task_templates(scope, position) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS task_templates_updated_at ON task_templates;
CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. RLS — mesmo padrão que message_templates (mig 041)
-- ────────────────────────────────────────────────────────────
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_templates_admins_all" ON task_templates;
CREATE POLICY "task_templates_admins_all" ON task_templates FOR ALL
  TO authenticated
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

-- Ana (viewer) lê os templates para conseguir usar o picker
-- no workbench mesmo estando em modo leitura nas outras abas.
DROP POLICY IF EXISTS "task_templates_authenticated_select" ON task_templates;
CREATE POLICY "task_templates_authenticated_select" ON task_templates FOR SELECT
  TO authenticated USING (deleted_at IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON task_templates TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. AUDIT LOG
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_task_template_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('task_templates', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('task_templates', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('task_templates', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_templates_audit ON task_templates;
CREATE TRIGGER task_templates_audit
  AFTER INSERT OR UPDATE OR DELETE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION log_task_template_changes();

-- ────────────────────────────────────────────────────────────
-- 6. SEED — 4 templates iniciais
-- ────────────────────────────────────────────────────────────
-- Variáveis suportadas (a interpolação acontece no cliente, sessão B):
--   {nome_cliente}    — orders.client_name OU vouchers.sender_name
--   {nif}             — orders.nif (vazio → "—")
--   {nome_parceiro}   — partners.name via orders.partner_id
--   {valor_comissao}  — orders.partner_commission formatado
--   {valor}           — preenchido pelo diálogo (needs_amount=true)
-- ────────────────────────────────────────────────────────────
INSERT INTO task_templates
  (slug, name, title_template, description_template,
   default_category, default_priority, needs_amount, amount_label,
   scope, position, is_seed)
VALUES
  (
    'passar_fatura',
    'Passar fatura com NIF',
    'Passar fatura para {nome_cliente} — NIF: {nif}',
    NULL,
    'administrativo', 'alta',
    true, 'Valor a faturar',
    'both', 0, true
  ),
  (
    'anexar_comprovativo',
    'Anexar comprovativo de pagamento',
    'Anexar comprovativo de pagamento — {nome_cliente}',
    NULL,
    'administrativo', 'media',
    false, NULL,
    'both', 1, true
  ),
  (
    'pedir_feedback',
    'Pedir feedback ao cliente',
    'Pedir feedback a {nome_cliente}',
    NULL,
    'outros', 'baixa',
    false, NULL,
    'order', 2, true
  ),
  (
    'avisar_parceiro_comissao',
    'Avisar parceiro da comissão',
    'Avisar {nome_parceiro} da comissão de {valor_comissao}',
    NULL,
    'administrativo', 'media',
    false, NULL,
    'order', 3, true
  )
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- Verificações rápidas (correr depois da migração):
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='tasks' AND column_name IN ('voucher_id','amount');
--   -- 2 linhas
--
--   SELECT count(*) FROM task_templates WHERE is_seed = true;
--   -- 4
--
--   SELECT slug, scope, needs_amount FROM task_templates ORDER BY position;
--   -- passar_fatura/both/true, anexar_comprovativo/both/false,
--   -- pedir_feedback/order/false, avisar_parceiro_comissao/order/false
-- ============================================================
