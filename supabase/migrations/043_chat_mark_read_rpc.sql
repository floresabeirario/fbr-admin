-- ============================================================
-- Migration 043: RPC mark_chat_messages_read
-- ============================================================
-- O sistema de notificações do chat interno precisa marcar as
-- mensagens dos OUTROS como lidas, mas a política UPDATE da
-- migração 029 só deixa o autor mexer na própria mensagem.
--
-- Em vez de relaxar a RLS (que abriria edição/eliminação cruzada),
-- criamos uma função SECURITY DEFINER cirúrgica que só consegue
-- acrescentar o email do JWT ao array `read_by` das mensagens
-- indicadas — nenhuma outra coluna pode ser alterada por esta via.
--
-- Esta função é chamada pelo action `markChatMessagesReadAction`
-- (src/app/(admin)/chat/actions.ts).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION mark_chat_messages_read(message_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  user_email := auth.jwt() ->> 'email';

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF user_email NOT IN (
    'info+antonio@floresabeirario.pt',
    'info+mj@floresabeirario.pt',
    'info+ana@floresabeirario.pt'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para o chat interno';
  END IF;

  IF message_ids IS NULL OR array_length(message_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE chat_messages
     SET read_by = read_by || to_jsonb(user_email)
   WHERE id = ANY(message_ids)
     AND NOT (read_by @> to_jsonb(user_email));
END;
$$;

REVOKE ALL ON FUNCTION mark_chat_messages_read(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_chat_messages_read(uuid[]) TO authenticated;

COMMIT;
