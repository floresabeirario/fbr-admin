-- ============================================================
-- Migration 027: View / RPC para audit_log com email do utilizador
-- ============================================================
-- O `audit_log.changed_by` é um UUID que aponta para `auth.users(id)`.
-- Para a UI mostrar "António / MJ / Ana" em vez de UUIDs, criamos uma
-- função SECURITY DEFINER que faz o JOIN e devolve linhas enriquecidas.
--
-- Acesso só admins — fica imposto pelo `requireAdmin()` no server action
-- E pela policy `admins_read_audit` que já existe em audit_log.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION audit_log_with_email(
  p_table TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  table_name TEXT,
  record_id UUID,
  action TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Gate de permissão: só admins
  IF (auth.jwt() ->> 'email') NOT IN (
    'info+antonio@floresabeirario.pt',
    'info+mj@floresabeirario.pt'
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      a.table_name,
      a.record_id,
      a.action,
      a.old_values,
      a.new_values,
      a.changed_by,
      u.email::TEXT AS changed_by_email,
      a.changed_at
    FROM audit_log a
    LEFT JOIN auth.users u ON u.id = a.changed_by
    WHERE
      (p_table IS NULL OR a.table_name = p_table)
      AND (p_action IS NULL OR a.action = p_action)
      AND (p_since IS NULL OR a.changed_at >= p_since)
    ORDER BY a.changed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION audit_log_with_email(TEXT, TEXT, TIMESTAMPTZ, INT) TO authenticated;

COMMIT;
