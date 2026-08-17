-- ============================================================
-- Migration 102: Ciclo de aprendizagem do assistente (sessão 153)
-- ============================================================
-- PROBLEMA: a Maria gera uma sugestão, edita-a e copia. Essa edição
-- (o que ele escreveu → o que ela realmente enviou) é o sinal mais
-- valioso do sistema inteiro, e até hoje era deitado fora de cada vez.
-- O assistente nunca melhorava com o uso.
--
-- O QUE ESTA TABELA FAZ: guarda esse par, em silêncio, no momento em
-- que a Maria carrega em "Copiar" ou "Abrir no WhatsApp". Zero cliques
-- extra, zero botões novos — a captura é um efeito secundário de algo
-- que ela já faz. Depois, na página "Cérebro do Claude", ela pede uma
-- análise e o Claude propõe regras de voz concretas a partir dos pares
-- ("ela corta sempre a frase de fecho", "ela nunca usa 'aguardamos'"),
-- que ela aceita ou rejeita uma a uma.
--
-- PARES SEM EDIÇÃO TAMBÉM CONTAM: `edited = false` diz-nos o que já
-- está bom. Sem isso, a análise só via defeitos e puxava a voz para
-- longe do que já funciona.
--
-- RGPD: as mensagens contêm dados de clientes. Retenção de 180 dias
-- (o cron diário apaga os mais antigos) — passado esse tempo as regras
-- já foram destiladas e o par cru não serve para mais nada. Sem PII
-- estruturada (nome/telefone) em colunas próprias: só o texto das
-- mensagens, que é o que a análise precisa de ler.
--
-- GRANTS: tabela NOVA criada depois de 30/10/2026 → precisa de GRANT
-- explícito (lição das migs 062/065/068/081 e [[project_supabase_public_grants_2026]]).
-- O service_role escreve (a rota /api/whatsapp/suggest-edit corre com
-- ele) e apaga (cron de retenção); os admins lêem para a análise.
--
-- ROLLOUT: correr no SQL Editor ANTES do deploy do admin — o código
-- novo escreve nesta tabela. Sem ela, a captura falha em silêncio
-- (best-effort, não parte a sugestão), mas não se aprende nada.
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- colar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS suggestion_edits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Contexto (nullable: leads não têm encomenda; conversas apagadas
  -- não devem levar o par com elas).
  conversation_id     UUID REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  order_id            TEXT,

  -- A instrução que a Maria escreveu ("diz que sim mas só em Setembro"),
  -- quando escreveu alguma. Ajuda a análise a perceber a intenção.
  instruction         TEXT,

  -- O par que interessa.
  suggestion_original TEXT NOT NULL,
  suggestion_final    TEXT NOT NULL,

  -- true = ela mexeu no texto antes de usar. Calculado na app (compara
  -- depois de normalizar espaços), guardado aqui para a análise poder
  -- filtrar sem reprocessar tudo.
  edited              BOOLEAN NOT NULL,

  -- 'copiar' | 'whatsapp' — por onde saiu. Se um dos caminhos gerar
  -- muito mais edições que o outro, é sinal de UX a corrigir.
  used_via            TEXT NOT NULL DEFAULT 'copiar'
                      CHECK (used_via IN ('copiar', 'whatsapp')),

  language            TEXT,
  model               TEXT,
  caller_email        TEXT,

  -- Marcado quando o par já entrou numa análise, para não voltar a
  -- pesar nas seguintes e não propor a mesma regra duas vezes.
  analysed_at         TIMESTAMPTZ
);

COMMENT ON TABLE suggestion_edits IS
  'Pares sugestão-gerada / texto-realmente-usado do assistente do WhatsApp. Capturados em silêncio ao copiar ou abrir no WhatsApp. Alimentam a análise de voz no Cérebro do Claude. Retenção: 180 dias (cron diário).';

COMMENT ON COLUMN suggestion_edits.edited IS
  'true = a Maria mexeu no texto antes de usar. Pares não editados também se guardam: dizem o que já está bom.';

-- Análise lê os não-analisados por ordem de chegada; retenção apaga
-- por data. Um índice serve os dois.
CREATE INDEX IF NOT EXISTS suggestion_edits_created_idx
  ON suggestion_edits (created_at DESC);

CREATE INDEX IF NOT EXISTS suggestion_edits_pendentes_idx
  ON suggestion_edits (created_at DESC)
  WHERE analysed_at IS NULL;

ALTER TABLE suggestion_edits ENABLE ROW LEVEL SECURITY;

-- Só admins. A Ana (viewer) não usa o assistente nem vê a análise;
-- funções da mig 085, nunca emails hardcoded.
DROP POLICY IF EXISTS "suggestion_edits_admins_read" ON suggestion_edits;
CREATE POLICY "suggestion_edits_admins_read" ON suggestion_edits FOR SELECT
  TO authenticated
  USING (is_team_admin(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "suggestion_edits_admins_update" ON suggestion_edits;
CREATE POLICY "suggestion_edits_admins_update" ON suggestion_edits FOR UPDATE
  TO authenticated
  USING (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

-- GRANTs explícitos (tabela nova, ver cabeçalho).
-- authenticated: SELECT para a página da análise, UPDATE para marcar
-- os pares como analisados. O INSERT vai pelo service_role na rota.
GRANT SELECT, UPDATE ON suggestion_edits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON suggestion_edits TO service_role;

COMMIT;

-- ============================================================
-- Regras de voz aprovadas pela Maria (chave nova em system_settings)
-- ============================================================
-- As regras que ela aceitar na análise vivem aqui e entram no prompt
-- a seguir à persona. Separadas de `claude_persona` de propósito: a
-- persona é escrita por ela, isto é aprendido do uso — e assim pode
-- limpar um sem perder o outro.

INSERT INTO system_settings (key, value)
VALUES ('claude_voice_rules', '')
ON CONFLICT (key) DO NOTHING;

-- ── Verificação (correr depois, no SQL Editor) ──────────────
-- 1. Tabela + colunas:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'suggestion_edits' ORDER BY ordinal_position;
--
-- 2. GRANTs (devem aparecer authenticated e service_role):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_name = 'suggestion_edits' ORDER BY grantee, privilege_type;
--
-- 3. Chave nova das regras (deve devolver 1 linha, valor vazio):
-- SELECT key, value FROM system_settings WHERE key = 'claude_voice_rules';
