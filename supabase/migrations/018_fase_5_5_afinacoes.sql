-- ============================================================
-- Migration 018: Fase 5.5 — afinações pré-Fase 6
-- ============================================================
-- Itens:
--  1. Novo estado de encomenda: a_finalizar_quadro (entre
--     a_aguardar_aprovacao e a_ser_emoldurado).
--  2. Campos de "recolha no local": morada + data + janela horária.
--     A morada vai um dia poder vir de uma pesquisa Google Maps
--     mas é guardada como TEXT (a UI escreve o resultado escolhido).
--  3. Inventário de flores por encomenda (JSONB array de
--     {qty, name}).
--  4. Sticky note (texto livre) em orders e vouchers — post-it
--     amarelo flutuante no workbench.
--  5. Flags payment_40_requested / payment_30_requested para
--     marcar que já lembrei o cliente de pagar essa tranche.
--  6. Em vouchers: partner_id (FK), partner_commission,
--     partner_commission_status — vales podem ser recomendados
--     por parceiros, idêntico às encomendas.
-- ============================================================

BEGIN;

-- 1) Novo estado de encomenda --------------------------------
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'entrega_flores_agendar',
      'entrega_agendada',
      'flores_enviadas',
      'flores_recebidas',
      'flores_na_prensa',
      'reconstrucao_botanica',
      'a_compor_design',
      'a_aguardar_aprovacao',
      'a_finalizar_quadro',
      'a_ser_emoldurado',
      'emoldurado',
      'a_ser_fotografado',
      'quadro_pronto',
      'quadro_enviado',
      'quadro_recebido',
      'cancelado'
    )
  );

-- 2) Recolha no local ---------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_date DATE,
  ADD COLUMN IF NOT EXISTS pickup_time_from TIME,
  ADD COLUMN IF NOT EXISTS pickup_time_to TIME;

-- 3) Inventário de flores -----------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4) Sticky note --------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sticky_note TEXT;

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS sticky_note TEXT;

-- 5) Flags de pedidos de pagamento --------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_40_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_30_requested BOOLEAN NOT NULL DEFAULT false;

-- 5a) Nova opção em "Como conheceu a FBR": recomendação de IA
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_how_found_fbr_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_how_found_fbr_check CHECK (
    how_found_fbr IS NULL OR how_found_fbr IN (
      'instagram', 'facebook', 'casamentos_pt', 'google',
      'vale_presente', 'florista', 'recomendacao', 'recomendacao_ia', 'outro'
    )
  );

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_how_found_fbr_check;
ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_how_found_fbr_check CHECK (
    how_found_fbr IS NULL OR how_found_fbr IN (
      'instagram', 'facebook', 'casamentos_pt', 'google',
      'vale_presente', 'florista', 'recomendacao', 'recomendacao_ia', 'outro'
    )
  );

-- 5b) Resposta do cliente à aprovação da composição --------
-- Quando a encomenda está em "a_aguardar_aprovacao", o cliente
-- precisa de validar a proposta. Se passarem 4 dias sem resposta,
-- o admin deve ser alertado para voltar a contactar. Clicar em
-- "Cliente já respondeu" desactiva o alerta.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS approval_responded BOOLEAN NOT NULL DEFAULT false;

-- 6) Parcerias em vouchers ---------------------------------
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS partner_id UUID
    REFERENCES partners(id) ON DELETE SET NULL;

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS partner_commission NUMERIC(10, 2);

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS partner_commission_status TEXT
    NOT NULL DEFAULT 'na'
    CHECK (
      partner_commission_status IN (
        'na', 'parceiro_informado', 'a_aguardar', 'paga',
        'a_aguardar_resposta', 'nao_aceita'
      )
    );

CREATE INDEX IF NOT EXISTS idx_vouchers_partner_id
  ON vouchers(partner_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pickup_date
  ON orders(pickup_date) WHERE deleted_at IS NULL AND pickup_date IS NOT NULL;

COMMIT;

-- ============================================================
-- Notas:
--  - Não há GRANTs a fazer aqui: as colunas novas herdam as
--    permissões da tabela (já concedidas em migrações anteriores).
--  - Estados existentes em orders.status não precisam de
--    conversão (a CHECK só ADICIONA o novo valor).
--  - inventory NOT NULL com default '[]'::jsonb evita que linhas
--    antigas tenham NULL e simplifica o código TypeScript.
-- ============================================================
