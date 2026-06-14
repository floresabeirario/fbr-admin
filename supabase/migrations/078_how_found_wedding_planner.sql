-- ============================================================
-- 078 — Nova origem "wedding_planner" em how_found_fbr
-- ============================================================
-- A Maria pediu uma opção "Recomendação de Wedding Planner" no campo
-- "Como conheceu a FBR" dos formulários (reserva + vale-presente).
-- `how_found_fbr` é TEXT com CHECK constraint, por isso é preciso alargar a
-- lista de valores permitidos em `orders` e `vouchers`.
-- (Padrão igual ao usado na migração 038.)

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_how_found_fbr_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_how_found_fbr_check CHECK (
    how_found_fbr IS NULL OR how_found_fbr IN (
      'instagram', 'facebook', 'casamentos_pt', 'google',
      'vale_presente', 'florista', 'wedding_planner',
      'recomendacao', 'recomendacao_ia', 'outro'
    )
  );

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_how_found_fbr_check;
ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_how_found_fbr_check CHECK (
    how_found_fbr IS NULL OR how_found_fbr IN (
      'instagram', 'facebook', 'casamentos_pt', 'google',
      'vale_presente', 'florista', 'wedding_planner',
      'recomendacao', 'recomendacao_ia', 'outro'
    )
  );
