-- ============================================================
-- FBR Admin — Figuras Públicas: par/cônjuge + simplificar tipos
-- Executar no Supabase SQL Editor
-- ============================================================
--
-- Um casamento é (quase sempre) um casal. Por vezes AMBAS as pessoas são
-- figuras públicas (cada uma com o seu @ e alcance), por vezes só uma é e
-- a outra é "apenas" o/a cônjuge. Para cobrir os dois casos com UM só
-- registo, juntam-se campos opcionais do par:
--   - partner_name        → sempre que houver par (mesmo que não seja figura)
--   - partner_instagram   → preencher só se o par também for figura
--   - partner_followers   → idem
-- Se só `partner_name` estiver preenchido → é o cônjuge. Se vier @ + alcance
-- → ambos são figuras.
--
-- Além disso, simplifica-se `figure_type`: "celebridade" funde-se em
-- "figura_publica" (a distinção era só semântica, sem comportamento ligado).
-- ============================================================

ALTER TABLE public_figures
  ADD COLUMN IF NOT EXISTS partner_name       TEXT,
  ADD COLUMN IF NOT EXISTS partner_instagram  TEXT,    -- sem @, como instagram_handle
  ADD COLUMN IF NOT EXISTS partner_followers  INTEGER;

-- ── Simplificar tipos: celebridade → figura_publica ──────────
-- 1) migrar registos existentes
UPDATE public_figures
   SET figure_type = 'figura_publica'
 WHERE figure_type = 'celebridade';

-- 2) recolocar o CHECK sem 'celebridade'
ALTER TABLE public_figures
  DROP CONSTRAINT IF EXISTS public_figures_figure_type_check;

ALTER TABLE public_figures
  ADD CONSTRAINT public_figures_figure_type_check
  CHECK (figure_type IN ('influencer', 'figura_publica'));
