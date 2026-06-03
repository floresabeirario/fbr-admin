-- ============================================================
-- Migration 072: Cadência de comunicação + 1º momento ("pedir opinião")
-- ============================================================
-- Contexto (sessão 104):
-- A Maria quer ser lembrada de enviar as mensagens certas em cada
-- momento-chave de uma encomenda (tudo enviado à MÃO por WhatsApp —
-- NADA automático). Os Afazeres do Dashboard tornam-se a sua "lista
-- de mensagens por enviar", que vai dando check.
--
-- 1º momento ligado: 2 dias após a encomenda entrar em "Quadro
-- recebido", criar uma tarefa-lembrete "Pedir opinião sobre o quadro".
-- A lógica (transição → lembrete) vive no motor src/lib/comms-cadence.ts;
-- esta migração só prepara os dados:
--
--   1. orders.comms_moments_done — quais momentos da cadência já
--      geraram lembrete (idempotência; base para futuro checklist).
--   2. 2 templates de mensagem (PT + EN) "pedir_opiniao_quadro".
--   3. system_settings.review_link — link de opinião (variável
--      {link_avaliacao}), editável em Sistema → Templates.
--
-- Só ALTER/INSERT em tabelas existentes → sem tabelas novas, sem
-- grants novos (project_supabase_public_grants_2026 não se aplica).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. orders.comms_moments_done
-- ────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS comms_moments_done TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN orders.comms_moments_done IS
  'Chaves dos momentos da cadência de comunicação que já geraram tarefa-lembrete (ver src/lib/comms-cadence.ts). Evita lembretes duplicados.';

-- ────────────────────────────────────────────────────────────
-- 2. Templates de mensagem (PT + EN) — pedir opinião
-- ────────────────────────────────────────────────────────────
-- Variáveis: {saudacao}, {nome}, {link_avaliacao}.
-- Sugeridos quando o estado é "quadro_recebido".
INSERT INTO message_templates
  (slug, name, language, category, scope, position, is_seed, suggested_statuses, body) VALUES

('pedir_opiniao_quadro_pt',
 'Pós-venda — pedir opinião',
 'pt', 'pos_venda', 'order', 80, true,
 '["quadro_recebido"]'::jsonb,
$$Olá {nome} 🌸

Já passaram alguns dias desde que o seu quadro chegou, e esperamos que já tenha encontrado o lugar certo na sua casa.

Pomos muito de nós em cada peça que fazemos, e ficamos sempre felizes por saber como foi recebida. Se tiver um momento, adoraríamos saber a sua opinião. As palavras de quem recebe os nossos quadros ajudam outras pessoas a confiar no nosso trabalho e são o melhor reconhecimento que podemos ter. Dão sentido a todo o cuidado que pomos em cada quadro e enchem-nos de alegria.

Pode contar-nos como foi a sua experiência aqui:
{link_avaliacao}

Fica também o convite para nos marcar numa foto do quadro em casa. Ver onde as flores vão parar faz-nos sempre o dia.

Das nossas mãos às suas, sempre à beira-rio. Obrigada.$$),

('pedir_opiniao_quadro_en',
 'Post-sale — ask for a review',
 'en', 'pos_venda', 'order', 81, true,
 '["quadro_recebido"]'::jsonb,
$$Hello {nome} 🌸

It has been a few days since your frame arrived, and we hope it has already found the right place in your home.

We put so much of ourselves into every piece we make, and it always makes us happy to hear how it was received. If you have a moment, we would love to know what you think. The words of those who receive our frames help others trust our work and are the greatest reward we could ask for. They give meaning to all the care we put into each frame and fill us with joy.

You can tell us about your experience here:
{link_avaliacao}

We would also love it if you tagged us in a photo of the frame at home. Seeing where the flowers end up always makes our day.

From our hands to yours, always by the river. Thank you.$$)

ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. system_settings.review_link
-- ────────────────────────────────────────────────────────────
-- Por agora o link do Google Maps da FBR. A Maria pode trocar por um
-- link curto (ou pela futura página de opiniões) em Sistema → Templates.
INSERT INTO system_settings (key, value) VALUES
  ('review_link', 'https://www.google.com/maps/place/Flores+%C3%A0+Beira-Rio+%7C+Preserva%C3%A7%C3%A3o+de+flores/data=!4m2!3m1!1s0x4069664bcb0bca61:0xf85c396495d9b485!17m2!4m1!1e3!18m1!1e1')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificações rápidas (correr depois da migração):
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='orders' AND column_name='comms_moments_done';
--   -- 1 linha
--
--   SELECT slug, language FROM message_templates
--    WHERE slug LIKE 'pedir_opiniao_quadro%';
--   -- pedir_opiniao_quadro_pt / pedir_opiniao_quadro_en
--
--   SELECT key, value FROM system_settings WHERE key='review_link';
--   -- 1 linha
-- ============================================================
