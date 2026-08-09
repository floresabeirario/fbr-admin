-- ============================================================
-- 095 — Melhor explicação do link de acompanhamento nas templates
-- ============================================================
-- A frase que introduz o {link_status} nas mensagens era genérica
-- ("Também poderá acompanhar o estado da sua encomenda aqui:") e não
-- explicava que o link é um acompanhamento VIVO, de todas as fases, do
-- início à entrega, e que a previsão da data de entrega também é
-- atualizada lá. Esta migração substitui SÓ essa linha (por variante do
-- texto atual) em todas as templates que a têm — não toca no resto de
-- cada mensagem, por isso não apaga afinações feitas à mão no admin.
--
-- Apenas DADOS (message_templates.body): sem schema, GRANT, RLS ou tipos.
-- Idempotente: correr 2× não faz nada na 2ª vez (as frases antigas já
-- não existem para substituir).
--
-- Templates afetadas (PT+EN): confirmacao_reserva_maos / _ctt / _recolha
-- / _dinheiro, ponto_situacao, vale_reserva_coberta.

UPDATE message_templates
SET body =
  -- ── Variantes PT → nova frase PT ──
  REPLACE(
  REPLACE(
  -- ── Variantes EN → nova frase EN ──
  REPLACE(
  REPLACE(
  REPLACE(
  REPLACE(
    body,
    'You can follow the status of your order at any time here:',
    'On this link you can follow your order through every stage, from start to the delivery of your frame. We keep the status and the estimated delivery date updated as we go, so you can check it whenever you like:'),
    'You can also follow the status of your order here:',
    'On this link you can follow your order through every stage, from start to the delivery of your frame. We keep the status and the estimated delivery date updated as we go, so you can check it whenever you like:'),
    'You can also track the status of your order here:',
    'On this link you can follow your order through every stage, from start to the delivery of your frame. We keep the status and the estimated delivery date updated as we go, so you can check it whenever you like:'),
    'You can also follow the progress of your order here:',
    'On this link you can follow your order through every stage, from start to the delivery of your frame. We keep the status and the estimated delivery date updated as we go, so you can check it whenever you like:'),
    'Pode acompanhar o estado da sua encomenda a qualquer momento aqui:',
    'Neste link pode acompanhar a sua encomenda em cada fase, do início até à entrega do quadro. Vamos atualizando o estado e a previsão da data de entrega à medida que avançamos, por isso pode consultá-lo sempre que quiser:'),
    'Também poderá acompanhar o estado da sua encomenda aqui:',
    'Neste link pode acompanhar a sua encomenda em cada fase, do início até à entrega do quadro. Vamos atualizando o estado e a previsão da data de entrega à medida que avançamos, por isso pode consultá-lo sempre que quiser:')
WHERE deleted_at IS NULL
  AND body LIKE '%{link_status}%';

-- ── Verificação (correr à mão depois do UPDATE) ──
-- (a) Quantas templates já têm a nova frase (esperado: as 6 bases × PT/EN
--     que não tenham sido reescritas à mão):
--   SELECT slug, language FROM message_templates
--   WHERE deleted_at IS NULL
--     AND (body LIKE '%em cada fase, do início%'
--       OR body LIKE '%follow your order through every stage%')
--   ORDER BY slug;
--
-- (b) Sobrou alguma template com o link mas ainda com a frase antiga?
--     (0 linhas = tudo trocado; se aparecer alguma, foi editada à mão e
--      basta colar a frase nova nessa no admin):
--   SELECT slug, language FROM message_templates
--   WHERE deleted_at IS NULL
--     AND body LIKE '%{link_status}%'
--     AND body NOT LIKE '%em cada fase, do início%'
--     AND body NOT LIKE '%follow your order through every stage%'
--   ORDER BY slug;
