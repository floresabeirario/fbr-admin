-- ============================================================
-- Migration 045: Despesas — descrição passa a ser o principal,
-- fornecedor passa a opcional (e pode ser link ou texto)
-- ============================================================
-- Maria pediu: ao registar uma despesa, a descrição é o campo
-- principal (obrigatório no formulário) e o fornecedor é
-- secundário (opcional). O fornecedor continua a ser TEXT mas
-- aceita URLs — o frontend auto-detecta e renderiza como link.
--
-- Esta migração só relaxa a constraint NOT NULL na BD. A regra
-- "descrição obrigatória" é aplicada ao nível do formulário
-- para não bloquear linhas históricas que tenham só supplier.
-- ============================================================

BEGIN;

ALTER TABLE expenses
  ALTER COLUMN supplier DROP NOT NULL;

COMMIT;
