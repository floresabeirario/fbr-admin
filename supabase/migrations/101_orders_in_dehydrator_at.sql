-- ============================================================
-- 101 — Timestamp de entrada no desidratador ("no desidratador há X")
-- ============================================================
-- Queremos mostrar há quanto tempo a encomenda está NO DESIDRATADOR (não
-- desde a prensa). Para isso carimbamos o momento em que o sinal
-- `in_dehydrator` (mig 099) passa a true, e limpamos quando volta a false.
--
-- Fazemos por trigger na BD para cobrir os DOIS caminhos que mexem no flag
-- (o toggle dos cards via setOrderInDehydratorAction e o do workbench via
-- updateOrderAction) sem ter de duplicar lógica na app.
--
-- BACKFILL: encomendas que já estejam marcadas (poucas, feito hoje nos
-- testes) recebem in_dehydrator_at = updated_at (aproximação) para não
-- ficarem sem contador.
--
-- GRANTS: coluna nova em `orders` (anterior a 30/10/2026, grants
-- table-level) — herda os privilégios; nada a fazer.
--
-- ROLLOUT: correr no SQL Editor antes (ou junto) do deploy do admin.
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS in_dehydrator_at timestamptz;

COMMENT ON COLUMN orders.in_dehydrator_at IS
  'Momento em que a encomenda foi posta no desidratador (in_dehydrator passou a true). NULL quando não está. Carimbado pelo trigger sync_dehydrator_timestamp. Usado para "no desidratador há X".';

-- Trigger dedicado: carimba na entrada, limpa na saída.
CREATE OR REPLACE FUNCTION sync_dehydrator_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.in_dehydrator THEN
    -- Só carimba na transição para "no desidratador" — se já estava lá e
    -- só se mexeu noutro campo, preserva o carimbo original.
    IF TG_OP = 'INSERT' OR NOT OLD.in_dehydrator THEN
      NEW.in_dehydrator_at := now();
    END IF;
  ELSE
    NEW.in_dehydrator_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_sync_dehydrator_ts ON orders;
CREATE TRIGGER orders_sync_dehydrator_ts
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_dehydrator_timestamp();

-- Backfill das que já estão marcadas.
UPDATE orders
SET in_dehydrator_at = COALESCE(updated_at, now())
WHERE in_dehydrator = true AND in_dehydrator_at IS NULL;

COMMIT;

-- ── Verificação (correr depois, no SQL Editor) ──────────────
-- SELECT order_id, in_dehydrator, in_dehydrator_at FROM orders
-- WHERE in_dehydrator = true;
