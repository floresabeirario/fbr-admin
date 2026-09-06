-- ============================================================
-- 104 — Vidro museu como opção paga (preservação, secas e recriação)
-- ============================================================
-- Até agora TODOS os quadros levavam vidro museu anti-UV UltraVue®, e o
-- preço-base (300/400/500 na preservação, 200/270/360 nas secas) já o
-- incluía. A partir daqui o cliente escolhe:
--
--   • COM vidro museu  → suplemento por tamanho (45 / 65 / 115 €)
--   • SEM vidro museu  → vidro normal, preço-base inalterado
--
-- ⚠️ AS ENCOMENDAS ANTIGAS FICAM NO ESTADO 'incluido', NÃO EM 'sim'.
--    Todas elas têm vidro museu, mas pagaram-no dentro do preço-base.
--    Se ficassem em 'sim', o recálculo automático do orçamento (que
--    dispara sempre que se mexe no tamanho da moldura na fase de design)
--    somaria +45€ a +115€ a clientes que já pagaram. O estado 'incluido'
--    diz "tem vidro museu, não cobra suplemento" e é à prova disso.
--
-- Estados possíveis:
--   'incluido' — legado: tem vidro museu, incluído no preço antigo (não cobra)
--   'sim'      — cliente escolheu vidro museu (cobra suplemento)
--   'nao'      — cliente escolheu vidro normal (não cobra)
--   'nao_sei'  — ainda não decidiu (não cobra; decide-se na fase de design)
--
-- Sem tabelas novas → os GRANTs existentes de orders/pricing_items servem.
-- ============================================================

-- ── 1. Coluna nova em orders ────────────────────────────────
-- O DEFAULT 'incluido' no ADD COLUMN preenche as linhas existentes (o
-- backfill que a Maria pediu: "tudo o que está no admin tem que dizer
-- sim"). Logo a seguir o default passa a 'nao_sei' para as futuras.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS museum_glass TEXT NOT NULL DEFAULT 'incluido';

-- Rede de segurança: se a coluna já existisse de uma execução anterior
-- interrompida, garante que nenhuma linha antiga ficou fora do backfill.
UPDATE orders SET museum_glass = 'incluido' WHERE museum_glass IS NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_museum_glass_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_museum_glass_check
  CHECK (museum_glass IN ('incluido', 'sim', 'nao', 'nao_sei'));

ALTER TABLE orders ALTER COLUMN museum_glass SET DEFAULT 'nao_sei';

COMMENT ON COLUMN orders.museum_glass IS
  'Vidro do quadro. incluido = encomenda anterior a 26/08/2026, tem vidro museu dentro do preco-base (NUNCA cobra suplemento). sim = escolheu vidro museu (cobra pricing_items.glass_supplement.museum_glass_<tamanho>). nao = vidro normal. nao_sei = por decidir, nao cobra.';

-- ── 2. Categoria de preços nova ─────────────────────────────
-- Categoria própria em vez de reaproveitar 'extra' (que é por unidade,
-- com quantidade) ou 'background_supplement' (que é o fundo, não o vidro).
ALTER TABLE pricing_items DROP CONSTRAINT IF EXISTS pricing_items_category_check;
ALTER TABLE pricing_items
  ADD CONSTRAINT pricing_items_category_check
  CHECK (category IN (
    'base_frame',
    'background_supplement',
    'glass_supplement',
    'extra'
  ));

-- ── 3. Preços do vidro museu por tamanho ────────────────────
-- Mesmos valores para os 3 serviços (preservação, secas, recriação): o
-- vidro é o mesmo, o que muda é só o preço-base do quadro. Por isso as
-- chaves são por tamanho e não têm prefixo 'secas_'.
INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  ('glass_supplement', 'museum_glass_30x40', 'Vidro museu UltraVue 30x40', 45,  1, 'Suplemento quando o cliente escolhe vidro museu anti-UV. Vale para preservacao, flores secas e recriacao.'),
  ('glass_supplement', 'museum_glass_40x50', 'Vidro museu UltraVue 40x50', 65,  2, 'Suplemento quando o cliente escolhe vidro museu anti-UV. Vale para preservacao, flores secas e recriacao.'),
  ('glass_supplement', 'museum_glass_50x70', 'Vidro museu UltraVue 50x70', 115, 3, 'Suplemento quando o cliente escolhe vidro museu anti-UV. Vale para preservacao, flores secas e recriacao.')
ON CONFLICT (category, key) DO NOTHING;

-- ── 4. Templates que prometiam vidro museu incluído ─────────
-- UPDATEs por replace() e não reescrita do corpo inteiro: preserva
-- qualquer edição que a Maria tenha feito no resto da mensagem. Cada um
-- só actua se a frase antiga ainda lá estiver (idempotente).

UPDATE message_templates
SET body = replace(
  body,
  'que é depois emoldurada com vidro museu e materiais da mais alta qualidade, transformando-a numa peça única que guarda a memória do vosso dia para sempre. 🖼️',
  'que é depois emoldurada com materiais da mais alta qualidade, transformando-a numa peça única que guarda a memória do vosso dia para sempre. 🖼️'
  || chr(10) || chr(10) ||
  'Pode ainda escolher o vidro museu anti-UV UltraVue®, o mesmo que se usa em museus: praticamente elimina os reflexos e filtra até 70% dos raios UV, protegendo as cores das flores durante décadas.'
)
WHERE slug = 'como_funciona_processo_pt'
  AND deleted_at IS NULL
  AND body LIKE '%emoldurada com vidro museu e materiais da mais alta qualidade%';

UPDATE message_templates
SET body = replace(
  body,
  'which is then framed with museum glass and the highest quality materials, turning it into a unique piece that keeps the memory of your day forever. 🖼️',
  'which is then framed with the highest quality materials, turning it into a unique piece that keeps the memory of your day forever. 🖼️'
  || chr(10) || chr(10) ||
  'You can also choose anti-UV UltraVue® museum glass, the same glass used in museums: it virtually eliminates reflections and filters up to 70% of UV rays, protecting the colours of the flowers for decades.'
)
WHERE slug = 'como_funciona_processo_en'
  AND deleted_at IS NULL
  AND body LIKE '%framed with museum glass and the highest quality materials%';

UPDATE message_templates
SET body = replace(
  body,
  'e o emolduramento com vidro museu, um vidro de elevada qualidade que ajuda a proteger a peça para que as flores do vosso dia possam ser apreciadas para sempre. 🖼️',
  'e o emolduramento com moldura feita à medida, para que as flores do vosso dia possam ser apreciadas para sempre. 🖼️'
)
WHERE slug = 'resposta_orcamento_caro_pt'
  AND deleted_at IS NULL
  AND body LIKE '%o emolduramento com vidro museu, um vidro de elevada qualidade%';

UPDATE message_templates
SET body = replace(
  body,
  'and framing with museum glass, a high-quality glass that helps protect the piece so the flowers of your day can be enjoyed forever. 🖼️',
  'and framing with a made-to-measure frame, so the flowers of your day can be enjoyed forever. 🖼️'
)
WHERE slug = 'resposta_orcamento_caro_en'
  AND deleted_at IS NULL
  AND body LIKE '%framing with museum glass, a high-quality glass%';

-- ── 5. Cérebro do Claude (factos do negócio) ────────────────
-- Se o assistente continuar a dizer que o vidro museu está incluído,
-- contradiz o formulário e o orçamento. Replaces cirúrgicos.
UPDATE system_settings
SET value = replace(
  replace(
    value,
    'emoldurada com vidro museu (protecção de longa duração).',
    'emoldurada com moldura feita à medida. O vidro museu anti-UV UltraVue® (protecção de longa duração, praticamente sem reflexos) é OPÇÃO PAGA e não está incluído no preço-base. Encomendas anteriores a 26/08/2026 levaram vidro museu incluído no preço.'
  ),
  'explicar o valor (processo de vários meses, vidro museu, peça única e irrepetível)',
  'explicar o valor (processo de vários meses, peça única e irrepetível)'
)
WHERE key = 'claude_facts';

-- Linha de preços do Cérebro: acrescenta o vidro museu logo a seguir ao
-- fundo com fotografia.
UPDATE system_settings
SET value = replace(
  value,
  '- Fundo com fotografia: +20€ num quadro 30x40.',
  '- Fundo com fotografia: +20€ num quadro 30x40.'
  || chr(10) ||
  '- Vidro museu anti-UV UltraVue® (opção paga, não incluída no preço-base): 30x40 +45€ · 40x50 +65€ · 50x70 +115€. Sem esta opção o quadro leva vidro normal e o preço-base não muda.'
)
WHERE key = 'claude_facts'
  AND value NOT LIKE '%Vidro museu anti-UV UltraVue® (opção paga%';

-- ============================================================
-- VERIFICAÇÃO (correr depois, no SQL Editor)
-- ============================================================
-- 1) Todas as encomendas actuais têm de estar em 'incluido':
--    SELECT museum_glass, count(*) FROM orders GROUP BY 1 ORDER BY 2 DESC;
--    → esperado: uma única linha, 'incluido', com o total de encomendas.
--
-- 2) Os três preços novos existem:
--    SELECT key, label, price FROM pricing_items
--    WHERE category = 'glass_supplement' AND deleted_at IS NULL ORDER BY position;
--    → esperado: museum_glass_30x40 = 45,00 · 40x50 = 65,00 · 50x70 = 115,00
--
-- 3) Nenhum template activo promete vidro museu incluído:
--    SELECT slug FROM message_templates
--    WHERE deleted_at IS NULL AND (body ILIKE '%com vidro museu,%' OR body ILIKE '%with museum glass and%');
--    → esperado: 0 linhas.
