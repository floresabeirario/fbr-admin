-- ============================================================
-- 093 — Checklist por fase + tracking CTT do quadro (sessão 140)
-- ============================================================
-- 1) phase_checklist: estado da mini-checklist por fase no workbench.
--    Estrutura: { "done": ["id-do-item", …], "custom": [{ "id", "label", "done" }, …] }
--    Os itens standard de cada fase vivem no código (src/lib/phase-checklist.ts);
--    aqui só se guarda o que está feito + itens adicionados à mão.
-- 2) frame_tracking_code: código de registo CTT do envio do quadro
--    (pedido no diálogo ao passar para "Quadro enviado").
-- 3) frame_shipped_date: data em que o quadro seguiu (alimenta a página
--    Entregas e Recolhas; distinto de frame_delivery_date, que é a
--    data em que o cliente RECEBEU o quadro).
--
-- Tabela existente → sem GRANTs novos (herdam-se os da tabela) e RLS
-- inalterada. Idempotente.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS phase_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS frame_tracking_code text,
  ADD COLUMN IF NOT EXISTS frame_shipped_date date;

-- Verificação (correr depois de aplicar):
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'orders'
--    AND column_name IN ('phase_checklist', 'frame_tracking_code', 'frame_shipped_date');
-- (deve devolver 3 linhas)
