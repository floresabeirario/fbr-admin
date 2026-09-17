-- ============================================================
-- Migration 113: Histórico de estados das encomendas + tempo até à 1.ª
--                resposta no WhatsApp (para as Métricas)
-- ============================================================
-- Contexto (sessão 174, "vai tudo"): as Métricas passam a mostrar
--   (a) quantos dias cada encomenda fica em cada fase de produção (onde
--       encrava), o que precisa da data de cada mudança de estado;
--   (b) quanto tempo a Maria demora a responder no WhatsApp a um pedido
--       novo (a query 6 do diagnóstico de 17/09, agora como função).
--
-- 1. Tabela order_status_history (order_id, from_status, to_status,
--    changed_at, changed_by), alimentada por trigger AFTER INSERT/UPDATE OF
--    status em orders. SECURITY DEFINER para o INSERT não depender das
--    permissões de quem muda o estado.
-- 2. Backfill a partir do audit_log (guarda a linha inteira em cada UPDATE
--    desde a mig 001). Só corre se a tabela estiver vazia → idempotente.
--    As encomendas importadas do Monday ficam com a 1.ª linha na data da
--    importação; o código só mede fases em pedidos desde o formulário.
-- 3. Função whatsapp_first_response(): por encomenda com telemóvel, a
--    1.ª mensagem enviada (sent_echo) depois do pedido, na conversa com o
--    mesmo número (últimos 9 dígitos). SECURITY INVOKER: respeita as
--    policies das tabelas do WhatsApp (equipa lê).
--
-- GRANTs explícitos (tabela nova, regra de 30/10/2026): authenticated lê;
-- service_role tudo (backups/cron). RLS com is_team_member() (mig 085).
-- Ordem de deploy: indiferente (o código trata a tabela/função em falta
-- como "sem dados").
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Tabela + RLS + GRANTs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by  UUID
);

COMMENT ON TABLE order_status_history IS
  'Uma linha por mudança de estado de uma encomenda (trigger orders_log_status_change). from_status NULL = criação. Usado pelas Métricas para dias em cada fase.';

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history(order_id, changed_at);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_status_history_member_read" ON order_status_history;
CREATE POLICY "order_status_history_member_read" ON order_status_history
  FOR SELECT USING (is_team_member(auth.jwt() ->> 'email'));

GRANT SELECT ON order_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_status_history TO service_role;

-- ────────────────────────────────────────────────────────────
-- 2. Trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION orders_log_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_status_history(order_id, from_status, to_status, changed_at, changed_by)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.created_at, now()), auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history(order_id, from_status, to_status, changed_at, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, now(), auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_log_status_change ON orders;
CREATE TRIGGER orders_log_status_change
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_log_status_change();

-- ────────────────────────────────────────────────────────────
-- 3. Backfill do audit_log (só com a tabela vazia)
-- ────────────────────────────────────────────────────────────
INSERT INTO order_status_history(order_id, from_status, to_status, changed_at, changed_by)
SELECT a.record_id,
       a.old_values->>'status',
       a.new_values->>'status',
       a.changed_at,
       a.changed_by
  FROM audit_log a
 WHERE a.table_name = 'orders'
   AND a.action IN ('INSERT', 'UPDATE')
   AND a.new_values ? 'status'
   AND (a.action = 'INSERT' OR a.old_values->>'status' IS DISTINCT FROM a.new_values->>'status')
   AND EXISTS (SELECT 1 FROM orders o WHERE o.id = a.record_id)
   AND NOT EXISTS (SELECT 1 FROM order_status_history)
 ORDER BY a.changed_at;

-- ────────────────────────────────────────────────────────────
-- 4. Tempo até à 1.ª resposta no WhatsApp
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION whatsapp_first_response()
RETURNS TABLE (
  order_id       UUID,
  requested_at   TIMESTAMPTZ,
  first_reply_at TIMESTAMPTZ,
  hours          NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ord AS (
    SELECT id, created_at,
           right(regexp_replace(phone, '\D', '', 'g'), 9) AS tel9
      FROM orders
     WHERE deleted_at IS NULL
       AND phone IS NOT NULL
       AND length(regexp_replace(phone, '\D', '', 'g')) >= 9
  ),
  conv AS (
    SELECT id AS conv_id,
           right(regexp_replace(display_phone, '\D', '', 'g'), 9) AS tel9
      FROM whatsapp_conversations
     WHERE display_phone IS NOT NULL
  )
  SELECT o.id,
         o.created_at,
         m.first_reply,
         round((extract(epoch FROM (m.first_reply - o.created_at)) / 3600)::numeric, 1)
    FROM ord o
    JOIN conv c ON c.tel9 = o.tel9
    JOIN LATERAL (
      -- received_at = hora da Meta (a do envio real); created_at seria a
      -- hora a que o webhook a guardou.
      SELECT min(received_at) AS first_reply
        FROM whatsapp_messages
       WHERE conversation_id = c.conv_id
         AND direction = 'sent_echo'
         AND received_at >= o.created_at
    ) m ON m.first_reply IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION whatsapp_first_response() TO authenticated;
GRANT EXECUTE ON FUNCTION whatsapp_first_response() TO service_role;

COMMIT;

-- ── Verificação (correr depois) ─────────────────────────────
-- 1. Linhas do histórico por encomenda (deve haver pelo menos 1 por encomenda):
-- SELECT COUNT(*) AS linhas, COUNT(DISTINCT order_id) AS encomendas FROM order_status_history;
--
-- 2. Tempo de resposta: quantos pedidos emparelharam com uma conversa e a mediana em horas:
-- SELECT COUNT(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY hours) FROM whatsapp_first_response();
--
-- 3. Smoke do trigger: mudar o estado de uma encomenda de teste no workbench e ver a linha nova:
-- SELECT * FROM order_status_history ORDER BY changed_at DESC LIMIT 5;
