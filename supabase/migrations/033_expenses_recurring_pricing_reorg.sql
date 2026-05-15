-- ============================================================
-- Migration 033: Despesas recorrentes (subscrições) + reorganização
-- da tabela de preços (fotografia por tamanho + moldura pirâmide)
-- ============================================================
-- Maria pediu (Finanças):
--   1) Diferenciar despesas únicas vs subscrições (mensais, anuais,
--      ou intervalo específico com start/end).
--   2) Suplemento de fundo "fotografia" depende do tamanho da
--      moldura (30x40 = 15€, 40x50 = 25€, 50x70 = 35€). Outros
--      fundos não custam ao cliente (cor passa a 0).
--   3) Moldura pirâmide é um upsell aplicado manualmente.
--   4) Molduras (base_frame) não precisam de notas.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. GOOGLE_INTEGRATION — cache da pasta "Despesas" no Drive
-- ------------------------------------------------------------
ALTER TABLE google_integration
  ADD COLUMN IF NOT EXISTS drive_expenses_folder_id TEXT;

-- ------------------------------------------------------------
-- 1. EXPENSES — campos de recorrência
-- ------------------------------------------------------------
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_period TEXT CHECK (recurrence_period IN ('monthly', 'yearly', 'custom')),
  ADD COLUMN IF NOT EXISTS recurrence_start_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_recurrence_check') THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_recurrence_check CHECK (
        (is_recurring = false
          AND recurrence_period IS NULL
          AND recurrence_start_date IS NULL
          AND recurrence_end_date IS NULL)
        OR
        (is_recurring = true
          AND recurrence_period IS NOT NULL
          AND recurrence_start_date IS NOT NULL
          AND (recurrence_end_date IS NULL OR recurrence_end_date >= recurrence_start_date))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS expenses_recurring_idx
  ON expenses(is_recurring, recurrence_period)
  WHERE deleted_at IS NULL AND is_recurring = true;

-- ------------------------------------------------------------
-- 2. PRICING ITEMS — fotografia por tamanho + pirâmide + limpeza
-- ------------------------------------------------------------

-- 2a. Limpa notas dos itens base_frame (Maria não as quer).
UPDATE pricing_items
  SET notes = NULL
  WHERE category = 'base_frame' AND deleted_at IS NULL;

-- 2b. Outros suplementos de fundo passam a 0 — só a fotografia custa
--     ao cliente (cor, transparente, preto, branco, etc.).
UPDATE pricing_items
  SET price = 0,
      notes = 'Sem custo extra para o cliente — só a fotografia tem suplemento'
  WHERE category = 'background_supplement'
    AND key IN ('transparente', 'preto', 'branco', 'cor', 'voces_a_escolher', 'nao_sei')
    AND deleted_at IS NULL;

-- 2c. A linha genérica "fotografia" é substituída pelas 3 por tamanho.
--     Mantemo-la como soft-deleted (ainda referenciada em snapshots
--     antigos) e adicionamos as 3 novas.
UPDATE pricing_items
  SET deleted_at = COALESCE(deleted_at, now()),
      notes = 'Substituído pelos 3 itens fotografia_<tamanho>'
  WHERE category = 'background_supplement'
    AND key = 'fotografia'
    AND deleted_at IS NULL;

INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  ('background_supplement', 'fotografia_30x40', 'Fundo fotografia — 30x40', 15, 4, 'Custo FBR: 6,72€ por impressão'),
  ('background_supplement', 'fotografia_40x50', 'Fundo fotografia — 40x50', 25, 5, 'Custo FBR: 11,20€ por impressão'),
  ('background_supplement', 'fotografia_50x70', 'Fundo fotografia — 50x70', 35, 6, 'Custo FBR: 19,60€ por impressão')
ON CONFLICT (category, key) DO UPDATE SET
  label = EXCLUDED.label,
  position = EXCLUDED.position,
  notes = EXCLUDED.notes;

-- 2d. Moldura pirâmide — upsell aplicado manualmente. Como categoria
--     "extra" mas sem campo automático na encomenda: Maria adiciona
--     manualmente ao orçamento quando o cliente aceita.
INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  ('extra', 'pyramid_frame', 'Moldura pirâmide (suplemento)', 0, 4, 'Upsell discutido na confirmação. Aplicado manualmente ao orçamento.')
ON CONFLICT (category, key) DO NOTHING;

COMMIT;
