-- ============================================================
-- FBR Admin — Fase 3: Leitura pública de vales
-- Permite que o site voucher.floresabeirario.pt leia vales
-- pagos e não arquivados sem autenticação (role anon).
-- Executar no Supabase SQL Editor
-- ============================================================

CREATE POLICY "vouchers_public_read" ON vouchers
  FOR SELECT
  TO anon
  USING (deleted_at IS NULL AND payment_status = '100_pago');
