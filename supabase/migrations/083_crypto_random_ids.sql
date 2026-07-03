-- ============================================================
-- Migration 083: IDs públicos com aleatoriedade criptográfica
-- ============================================================
-- Auditoria da sessão 124: generate_order_id() e
-- generate_voucher_code() usavam random() do Postgres, que não é
-- criptograficamente seguro (a seed é previsível em teoria). O
-- order_id é o token público do site de status (expõe nome do
-- cliente + estado) e o code do vale é o token do site de vouchers,
-- por isso passam a usar gen_random_bytes() do pgcrypto.
--
-- Risco prático do random() era baixo (36^16 combinações), isto é
-- endurecimento barato. Encomendas/vales existentes NÃO mudam de ID.
--
-- CREATE OR REPLACE preserva os GRANTs existentes das funções
-- (authenticated + anon, das migs 003/016).
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- colar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

-- pgcrypto vem incluído no Supabase; isto só garante que está activa.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ID de encomenda: 16 caracteres A-Z0-9 (≈82 bits de entropia).
-- O viés do módulo (256 % 36 ≠ 0) é desprezável para este uso.
CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  bytes BYTEA := gen_random_bytes(16);
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 0..15 LOOP
    result := result || substr(chars, (get_byte(bytes, i) % 36) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Código de vale: mantém TUDO da mig 009 (alfabeto sem 0/O/I/1 para
-- leitura fácil + loop de unicidade com 10 tentativas); só a fonte de
-- aleatoriedade muda de random() para gen_random_bytes(). Bónus: o
-- alfabeto tem 32 caracteres (2^5), portanto o módulo não tem viés
-- nenhum.
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes BYTEA;
  result TEXT;
  i INTEGER;
  attempts INTEGER := 0;
  exists_already BOOLEAN;
BEGIN
  LOOP
    bytes := gen_random_bytes(6);
    result := '';
    FOR i IN 0..5 LOOP
      result := result || substr(chars, (get_byte(bytes, i) % 32) + 1, 1);
    END LOOP;

    -- Garantir unicidade (igual à mig 009)
    SELECT EXISTS(SELECT 1 FROM vouchers WHERE code = result) INTO exists_already;
    EXIT WHEN NOT exists_already;

    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Não foi possível gerar código único após 10 tentativas';
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ── Verificação rápida (correr separadamente) ───────────────────
-- SELECT generate_order_id(), generate_voucher_code();
-- (devem devolver 16 e 6 caracteres A-Z0-9 novos a cada corrida)
