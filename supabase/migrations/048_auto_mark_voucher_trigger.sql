-- ============================================================
-- Migration 048: Trigger auto-mark vale como "preservação agendada"
-- ============================================================
-- Complementa a lógica TS adicionada na sessão 80 (`markVoucherAsScheduled`
-- em createOrderAction / updateOrderAction). Aquela cobre o caminho do
-- admin; esta cobre TODOS os caminhos restantes:
--
--   1. INSERTs vindos do form público (PostgREST anon — não passa pelo action)
--   2. INSERTs vindos de imports / scripts ad-hoc / SQL manual
--   3. UPDATEs que alterem gift_voucher_code feitos fora do action
--
-- A regra: sempre que uma linha em `orders` ganhe (INSERT) ou mude
-- (UPDATE) o seu `gift_voucher_code` para um valor não-vazio, marca
-- o vale correspondente como `preservacao_agendada`. Evita a dupla
-- contagem na faturação (vale + encomenda a contar ao mesmo tempo).
--
-- Salvaguardas:
--   - Idempotente: WHERE usage_status <> 'preservacao_agendada' evita writes
--     inúteis (e portanto evita ciclos infinitos via outros triggers).
--   - Código inexistente é silencioso: WHERE não bate, nada acontece.
--   - EXCEPTION WHEN OTHERS NUNCA bloqueia o INSERT/UPDATE em orders —
--     se algo falhar no vale, a encomenda ainda assim é criada/actualizada.
--     O erro vai apenas para os logs do Postgres (RAISE NOTICE).
--   - SECURITY DEFINER → bypassa RLS de vouchers (a função corre como
--     o owner da função, não como o utilizador autenticado).
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- copiar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. FUNÇÃO do trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_mark_voucher_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Já validámos no WHEN do trigger que NEW.gift_voucher_code está
  -- preenchido e mudou — aqui só faz o UPDATE protegido.
  BEGIN
    UPDATE vouchers
       SET usage_status = 'preservacao_agendada',
           updated_at = now()
     WHERE code = NEW.gift_voucher_code
       AND deleted_at IS NULL
       AND usage_status <> 'preservacao_agendada';
  EXCEPTION
    WHEN OTHERS THEN
      -- NUNCA bloquear o INSERT/UPDATE em orders por causa do vale.
      -- Log para os logs do Postgres mas continua o fluxo principal.
      RAISE NOTICE
        'auto_mark_voucher_used: falhou para code=% (order id=%): %',
        NEW.gift_voucher_code, NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_mark_voucher_used() IS
  'Trigger function: ao criar/editar encomenda com gift_voucher_code, marca o vale correspondente como preservacao_agendada. Silencioso em falha — nunca bloqueia o INSERT/UPDATE em orders.';

-- ────────────────────────────────────────────────────────────
-- 2. TRIGGER em INSERT
-- ────────────────────────────────────────────────────────────
-- AFTER INSERT — a encomenda já está criada quando o trigger corre.
-- O WHEN filtra logo: só dispara para encomendas que JÁ vêm com código
-- preenchido (caso típico do form público).
DROP TRIGGER IF EXISTS orders_auto_mark_voucher_insert ON orders;
CREATE TRIGGER orders_auto_mark_voucher_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (
    NEW.gift_voucher_code IS NOT NULL
    AND TRIM(NEW.gift_voucher_code) <> ''
  )
  EXECUTE FUNCTION auto_mark_voucher_used();

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGER em UPDATE (só quando o código muda)
-- ────────────────────────────────────────────────────────────
-- AFTER UPDATE OF gift_voucher_code → o Postgres só avalia o trigger
-- quando esta coluna específica é incluída no SET do UPDATE. Evita
-- disparar em cada save da Maria (mudar telefone, status, etc).
--
-- WHEN (... IS DISTINCT FROM ...) → "IS DISTINCT FROM" trata NULL
-- como qualquer outro valor (NULL ≠ "X" devolve TRUE, NULL = NULL
-- devolve FALSE). Em vez do operador `<>` que dá NULL quando há NULL.
DROP TRIGGER IF EXISTS orders_auto_mark_voucher_update ON orders;
CREATE TRIGGER orders_auto_mark_voucher_update
  AFTER UPDATE OF gift_voucher_code ON orders
  FOR EACH ROW
  WHEN (
    NEW.gift_voucher_code IS DISTINCT FROM OLD.gift_voucher_code
    AND NEW.gift_voucher_code IS NOT NULL
    AND TRIM(NEW.gift_voucher_code) <> ''
  )
  EXECUTE FUNCTION auto_mark_voucher_used();

COMMIT;

-- ============================================================
-- SMOKE TESTS (correr separadamente após a migração)
-- ============================================================
--
-- 1) Estado actual de um vale qualquer para usar nos testes:
--    (substituir 'XXXXXX' por um código real que esteja
--     no estado 'preservacao_nao_agendada' E 100_pago)
--
--    SELECT code, usage_status, payment_status FROM vouchers
--     WHERE code='XXXXXX';
--    → confirmar que está em 'preservacao_nao_agendada'
--
-- 2) Simular INSERT do form público (encomenda anónima com o código):
--    INSERT INTO orders (client_name, gift_voucher_code, status)
--    VALUES ('TESTE TRIGGER', 'XXXXXX', 'entrega_flores_agendar')
--    RETURNING id;
--    → SELECT usage_status FROM vouchers WHERE code='XXXXXX';
--    → deve passar a 'preservacao_agendada'
--    → apagar a encomenda teste: DELETE FROM orders WHERE client_name='TESTE TRIGGER';
--    → restaurar o vale se quiseres: UPDATE vouchers SET usage_status='preservacao_nao_agendada' WHERE code='XXXXXX';
--
-- 3) Confirmar que código inexistente NÃO bloqueia o INSERT:
--    INSERT INTO orders (client_name, gift_voucher_code, status)
--    VALUES ('TESTE COD INVALIDO', 'NAO_EXISTE_AAAA', 'entrega_flores_agendar')
--    RETURNING id;
--    → INSERT deve ter sucesso. Limpar: DELETE FROM orders WHERE client_name='TESTE COD INVALIDO';
--
-- 4) Confirmar que UPDATE noutra coluna NÃO dispara o trigger:
--    UPDATE orders SET phone='999000111' WHERE id='<algum-id>';
--    → não deve haver alteração em vouchers (sem write inútil).
--
-- 5) Lista de triggers em orders (para confirmar que tudo está lá):
--    SELECT tgname, tgenabled FROM pg_trigger
--     WHERE tgrelid='orders'::regclass AND NOT tgisinternal
--     ORDER BY tgname;
--    → deve incluir orders_auto_mark_voucher_insert + orders_auto_mark_voucher_update
-- ============================================================
