---
name: nova-migracao
description: Criar uma migração Supabase nova no fbr-admin sem colisões de numeração e sem esquecer GRANTs/RLS/registo no PROGRESS.md. Usar sempre que for preciso mexer no schema da base de dados.
---

# Nova migração Supabase

## 1. Número sem colisão
- `ls supabase/migrations/ | sort | tail -5` para ver o último número.
- **Sessões paralelas:** verifica também `git status` — outra sessão pode ter uma migração
  não commitada com o número seguinte. Se houver risco, salta um número e diz porquê.
- Nome: `NNN_descricao_curta.sql` (snake_case, PT sem acentos).

## 2. Regras de conteúdo (armadilhas conhecidas)
- **GRANTs explícitos** para tabelas novas: `GRANT` a `authenticated` E `service_role`
  conforme o uso (a partir de 30/10/2026 o Supabase não dá grants por defeito em `public`).
  Lição das migs 062/065/068/081: o service_role esquecido dá healthcheck vermelho.
- **RLS:** usar `is_team_admin()`/`is_team_member()` (mig 085) — NUNCA emails hardcoded.
- **`INSERT...RETURNING` precisa de GRANT SELECT**, não só INSERT.
- **`CREATE TABLE IF NOT EXISTS` é silencioso** se a tabela já existe — para alterar tabelas
  existentes usa `ALTER TABLE`.
- Migração idempotente sempre que possível (`IF NOT EXISTS`, `DROP ... IF EXISTS` antes de recriar).
- No fim do ficheiro, deixa em comentário 1-3 queries de verificação que a Maria pode correr.

## 3. Sincronizar o código
- Actualiza os tipos em `src/types/database.ts` (o teste anti-drift do preflight
  [lib/schema-drift.ts] falha se um campo TS não existir nas migrações — e vice-versa apanha fantasmas).
- Se a migração muda colunas que o código já selecciona, pensa na **ordem de deploy**:
  se o select novo precisa da coluna nova, a migração tem de correr ANTES do deploy
  (e escreve isso explicitamente no PROGRESS.md).

## 4. Registar
- A migração NÃO está aplicada só porque o ficheiro existe — **é a Maria que a corre no
  SQL Editor do Supabase**. Acrescenta-a a "⚠️ Pendentes de confirmação da Maria" no
  PROGRESS.md com a ordem correcta (antes/depois do deploy) e as queries de verificação.
