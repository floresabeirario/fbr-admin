-- ============================================================
-- Migration 061: WhatsApp em tempo real (Coexistence + Cloud API)
-- ============================================================
-- Fase 6 (parte 41) — integração viva substituindo o registo manual
-- da mig 042. As mensagens chegam directamente da Meta via webhook
-- (Coexistence activada pelo Dualhook), incluindo ecos das respostas
-- que a Maria envia pelo telemóvel (smb_message_echoes).
--
-- Modelo: conversa POR NÚMERO DE TELEFONE (não por encomenda). Uma
-- cliente com 3 encomendas vê o mesmo histórico em todos os
-- workbenches dela. Conversas de números sem encomenda associada
-- aparecem numa "Caixa de Entrada" dedicada.
--
-- Multimédia: a Meta envia URLs com validade de 5 min. O webhook
-- guarda a mensagem com media_pending=true e responde 200 imediatamente
-- (limite de 10s da Meta). Um job assíncrono puxa os ficheiros para a
-- Drive da cliente e actualiza media_url_drive — fiel a
-- [[feedback_drive_para_ficheiros]].
--
-- Idempotência: wamid (id da Meta) é UNIQUE — Meta retransmite eventos
-- até 7 dias se não responderes 200.
--
-- A coluna orders.whatsapp_log (mig 042) NÃO é apagada nesta migração.
-- Será removida em migração separada depois de o conteúdo ser exportado
-- para a Drive de cada encomenda.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. TABELA whatsapp_conversations
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Telefone normalizado E.164: "+351935896353". UNIQUE garante 1
  -- conversa por número (independente de quantas encomendas tem).
  phone_e164      TEXT NOT NULL UNIQUE,

  -- Versão amigável para mostrar na UI ("935 896 353" ou
  -- "+351 935 896 353"). Best-effort do parser; cai-se em phone_e164
  -- se vier vazio.
  display_phone   TEXT,

  -- Nome de perfil que a Meta envia em contacts[].profile.name
  -- (raramente útil — clientes podem ter "Bea ❤️" — mas guardamos).
  contact_name    TEXT,

  -- Sumário para a inbox e workbench (actualizado por trigger).
  last_message_at         TIMESTAMPTZ,
  last_message_preview    TEXT,
  last_message_direction  TEXT CHECK (last_message_direction IN ('received', 'sent_echo')),

  -- Bolinha de não-lidas no workbench/inbox. Incrementa em mensagens
  -- recebidas; zera via RPC mark_whatsapp_conversation_read.
  unread_count    INT NOT NULL DEFAULT 0,

  -- Arquivar conversa antiga sem perder histórico.
  archived        BOOLEAN NOT NULL DEFAULT false,

  -- Notas livres da Maria sobre a pessoa (opcional).
  notes           TEXT
);

COMMENT ON TABLE whatsapp_conversations IS
  'Conversa de WhatsApp com uma pessoa, identificada pelo número (E.164). Independente de quantas encomendas a pessoa tenha. Alimentada pelo webhook /api/whatsapp/webhook (Coexistence Meta).';

CREATE INDEX IF NOT EXISTS whatsapp_conversations_last_msg_idx
  ON whatsapp_conversations(last_message_at DESC NULLS LAST)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_unread_idx
  ON whatsapp_conversations(unread_count)
  WHERE unread_count > 0;

DROP TRIGGER IF EXISTS whatsapp_conversations_updated_at ON whatsapp_conversations;
CREATE TRIGGER whatsapp_conversations_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. TABELA whatsapp_messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,

  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,

  -- ID da Meta (wamid.HBgL...). Idempotência: se a Meta retransmitir
  -- o mesmo evento, o INSERT falha por unique violation e o webhook
  -- ignora silenciosamente (sucesso).
  wamid           TEXT NOT NULL UNIQUE,

  -- 'received' = mensagem do cliente para nós.
  -- 'sent_echo' = mensagem enviada pela Maria no telemóvel que a Meta
  -- nos reflecte via Coexistence (smb_message_echoes).
  direction       TEXT NOT NULL CHECK (direction IN ('received', 'sent_echo')),

  -- Tipo de conteúdo. 'unsupported' apanha tipos que ainda não tratamos
  -- (reactions, button replies, etc) sem perder a mensagem.
  content_type    TEXT NOT NULL CHECK (content_type IN (
                    'text', 'image', 'video', 'audio', 'document',
                    'sticker', 'location', 'contacts', 'reaction',
                    'system', 'unsupported'
                  )),

  -- Corpo textual (se content_type='text') ou legenda (se multimédia).
  text            TEXT,

  -- Para multimédia: media_id é o ID da Meta para refetch se preciso;
  -- media_mime é o MIME type; media_url_drive é onde GUARDÁMOS o
  -- ficheiro depois de puxar da Meta (URL Drive permanente).
  media_id        TEXT,
  media_mime      TEXT,
  media_url_drive TEXT,

  -- TRUE enquanto o job assíncrono ainda não puxou o ficheiro da Meta.
  -- A UI mostra "📷 a carregar..." durante esta janela (segundos).
  media_pending   BOOLEAN NOT NULL DEFAULT false,

  -- Se esta mensagem responde a outra ("reply to" do WhatsApp).
  reply_to_wamid  TEXT,

  -- Timestamp original da Meta (segundos desde epoch convertidos).
  -- Distinto de created_at — útil para reconstruir ordem se houver
  -- atraso no webhook.
  received_at     TIMESTAMPTZ NOT NULL,

  -- Raw event da Meta para debug e recuperação se o parser tiver bug.
  meta_payload    JSONB NOT NULL
);

COMMENT ON TABLE whatsapp_messages IS
  'Mensagem individual de WhatsApp (recebida ou eco de envio). wamid é a chave de idempotência da Meta.';

-- Index principal: ler conversa por ordem cronológica.
CREATE INDEX IF NOT EXISTS whatsapp_messages_conv_received_idx
  ON whatsapp_messages(conversation_id, received_at DESC);

-- Index para o job assíncrono encontrar multimédia pendente.
CREATE INDEX IF NOT EXISTS whatsapp_messages_pending_idx
  ON whatsapp_messages(created_at)
  WHERE media_pending = true;

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGER — actualizar sumário da conversa em cada mensagem nova
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION whatsapp_update_conversation_summary()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET
    last_message_at        = NEW.received_at,
    last_message_preview   = LEFT(
      COALESCE(
        NULLIF(NEW.text, ''),
        CASE NEW.content_type
          WHEN 'image'    THEN '📷 Foto'
          WHEN 'video'    THEN '🎥 Vídeo'
          WHEN 'audio'    THEN '🎤 Áudio'
          WHEN 'document' THEN '📄 Documento'
          WHEN 'sticker'  THEN '🌸 Sticker'
          WHEN 'location' THEN '📍 Localização'
          WHEN 'contacts' THEN '👤 Contacto'
          WHEN 'reaction' THEN '↩ Reacção'
          ELSE '(mensagem)'
        END
      ),
      140
    ),
    last_message_direction = NEW.direction,
    unread_count           = CASE
      WHEN NEW.direction = 'received' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at             = now()
  WHERE id = NEW.conversation_id
    -- Só actualiza se a nova mensagem é mais recente — protege contra
    -- backfills/ordem desordenada de eventos.
    AND (last_message_at IS NULL OR last_message_at <= NEW.received_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS whatsapp_messages_summary_trigger ON whatsapp_messages;
CREATE TRIGGER whatsapp_messages_summary_trigger
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION whatsapp_update_conversation_summary();

-- ────────────────────────────────────────────────────────────
-- 4. RPC — marcar conversa como lida (zera unread_count)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_whatsapp_conversation_read(conv_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = 0, updated_at = now()
  WHERE id = conv_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION mark_whatsapp_conversation_read(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
-- Os 2 admins têm acesso total. Ana (viewer) pode LER (para apoio
-- no atendimento futuro) mas não pode escrever conversas.
-- O service role do webhook bypass RLS (escreve directamente).
-- ────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages      ENABLE ROW LEVEL SECURITY;

-- Conversations: admins fazem tudo
DROP POLICY IF EXISTS "whatsapp_conversations_admins_all" ON whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_admins_all" ON whatsapp_conversations FOR ALL
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

-- Conversations: todos os 3 utilizadores autenticados podem ler
DROP POLICY IF EXISTS "whatsapp_conversations_team_read" ON whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_team_read" ON whatsapp_conversations FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  );

-- Messages: admins fazem tudo
DROP POLICY IF EXISTS "whatsapp_messages_admins_all" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_admins_all" ON whatsapp_messages FOR ALL
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

-- Messages: todos os 3 utilizadores autenticados podem ler
DROP POLICY IF EXISTS "whatsapp_messages_team_read" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_team_read" ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. GRANTS
-- ────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_messages      TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. REALTIME — publicar tabelas para Supabase Realtime
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;
