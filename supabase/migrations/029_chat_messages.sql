-- ============================================================
-- Migration 029: Chat interno entre membros (versão mínima — só texto)
-- ============================================================
-- Canal único e plano para os 3 utilizadores (António, MJ, Ana)
-- conversarem dentro da plataforma, substituindo trocas avulsas
-- por WhatsApp/email para assuntos operacionais.
--
-- Esta versão mínima suporta APENAS texto. Media (foto, vídeo,
-- áudio) fica para uma migração futura — a coluna `attachments`
-- já está prevista para evitar quebrar quando isso for adicionado.
--
-- Realtime: a tabela é publicada para Supabase Realtime para
-- que mensagens novas apareçam sem refresh.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  author_id       UUID REFERENCES auth.users(id),
  author_email    TEXT NOT NULL,
  body            TEXT NOT NULL,
  -- Reservado para a expansão futura (foto/vídeo/áudio).
  -- Estrutura prevista: [{kind: "image"|"video"|"audio", url, mime?, duration?}]
  attachments     JSONB DEFAULT '[]'::jsonb NOT NULL,
  -- Mensagem que esta responde (thread leve sem nesting)
  reply_to        UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  -- Read receipts: array de emails que já leram esta mensagem
  read_by         JSONB DEFAULT '[]'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY — todos os 3 utilizadores escrevem e leem
-- ============================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_read" ON chat_messages;
CREATE POLICY "chat_messages_read" ON chat_messages FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  );

-- INSERT: o autor tem de ser o próprio user (compara email do JWT)
DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
    AND author_email = auth.jwt() ->> 'email'
  );

-- UPDATE: só o autor pode editar/apagar a sua própria mensagem
-- (read_by é actualizado por qualquer um — política separada abaixo)
DROP POLICY IF EXISTS "chat_messages_update_own" ON chat_messages;
CREATE POLICY "chat_messages_update_own" ON chat_messages FOR UPDATE
  USING (
    auth.jwt() ->> 'email' = author_email
    AND auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  );

-- ============================================================
-- GRANTs
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO authenticated;

-- ============================================================
-- REALTIME — publicar tabela para subscribers
-- ============================================================
-- A publicação `supabase_realtime` é gerida pelo Supabase.
-- ALTER PUBLICATION pode falhar se já existir; ignorar com idempotência.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Se a publicação não existir (instalação manual de Supabase), nada se passa.
  NULL;
END $$;

COMMIT;
