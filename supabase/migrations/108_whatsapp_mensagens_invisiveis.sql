-- ============================================================
-- Migration 108: mensagens de WhatsApp invisíveis ou perdidas
-- ============================================================
-- Diagnóstico da sessão 166. A Maria queixou-se de mensagens que não
-- apareciam na aba WhatsApp, "sem padrão nenhum". Eram três problemas
-- independentes a somar-se:
--
--   1. 20 mensagens guardadas INTEIRAS mas invisíveis: a Meta manda as
--      mensagens editadas embrulhadas em `edit.message.text.body` e os
--      contactos partilhados em `contacts[]`. O parseContent só conhecia
--      `text.body`, por isso caíam em content_type='unsupported' com
--      text=NULL e a UI mostrava "(mensagem)" em itálico.
--   2. 11 eventos `revoke` ("apagar para todos") entravam como linhas
--      fantasma E a mensagem original continuava lá como se nada fosse.
--   3. Mensagens genuinamente perdidas (confirmado à mão: a mensagem da
--      Márcia Pimenta de 11/09 14:47 não está na BD). O webhook respondia
--      200 mesmo quando falhava a gravar, por isso a Meta nunca reenviava.
--
-- Esta migração só trata do que é dados. A correcção do webhook vai no
-- código (route.ts) e precisa de deploy.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. COLUNAS NOVAS em whatsapp_messages
-- ────────────────────────────────────────────────────────────

-- Mensagem que chegou como edição de outra ("editada" no WhatsApp).
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_edit BOOLEAN NOT NULL DEFAULT false;

-- Quando o remetente apagou a mensagem para todos. A linha NÃO se apaga
-- (o histórico é registo de trabalho); a UI risca-a.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Quantas vezes já tentámos puxar a multimédia. Antes desistia-se à
-- primeira (media_pending=false) e a foto perdia-se em silêncio — foi o
-- que aconteceu a 41 ficheiros em Junho de 2026.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_attempts SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN whatsapp_messages.is_edit IS
  'Chegou como evento `edit` da Meta: o texto é a versão corrigida pelo remetente.';
COMMENT ON COLUMN whatsapp_messages.revoked_at IS
  'Preenchido quando a Meta manda um `revoke` a apontar para esta mensagem.';
COMMENT ON COLUMN whatsapp_messages.media_attempts IS
  'Tentativas de download da multimédia. Desiste-se às 3 (ver media-fetch.ts).';

-- As pendentes com poucas tentativas são as que o cron vai buscar.
CREATE INDEX IF NOT EXISTS whatsapp_messages_media_retry_idx
  ON whatsapp_messages(received_at)
  WHERE media_pending = true;

-- ────────────────────────────────────────────────────────────
-- 2. TABELA whatsapp_webhook_failures
-- ────────────────────────────────────────────────────────────
-- Até agora as falhas do webhook só existiam no console da Vercel, que
-- expira. Sem isto não há maneira de MEDIR quantas mensagens se perdem —
-- só de as estimar por arqueologia (reacções órfãs).
CREATE TABLE IF NOT EXISTS whatsapp_webhook_failures (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NULL quando nem sequer conseguimos ler o id da mensagem.
  wamid          TEXT,
  direction      TEXT,
  msg_type       TEXT,
  phone_e164     TEXT,

  -- Onde rebentou: 'parse' | 'conversation' | 'insert'.
  stage          TEXT NOT NULL,
  error_code     TEXT,
  error_message  TEXT,

  -- Quantas vezes a Meta já retransmitiu isto sem sucesso. Aos 3, o
  -- webhook passa a responder 200 para a Meta não desactivar a
  -- subscrição por causa de uma mensagem que nunca vai entrar.
  attempts       INT NOT NULL DEFAULT 1,

  -- Fica true quando a mensagem acaba por entrar numa retransmissão.
  resolved       BOOLEAN NOT NULL DEFAULT false,

  -- Payload cru para recuperar a mensagem à mão se for preciso.
  payload        JSONB
);

COMMENT ON TABLE whatsapp_webhook_failures IS
  'Mensagens de WhatsApp que o webhook não conseguiu gravar. Uma linha por wamid, com contador de retransmissões da Meta.';

-- Uma linha por mensagem: as retransmissões incrementam attempts.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_webhook_failures_wamid_idx
  ON whatsapp_webhook_failures(wamid)
  WHERE wamid IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_webhook_failures_open_idx
  ON whatsapp_webhook_failures(last_seen_at DESC)
  WHERE resolved = false;

-- ────────────────────────────────────────────────────────────
-- 3. RLS + GRANTS
-- ────────────────────────────────────────────────────────────
-- Tabelas novas deixaram de herdar privilégios (ver nota de 30/10/2026):
-- o GRANT tem de ser explícito. O webhook escreve com service_role, que
-- passa por cima da RLS; a equipa só lê.
ALTER TABLE whatsapp_webhook_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_failures_team_read" ON whatsapp_webhook_failures;
CREATE POLICY "wa_failures_team_read" ON whatsapp_webhook_failures
  FOR SELECT TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "wa_failures_admins_all" ON whatsapp_webhook_failures;
CREATE POLICY "wa_failures_admins_all" ON whatsapp_webhook_failures
  FOR ALL TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_webhook_failures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_webhook_failures TO service_role;

COMMIT;

-- ============================================================
-- SEGUNDA PARTE — recuperar o que já está guardado mas invisível
-- ============================================================
-- Tudo isto é reprocessamento a partir do meta_payload que já lá está.
-- Não inventa nada e pode correr-se outra vez sem estragar (as
-- condições excluem as linhas já tratadas).

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 4. MENSAGENS EDITADAS → texto verdadeiro
-- ────────────────────────────────────────────────────────────
-- 18 linhas à data do diagnóstico. Entre elas a carta de agradecimento
-- de uma noiva, escrita de madrugada a seguir ao casamento, que estava
-- a aparecer à Maria como "(mensagem)".
UPDATE whatsapp_messages
SET content_type = 'text',
    text         = meta_payload->'edit'->'message'->'text'->>'body',
    is_edit      = true
WHERE content_type = 'unsupported'
  AND meta_payload->>'type' = 'edit'
  AND meta_payload->'edit'->'message'->'text'->>'body' IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 5. CONTACTOS PARTILHADOS → nome e número legíveis
-- ────────────────────────────────────────────────────────────
UPDATE whatsapp_messages m
SET content_type = 'contacts',
    text = sub.legenda
FROM (
  SELECT x.id,
         string_agg(
           COALESCE(
             ct->'name'->>'formatted_name',
             NULLIF(TRIM(COALESCE(ct->'name'->>'first_name', '') || ' ' ||
                         COALESCE(ct->'name'->>'last_name', '')), ''),
             'Contacto'
           )
           || COALESCE(
                ' — ' || (SELECT string_agg(ph->>'phone', ', ')
                          FROM jsonb_array_elements(
                                 CASE WHEN jsonb_typeof(ct->'phones') = 'array'
                                      THEN ct->'phones'
                                      ELSE '[]'::jsonb END) ph),
                ''
              ),
           ' | ')
         AS legenda
  FROM (
    SELECT id, meta_payload
    FROM whatsapp_messages
    WHERE content_type = 'unsupported'
      AND meta_payload->>'type' = 'contacts'
      AND jsonb_typeof(meta_payload->'contacts') = 'array'
  ) x,
  LATERAL jsonb_array_elements(x.meta_payload->'contacts') ct
  GROUP BY x.id
) sub
WHERE m.id = sub.id;

-- ────────────────────────────────────────────────────────────
-- 6. MENSAGENS APAGADAS → riscar a original
-- ────────────────────────────────────────────────────────────
-- O evento `revoke` traz `revoke.original_message_id`. Marcamos a
-- original como apagada em vez de a deixar a fingir que ainda existe.
UPDATE whatsapp_messages original
SET revoked_at = rev.received_at
FROM whatsapp_messages rev
WHERE rev.meta_payload->>'type' = 'revoke'
  AND original.wamid = rev.meta_payload->'revoke'->>'original_message_id'
  AND original.revoked_at IS NULL;

-- A própria linha do `revoke` deixa de aparecer como mensagem: passa a
-- 'system', que a UI não desenha como balão de conversa.
UPDATE whatsapp_messages
SET content_type = 'system',
    text = 'Mensagem apagada pelo remetente'
WHERE content_type = 'unsupported'
  AND meta_payload->>'type' = 'revoke';

-- ────────────────────────────────────────────────────────────
-- 7. REFRESCAR O SUMÁRIO das conversas afectadas
-- ────────────────────────────────────────────────────────────
-- O trigger da mig 061 só corre no INSERT, por isso as conversas cuja
-- última mensagem foi uma destas continuariam com "(mensagem)" na inbox.
UPDATE whatsapp_conversations c
SET last_message_preview = LEFT(
      COALESCE(
        NULLIF(u.text, ''),
        CASE u.content_type
          WHEN 'image'    THEN '📷 Foto'
          WHEN 'video'    THEN '🎥 Vídeo'
          WHEN 'audio'    THEN '🎤 Áudio'
          WHEN 'document' THEN '📄 Documento'
          WHEN 'sticker'  THEN '🌸 Sticker'
          WHEN 'location' THEN '📍 Localização'
          WHEN 'contacts' THEN '👤 Contacto'
          ELSE '(mensagem)'
        END
      ), 140)
FROM (
  SELECT DISTINCT ON (conversation_id)
         conversation_id, text, content_type
  FROM whatsapp_messages
  WHERE content_type <> 'reaction'
  ORDER BY conversation_id, received_at DESC
) u
WHERE c.id = u.conversation_id;

COMMIT;

-- ============================================================
-- VERIFICAÇÃO — correr depois, num SELECT só
-- ============================================================
-- SELECT 'editadas recuperadas' AS o_que, count(*)::text AS quantas
--   FROM whatsapp_messages WHERE is_edit
-- UNION ALL SELECT 'contactos legíveis',
--   count(*)::text FROM whatsapp_messages WHERE content_type='contacts'
-- UNION ALL SELECT 'originais riscadas como apagadas',
--   count(*)::text FROM whatsapp_messages WHERE revoked_at IS NOT NULL
-- UNION ALL SELECT 'ainda sem conteúdo (a Meta não manda)',
--   count(*)::text FROM whatsapp_messages WHERE content_type='unsupported';
