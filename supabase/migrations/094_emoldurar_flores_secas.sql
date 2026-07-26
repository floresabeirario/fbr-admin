-- ============================================================
-- 094 — Emoldurar Flores Secas (novo serviço, variante de Preservação)
-- ============================================================
-- As encomendas de "emoldurar flores já secas" vivem na MESMA tabela
-- `orders` que a preservação (partilham ~90% dos campos, workbench,
-- estados, orçamento, Drive e site de status). Distinguem-se por
-- `service_type`. Esta migração acrescenta:
--
--   • service_type      — discriminador ('preservacao' | 'emoldurar_secas')
--   • dried_approach     — abordagem escolhida pelo cliente (as 3 opções da
--                          página do serviço + "não sei")
--   • dried_condition    — estado actual das flores já secas
--   • client_photos      — fotos do ramo submetidas no form público.
--                          JSONB [{ path, name }] a apontar para o bucket
--                          `bouquet-photos` do Storage. TEMPORÁRIO: ao 1º
--                          pagamento são copiadas para a pasta Drive do
--                          cliente e este array é esvaziado (ver
--                          src/lib/google/order-drive-trigger.ts).
--
-- Preços do serviço: base_frame `secas_30x40/40x50/50x70` (200/270/360€),
-- distintos da preservação (300/400/500€). O cálculo do orçamento escolhe
-- a chave conforme service_type (src/lib/pricing.ts).
--
-- Nota RLS/GRANTs: `orders` é uma tabela EXISTENTE — as colunas novas
-- herdam os grants/policies em vigor. Os forms públicos inserem com
-- service_role (mig 084), que contorna RLS, por isso não é preciso mexer
-- em policies para o insert público destas colunas.
-- ============================================================

BEGIN;

-- ── 1. Colunas novas em orders ──────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS service_type   TEXT NOT NULL DEFAULT 'preservacao',
  ADD COLUMN IF NOT EXISTS dried_approach  TEXT,
  ADD COLUMN IF NOT EXISTS dried_condition TEXT,
  ADD COLUMN IF NOT EXISTS client_photos   JSONB NOT NULL DEFAULT '[]'::jsonb;

-- CHECKs (idempotentes: dropa antes de recriar)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_service_type_check;
ALTER TABLE orders ADD  CONSTRAINT orders_service_type_check
  CHECK (service_type IN ('preservacao', 'emoldurar_secas'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_dried_approach_check;
ALTER TABLE orders ADD  CONSTRAINT orders_dried_approach_check
  CHECK (dried_approach IS NULL OR dried_approach IN
    ('ramo_original', 'recriacao', 'combinacao', 'nao_sei'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_dried_condition_check;
ALTER TABLE orders ADD  CONSTRAINT orders_dried_condition_check
  CHECK (dried_condition IS NULL OR dried_condition IN
    ('bom_estado', 'frageis', 'danificadas', 'avaliar'));

COMMENT ON COLUMN orders.service_type IS
  'Tipo de serviço: preservacao (default) | emoldurar_secas. Distingue as encomendas de flores já secas dentro da mesma tabela.';
COMMENT ON COLUMN orders.dried_approach IS
  'Só para emoldurar_secas: ramo_original | recriacao | combinacao | nao_sei.';
COMMENT ON COLUMN orders.dried_condition IS
  'Só para emoldurar_secas: bom_estado | frageis | danificadas | avaliar.';
COMMENT ON COLUMN orders.client_photos IS
  'Fotos do ramo submetidas no form (emoldurar_secas). JSONB [{path,name}] no bucket bouquet-photos. Movidas para o Drive ao 1º pagamento e depois esvaziadas.';

-- Índice parcial para separar depressa os dois serviços na lista.
CREATE INDEX IF NOT EXISTS orders_service_type_idx
  ON orders(service_type) WHERE deleted_at IS NULL;

-- ── 2. Preços base do serviço (tabela de preços) ────────────
-- Mesma categoria base_frame, chaves prefixadas com "secas_".
-- ON CONFLICT DO NOTHING: não pisa se já existirem / a Maria já os afinou.
INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  ('base_frame', 'secas_30x40', 'Flores secas — Moldura 30x40', 200, 10, 'Serviço emoldurar flores já secas'),
  ('base_frame', 'secas_40x50', 'Flores secas — Moldura 40x50', 270, 11, 'Serviço emoldurar flores já secas'),
  ('base_frame', 'secas_50x70', 'Flores secas — Moldura 50x70', 360, 12, 'Serviço emoldurar flores já secas')
ON CONFLICT (category, key) DO NOTHING;

COMMIT;

-- ── 3. Bucket de Storage para as fotos do ramo ──────────────
-- FORA da transacção de propósito: se este INSERT falhar por permissões no
-- teu projecto, as alterações de schema acima ficam na mesma (não rollback).
-- Nesse caso, cria o bucket à mão em Dashboard → Storage → New bucket
-- ("bouquet-photos", **privado**). Acesso só por service_role (o site faz
-- upload; o admin lê via signed URL) — não são precisas policies.
-- Limite 11 MB/ficheiro (o form permite até 10 MB) e só imagens.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bouquet-photos', 'bouquet-photos', false, 11534336,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- ── Verificação (correr depois, no SQL Editor) ──────────────
-- 1) Colunas criadas:
--    SELECT column_name, data_type, column_default FROM information_schema.columns
--    WHERE table_name = 'orders' AND column_name IN
--      ('service_type','dried_approach','dried_condition','client_photos');
-- 2) Preços do serviço:
--    SELECT key, label, price FROM pricing_items
--    WHERE category = 'base_frame' AND key LIKE 'secas_%' ORDER BY position;
-- 3) Bucket:
--    SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'bouquet-photos';
