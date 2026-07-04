# FBR Admin — Estado do Projecto

> Lido no início de cada sessão; actualizado em tempo real durante a sessão.
> **Regras deste ficheiro:** máximo ~30 KB. Só as últimas 5 sessões ficam aqui, em formato compacto
> (template: O quê / Ficheiros / Migrações + passos manuais / Smoke / Pendente, máx ~15 linhas).
> Ao entrar a 6ª sessão, a mais antiga move-se **na íntegra** para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)
> (que NÃO é lido por defeito — todo o histórico das sessões 1-131 está lá). O detalhe fino vive nos commits do git.

---

## Onde estamos

**Fase 6 — Integrações + PWA + RGPD (em curso).** Última sessão: **133** (2026-07-04, auditoria de segurança + ecossistema com o Fable).

### ⚠️ Pendentes de confirmação da Maria (verificar antes de assumir)
- [ ] **Smoke sessão 133 (correcções de segurança já em produção):** login dos 3 perfis OK; aba WhatsApp abre e as imagens carregam (proxy passou a gated para /media|/suggest|/retry — só o /webhook é isento); confirmar que a Ana já NÃO edita Ideias nem Livro de Receitas (só Tarefas/Parcerias/Chat)
- [ ] **fbr-website:** as correcções M1/M2 estão no develop (commit 1cdc431) — entram quando fizeres o merge develop→main que já estava pendente
- [x] **Mig 091** corrida no Supabase ✅ (confirmado pela Maria, 04/07 — deploy das etiquetas WhatsApp desbloqueado)
- [ ] **Mig 089** (lembretes de tarefas) corrida? + secret **`CRON_SECRET`** criado no GitHub (repo fbr-admin → Settings → Secrets → Actions, mesmo valor da Vercel)?
- [ ] **Smoke sessão 131:** botão "Etiquetas" na aba WhatsApp (mudar cor/nome, criar nova, atribuir a conversa); ✓ cinza em vez de 📱 nas mensagens enviadas
- [ ] **Smoke sessão 130:** sino na sidebar da PWA no telemóvel → "Notificações ligadas" (só funciona em produção)
- [x] **fbr-website:** merge develop→main FEITO na sessão 133 (`711ca4b`) — segurança + sessão 126 (cookies/keywords/UltraVue) + perf em produção

### Próximo passo concreto
Roadmap aprovado (sessão 124, prioridades da Maria — [[project_prioridades_roadmap_124]]):
1. ~~Varrimento `formatDateTimeLisbon`~~ ✅ FEITO na 133 (todos os HH:mm sobre timestamptz; export-csv.ts fica, é server-only)
2. **Item 4 restante:** tipos gerados do Supabase no preflight (precisa do access token da Maria — por isso a 124 usou o schema-drift offline)
3. **Item 8:** vista "Hoje" no Dashboard (experimental, fácil de remover) + relatório mensal interno
4. **2c:** expurgar conversas WhatsApp do histórico git (sessão DEDICADA: filter-repo + force push, coordenar com sessões paralelas)
5. **Motor de cadência de comunicação** (sessão 104): lembretes internos de follow-up por fase da encomenda (nunca envia ao cliente — só lembra a equipa). Melhor começar por desenhar a spec.

---

### Fases do projecto
- [x] **Fase 1** — Fundação: Supabase ligado, autenticação, layout/navegação ✅
- [x] **Fase 2** — Preservação de Flores: tabela, workbench, estados, orçamento, permissões ✅
- [x] **Fase 3** — Vale-Presente (admin + site público `voucher.floresabeirario.pt`) + Status ✅
- [x] **Fase 4** — Dashboard + Tarefas + Métricas ✅
- [x] **Fase 5** — Formulários públicos + Parcerias ✅
- [x] **Fase 5.5** — Afinações pós-uso ✅
- [~] **Fase 6** — Integrações + PWA + RGPD completo ← **EM CURSO**

---

## O que está feito (estado actual da plataforma)

- Next.js 16 + shadcn/ui + Supabase ligado, deploy em `admin.floresabeirario.pt`
- Login Netflix com fotos, **email+password** (António admin, MJ admin, Ana viewer); permissões admin/viewer em todas as abas; gate de equipa no proxy (sessão 124); policies centralizadas em `is_team_admin()`/`is_team_member()` (mig 085) + `TEAM` em [roles.ts](src/lib/auth/roles.ts) como fonte única no código
- **Preservação**: 4 vistas (Tabela / Cards / Calendário / Timeline), grupos colapsáveis, drag-and-drop, workbench 3 colunas (refactorizado na 128: orquestrador 436 linhas + 12 componentes em `_components/`), edição inline, alertas 40%/30%/aprovação, vistas/filtros/colunas guardáveis (sessão 95), detecção de clientes repetidos (avisa, nunca bloqueia), dark mode
- **Vale-Presente** admin + site público `voucher.floresabeirario.pt`
- **Status** admin + site público `status.floresabeirario.pt` (12 fases públicas PT/EN, data prevista auto +6m; redesign "Herbário" na 123)
- **Parcerias** completas (4 categorias, mapa Portugal, interações, acções, Nominatim) + Figuras Públicas
- **Dashboard** com afazeres globais em kanban GTD, recolhas/entregas, alertas; tarefas multi-assignee com lembretes data+hora
- **Métricas** + **Finanças** (6 sub-abas: Painel / P&L por encomenda / Catálogo / Despesas / Faturação / Competição; COGS tudo-ou-nada; helpers em [lib/finance.ts](src/lib/finance.ts))
- **Entregas e Recolhas** (agenda + mapa + notas) · **Livro de Receitas** · **Chat interno** (Realtime) · **Ideias** · **Healthchecks** (com monitorização de erros client-side, mig 086) · **Ecossistema**
- **Pesquisa global** Cmd+K em 5 tipos · **PWA** instalável (iOS + Android) com **notificações push internas** (sessão 130: na hora + diárias 7h + lembretes pontuais via GitHub Actions)
- **Integrações Google**: OAuth, pastas Drive auto ao 1º pagamento, Calendar, **Gmail no workbench** (só-leitura, sessão 105)
- **WhatsApp Cloud API** end-to-end (sessões 97-99): webhook, aba `/whatsapp` com avatares/vistos/etiquetas geríveis, media→Drive; registo manual por workbench também existe (sessão 65)
- **Assistente AI "Claude"** (Anthropic API, sessão 119 v2) + **Templates de mensagens** (29 PT+EN, picker com snippets/pesquisa, pares PT/EN na gestão)
- **RGPD**: exportação JSON+PDF, retenção 10 anos com anonimização, audit log UI
- **Backup diário da BD → Drive** (sessão 124: cron 05:00 UTC, 22 tabelas, rotação 14d + mensais + Janeiros; healthcheck próprio)
- **Forms públicos fechados de ponta a ponta** (mig 084 + service role no site; Turnstile server-side) · **CI** GitHub Actions corre `npm run preflight` · anti-drift tipos↔BD no preflight ([lib/schema-drift.ts](src/lib/schema-drift.ts))
- 91 migrações; 92 testes vitest; smoke Playwright (`npm run smoke`)

---

## Últimas sessões (detalhe compacto)

### Sessão 133 (2026-07-04) — Auditoria de segurança + ecossistema + correcções aplicadas
- **Auditoria (Fable):** 4 repos + RLS/GRANTs das 91 migrações + lógica financeira. **0 críticos, 3 moderados, 5 menores.** Relatório: https://claude.ai/code/artifact/eca9f339-da8e-4fa5-944d-e9a3fbc27403
- **Correcções aplicadas e EM PRODUÇÃO (admin `1114903` + voucher `37488f8` pushed):** m4 helper `isAuthorizedCron` timing-safe ([lib/auth/cron.ts](src/lib/auth/cron.ts)) nas 3 rotas de cron; m1 proxy só isenta `/api/whatsapp/webhook/` (media/suggest/retry voltam ao gate, têm auth própria); m3 callback Google não põe `detail` do erro no URL; **C1** Ideias + Livro de Receitas passam a `requireAdmin` (Maria confirmou: Ana edita só Tarefas/Parcerias/Chat — reverter = requireUser); m2 rate limit 30/min/IP no lookup de vales (fbr-voucher).
- **fbr-website (develop `1cdc431`, NÃO em produção — entra no merge pendente):** M1 `isVercelPreview` só aceita `fbr-website-*.vercel.app`; M2 `verifyTurnstile` fail-closed em produção + alarme no `monitor-forms` se `TURNSTILE_SECRET` sumir. **C2 confirmado:** `TURNSTILE_SECRET` existe em Production na Vercel do site (screenshot da Maria).
- **Não corrigido de propósito:** M3 webhook WhatsApp sem HMAC (limitação Dualhook, risco aceite — rodar path token 1x/ano); m5 CLAUDE.md diz "11 estados públicos" (são 13). Ver [[project_auditoria_133_pendentes]].
- **Ecossistema:** plataformas todas adequadas; Monday/Sheets/Excel eliminados. Recomendação a prazo: absorver fbr-tracking no fbr-website (lógica de fases duplicada, hoje em sincronia).
- **Ganhos pequenos (mesma sessão, admin `8c566bd`):** varrimento `formatDateTimeLisbon` completo (metricas/healthchecks/chat/audit/parcerias×2/receitas/painel; novos helpers `formatTimeLisbon` e `...WithSeconds`); CLAUDE.md 11→13 fases.
- **fbr-website merge→main `711ca4b` + perf `074b08a` (EM PRODUÇÃO):** correcções de segurança + sessão 126 foram live; **performance:** imagens de origem sobredimensionadas reduzidas 60MB→8MB (sharp, 1920px/q82 — [scripts/downsize-images.mjs](../fbr-website/fbr-website/scripts/downsize-images.mjs)) + removidos 5 vídeos mortos sem referências (~60MB). Causa da lentidão: fotos da equipa a 12MP/10MB e vídeos gigantes no deploy. **Preflight admin OK + build website OK.**

### Sessão 132 (2026-07-04) — Arrumação do workflow (sem código da plataforma)
- **O quê:** PROGRESS.md 180 KB→compacto (histórico integral movido para [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)); secções "Próximas frentes"/"Ideias" dessincronizadas actualizadas (Gmail/WhatsApp/AI/push/backup/filtros já estavam FEITOS); permissões duráveis em [.claude/settings.json](.claude/settings.json) e `settings.local.json` esvaziado + gitignored (estava tracked com 60 KB de histórico); CLAUDE.md corrigido (login é password, não Google OAuth) + secção "Como trabalhar neste repo"; skills novas `/fechar-sessao` e `/nova-migracao` em `.claude/skills/`; memórias do PROGRESS fundidas.
- **Limpeza de ficheiros:** `public/` só pode ter o que é para servir — saíram para `_privado/` (gitignored): `plataforma admin.pdf` (a spec interna estava **servida publicamente** no deploy!), 1 extracção .txt (a duplicada foi apagada) e o xlsx do GSC de 26/05; apagados os 5 SVGs boilerplate do create-next-app (sem referências). ⚠️ Estes ficheiros continuam no **histórico** do git — a sessão de expurgo (item 2c, filter-repo) deve removê-los junto com as conversas WhatsApp.
- **Migrações:** nenhuma. **Smoke:** n/a (só ficheiros de processo; zero código tocado).

### Sessão 131 (2026-07-04) — WhatsApp: avatares, etiquetas geríveis, vistos
- **O quê:** aba `/whatsapp` com layout à WhatsApp mas cores da marca. **Avatares** (iniciais + cor determinística; foto do quadro da encomenda ligada como foto de perfil — match últimos 9 dígitos do telefone, `toEmbeddableImageUrl`, fallback com `onError`). **Vistos** ✓/✓✓/✓✓ azul (o antigo 📱 passou a ✓ cinza "enviada"). **Etiquetas:** de 3 fixas evoluiu para sistema gerível pela Maria — recolorir/renomear/criar (paleta pronta de 14 cores, classes Tailwind literais), definições em `system_settings["whatsapp_labels"]`; etiquetas automáticas Cliente/Lead/Cancelado derivadas do estado da encomenda ligada (prioridade cliente>lead>cancelado; sem encomenda → sem chip; "Cancelado" nunca é gravado), manual sobrepõe.
- **Ficheiros:** [whatsapp-client.tsx](src/app/(admin)/whatsapp/whatsapp-client.tsx), [page.tsx](src/app/(admin)/whatsapp/page.tsx), [actions.ts](src/app/(admin)/whatsapp/actions.ts), novo [lib/whatsapp/labels.ts](src/lib/whatsapp/labels.ts). Removidos 2 NUL bytes pré-existentes no `NotesArea` (faziam o grep tratar o ficheiro como binário).
- **Migrações:** [090](supabase/migrations/090_whatsapp_category.sql) (corrida) + [091](supabase/migrations/091_whatsapp_category_freeform.sql) (**correr ANTES do deploy** — drop do CHECK).
- **Limitação Meta (não insistir):** a Cloud API NÃO dá fotos de perfil, labels do Business nem vistos de mensagens enviadas pelo telemóvel — [[project_whatsapp_cloud_api_limits]].
- **Commits:** bc73f8e, 55a098f, bdbf9c7, 35391ce, 2463ea4. Preflight + lint OK.
- **Smoke (Maria):** gerir etiquetas (cor/nome/nova), atribuir a conversa, chips na lista, ✓ nas enviadas.

### Sessão 130 (2026-07-03) — Notificações push internas da PWA
- **O quê:** Web Push + VAPID próprio (sem serviço externo). **Na hora:** 🌸 nova encomenda do form (admins), ✅ tarefa atribuída (ao próprio), 📅 data de entrega das flores preenchida, 💬 WhatsApp de cliente recebido (SÓ António, colapsado por conversa), 🎁 novo vale-presente. **Diárias (cron 7h, 1 push por evento — Maria recusou digest):** 📦 recolha amanhã, 💐 flores amanhã/em mãos, 🧊 congelador 120h completas, 🚑 healthcheck→vermelho, prazos de tarefa (3d e 1d antes, aos assignees). **Lembrete pontual data+hora** em tarefas (`tasks.reminder_at`, badge 🔔): GitHub Actions [reminders.yml](.github/workflows/reminders.yml) toca em [/api/cron/reminders](src/app/api/cron/reminders/route.ts) de 10/10min (marca `reminder_sent_at` ANTES de enviar; editar data repõe NULL).
- **Ficheiros-chave:** [lib/push/send.ts](src/lib/push/send.ts) + [daily.ts](src/lib/push/daily.ts) (lógica pura testável), [push-toggle.tsx](src/components/push-toggle.tsx) (sino na sidebar, por dispositivo), [sw.js](public/sw.js) v6, rotas `/api/internal/notify-order` + `notify-voucher` (Bearer `INTERNAL_NOTIFY_SECRET`, chamadas pelo fbr-website).
- **Migrações:** [088](supabase/migrations/088_push_subscriptions.sql) (corrida) + [089](supabase/migrations/089_task_reminders.sql) (ver pendentes no topo). Env: 4 VAPID_* (a NEXT_PUBLIC antes do build!) + INTERNAL_NOTIFY_SECRET nos 2 repos + CRON_SECRET no GitHub — [[project_push_notifications]].
- **Regra:** nada de envio automático a clientes — tudo interno [[feedback_nada_de_envio_automatico]]. 92 testes ✅. Só funciona em produção (SW).

### Sessão 129 (2026-07-03) — Fix React #418 (horas UTC no servidor vs Lisboa no browser)
- **O quê:** timestamptz formatados com date-fns `format(…HH:mm)` usam a hora da máquina → SSR em UTC ≠ browser em Lisboa → mismatch de hidratação #418 (apanhado pela monitorização de erros da 124; a página nunca partiu, o React recupera). Helper novo **`formatDateTimeLisbon`** em [format-date.ts](src/lib/format-date.ts) (Intl, sempre Europe/Lisbon, sem dependência nova), aplicado nos 5 sítios do workbench de Preservação. Commit c319638.
- **Pendente:** o mesmo padrão existe em metricas, healthchecks, financas/painel, chat, workbenches parcerias/figura, livro-receitas → é o passo 1 do "Próximo passo concreto" no topo.

> Sessões 127-128 movidas para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md) (secção "Sessões 126-131 — texto integral").

---

## Pendências externas (outros repos)

- **fbr-website** — develop com trabalho por fazer merge para main (sessão 126: cookies/keywords/UltraVue — Maria aprova o preview primeiro). Decisões em aberto da auditoria 122: aggregateRating? subtítulo no hero? data nas páginas legais? + vídeo `tracking.mp4` (Maria ainda não tem).
- **Relatório mensal de analytics (Clarity)** — recolha automática já corre (cron no fbr-website → `analytics_snapshots`); falta a compilação mensal + envio por email via Resend — [[project_website_analytics]].

---

## Próximas frentes (por ordem — ver "Próximo passo concreto" no topo)

- Varrimento `formatDateTimeLisbon` (129) → tipos gerados Supabase no preflight → vista "Hoje" + relatório mensal → expurgo WhatsApp do git (sessão dedicada) → cadência de comunicação (104)
- **Chat interno — media** (upload foto/vídeo/áudio; hoje só texto)
- **Mover Competição** de Finanças para Parcerias (decidir: sub-aba ou aba "Inteligência")
- View SQL `order_pnl` para exports/queries ad-hoc (nice-to-have)
- Outras ideias vivem na aba `/ideias` da plataforma

---

## Armadilhas conhecidas (anti-repetição)

- **timestamptz → sempre `formatDateTimeLisbon`** (nunca `format(…HH:mm)` do date-fns em componentes hidratados — React #418, sessão 129)
- **`useEffect+setState` viola ESLint** — usar "store info from previous renders" ([[feedback_react_set_state_in_effect]])
- **`useSyncExternalStore` snapshot** tem de devolver referência cacheada ou dá React #185 ([[feedback_useSyncExternalStore_pitfall]])
- **`INSERT...RETURNING` precisa de GRANT SELECT** — não só INSERT ([[feedback_supabase_rls_pitfalls]]); tabelas novas precisam de GRANT explícito ([[project_supabase_public_grants_2026]])
- **`CREATE TABLE IF NOT EXISTS` é silencioso** se a tabela existe — usar `ALTER TABLE` em migrações subsequentes
- **Migrações no repo ≠ aplicadas em produção** — é a Maria que as corre no SQL Editor; verificar antes de depender ([[feedback_migracoes_supabase_aplicadas]])
- **Vercel não auto-redeploya** ao mudar env vars — forçar; `NEXT_PUBLIC_*` só entra no build seguinte
- **Nada entra em `public/`** que não seja para servir na app (tudo aí é público no deploy)
- **Sessões paralelas** no mesmo working tree — `git status` antes de commitar ([[project_parallel_sessions_worktree]])
- **base-ui (não Radix):** `PopoverTrigger` sem `asChild` — o Trigger já é `<button>`
- **Smoke test obrigatório** antes de fechar sessões que mexem em páginas críticas ([[feedback_smoke_test_obrigatorio]])
