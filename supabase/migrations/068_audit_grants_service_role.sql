-- ============================================================
-- Migration 068: Auditoria preventiva de GRANTs a service_role
-- ============================================================
-- Memoria feedback_supabase_rls_pitfalls.md regra 5: tabelas tocadas
-- por createAdminClient (webhooks, crons, after()) precisam de GRANT
-- explicito a service_role mesmo bypassando RLS.
--
-- Migracoes 062 e 065 corrigiram whatsapp_* + google_integration +
-- system_settings depois de bugs observados em producao. Esta migracao
-- e preventiva: cobre todas as outras tabelas onde futuras background
-- tasks (cron emails, webhooks de outros sites, after() tasks)
-- poderiam falhar com 42501.
--
-- IF EXISTS para nao falhar em tabelas que ja foram dropadas
-- entretanto.
-- ============================================================

BEGIN;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'orders', 'vouchers', 'partners', 'partner_interactions', 'partner_actions',
    'tasks', 'task_templates', 'checklist_items',
    'ideas', 'recipes',
    'pricing', 'expenses',
    'production_cost_items',
    'chat_messages',
    'audit_log',
    'message_templates',
    'order_calendar_event'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role',
        tbl
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;
