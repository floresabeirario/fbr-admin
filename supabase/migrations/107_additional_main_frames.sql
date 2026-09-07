-- ============================================================
-- 107 — Quadros principais adicionais (sessão 163, 07/09/2026)
--
-- Alguns clientes querem mais do que um quadro grande: dois 30x40, ou um
-- 30x40 e um 50x70. Até aqui a encomenda só tinha `frame_size` (o quadro
-- principal) e o resto ia para as notas. Passa a haver uma coluna JSONB
-- com a quantidade de quadros ADICIONAIS por tamanho, além do principal:
--
--   {}                        nenhum (o normal)
--   {"30x40": 1}              um 30x40 a mais
--   {"30x40": 1, "50x70": 2}  um 30x40 e dois 50x70 a mais
--
-- Cada quadro adicional entra no orçamento pelo preço-base do seu
-- tamanho, com o mesmo fundo e a mesma escolha de vidro museu do
-- principal (decisão da Maria, 07/09/2026). O cliente tem de entregar
-- flores suficientes para todos (aviso no formulário do site).
--
-- ⚠️ ORDEM DE DEPLOY: esta migração tem de correr ANTES do deploy do
-- fbr-website (o INSERT do formulário passa a mandar a coluna) e ANTES do
-- deploy do admin (os SELECTs passam a pedi-la).
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS additional_main_frames JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Só objectos ({}), nunca arrays/strings: o código lê por tamanho.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_additional_main_frames_object;
ALTER TABLE orders
  ADD CONSTRAINT orders_additional_main_frames_object
  CHECK (jsonb_typeof(additional_main_frames) = 'object');

COMMENT ON COLUMN orders.additional_main_frames IS
  'Quadros principais adicionais por tamanho, além de frame_size. Ex.: {"30x40": 1, "50x70": 2}. Mig 107.';

-- ── Verificação (correr depois) ──────────────────────────────
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'orders' AND column_name = 'additional_main_frames';
-- → jsonb | '{}'::jsonb | NO
--
-- SELECT count(*) FROM orders WHERE additional_main_frames <> '{}'::jsonb;
-- → 0 (nenhuma encomenda antiga é tocada)
