-- ============================================================
-- 082 — "Entregar até": data-limite de entrega pedida pelo cliente
-- ============================================================
-- Há encomendas em que o cliente pede que o quadro seja entregue
-- até certa data (um aniversário, uma oferta, etc.). Esta data não
-- existia em lado nenhum e perdia-se nas notas. Campos admin,
-- editáveis no workbench (caixa "Envio das flores e receção do
-- quadro"). Alimentam um alerta no Dashboard quando o prazo se
-- aproxima e uma pill na tabela de Preservação.
-- Só ALTER numa tabela existente, sem grants novos. As colunas NÃO
-- entram no GRANT do anon (site público não as vê).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_deadline DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_deadline_reason TEXT;

COMMENT ON COLUMN orders.delivery_deadline IS 'Data-limite de entrega do quadro pedida pelo cliente (ex: aniversário). NULL = sem prazo especial.';
COMMENT ON COLUMN orders.delivery_deadline_reason IS 'Motivo do prazo (ex: "aniversário da mãe a 15/09") — contexto para a equipa.';
