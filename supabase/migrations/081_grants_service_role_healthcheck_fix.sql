-- ============================================================
-- Migration 081: GRANTs a service_role em falta (bolinha vermelha)
-- ============================================================
-- A mig 068 fez uma auditoria de GRANTs a service_role mas usou
-- nomes de tabela errados ('checklist_items' e 'pricing' nao existem;
-- os nomes reais sao 'personal_checklist' e 'pricing_items') e
-- esqueceu 'competitors', 'public_status_settings' e 'team_members'.
-- Como o loop da 068 tinha IF EXISTS, os nomes errados passaram em
-- silencio.
--
-- Sintoma: o cron diario das 07:00 (/api/cron/healthcheck) corre com
-- createAdminClient (service_role) e leva "permission denied" (42501)
-- nessas tabelas -> grava a cache da bolinha com 4 erros -> bolinha
-- vermelha todas as manhas. Abrir a aba Healthchecks corre os checks
-- com a sessao da Maria (authenticated, com grants) -> tudo ok ->
-- cache regravada verde ate ao cron seguinte.
-- ============================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON personal_checklist     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON competitors            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pricing_items          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public_status_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members           TO service_role;

COMMIT;
