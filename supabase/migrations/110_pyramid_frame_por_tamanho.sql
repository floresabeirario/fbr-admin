-- ============================================================
-- Migration 110: Suplemento da moldura pirâmide passa a ser POR TAMANHO
-- ============================================================
-- Contexto (sessão 174, 17/09/2026): a Maria corrigiu que "moldura
-- pirâmide tem suplemento por tamanho". Até aqui havia um único item
-- pricing_items.extra.pyramid_frame, aplicado uma vez por encomenda
-- (mig 033). Passa a haver um item por tamanho, como já acontece com o
-- fundo fotografia (fotografia_<size>) e o vidro museu (museum_glass_<size>).
--
-- O que faz:
--   1. Cria 3 itens 'extra' novos: pyramid_frame_30x40 / _40x50 / _50x70.
--      O preço inicial de cada um é o preço ACTUAL do item genérico (ou 0
--      se não existir), para nada mudar até a Maria editar em
--      Finanças → Catálogo → "Moldura pirâmide".
--   2. Mantém o item genérico `pyramid_frame` (não apaga): o código usa-o
--      como fallback enquanto esta migração não corre, e os snapshots das
--      encomendas antigas continuam a referir a chave antiga. Só lhe muda
--      as notas para ficar claro que já não se edita.
--
-- Ordem de deploy: o código (lib/pricing.ts) procura primeiro o item por
-- tamanho e cai no genérico se não existir, por isso a ordem é indiferente.
-- Sem tabelas novas → sem GRANTs novos. Idempotente (ON CONFLICT DO NOTHING).
-- ============================================================

BEGIN;

INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  ('extra', 'pyramid_frame_30x40', 'Moldura pirâmide (suplemento) · 30x40',
    COALESCE((SELECT price FROM pricing_items WHERE category = 'extra' AND key = 'pyramid_frame' AND deleted_at IS NULL), 0),
    5, 'Suplemento por tamanho (mig 110). Entra no orçamento quando a encomenda tem moldura pirâmide.'),
  ('extra', 'pyramid_frame_40x50', 'Moldura pirâmide (suplemento) · 40x50',
    COALESCE((SELECT price FROM pricing_items WHERE category = 'extra' AND key = 'pyramid_frame' AND deleted_at IS NULL), 0),
    6, 'Suplemento por tamanho (mig 110). Entra no orçamento quando a encomenda tem moldura pirâmide.'),
  ('extra', 'pyramid_frame_50x70', 'Moldura pirâmide (suplemento) · 50x70',
    COALESCE((SELECT price FROM pricing_items WHERE category = 'extra' AND key = 'pyramid_frame' AND deleted_at IS NULL), 0),
    7, 'Suplemento por tamanho (mig 110). Entra no orçamento quando a encomenda tem moldura pirâmide.')
ON CONFLICT (category, key) DO NOTHING;

UPDATE pricing_items
   SET notes = 'Substituído pelos itens por tamanho pyramid_frame_<size> (mig 110). Fica só como fallback; não editar.'
 WHERE category = 'extra' AND key = 'pyramid_frame';

COMMIT;

-- ── Verificação (correr depois) ─────────────────────────────
-- 1. Devem aparecer 4 linhas: as 3 novas com o mesmo preço do genérico.
-- SELECT key, label, price, position, deleted_at
--   FROM pricing_items
--  WHERE category = 'extra' AND key LIKE 'pyramid_frame%'
--  ORDER BY position;
--
-- 2. Em Finanças → Catálogo → "Moldura pirâmide" as 3 linhas passam a ter
--    um preço editável cada (antes: "item em falta").
