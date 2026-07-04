-- ============================================================
-- Categoria (etiqueta) das conversas de WhatsApp
-- ============================================================
-- As "labels" que a Maria põe no WhatsApp Business do telemóvel
-- (CLIENTE / LEAD / OPERACIONAL) NÃO são expostas pela Cloud API da
-- Meta, por isso guardamo-las aqui na plataforma.
--
-- NULL = automático: a categoria é derivada no cliente a partir do
--        estado da encomenda ligada por telefone —
--          cliente = encomenda em "Entrega agendada" ou mais à frente
--                    (Reservas em diante);
--          lead    = pré-reserva ("Entrega de flores por agendar") ou
--                    conversa sem encomenda.
-- Valor não-nulo = escolha manual da Maria, que se sobrepõe ao automático
--        (é aqui que entra 'operacional', que o automático nunca infere).
--
-- Sem GRANT novo: a mig 061 deu GRANT UPDATE ao nível da TABELA a
-- authenticated e a mig 062 a service_role, o que cobre colunas novas.

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN ('cliente', 'lead', 'operacional'));

COMMENT ON COLUMN whatsapp_conversations.category IS
  'Etiqueta manual da conversa (cliente/lead/operacional). NULL = derivada automaticamente do estado da encomenda ligada.';
