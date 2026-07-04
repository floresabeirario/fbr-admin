---
name: fechar-sessao
description: Ritual de fim de sessão do fbr-admin — preflight, actualizar/comprimir o PROGRESS.md, commit seguro (sessões paralelas) e lista de passos manuais para a Maria. Usar antes de terminar qualquer sessão de trabalho.
---

# Fechar sessão

Executa estes passos por ordem. Não saltes nenhum sem dizer porquê.

## 1. Preflight
- Se a sessão tocou em código: `npm run preflight` (tsc + vitest + build). Tem de passar.
- Corre `npx eslint` nos ficheiros alterados.
- Se houver páginas afectadas e não der para smoke local, escreve no PROGRESS.md o smoke
  exacto que a Maria deve fazer no browser antes de confiar no deploy.

## 2. Actualizar o PROGRESS.md
- A entrada da sessão actual segue o template compacto (máx ~15 linhas):
  **O quê / Ficheiros / Migrações + passos manuais / Smoke / Pendente**.
- Actualiza a secção "⚠️ Pendentes de confirmação da Maria" no topo: acrescenta os novos
  passos manuais desta sessão e remove os que ela confirmou entretanto.
- Actualiza "Próximo passo concreto" se a ordem mudou.
- **Compressão automática (sem pedir confirmação):** se há mais de 5 sessões em
  "Últimas sessões", move a(s) mais antiga(s) NA ÍNTEGRA para o `PROGRESS-ARQUIVO.md`
  (secção do topo do arquivo) e deixa no PROGRESS.md, no máximo, uma linha de referência.
- Alvo: PROGRESS.md abaixo de ~30 KB. Verifica com `wc -c PROGRESS.md`.

## 3. Commit seguro (sessões paralelas!)
- `git status --short` primeiro. Pode haver outra sessão Claude com trabalho a meio no
  mesmo working tree — committa SÓ os ficheiros desta sessão, nomeados um a um
  (nunca `git add -A` sem verificar).
- Nunca committar `.claude/settings.local.json` (está gitignored; se aparecer, algo está mal).
- Mensagem de commit curta em PT descrevendo o resultado, com
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Push para `origin master` só se a Maria pediu push/deploy OU se a sessão já vinha a
  pushar com autorização dela. **Se há migração nova por correr, avisa ANTES do push**
  quando o deploy depender dela (ordem: migração primeiro, deploy depois).

## 4. Relatório final para a Maria
Termina a resposta com uma lista curta e numerada:
1. O que ficou feito (uma linha por item).
2. **Passos manuais dela**, por ordem (migrações no SQL Editor, env vars, secrets, merges).
3. Smoke que ela deve fazer (páginas + o que confirmar).
