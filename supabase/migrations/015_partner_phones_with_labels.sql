-- ============================================================
-- FBR Admin — Parcerias: telemóveis ganham etiqueta
-- Executar no Supabase SQL Editor ANTES da 014.
-- ============================================================
--
-- A coluna `partners.phones` era TEXT[] (apenas números).
-- Passa a ser JSONB com formato:
--   [
--     { "label": "Ana Paula", "number": "915704383" },
--     { "label": null,         "number": "933786543" }
--   ]
--
-- Permite associar cada telemóvel a uma pessoa ou departamento
-- (ex.: na nota "Ana paula - 915 704 383 | Diogo - 933886082"
--  ficámos sem saber qual número era de quem).
--
-- Idempotente: só faz ALTER se phones ainda for TEXT[].
-- Os dados existentes são convertidos sem perda — cada string vira
-- {"label": null, "number": <string>}.
--
-- Nota técnica: o Postgres não permite subqueries no USING de um
-- ALTER COLUMN ... TYPE, por isso usamos uma função auxiliar
-- (criada e logo apagada).
-- ============================================================

DO $$
DECLARE
  current_type TEXT;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'partners' AND column_name = 'phones';

  IF current_type = 'ARRAY' THEN
    -- Função auxiliar: TEXT[] → JSONB com {label:null, number:<string>}
    CREATE OR REPLACE FUNCTION _phones_text_to_jsonb(arr TEXT[])
    RETURNS JSONB
    LANGUAGE sql
    IMMUTABLE
    AS $fn$
      SELECT COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('label', NULL, 'number', n))
         FROM unnest(arr) AS n),
        '[]'::jsonb
      );
    $fn$;

    ALTER TABLE partners
      ALTER COLUMN phones DROP DEFAULT;

    ALTER TABLE partners
      ALTER COLUMN phones TYPE JSONB
      USING _phones_text_to_jsonb(phones);

    ALTER TABLE partners
      ALTER COLUMN phones SET DEFAULT '[]'::jsonb;

    ALTER TABLE partners
      ALTER COLUMN phones SET NOT NULL;

    DROP FUNCTION _phones_text_to_jsonb(TEXT[]);
  END IF;
END $$;
