-- ============================================================
-- Etiquetas geríveis: category deixa de estar limitada às 4 fixas
-- ============================================================
-- A mig 090 pôs um CHECK (category IN ('cliente','lead','operacional')).
-- Agora a Maria pode criar etiquetas próprias, cuja key fica guardada em
-- whatsapp_conversations.category — por isso removemos o CHECK e passamos a
-- validar do lado da app (as definições vivem em system_settings.whatsapp_labels).
-- Continua NULL = automático (derivado do estado da encomenda).

ALTER TABLE whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_category_check;

COMMENT ON COLUMN whatsapp_conversations.category IS
  'Key da etiqueta manual da conversa (ver system_settings.whatsapp_labels). NULL = derivada automaticamente do estado da encomenda.';
