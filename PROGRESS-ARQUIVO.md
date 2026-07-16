# FBR Admin — Arquivo do PROGRESS.md

> Histórico integral das sessões antigas, movido do `PROGRESS.md` na sessão 132 (2026-07-04).
> O `PROGRESS.md` principal guarda só o estado actual + as últimas 5 sessões em formato compacto.
> **Este ficheiro NÃO é lido no início das sessões** — consulta-o apenas quando precisares do detalhe de uma sessão antiga.
> Nota: os blocos `<!-- comentados -->` lêem-se melhor em vista raw (o preview de Markdown esconde-os).

---

## Sessões 126-131 — texto integral original (formato mega-parágrafo)

### Sessão 129 (2026-07-03) — Fix React #418 (horas UTC no servidor vs Lisboa no browser)
- **O quê:** timestamptz formatados com date-fns `format(…HH:mm)` usam a hora da máquina → SSR em UTC ≠ browser em Lisboa → mismatch de hidratação #418 (apanhado pela monitorização de erros da 124; a página nunca partiu, o React recupera). Helper novo **`formatDateTimeLisbon`** em [format-date.ts](src/lib/format-date.ts) (Intl, sempre Europe/Lisbon, sem dependência nova), aplicado nos 5 sítios do workbench de Preservação. Commit c319638.
- **Pendente:** o mesmo padrão existe em metricas, healthchecks, financas/painel, chat, workbenches parcerias/figura, livro-receitas → foi tratado depois (varrimento `formatDateTimeLisbon` FEITO na sessão 133).

## Fase actual: FASE 6 (parte 75) — Sessão 131: **Aba WhatsApp mais parecida com a app real — avatares com foto de perfil** (2026-07-04). A Maria pediu que a aba `/whatsapp` ficasse "praticamente igual" ao WhatsApp real e perguntou se dava para ter as **fotos de perfil** de cada conversa. **Esclarecido (importante):** a **WhatsApp Cloud API da Meta NÃO expõe a foto de perfil dos contactos** (privacidade) — não há forma de as ir buscar, nem no telemóvel nem na plataforma; só temos nome, número e mensagens. Decisão dela (AskUserQuestion): **layout/sensação do WhatsApp MAS cores da marca** creme/cocoa (não o verde + doodles). **Implementado:** componente `Avatar` (círculo com iniciais + cor determinística pelo número via `avatarColor`/`AVATAR_COLORS` — paleta escolhida para assentar no creme/cocoa; ícone `User` quando sem nome) na **lista de conversas** (44px, linha reestruturada para flex com avatar) e no **cabeçalho da conversa** (40px). **Ideia da Maria, implementada:** conversa ligada a uma encomenda que tenha foto → usa a **foto principal do quadro (`orders.flowers_photo_url`)** como foto de perfil. Matching por **últimos 9 dígitos** do telefone (índice `tail→foto` no client, `convPhoto` memo; no viewer via `linkedOrders`→`avatarPhoto`; 1ª encomenda com foto ganha); URL do Drive convertido com `toEmbeddableImageUrl` (→ lh3.googleusercontent.com); `<img>` com `onError`→fallback para iniciais (reset do erro no render quando a foto muda). Ficheiros: [whatsapp-client.tsx](src/app/(admin)/whatsapp/whatsapp-client.tsx) e [page.tsx](src/app/(admin)/whatsapp/page.tsx) (`flowers_photo_url` acrescentado à query dos orders + tipo `OrderLite`). **tsc + eslint limpos** nos 2 ficheiros. Sem migração. Commit **bc73f8e** pushed para master. **PARTE 2 (mesma sessão — categorias + vistos):** a Maria pediu também as **categorias/etiquetas** que põe no telemóvel (CLIENTE 🌸🖼️ / LEAD / OPERACIONAL) e reparou que **não tem os vistos** das mensagens. Esclarecido: as **labels do WhatsApp Business NÃO são expostas pela Cloud API** (tal como as fotos de perfil) — não há sync do telemóvel. Decisão dela (AskUserQuestion): **automático + manual**, com a regra que ela deu: **Lead = pré-reservas e outros; Cliente = reservas e por aí adiante**. Implementado: **[mig 090](supabase/migrations/090_whatsapp_category.sql)** (coluna `whatsapp_conversations.category` TEXT nullable, CHECK cliente/lead/operacional; **NULL = automático**; sem GRANT novo — a 061/062 deram GRANT ao nível da tabela); tipo `WhatsappConversation.category` + coluna no select do [page.tsx](src/app/(admin)/whatsapp/page.tsx); action `setConversationCategoryAction` (requireAdmin) em [actions.ts](src/app/(admin)/whatsapp/actions.ts). No [whatsapp-client.tsx](src/app/(admin)/whatsapp/whatsapp-client.tsx): **derivação automática** = cliente se alguma encomenda ligada (match últimos-9) está em `entrega_agendada` ou depois via `isStatusAtOrAfter` (types/database), senão lead; categoria efetiva = `category ?? auto`. `CategoryChip` (cliente verde / lead âmbar / operacional azul) na **lista** (por baixo do preview) e `CategoryPicker` (Popover base-ui — **sem `asChild`, o Trigger já é `<button>`**) no **cabeçalho** com opções Cliente/Lead/Operacional/Automático; `handleSetCategory` optimista no estado local + persiste. **Vistos:** o 📱 (fallback quando a Meta não manda status — típico das mensagens enviadas pelo telemóvel, que a Cloud API muitas vezes não reporta) passou a **✓ cinza discreto ("enviada")**, à WhatsApp; ✓✓ cinza=entregue, ✓✓ azul=lida (quando chegam), ⚠=falhou. **tsc (projeto todo) + eslint limpos.** **⚠️ NÃO committed/pushed nem smoke-tested. PASSO DA MARIA: correr a [mig 090](supabase/migrations/090_whatsapp_category.sql) no Supabase SQL Editor ANTES do deploy** — o select passou a pedir a coluna `category`; se a mig não correr primeiro, a aba `/whatsapp` fica sem conversas (erro na query). Smoke: chips na lista, mudar categoria no cabeçalho (Operacional para o Tons/fornecedores), ✓ em vez de 📱 nas mensagens enviadas. Commit **55a098f** pushed (mig 090 corrida pela Maria). **FIX (a Maria: "tudo o que não é cliente está como lead, não é suposto"):** o automático estava a marcar **Lead** também em conversas SEM encomenda nenhuma (fornecedores/contactos). Corrigido: `autoCategoryFromOrders` e `convAutoCategory` **só inferem quando há encomenda ligada** (cliente se reserva+, lead se pré-reserva); sem encomenda → **null (sem chip)**, como no telemóvel. Lista só mostra chip quando há categoria; `CategoryPicker` mostra "+ etiqueta" (tracejado) quando não há e a linha Automático diz "(sem etiqueta)" quando `auto` é null. tsc + lint OK. Commit **bdbf9c7** pushed. **FIX 2 (a Maria: "as encomendas canceladas podem ter a tag cancelado?"):** encomenda cancelada aparecia como Lead. Nova categoria automática **Cancelado** (chip cinza cream-200/cocoa-500), derivada de `status === "cancelado"`; `orderAutoCategory` + `CATEGORY_PRIORITY` (cliente 3 > lead 2 > cancelado 1) para quando a pessoa tem várias encomendas (uma reserva activa ganha ao cancelamento). "Cancelado" é **só automático/exibição — nunca gravado** (tipo `StoredCategory = Exclude<Category,"cancelado">` para o que vai à BD; fica fora do `CATEGORY_ORDER` do seletor manual e do CHECK da mig 090, por isso **sem migração nova**). tsc + lint OK. Commit **35391ce** pushed. **PARTE 3 — etiquetas GERÍVEIS (a Maria: "quero escolher as cores nas etiquetas e nas etiquetas futuras"):** passou de 4 categorias fixas no código para um sistema de etiquetas que ela gere (recolorir/renomear + criar novas). Escolha dela (AskUserQuestion): **paleta pronta** (não roda de cores livre). **Arquitectura:** nova lib [lib/whatsapp/labels.ts](src/lib/whatsapp/labels.ts) (tipos `WhatsappLabel {key,name,color,auto?}`, `LABEL_PALETTE` de 14 cores com classes Tailwind **literais** [JIT gera-as], `PALETTE_ORDER`, `AUTO_LABEL_KEYS=cliente/lead/cancelado`, `DEFAULT_WHATSAPP_LABELS`, `normalizeLabels` [sanitiza + garante as 3 auto sempre presentes no início], `parseLabelsJson`, `resolveLabel` [fallback neutro se key apagada], `newLabelKey` [key opaca estável — renomear não parte referências]). Definições guardadas em **system_settings["whatsapp_labels"]** (JSON; admins escrevem via política `system_settings_admins_all` da mig 085, membros lêem). **[mig 091](supabase/migrations/091_whatsapp_category_freeform.sql):** DROP do CHECK da 090 → `category` passa a guardar qualquer key de etiqueta (validação na app); tipo `WhatsappConversation.category` agora `string|null`. Actions novas em [actions.ts](src/app/(admin)/whatsapp/actions.ts): `saveWhatsappLabelsAction` (requireAdmin, normaliza+upsert, devolve limpo) e `getWhatsappLabels`; [page.tsx](src/app/(admin)/whatsapp/page.tsx) lê as etiquetas e passa `initialLabels`. No [whatsapp-client.tsx](src/app/(admin)/whatsapp/whatsapp-client.tsx): estado `labels`+`labelByKey`; `LabelChip` (cor da paleta), `CategoryPicker` agora lista TODAS as etiquetas + "Automático", `LabelsManager` (Dialog: renomear via input, recolorir via swatches `PALETTE_ORDER`, adicionar/apagar — auto não se apaga; botão "Etiquetas" 🏷 no cabeçalho da lista). Auto derivação por **key** (`orderAutoKey`/`autoKeyFromOrders`/`convAutoKey`, prioridade cliente>lead>cancelado) mantém-se. **Nota:** ao limpar, encontrei e removi **2 NUL bytes pré-existentes** nos template literals do `NotesArea` (`${conversationId}\0${initialNotes}` → espaço; eram invisíveis, o build tolerava-os, mas faziam o grep tratar o ficheiro como binário). **Preflight: tsc + eslint + `next build` OK.** **⚠️ NÃO committed/pushed. PASSO DA MARIA: correr a [mig 091](supabase/migrations/091_whatsapp_category_freeform.sql) ANTES do deploy** (senão gravar uma etiqueta nova viola o CHECK antigo). Smoke: botão "Etiquetas" → mudar cor/nome, criar nova; atribuí-la a uma conversa; as auto (Cliente/Lead/Cancelado) continuam sozinhas mas recoloríveis.

## Fase anterior: FASE 6 (parte 74) — Sessão 130: **Notificações push internas da PWA (item 2 do roadmap 124)** (2026-07-03). Avisos no telemóvel dos 3 utilizadores mesmo com a **app fechada**, via Web Push + VAPID (**sem serviço externo**, sem custo — chaves próprias). **Conjunto decidido com a Maria** (ela mudou o que eu propus: TIROU o WhatsApp, acrescentou logística das flores): **na hora →** 🌸 nova encomenda do form (admins), ✅ tarefa atribuída a ti (à pessoa atribuída — é aqui que a Ana entra), 📅 data de entrega das flores preenchida numa encomenda (admins); **diárias pelo cron das 7h (1 push por evento, não um resumo agrupado — ela recusou o digest) →** 📦 recolha amanhã (admins), 💐 flores a chegar amanhã / entrega em mãos (admins), 🧊 flores no congelador há **5 dias COMPLETOS = 120h** (admins; pedido explícito dela), 🚑 healthcheck a vermelho (admins, só na transição para vermelho). **Nada de envio automático a clientes — tudo interno** [[feedback-nada-de-envio-automatico]]. **Arquitectura:** [mig 088](supabase/migrations/088_push_subscriptions.sql) (`push_subscriptions` [endpoint único por dispositivo + chaves p256dh/auth; RLS: cada um gere as SUAS via is_team_member da mig 085; GRANT service_role] + `push_dedup` [chaves de aviso já enviado, anti-repetição das notificações diárias; só service_role]); `web-push` instalado + script [`npm run generate-vapid`](scripts/generate-vapid.mjs); [lib/push/send.ts](src/lib/push/send.ts) (`server-only`; configura VAPID; `sendPushToEmails`/`sendPushToAdmins`; **poda subs expiradas 404/410**; `claimDedupKey`); [lib/push/daily.ts](src/lib/push/daily.ts) (lógica **pura testável** — `computeDailyPushItems`, `tomorrowLisbonYMD`; congelador 120h por milissegundos, recolha/flores "amanhã" em hora de Lisboa; **CTT das flores fica de fora de propósito** — sem data de chegada fiável); [push-actions.ts](src/app/(admin)/push-actions.ts) (guardar/remover subscrição, sessão do próprio); [push-toggle.tsx](src/components/push-toggle.tsx) (sino na sidebar — desktop + mobile — liga/desliga NESTE dispositivo; pede permissão, subscreve, mostra estado; esconde-se se não suportado); [public/sw.js](public/sw.js) ganha handlers `push` + `notificationclick` (**bump v5→v6**). **Gatilhos:** nova encomenda → rota [/api/internal/notify-order](src/app/api/internal/notify-order/route.ts) (Bearer `INTERNAL_NOTIFY_SECRET`, fora do gate no [proxy.ts](src/proxy.ts)) chamada pelo **fbr-website** logo a seguir ao email Resend que já existia ([reservar-preservacao/route.js](../fbr-website/fbr-website/app/api/reservar-preservacao/route.js), fire-and-forget); tarefa atribuída → `notifyTaskAssignees` em [(admin)/actions.ts](src/app/(admin)/actions.ts) (createTask + updateTask; só avisa quem é NOVO na tarefa, nunca o próprio que atribuiu; via `after`); data de entrega das flores → [preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts) (NULL→valor em pickup_date OU hand_delivery_date, via `after`); diárias + healthcheck-vermelho → dentro do cron [healthcheck/route.ts](src/app/api/cron/healthcheck/route.ts) (**sem cron novo** — plano Hobby só permite 2, já usados; lê o estado anterior para só avisar na transição para vermelho; limpa push_dedup >60 dias). Helper novo `formatDatePT` em [format-date.ts](src/lib/format-date.ts). **+11 testes** de daily.ts (**85 no total ✅**). **Preflight completo OK** (tsc + 85 testes + next build) **+ eslint limpo** nos ficheiros novos. **⚠️ PASSOS MANUAIS DA MARIA (por ordem):** (1) `npm run generate-vapid` → copiar as 4 linhas; (2) no **fbr-admin** (Vercel **E** .env.local) meter `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` — **a NEXT_PUBLIC tem de estar ANTES do build** (é embutida no bundle); (3) gerar um segredo aleatório e pô-lo como `INTERNAL_NOTIFY_SECRET` **no fbr-admin E no fbr-website** (mesmo valor); (4) correr a **mig 088** no Supabase SQL Editor; (5) **push do fbr-admin primeiro**, depois deploy do fbr-website (se o site chamar antes do endpoint existir, falha em silêncio — sem quebra); (6) **smoke:** instalar/abrir a PWA no telemóvel, carregar no **sino** na sidebar → "Notificações ligadas", e testar (nota: **só funciona em produção** — o service worker só regista em prod; iOS exige a PWA adicionada ao ecrã principal). **Nota sessões paralelas** [[project-parallel-sessions-worktree]]: ficheiros partilhados tocados — `package.json`, `sw.js`, `proxy.ts`, `layout.tsx`, `format-date.ts`, `(admin)/actions.ts`, `preservacao/actions.ts`, `healthcheck/route.ts`, `ecossistema/page.tsx`; cuidado ao commitar. **Restante do roadmap 124:** 2c (expurgar conversas WhatsApp do histórico git, sessão dedicada); item 4 (tipos gerados do Supabase no preflight); item 8 (vista "Hoje", relatório mensal); retomar cadência de comunicação (sessão 104); + o PENDENTE da 129 (varrer `format(…HH:mm)` sobre timestamptz com `formatDateTimeLisbon` nas outras páginas). **PARTE 2 (mais 3 notificações pedidas pela Maria, mesma sessão — commits/deploy feitos, mig 088 já corrida, sem env vars novas):** (a) **prazo de tarefa** → aviso **3 dias e 1 dia antes** do `due_date`, à(s) pessoa(s) atribuída(s) (tarefa sem responsável cai para admins); `computeTaskDeadlineItems` em [daily.ts](src/lib/push/daily.ts) (corre no mesmo cron das 7h), `DailyPushItem` ganhou `recipients?` (task→assignees; resto→admins, tratado no loop do cron). (b) **WhatsApp de cliente → SÓ ao António** (ela pediu; email derivado do TEAM, não hardcodado): no [webhook](src/app/api/whatsapp/webhook/[token]/route.ts) push por mensagem **recebida** (não ecos nem reações), `tag` por conversa (uma rajada colapsa numa notificação). (c) **nova submissão de vale-presente** → admins, rota [/api/internal/notify-voucher](src/app/api/internal/notify-voucher/route.ts) chamada pelo site em [vale-presente/route.js](../fbr-website/fbr-website/app/api/vale-presente/route.js) (espelha a de encomenda). **+5 testes (90 total ✅), preflight + lint OK.** **EM DISCUSSÃO / NÃO feito:** lembrete de tarefa com **data+hora exactas** ("lembra-me amanhã às 15h") — precisa de decisão de infra porque o cron do plano **Hobby só corre 1×/dia** (não dá granularidade horária); opções a decidir com a Maria: lembrete só de manhã (7h) no dia escolhido (grátis) / cron externo GitHub Actions ~10min (grátis, ~10min de atraso) / Vercel Pro (crons ao minuto, custa). **PARTE 3 (a Maria escolheu "hora certa, grátis" → lembrete pontual "lembra-me a esta data/hora"):** campo **data+hora** ao criar/editar tarefa em [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx) (input `datetime-local` + botão limpar + badge 🔔 violeta no cartão, riscado quando já enviado), guardado em `tasks.reminder_at` ([mig 089](supabase/migrations/089_task_reminders.sql), + `reminder_sent_at`). Como o cron do Hobby só corre 1×/dia, o disparo vem de um **GitHub Actions** [reminders.yml](.github/workflows/reminders.yml) que toca em [/api/cron/reminders](src/app/api/cron/reminders/route.ts) **de 10 em 10 min** (best-effort, pode atrasar ~10min; valida CRON_SECRET). O endpoint marca `reminder_sent_at` ANTES de enviar (com guarda de corrida `.is(reminder_sent_at,null)`) — prefere perder 1 lembrete a martelá-lo. Vai à(s) pessoa(s) da tarefa (sem responsável → admins); `reminderItemFor` em [daily.ts](src/lib/push/daily.ts). Ao editar, [updateTaskAction](src/app/(admin)/actions.ts) repõe `reminder_sent_at=NULL` se a data/hora mudar (comparação por **instante**, não string, porque o Postgres devolve o timestamptz noutro formato). Conversão `datetime-local`↔ISO + formatação **Lisbon-safe** em [format-helpers.ts](src/app/(admin)/_components/dashboard/format-helpers.ts) (evita o #418 da 129). +2 testes (**92 total ✅**), preflight + lint + build OK. **⚠️ PASSOS DA MARIA para o lembrete:** (1) correr a **[mig 089](supabase/migrations/089_task_reminders.sql)** no Supabase; (2) no **GitHub** (repo fbr-admin → Settings → Secrets and variables → Actions → New repository secret) criar **`CRON_SECRET`** com o **MESMO valor** que está na Vercel (senão o ticker leva 401); (3) o workflow começa a correr sozinho após o push (agenda só no branch default = master); testar à mão em Actions → "Lembretes de tarefas" → Run workflow.

## Fase anterior: FASE 6 (parte 73) — Sessão 129: **Fix mismatch de hidratação (React #418) no workbench de Preservação — horas formatadas em UTC no servidor vs Lisboa no cliente** (2026-07-03). O healthcheck "Erros na app (últimas 24h)" mostrava 3 erros; a query `SELECT * FROM client_errors ORDER BY at DESC` revelou 3× o **mesmo** `Minified React error #418` (mismatch de hidratação), todos em `/preservacao/[id]`, 3 encomendas, do login da Maria, em 3 cargas de página. **Causa:** timestamps `timestamptz` (`created_at`/`updated_at` no rodapé, `computed_at`/`captured_at` dos snapshots de orçamento, `freezer_in_at` do congelador) formatados com `format(parseISO(x), "…HH:mm")` do date-fns, que imprime na **hora da máquina**: servidor Vercel em **UTC**, browser da Maria em **Europe/Lisbon (UTC+1 no verão)** → o `HH:mm` desfasa 1h entre SSR e cliente → React deita a árvore fora (#418). Diagnóstico blindado: (a) só apareceu **agora** porque a monitorização de erros (mig 086, sessão 124) é nova — o bug era antigo e silencioso, o monitor fez exactamente o que devia; (b) **só 3 linhas** apesar de estar em todos os workbenches porque a hidratação só corre no carregamento COMPLETO (não nas setas prev/next = SPA nav) e o [error-reporter](src/components/error-reporter.tsx) faz dedupe da mesma mensagem → ~1 registo por refresh; (c) **sazonal** — no inverno Lisboa=UTC e não desfasaria; (d) a página **nunca partiu** (o React recupera re-renderizando no cliente → healthcheck a amarelo, não vermelho). **Fix:** helper novo `formatDateTimeLisbon` em [format-date.ts](src/lib/format-date.ts) que formata **sempre** em `Europe/Lisbon` via `Intl.DateTimeFormat` (igual no servidor e no cliente, **sem dependência nova** — o `date-fns-tz` não está instalado; date-fns v4). Aplicado nos 5 sítios de Preservação: [closing-cards.tsx](src/app/(admin)/preservacao/[id]/_components/closing-cards.tsx) (rodapé "Criada/Actualizada em" — o registado), [budget-badges.tsx](src/app/(admin)/preservacao/[id]/_components/budget-badges.tsx) (2 snapshots), [flowers-card.tsx](src/app/(admin)/preservacao/[id]/_components/flowers-card.tsx) (congelador), [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) (tooltip da listagem). Imports de `parseISO`/`pt` limpos onde ficaram por usar. **Preflight completo OK** (tsc + 74 testes + build) **+ eslint limpo** nos 5 ficheiros. Sem migração. **Commit c319638 pushed para master** (deploy Vercel; só os meus 5 ficheiros — `settings.local.json` deixado de fora). **Maria — smoke:** abrir um workbench de Preservação com **refresh (F5, não pelas setas)** + consola aberta (F12) → o `#418` já não aparece; o rodapé mostra a hora de Portugal (ex.: 10:44 em vez de 09:44). **PENDENTE (mesmo bug latente noutras páginas, NÃO registado nos erros — só o workbench de Preservação apareceu):** o mesmo padrão `format(…HH:mm)` sobre timestamptz existe em [metricas-client.tsx:377](src/app/(admin)/metricas/metricas-client.tsx), [healthchecks-client.tsx:141](src/app/(admin)/healthchecks/healthchecks-client.tsx), [financas/_tabs/painel-tab.tsx:220](src/app/(admin)/financas/_tabs/painel-tab.tsx) (usa `format(now,…)` com `new Date()` — verificar se é outro tipo de mismatch), [chat-client.tsx:142](src/app/(admin)/chat/chat-client.tsx), workbenches de [parcerias:122](src/app/(admin)/parcerias/[id]/workbench-client.tsx) e [figura:143](src/app/(admin)/parcerias/figura/[id]/workbench-client.tsx), [recipe-detail-client.tsx:42](src/app/(admin)/livro-receitas/[id]/recipe-detail-client.tsx). Varrer todas com `formatDateTimeLisbon` numa próxima passagem (a Maria adiou; ficheiros de possíveis sessões paralelas). Nota: [export-csv.ts:47](src/lib/export-csv.ts) tem o mesmo `format(…HH:mm)` mas corre só no servidor (sem hidratação) — mudar-lhe o fuso alteraria o output do CSV, deixar como está.

## Fase anterior: FASE 6 (parte 72) — Sessão 128: **Refactor do workbench de Preservação (item 5 do roadmap 124) — partir o workbench-client.tsx em componentes** (2026-07-03). Continuação do roadmap da sessão 124 (parte 6): o `workbench-client.tsx` de Preservação tinha **2473 linhas** (o maior ficheiro da app), difícil de navegar e arriscado de editar. Refactor no espírito do que foi feito às Finanças na sessão 114: **ZERO mudanças de comportamento**, só reorganização. **Resultado: [workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx) 2473 → 436 linhas** (orquestrador puro — mantém TODO o estado partilhado: autosave com debounce 900ms + merge de `pendingRef` durante o await, os 5 diálogos, as transições de estado/pagamento com efeitos em cadeia [40%→30%→data de entrega], o handler do parceiro que aplica vários campos numa transição). A apresentação saiu para **12 ficheiros novos em [_components/](src/app/(admin)/preservacao/[id]/_components/)** (juntam-se aos layout.tsx/fields.tsx/budget-badges.tsx/gmail-panel.tsx/wa-live-panel.tsx que já lá viviam): `shared.ts` (tipos `UpdateFn`/`ClientUpdateFn`, `DuplicateOrderInfo` [o page.tsx importa-o via re-export do workbench-client, mantido], `toDateInput`, e as derivações puras `computeEventFlags`/`computeInvoiceFlags`), `header.tsx` (header fixo + faixa de cliente repetido `DuplicatesBanner`), `comms-card.tsx` (Comunicações: contactos + popover de edição, picker de templates, tabs Gmail/WhatsApp), `gallery-cards.tsx` (Inventário + Galeria de inspiração), `hero.tsx` (foto + nome + atalhos Drive/Calendar + dados do evento; inclui os handlers de Drive/Calendar porque chamam Server Actions e mexem no `local` via `setLocal` passado do pai), `alerts.tsx` (fatura em falta + aprovação pendente), `flowers-card.tsx` (congelador, moldura, extras, peças extra), `shipping-card.tsx` (envio das flores + receção do quadro + prazo "Entregar até"), `origin-card.tsx` (como conheceu a FBR + notas), `finance-card.tsx` (orçamento, pagamento, acerto, faturas), `partnership-card.tsx` (parceiro + comissão; recebe `onPartnerChange` do pai), `closing-cards.tsx` (entrega e feedback, cupão 5%, rodapé de datas), `dialogs.tsx` (os 5 diálogos como componentes de apresentação; o ESTADO deles fica no orquestrador porque é aberto pelos handlers de status/pagamento). Constantes `EXTRA_OPTIONS`/`PAYMENT_COLORS` mudadas para junto do respectivo cartão. Padrão: cada cartão recebe `local`+`update`(+`clientUpdate` quando tem campos do cliente) e mantém o seu próprio estado de UI local (drafts de popovers, toggles mobile). **Preflight completo OK: tsc limpo + 74 testes ✅ + next build + eslint limpo.** Sem migração. **Nota sessão paralela** [[project-parallel-sessions-worktree]]: durante o refactor, outra sessão adicionou `isStatusAtOrAfter` em [types/database.ts](src/types/database.ts) e usou-a no `flowers-card.tsx` novo (congelador só aparece de "Flores na prensa" em diante) — alteração mantida, entra no preflight; **ao commitar, cuidado que `types/database.ts` e `flowers-card.tsx` são partilhados com a outra sessão** (o resto dos ficheiros são só meus). **Maria — smoke:** abrir uma encomenda em Preservação e confirmar que TUDO funciona igual (autosave a guardar ao editar; diálogos de pagamento / confirmação de campo do cliente / quadro recebido / arquivar; atalhos Drive e Calendar; faixa de cliente repetido; reordenação dos cartões em mobile). É pura reorganização, o comportamento é idêntico. **Restante do roadmap 124:** item 2 (notificações push internas, sessão própria — VAPID keys, tabela de subscrições, service worker); 2c (expurgar conversas WhatsApp do histórico git, sessão dedicada); item 4 restante (tipos gerados do Supabase no preflight); item 8 (vista "Hoje", relatório mensal); retomar cadência de comunicação (sessão 104).

## Fase anterior: FASE 6 (parte 71) — Sessão 127: **Templates — snippet+pesquisa no picker, vista emparelhada PT/EN na gestão, fix dialogs mobile** (2026-07-03). A Maria pediu reflexão sobre a experiência de gestão/sugestão de templates ("às vezes o título não explica bem o que é o texto"); das 9 opções apresentadas aprovou **1 (snippet), 4 (pesquisa) e 8 (pares PT/EN)**. **(1) Snippet no picker:** função nova `templateSnippet` em [lib/templates.ts](src/lib/templates.ts) (salta a linha de saudação `{saudacao} {nome} 🌷`/`Hello…`, igual em quase todos, e mostra a primeira frase ÚTIL, que é o que distingue); no [template-picker.tsx](src/components/template-picker.tsx) cada item mostra 2 linhas de snippet sob o título; `slugBase` passou a exportado. **(2) Pesquisa no picker:** campo no topo do popover filtra por nome E conteúdo mantendo a divisão Sugeridos/Todos; limpa ao fechar; popover 360→420px. **(3) Vista emparelhada PT/EN na gestão** ([templates-client.tsx](src/app/(admin)/comunicacoes/templates/templates-client.tsx)): sem filtro de idioma, cada template aparece lado a lado com a gémea do mesmo slug base (grid lg:grid-cols-2); quando falta a versão EN/PT, slot tracejado "Falta a versão X — criar a partir desta" abre o editor **pré-preenchido com o corpo/categoria/estados da gémea** e slug `base_idioma` (estado `creating`→`createInitial: Partial<MessageTemplate>`); ao editar, painel colapsável "Versão X (para comparar)" mostra o corpo da gémea. Com filtro de idioma activo a vista volta a linhas simples (pares fariam sempre um lado vazio). **(4) FIX MOBILE (screenshot da Maria: o dialog de preview do picker transbordava a margem direita do ecrã, texto e botão Copiar cortados):** causa = filhos do grid do DialogContent não encolhem (título comprido empurra a caixa para fora); fix nos DOIS dialogs (preview do picker + editor da gestão [[feedback-aplicar-padroes-em-areas-analogas]]): `min-w-0`+`break-words` no título com espaço para o X, `overflow-x-hidden` no conteúdo, rodapé empilha em coluna no telemóvel (`flex-col-reverse sm:flex-row`, desktop intocado [[feedback-desktop-prioridade]]), "Copiar para clipboard"→"Copiar". **Decisões da conversa:** opção 2 (preview por hover) DESCARTADA a favor da 3 (picker em dois painéis com pré-visualização ao vivo, estilo command palette) — mas a 3 só avança SE a Maria ainda sentir fricção após uns dias de uso; em reserva ficaram: contador de utilizações (a melhor aposta de gestão — dados reais para renomear/arquivar), pré-visualização com dados de exemplo no editor, convenção de títulos "situação: resposta", campo description (provavelmente desnecessário com o snippet). Preflight completo OK (tsc + testes + build) + lint. Sem migração. **Commit 69e4379 pushed para master** (deploy automático Vercel). **Maria — smoke:** workbench → "Inserir template" deve mostrar snippets sob os títulos + campo de pesquisa; Sistema→Templates → pares PT/EN lado a lado + slot "Falta a versão…"; **no telemóvel** abrir um template do picker → dialog todo dentro do ecrã com os botões empilhados. **Afinação pós-deploy (screenshot da Maria: vários snippets mostravam só "Bom dia, {nome}"):** o filtro só apanhava {saudacao}/Hello/Olá — saudações escritas à mão passavam; isGreetingLine nova em templates.ts (linha começa por fórmula de cumprimento E, sem variáveis/emojis/pontuação, sobra ≤20 chars; "Olá! O seu quadro já seguiu viagem" NÃO é filtrada) + 5 testes de templateSnippet (21 ✅). Commit **9f9323b pushed** — só os 2 ficheiros meus: havia uma **sessão paralela com trabalho a meio no working tree** (mig 086 client_errors, error-reporter, schema-drift, voucher.ts/export-csv.ts com erro de tsc temporário) [[project-parallel-sessions-worktree]]; preflight completo local impossível, validação delegada no CI (a árvore pushed não inclui o trabalho deles). **2ª afinação (screenshot: pós-venda mostrava "Olá {nome} 🌸"):** em JS o  falha depois de vogal acentuada (á não é word char) → "Olá" escapava ao GREETING_START; substituído por lookahead unicode (?=[sp{P}]|$) com flag u, commit pushed.

## Fase anterior: FASE 6 (parte 70) — Sessão 126: **Site — decisões da auditoria: keywords meta fora, VideoObject fora, UltraVue com dimensões, caixinha de cookies informativa** (2026-07-03). A Maria respondeu às perguntas em aberto da sessão 122: retirar keywords meta, remover VideoObject, UltraVue ok "vê lá no que mexes", e "caixa mini mini mini sobre os cookies" — com esclarecimento a meio: **o Elfsight aparece SEMPRE, não fica dependente do aceitar**. Tudo no repo fbr-website: (1) **meta keywords removida das 20 páginas + artigos do blog** (codemod; um  órfão do regex multiline do JS colou linhas em 21 ficheiros — reparado com (?!
)→CRLF; a `keywords` do schema BlogPosting foi REPOSTA porque é propriedade schema.org válida, não a meta tag); (2) **VideoObject removido** do schema da home (o vídeo vivia no Facebook, não estava na página — não rendia nada); (3) **imagem UltraVue** (ladoalado.webp, Opções+Emoldurar) passa de width/height 0 para **640×640 reais** + sizes correcto — visual igual, browser reserva o espaço (sem salto de layout); (4) **caixinha de cookies** ([components/CookieConsent.jsx](../fbr-website/fbr-website/components/CookieConsent.jsx), montada no layout): mini, canto inferior esquerdo, PT/EN, texto "Usamos cookies de terceiros apenas para mostrar as avaliações Google" + link privacidade + botão OK; guarda em localStorage ([_lib/consent.js](../fbr-website/fbr-website/app/_lib/consent.js), useSyncExternalStore com snapshot string [[feedback-useSyncExternalStore-pitfall]]) e não volta a aparecer; **apenas informativa** — a 1ª versão bloqueava o Elfsight até aceitar (RGPD estrito), a Maria preferiu widget sempre visível; os 2 widgets (home + bouquet-noiva) foram extraídos para [components/ElfsightReviews.jsx](../fbr-website/fbr-website/components/ElfsightReviews.jsx). Build + smoke em next start OK (keywords=0, VideoObject=0, widgets no HTML, páginas 200). **Git: develop 2365e8d pushed — SEM merge para main** (Maria quer aprovar o preview primeiro; nota: por cima do 56d162b "Forms escrevem com service role" de outra sessão paralela). **Pendentes:** vídeo tracking.mp4 (Maria ainda não tem); decisões que faltam da 122: aggregateRating? subtítulo no hero? data nas legais?; depois da aprovação do preview → merge develop→main. **Smoke para a Maria no preview:** caixinha aparece uma vez em janela anónima e some com OK; avaliações Google visíveis na home e bouquet-noiva SEM tocar na caixinha; Opções/Emoldurar sem salto na imagem do vidro.

---

## Resumos compactos movidos do PROGRESS.md (o texto integral destas sessões está acima)

### Sessão 128 (2026-07-03) — Refactor do workbench de Preservação
- **O quê:** [workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx) 2473→436 linhas (orquestrador puro: autosave debounce 900ms + `pendingRef`, 5 diálogos, transições de estado/pagamento em cadeia); apresentação em 12 componentes novos em [_components/](src/app/(admin)/preservacao/[id]/_components/) (header, hero, comms-card, flowers-card, shipping-card, finance-card, partnership-card, closing-cards, dialogs, …). Zero mudanças de comportamento. Padrão: cada cartão recebe `local`+`update

<!-- Sessão 125 (FASE 6 parte 69 — Picker de templates: "Sugeridos para esta fase" mostrava ~18 com contradições [tamanho escolhido+indeciso, funeral num casamento, vale sem vale, PT+EN duplicado]; causa = rankTemplatesForStatus em lib/templates.ts juntava fieldSuggestionBases com TODAS as templates de suggested_statuses sem filtro; fix 2 mecanismos [nada some, desce para "Todos"]: mapa RELEVANCIA_POR_CAMPOS [template só sugerida se os campos não a contradisserem] + soIdiomaPreferido [gémea no outro idioma desce para "Todos" quando se sabe form_language]; mesmo dedupe em rankTemplatesForLead; ~18→4 no caso da Melanie; +5 testes [58 total]; sem migração) comprimida. -->


<!-- Sessão 124 (FASE 6 parte 68 — Auditoria completa aprovada por item + várias entregas: BACKUP diário Drive [lib/backup.ts + backup-rotation.ts, cron 05:00 UTC no vercel.json, 22 tabelas paginadas→gzip para pasta "Backups da base de dados", rotação 14 diários + mensais 1 ano + Janeiros para sempre → lixo da Drive, healthcheck próprio, sem mig]; hardening [gate de equipa isTeamEmail no proxy/getVerifiedEmail/auth-callback, requireAdmin nas 4 whatsapp/actions, /api/whatsapp/media só serve ficheiros presentes na BD, FIX real de produção: upload de media do webhook falhava sempre à 1ª por correr como anon → oauth.ts/drive.ts aceitam client opcional], mig 083 gen_random_bytes nos generate_order_id/voucher_code, xlsx do GSC fora de public/ → _privado gitignored; CI .github/workflows/ci.yml corre preflight; item 2b — forms do fbr-website fechados de ponta a ponta [createFormsClient com SERVICE_ROLE, mig 084 REVOKE INSERT anon em orders/vouchers/audit_log + drop policies public_insert/select_recent — ordem crítica deploy site ANTES da mig; verificado em produção: health ok:true, sites 200, INSERT anon = 42501; commit site 88ca763]; item 3 — mig 085 ~35 policies em 22 tabelas centralizadas em is_team_admin()/is_team_member() [mig 046 adoptada, auto-contida idempotente] + parte TS: roles.ts ganha TEAM como fonte única, 5 consumidores derivam, zero emails hardcoded fora de roles.ts; item 8.5 — lib/duplicates.ts detecção de clientes repetidos [normalizeEmail/normalizePhone últimos-9-dígitos, avisa com faixa azul + chips NUNCA bloqueia [[feedback-duplicados-nao-bloquear]], em Preservação e Vale-Presente]; item 5a — lib/schema-drift.ts anti-drift tipos↔BD no preflight/CI [parse de migrações vs interfaces, apanhou campo FANTASMA Voucher.drive_folder_url usado no export-csv → removido]; item 5b — mig 086 monitorização de erros [tabela client_errors, error-reporter.tsx no layout, (admin)/error.tsx boundary, reportClientErrorAction best-effort, healthcheck "Erros na app (24h)", retenção 30 dias]. Migs 083/084/085/086 corridas pela Maria; signups do Supabase Auth desligados. Roadmap aprovado 5→2→4→1→3. Detalhe comprimido) -->

<!-- BLOCO 124 ORIGINAL (comprimido) — ## Fase anterior: FASE 6 (parte 68) — Sessão 124: **Auditoria completa da plataforma + BACKUP diário para a Drive + hardening (mig 083) + CI** (2026-07-02/03). A Maria pediu análise profissional completa (inconsistências arquitectónicas, riscos de segurança, gaps, decisões questionáveis, sugestões); relatório entregue no chat e aprovado por item: **2a-d go, 3 go, 4 "avança com tudo", 8 "faz como achares melhor"**; 7.2 ok. **(1) BACKUP DIÁRIO — o gap mais grave (a spec prometia "backup automático diário para Google Drive" e não existia uma linha):** [lib/backup.ts](src/lib/backup.ts) + [lib/backup-rotation.ts](src/lib/backup-rotation.ts) (funções puras testadas; separadas porque backup.ts tem `server-only` que rebenta no vitest) + rota [/api/cron/backup](src/app/api/cron/backup/route.ts) (CRON_SECRET, maxDuration 60) + cron **05:00 UTC** no [vercel.json](vercel.json) (2 crons = limite do plano Hobby). Exporta **22 tabelas** (todas menos `google_integration` — contém o refresh_token OAuth, um segredo; se se perder reconecta-se em /settings/google em 30s) com paginação de 1000 (limite PostgREST) e ordenação estável (`id`; system_settings→`key`, team_members→`email`), JSON→gzip, para a pasta Drive **"Backups da base de dados"** sob "FBR — Encomendas" (id cacheado em system_settings[backup_drive_folder_id], revalidado se apagarem a pasta); ficheiro `fbr-backup-YYYY-MM-DD.json.gz`, re-corrida no mesmo dia substitui. **Rotação aprovada pela Maria** ("backups diários infinitos não servem para nada"): últimos 14 dias diários + dia 1 de cada mês no último ano + 1 de Janeiro para sempre (~26 ficheiros estáveis, 50-150 MB no total); os que saem vão para o **lixo da Drive** (recuperáveis 30 dias), nunca delete definitivo; ficheiros com nomes fora do padrão nunca são tocados. Estado de cada corrida (ok/erro, tamanho, nº registos, rodados) em system_settings[backup_status]; **healthcheck novo "Backup diário da BD → Drive"** em [healthchecks.ts](src/lib/healthchecks.ts): warning se nunca correu, ERROR se a última falhou ou tem >48h (backup partido em silêncio é pior que não ter backup). GRANTs service_role já cobriam as 22 tabelas (062+065+068+081) → **sem migração para o backup**. **13 testes novos** de rotação (53 no total ✅). NÃO testável localmente (.env.local só tem as chaves públicas) — teste real na produção (passos abaixo). **(2) Hardening aprovado:** (a) **gate de equipa** — `isTeamEmail()` novo em [roles.ts](src/lib/auth/roles.ts); [proxy.ts](src/proxy.ts) trata sessão de conta fora da equipa como NÃO autenticada (fica presa no /login, sem loop) e [getVerifiedEmail](src/lib/auth/server.ts) idem (cobre as rotas /api/whatsapp/* que o proxy deixa passar para o webhook); [auth/callback](src/app/auth/callback/route.ts) faz signOut a emails desconhecidos. Nota da auditoria: o login real é por **password** (não Google OAuth como a spec dizia) — o risco de signups abertos é via API directa do Supabase Auth; a Maria deve **desligar "Allow new users to sign up"** no dashboard (instruções no chat; com o gate, mesmo esquecido, um estranho já não entra). (b) [whatsapp/actions.ts](src/app/(admin)/whatsapp/actions.ts): `requireAdmin` nas 4 actions — era a ÚNICA família de actions sem verificação (as RLS só-admins seguravam; agora está alinhado com a convenção). (c) [/api/whatsapp/media/[fileId]](src/app/api/whatsapp/media/[fileId]/route.ts): antes servia QUALQUER ficheiro da Drive FBR a qualquer sessão (proxy de leitura arbitrário); agora só serve ficheiros presentes em `whatsapp_messages.media_drive_file_id`, lookup com a sessão do utilizador (RLS team_read decide) e refresh_token lido por service_role SÓ depois das verificações → **bónus: as imagens do WhatsApp deixam de aparecer partidas à Ana** (a RLS só-admins de google_integration dava-lhe 503; docstring do [admin.ts](src/lib/supabase/admin.ts) actualizada com o padrão). (d) **BUG REAL de produção encontrado e corrigido:** o upload de media do webhook WhatsApp→Drive **falhava SEMPRE à primeira** — `loadIntegration()` lia com a sessão (inexistente num webhook) → corria como `anon` → permission denied; a mig 065 deu o GRANT a service_role mas o código nunca o usava ali (as imagens só entravam na Drive pelo botão retry de um admin). Fix: [oauth.ts](src/lib/google/oauth.ts) e [drive.ts](src/lib/google/drive.ts) aceitam client Supabase opcional e o [media-fetch.ts](src/lib/whatsapp/media-fetch.ts) passa o seu createAdminClient. (e) **[Mig 083](supabase/migrations/083_crypto_random_ids.sql):** `generate_order_id()` e `generate_voucher_code()` passam de `random()` (não criptográfico; o order_id é o token público do site de status) para `gen_random_bytes()` do pgcrypto; o voucher mantém o alfabeto sem 0/O/I/1 e o loop de unicidade da mig 009 (32=2^5 chars → módulo sem viés). IDs existentes não mudam. (f) **xlsx do Google Search Console tirado de `public/`** (tudo o que está aí é servido no deploy!) para a pasta nova `_privado/`, gitignored — regra: nada entra em public/ que não seja para servir na app. **(3) CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) corre `npm run preflight` em cada push/PR com env vars dummy (validado localmente: o build passa com as mesmas dummies). Rede de segurança para esquecimentos e sessões paralelas. **(4) Nota de produto (pedido da Maria no chat):** a futura detecção de clientes duplicados **avisa com link mas NUNCA bloqueia** — a mesma pessoa pode fazer várias encomendas (memória nova feedback_duplicados_nao_bloquear.md). Preflight completo OK (tsc + 53 testes + build). **Maria — passos manuais:** (1) correr a **[mig 083](supabase/migrations/083_crypto_random_ids.sql)** no Supabase SQL Editor [[feedback-migracoes-supabase-aplicadas]]; (2) **desligar signups** no Supabase: menu esquerdo → Authentication → Sign In / Up → "Allow new users to sign up" OFF → Save; (3) push (estreia o CI — aba Actions no GitHub deve ficar verde); (4) smoke: **login dos 3 perfis** (a mudança do proxy é a mais sensível!), conversa WhatsApp com imagens (pedir à Ana para confirmar que agora as vê), Sistema→Healthchecks com a linha nova "Backup diário da BD → Drive" (amarela até ao 1º backup); (5) **testar o backup já**: Vercel → projecto → Settings → Crons → /api/cron/backup → Run; confirmar na Drive a pasta "Backups da base de dados" com `fbr-backup-<data>.json.gz` e o healthcheck verde no dia seguinte. **Roadmap aprovado para as próximas sessões (por ordem):** (i) 2b — form público validado no servidor (Turnstile server-side no repo fbr-website + revogar INSERT anon; migração); (ii) 3 — centralizar equipa (adoptar is_team_admin()/team_members da mig 046 nas ~24 policies + código TS); (iii) 2c — expurgar conversas WhatsApp do histórico git (sessão DEDICADA: filter-repo + force push, coordenar com sessões paralelas); (iv) 4 restantes — tipos gerados do Supabase no preflight, monitorização de erros, refactor do workbench de Preservação; (v) 8 — funcionalidades ao critério do Claude: vista "Hoje" no Dashboard, notificações push internas (PWA), duplicados (não bloqueantes!), relatório mensal interno; (vi) retomar a cadência de comunicação (sessão 104). **PARTE 2 (mesma sessão, "continua a fazer as coisas"; a Maria correu a mig 083 e desligou os signups):** **(5) Item 2b FEITO — forms do site fechados de ponta a ponta:** a auditoria ao fbr-website revelou que as rotas [api/reservar-preservacao](../fbr-website/fbr-website/app/api/reservar-preservacao/route.js) e [api/vale-presente](../fbr-website/fbr-website/app/api/vale-presente/route.js) JÁ validavam Turnstile server-side + honeypot + rate limit + Origin — o único buraco era escreverem com a ANON KEY (pública), o que obrigava a policy de INSERT anon a existir (= tudo contornável falando directo com o PostgREST). Fix: helper novo [app/_lib/supabase-server.js](../fbr-website/fbr-website/app/_lib/supabase-server.js) (`createFormsClient` prefere **SUPABASE_SERVICE_ROLE_KEY**, com fallback anon durante a transição, + `createAnonClient`); as 2 rotas + o teste de ESCRITA do [api/health](../fbr-website/fbr-website/app/api/health/route.js) usam o forms client (a LEITURA do health continua anon — testa o que os sites públicos de status/voucher veem). Build do site OK; **commit 56d162b no develop do fbr-website, PUSHED** (merge→main decide a Maria). No admin, **[mig 084](supabase/migrations/084_revoke_anon_inserts.sql)**: drop das policies orders/vouchers_public_insert (016) e *_public_select_recent (017, só serviam o RETURNING dos inserts anon), REVOKE INSERT em orders/vouchers/audit_log ao anon, REVOKE EXECUTE nas funções de gerar IDs e update_updated_at, GRANT EXECUTE de cleanup_form_healthchecks a service_role (+revoke ao anon). Policies de leitura dos sites públicos INTACTAS. **⚠️ ORDEM CRÍTICA:** (1) env var `SUPABASE_SERVICE_ROLE_KEY` no projecto **fbr-website** da Vercel; (2) merge develop→main do site + esperar o deploy; (3) SÓ DEPOIS correr a mig 084; (4) verificar floresabeirario.pt/api/health → ok:true + submeter um form de teste. Se a mig correr antes do deploy, os forms PARTEM. **(6) Sobreposições no workbench mobile (screenshot da Maria: "Tamanho da moldura"/"Fundo do quadro" e "Moldura pirâmide"/"Tipo de moldura" texto em cima de texto):** causa raiz = `Field`/`HeroField` em [_components/layout.tsx](src/app/(admin)/preservacao/[id]/_components/layout.tsx) usavam `col-span-2` FIXO; num grid `grid-cols-1` (mobile) um span de 2 cria uma 2ª coluna IMPLÍCITA e os campos auto-colocados ficam em 2 colunas esmagadas com overflow sobreposto. Fix: `span2` → `xl:col-span-2` no Field (o Grid2 só tem 2 colunas em xl) e `lg:col-span-2` no HeroField (grid do hero é lg); desktop intocado [[feedback-desktop-prioridade]]. **Varrimento completo do repo:** todos os restantes `col-span-N` têm prefixo responsivo alinhado com o grid pai ou vivem em grids de largura fixa (grid-cols-3/12) — este padrão de sobreposição não existe em mais lado nenhum. Preflight completo OK (tsc + 53 testes + build) depois da parte 2. **(7) 2b FECHADO EM PRODUÇÃO na própria sessão:** Maria adicionou a env var na Vercel do site, o Claude fez o merge develop→main (**88ca763**, deploy READY verificado via Vercel MCP), e a Maria correu a **mig 084**. Verificação completa pós-migração: /api/health do site **ok:true** (o teste de escrita usa o caminho novo; confirmado nos logs da Vercel que foi servido pelo deployment novo e SEM o aviso de fallback anon), home + 2 páginas de forms **200**, leituras anon de orders/vouchers (sites status/voucher) **200**, sites status.floresabeirario.pt e voucher.floresabeirario.pt **200**, e **INSERT anon directo ao PostgREST devolve 42501 permission denied** — o contorno do Turnstile está morto. Migs 083 e 084 corridas; signups do Supabase Auth desligados pela Maria (confirmar Save changes). **Pendente do admin:** push do fbr-admin (Maria) + teste do cron /api/cron/backup na Vercel + smoke do login dos 3 perfis. **PARTE 3 ("push admin" + "continua próxima tarefa"):** push feito pelo Claude — commits **c1b6931** (sessão 124) + **cbfc19e** (trabalho da sessão paralela 125 em templates.ts, committado em separado com 58 testes verdes + tsc limpo) + o 6210a3f da 122 que estava por pushar. **Item 3 do roadmap FEITO na BD: [mig 085](supabase/migrations/085_team_policies_centralized.sql)** — TODAS as policies com os 3 emails hardcoded passam a delegar em `is_team_admin()`/`is_team_member()` (a mig 046 finalmente adoptada): orders (re-aplica), vouchers, public_status_settings, audit_log (INSERT apertado de `true`→is_team_member), tasks, personal_checklist (owner_all intacta), partners, competitors, google_integration, pricing_items, ideas, recipes, public_figures, chat_messages (lógica de autor mantida), expenses, production_cost_items, system_settings (+select true→member), message_templates, team_members (funções SECURITY DEFINER, sem recursão), task_templates, whatsapp_conversations/messages, claude_usage — **~35 policies em 22 tabelas**, policies anon intactas. A mig é AUTO-CONTIDA (re-cria funções+seed, idempotente, funciona quer a 046 tenha corrido em produção quer não [[feedback-migracoes-supabase-aplicadas]]) e termina com query de verificação (0 policies com emails hardcoded). A partir daqui, mudar papéis/adicionar membro = 1 linha em team_members. **Falta a parte TS** (roles.ts/team-members.ts/login/chat hardcoded — próxima sessão, com UI de gestão em Sistema). **Maria:** correr a **mig 085** no SQL Editor (+ verificações do fim do ficheiro); smoke: login dos 3, Ana continua só-leitura fora de Tarefas/Parcerias. **PARTE 4 (mig 085 corrida pela Maria + "continua"):** verificação pós-085 feita (leituras anon dos sites públicos 200 + health do site ok:true; a parte authenticated fica no smoke do login dela). **Item 3 — parte TS FEITA:** [roles.ts](src/lib/auth/roles.ts) ganha `TEAM: TeamMember[]` (email+nome+foto+papel) como **fonte única no código** — ADMIN_EMAILS_LIST/VIEWER_EMAILS_LIST agora derivam de TEAM; os 5 consumidores que duplicavam a lista passaram a importar/derivar: [team-members.ts](src/app/(admin)/_components/dashboard/team-members.ts) (re-exporta), [layout.tsx](src/app/(admin)/layout.tsx) (PROFILES), [login/page.tsx](src/app/login/page.tsx) (PROFILES), [chat-client.tsx](src/app/(admin)/chat/chat-client.tsx) (TEAM + mapa local CHAT_COLORS por email, cosmético), workbenches de [parcerias](src/app/(admin)/parcerias/[id]/workbench-client.tsx) e [figuras](src/app/(admin)/parcerias/figura/[id]/workbench-client.tsx) (ASSIGNEES). Grep confirma: **zero emails da equipa hardcoded fora de roles.ts** (+ mapa de cores do chat). Porquê estático e não a ler da BD: o /login mostra os perfis ANTES de haver sessão e o anon não pode ler team_members — documentado no próprio roles.ts. **Adicionar/mudar um membro agora = 1 linha em roles.ts + 1 linha em team_members (BD) + password no Supabase Auth.** Preflight OK (tsc + 58 testes + build) + lint limpo nos 7 ficheiros. **PARTE 5 — item 8.5 FEITO: detecção de clientes repetidos (avisa com link, NUNCA bloqueia [[feedback-duplicados-nao-bloquear]]):** lib nova [lib/duplicates.ts](src/lib/duplicates.ts) (funções puras: `normalizeEmail` case-insensitive; `normalizePhone` só-dígitos, sem +351/00351, mínimo 9 dígitos, compara os últimos 9 — "+351 912 345 678" = "912345678"; `findDuplicates` com matchedBy email/telemóvel/ambos; matching em JS porque a normalização de telefones não se faz em PostgREST e a tabela tem centenas de linhas). **Workbench de Preservação:** [page.tsx](src/app/(admin)/preservacao/[id]/page.tsx) procura outras encomendas não-apagadas com o mesmo email/telemóvel; o [workbench-client](src/app/(admin)/preservacao/[id]/workbench-client.tsx) mostra faixa azul discreta sob o header ("🌸 Cliente repetido — tem N outras encomendas:") com chips clicáveis #ID + estado + data do evento. **Workbench de Vale-Presente (análogo [[feedback-aplicar-padroes-em-areas-analogas]]):** outros VALES do mesmo remetente E encomendas de preservação com o mesmo contacto (labels resolvidos no servidor, tipo `VoucherDuplicateInfo`). **7 testes novos** na lib (65 no total ✅). Sem migração. Preflight + lint OK. **Maria — smoke:** abrir uma encomenda de cliente repetido (ou criar 2 de teste com o mesmo email) → faixa azul com chip para a outra; vale cujo remetente também tem encomenda → chips "Vale …" e "Encomenda #…". **PARTE 6 (prioridades da Maria: 5→2→4→1 experimental→3; arranca o 5):** **(a) Anti-drift tipos↔BD** — em vez do gerador oficial (precisava de access token dela), teste OFFLINE que corre no preflight/CI: [lib/schema-drift.ts](src/lib/schema-drift.ts) faz o parse das migrações (CREATE TABLE com contagem de parêntesis ciente de strings e de comentários; ALTERs com MÚLTIPLOS "ADD COLUMN" numa instrução — dois pontos cegos que o db-inventory também tem) e dos interfaces TS; [schema-drift.test.ts](src/lib/__tests__/schema-drift.test.ts) exige que TODA a propriedade de Order/Voucher exista como coluna nas migrações → a classe do bug `total_budget` (sessão 119) morre no CI. **Apanhou drift REAL à primeira corrida: `Voucher.drive_folder_url` era um campo FANTASMA** (nenhuma migração o criou; produção confirma 42703 "does not exist"; vouchers só têm `drive_folder_id` da mig 022) — e era usado no [export-csv.ts](src/lib/export-csv.ts): a coluna "Pasta Drive" do CSV dos vales ia SEMPRE vazia. Corrigido: campo removido do tipo e o CSV constrói o URL a partir do drive_folder_id. **(b) Monitorização de erros ([mig 086](supabase/migrations/086_client_errors.sql))** — um crash no browser era invisível até alguém se queixar; agora: tabela `client_errors` (RLS: equipa insere via is_team_member, admins leem via is_team_admin; GRANTs incl. service_role — lição 062/065/068/081), [error-reporter.tsx](src/components/error-reporter.tsx) montado no layout (window.onerror + unhandledrejection; máx 5 relatórios/pageload; ignora "Script error." cross-origin; nunca repete a mesma mensagem seguida), **error boundary novo** [(admin)/error.tsx](src/app/(admin)/error.tsx) (🥀 + botão retry em vez do ecrã branco do Next, e regista com source=boundary), action `reportClientErrorAction` best-effort em [(admin)/actions.ts](src/app/(admin)/actions.ts) (engole falhas — reportar um erro nunca pode causar outro; corta message/stack/path), **healthcheck novo "Erros na app (últimas 24h)"** (ok / warning / error com ≥10; avisa "corre a mig 086" se a tabela faltar) e **retenção de 30 dias** no cron do healthcheck (delete best-effort). Sem Sentry/serviços externos: para 3 utilizadores a BD+healthchecks chegam. `client_errors` fica DE FORA do backup diário (logs efémeros). **9 testes novos** (**74 no total ✅**). Preflight + lint OK. **Maria:** correr a **mig 086** no SQL Editor; smoke: Sistema→Healthchecks deve mostrar "Erros na app (últimas 24h)" (fica warning "corre a mig 086" até correres). **Resto do item 5** — o refactor do workbench (2.5k linhas) fica para uma sessão FRESCA (mexer nesse ficheiro no fim de uma sessão já gigante era pedir asneira); **a seguir vem o item 2 (notificações push internas), também sessão própria** (VAPID keys, tabela de subscrições, service worker). -->
<!-- fim do bloco 124 original -->

<!-- Sessão 123 (FASE 6 parte 67 — fbr-tracking status.floresabeirario.pt: BUG timeline 11 passos vs 12 fases públicas do admin (faltava fase 7 "A finalizar o quadro" → passo errado destacado da fase 7 em diante + "Passo 12 de 11"); fix passos→utils/timeline.js (12 entradas, sync com STATUS_TO_PUBLIC_PHASE); página no idioma do cliente (getEncomendaById devolve idioma pt/en/ambos, textos fixos via helper bi()); "Em breve"/"Coming soon" quando sem data de entrega; og:image+og:url; /api/tracking removido; 15 rondas de redesign "Herbário" no develop→ final aprovado: estrutura Herbário (nome do cliente primeiro, cartão de estado com fase+mensagem juntas, linha de progresso clicável a abrir 12 etapas, moldura traço duplo) na paleta 100% verdes FBR do main, flores botânicas line-art vistas de lado no cabeçalho (feedback_flores_lineart_estilo.md); merge develop→main 25b9e85 PUSHED, produção verificada por curl) comprimida. -->

<!-- Sessão 122 (FASE 6 parte 66 — auditoria UX/UI/copy/SEO do site + correcções aprovadas em 32 ficheiros: funil EN reparado (CTAs locale-aware, blog EN 404, LangSwitcher em artigos), <a>→Link em todo o lado, 404/erro com marca, h1 da home = eyebrow SEO, HowTo schema PT/EN, preços centralizados em _lib/precos.js, splitTitle em 9 ficheiros, form do vale com checkbox Termos/RGPD + resumo de erros, copy EN sem videochamada, sitemap com datas reais; hero CTA "Reservar eternização de flores"; develop 2baaf4d + main af2540a EM PRODUÇÃO; pendente: vídeo tracking.mp4 da Maria + decisões aggregateRating/subtítulo hero/data nas legais) comprimida. -->

<!-- Sessão 121 (FASE 6 parte 65 — performance: proxy e getCurrentEmail/Role passam de auth.getUser (rede) para auth.getClaims (validação local do JWT) + loading.tsx global do grupo (admin); "Entregar até" mig 082 (orders.delivery_deadline+reason, campos no workbench, pill ⏰ na tabela, alerta no dashboard, CSV/RGPD); botão refresh duplicado no topo da sidebar; tabela PC: colunas Pagamento 170px/Estado 235px; mobile: overflow-x-auto em 7 tabelas de Finanças/Métricas/Sistema. Mig 082 corrida) comprimida. -->

<!-- Sessão 120 (FASE 6 parte 64 — site: hero da reserva encavalitado no logo da nav abaixo de 1440px; causa = heroes rp/vp centrados sem reservar espaço para barra de anúncio+nav fixa; fix CSS padding-top clamp(100px,12svh,128px) + min-height 560px em .rp-hero/.vp-hero e depois no .page-hero partilhado (5 páginas); bouquet-noiva e emoldurar não tocados (já compensavam); merges develop→main f887190 + 37d1266 pushed, produção OK. Memória project_website_hero_nav_fixa.md) comprimida. -->

<!-- Sessão 119 (FASE 6 parte 63 — Claude v2, mig 080: fix coluna budget na rota /suggest (era total_budget, erro engolido pelo ?? []), claude_facts preenchido (~6k chars), 39 pares de templates PT+EN reescritos de 37 conversas reais, resposta na língua do cliente, sugestões por campos fieldSuggestionBases + picker de leads em /whatsapp, dados de pagamento no system prompt, travessões removidos das templates (memória feedback_sem_travessao), género "o Claude"; conversas WhatsApp untracked do repo (gitignore + git rm --cached de 17 ficheiros) mas AINDA NO HISTÓRICO git — expurgo agendado no roadmap da sessão 124. Mig 080 corrida) comprimida. -->

<!-- Sessão 118 (FASE 6 parte 62 — bolinha healthcheck vermelha de manhã: mig 068 tinha nomes de tabelas errados + IF EXISTS silencioso → cron service_role levava 42501 em 4 tabelas; fix mig 081 GRANT service_role em personal_checklist/competitors/pricing_items/public_status_settings/team_members; mig corrida pela Maria na sessão; verificar bolinha verde após cron 07:00) comprimida. -->

<!-- Sessão 117 (FASE 6 parte 61 — pré-reservas fora das recolhas (secção 'Por confirmar' em entregas-recolhas + getUpcomingPickups salta pré-reservas); site: secção 'Onde estamos' em Contactos + banner topo nav.announce 30px + secção home 'O evento já passou?' com wa variante urgente + FAQ pós-evento; status: mensagem fase 1 'as suas flores' nos 2 repos + meta/og do link no idioma do cliente; congelador mig 079 (freezer_in_at/out_at, pill ❄ X/5, alerta 5 dias); afazeres default 'só os meus'; análise GSC → bouquet PT 'ramo de noiva', 4 artigos blog novos PT+EN + 1 só-EN destination weddings, momentos floresP3, links guia de envio, fix sitemap posts órfãos; AltLocaleHref para switch de idioma em artigos; prazo flores 5→6 dias em 72 ocorrências; blog listagem redesenhada; merge develop→main 1f77d4d. Mig 079 corrida) comprimida. -->

<!-- Sessão 116 (FASE 6 parte 60 — auditoria geral + lotes 1-5: healthcheck auto-cura 6h; cores semânticas nas Métricas; tooltips ⓘ a explicar Receita=dinheiro recebido; Top 5 parceiros com comissão paga/por pagar/total; sufixo "⏳ entrega por combinar" nos eventos Google Calendar sem data de entrega; wa.js com mensagens WhatsApp EN no site; /api/health do site reescrito para Supabase+Resend com escrita sentinela auto-limpa (mig 077) e cron semanal; opção "Wedding Planner" no como-conheceu (mig 078); tab P&L→"Lucro por encomenda"; comissão registada NO VALE passa a contar nos agregados com guarda anti dupla contagem em finance.ts (commissionFullFromVoucher/orderCommissionSuppressedByVoucher, só conta com vale 100% pago); rename do repo GitHub fbr-admin2→fbr-admin (pasta local mantém nome antigo). Migs 077+078 corridas) comprimida. -->

<!-- Sessão 115 (FASE 6 parte 59 — link de status para quem paga em dinheiro à entrega: mig 076 policy pública alargada (payment_status ≠ 100_por_pagar OU status ≠ entrega_flores_agendar) + coluna interna cash_on_delivery (fora do GRANT anon) + CheckRow "Pagamento em dinheiro à entrega" na caixa Finanças do workbench. Mig 076 corrida) comprimida. -->

<!-- Sessão 114 (FASE 6 parte 58 — saúde do código: lint 51→0 (useSyncExternalStore, store-from-previous-renders, mini-store do som), vitest instalado com 24 testes de dinheiro (finance/metrics/budget-adjustment) integrados no preflight, refactor Finanças 4038→~190 linhas + _tabs/, script scripts/db-inventory.mjs (23/23 tabelas e 54/54 colunas confirmadas na produção). Sem migração) comprimida. -->

<!-- Sessão 113 (FASE 6 parte 57 — auditoria das Métricas: canceladas fora da receita, receita por event_date (alinhada com Finanças), comissões Top 5 via commissionFromOrder, etiqueta de comparação dinâmica; novo preset default "Desde sempre" + flag showComparison; RefreshButton global router.refresh() na sidebar/header mobile; aba Faturação alinhada (canceladas a 0 em revenueFromOrder/cogsFromOrder + filtro nas comissões). Sem migração) comprimida. -->


<!-- Sessão 112 (FASE 6 parte 56 — pill âmbar "40% pedidos" na tabela de Preservação ao lado de "Contactada": payment_40_requested && pagamento ∉ {70_pago,100_pago}; workbench já tinha o CheckRow equivalente da sessão 96; sem migração) comprimida. -->

<!-- Sessão 111 (FASE 6 parte 55 — banner global "Há alterações novas" quando OUTRO utilizador edita a página onde estás, mig 075: orders/vouchers/partners/public_figures na publicação supabase_realtime + trigger set_updated_by() para ignorar as próprias edições; hook use-stale-data.ts mapeia path→tabelas; banner em stale-data-banner.tsx montado no layout) comprimida. -->

<!-- Sessão 110 (FASE 6 parte 54 — Orçamento provisório 300€ + acerto de pagamento ao decidir o tamanho, mig 074: pricing.ts calcula com base 30x40 e marca snapshot provisional:true quando tamanho é nao_sei/voces_a_escolher; coluna orders.budget_at_first_payment guarda o € no 1º pagamento; helper budget-adjustment.ts computeBudgetAdjustment devolve quanto falta pedir quando o orçamento sobe depois do sinal (caso real: 90€/300 → 500 → faltam 260€, hoje coberto por teste unitário em __tests__); aviso âmbar na caixa Finanças; recálculo automático do budget quando muda campo de preço e o orçamento ainda é o automático; 2 templates reajuste_pagamento_tamanho PT+EN + variáveis {sinal_pago}/{valor_em_falta}. Migs 074+073 confirmadas na produção pelo inventário da sessão 114) comprimida. -->

<!-- Sessão 109 (FASE 6 parte 53 — Fundo próprio para os quadros extra pequenos, mig 073: ALTER orders ADD extra_small_frames_background com as 7 opções de frame_background, NULL = igual ao principal; select condicional "Fundo do quadro extra" no workbench Preservação quando extra_small_frames é sim/mais_info; coluna no export CSV + linha no RGPD-print; sem impacto no orçamento. Mig 073 confirmada na produção pelo inventário da sessão 114) comprimida. -->

<!-- Sessão 108 (FASE 6 parte 52 — bug "não consigo gerar o orçamento": Next censura mensagens de erros lançados em Server Actions [[feedback-server-action-error-sanitized]]; recomputeOrderBudgetAction+captureOrderProductionCostAction passam a devolver ActionResult{ok,error} em vez de throw; mensagem accionável quando frame_size é nao_sei/voces_a_escolher. Sem migração) comprimida. -->

<!-- Sessão 107 (FASE 6 parte 51 — (1) removido alerta "Parada há X dias" da secção 2 de getDashboardAlerts (src/lib/dashboard.ts) + const STUCK_DAYS; (2) nova vista "Comissões" nas Parcerias: helper src/lib/commissions.ts (CommissionItem, COMMISSION_PENDING_STATUSES, isCommissionDueNow vs isCommissionNotYetDue, groupCommissionsByPartner, sumCommissions), parcerias/page.tsx +2 queries orders/vouchers, parcerias/commissions-view.tsx 3º botão "€ Comissões" com total por pagar agora + "Marcar paga" (markCommissionPaidAction, requireAdmin). Sem migração. Push feito) comprimida. -->

<!-- Sessão 106 (FASE 6 parte 50 — Gmail+WhatsApp no workbench das Parcerias e das Figuras Públicas: componente CommunicationsCard reusa GmailPanel+WhatsappLivePanel por import; dropdown de telefone quando phones[]>1; card no topo da coluna esquerda, removido lg:sticky nas Parcerias. Sem migração. Push feito) comprimida. -->

<!-- Sessão 105 (FASE 6 parte 49 — Gmail só-leitura a sério no workbench: src/lib/google/gmail.ts fetchThreadsWithContact reusa getAuthenticatedClient, q from:/to:, format:full, base64url decode, estados ok|not_connected|missing_scope; rota /api/google/emails admin-only; gmail-panel.tsx threads colapsáveis usado em Preservação+Vale-Presente; Ecossistema Gmail→Activo. Maria pode precisar de reautorizar scope gmail.readonly em /settings/google) comprimida. -->

<!-- Sessão 104 (FASE 6 parte 48 — Motor de cadência de comunicação + 1º momento "pedir opinião", mig 072: src/lib/comms-cadence.ts genérico mas só liga "pedir_opiniao" (quadro_recebido +2 dias, ambos admins, idempotente via orders.comms_moments_done); tarefa criada na transição em updateOrderAction (sem cron); 2 templates PT/EN pos_venda + variável {link_avaliacao} + system_settings.review_link editável em Sistema→Templates. Próximo passo: +entradas COMMS_CADENCE para sinal 30%/agradecer reserva/pedir 40%/30% final/avisar a caminho) comprimida. -->

<!-- Sessão 103 (FASE 6 parte 47 — 3 afinações pós-uso: "X total" da Preservação sem canceladas (totalNaoCanceladas + tooltip); Templates/Cérebro do Claude saíram da sidebar (acessíveis via /comunicacoes + atalhos no topo do /whatsapp); WhatsappLivePanel no workbench do Vale-Presente. Sem migração) comprimida. -->

<!-- Sessão 102 (FASE 6 parte 46 — Ecossistema actualizado: array INTEGRATIONS ganha Dualhook (relay multi-tenant dos webhooks Meta), WhatsApp+Claude passam a "Activo", Gmail fica Pendente; IntegrationCard com nome clicável quando há url) comprimida. -->

<!-- Sessão 101 (FASE 6 parte 45 — Figuras Públicas: par/cônjuge para casais (1 registo + partner_name/partner_instagram/partner_followers, mig 071), toggle invertido (Figuras Públicas default à esquerda), tipos simplificados (Celebridade fundida em Figura pública), figureDisplayName "Sofia & João") comprimida. -->

<!-- Sessão 100 (FASE 6 parte 44 — Figuras Públicas: nova secção dentro de Parcerias via toggle, tabela public_figures + funil próprio mig 070, tipos/actions/helpers/outreach-templates, listagem com KPIs + alertas follow-up/evento, workbench 3 colunas com custo estimado do catálogo. Ana edita. Código de referência rejeitado → Ideias Futuras. Icon Instagram não existe no lucide novo → AtSign) comprimida. -->

<!-- Sessão 99 (FASE 6 parte 43 — WhatsApp polish round 1+2 + mig 065: service_role grants em google_integration e system_settings; linkify URLs, indicador media falhada, chips de filtro inbox, marcar não-lida, retry media) comprimida. -->

<!-- Sessão 98 (FASE 6 parte 42 — mobile fixes: tabela Cliente colapsava a 0px com tableLayout fixed → minWidth 830+200+extras; header workbench basis-full sm:flex-1; secção Flores lg:grid-cols-2 → xl:grid-cols-2) comprimida. -->

<!-- Sessão 97 (FASE 6 parte 41 — WhatsApp end-to-end: backend mig 061-064, webhook path-token, parser idempotente, Realtime, página /whatsapp, rota /suggest com Claude Sonnet 4.6 + prompt caching, Cérebro do Claudio em /comunicacoes/claudio, reorg hub /comunicacoes, workbench tab LIVE via wa-live-panel, media fetch para Drive, statuses delivery/read. Modelo claude-sonnet-4-6. Windows Desktop não gera echoes. Envio nunca construído → 0€ Meta) comprimida no Histórico condensado em baixo. -->

<!-- Sessão 96 (FASE 6 parte 40 — mobile polish workbench/sidebar/tabela + email do form com mês por extenso) comprimida no Histórico condensado em baixo. -->

<!-- Sessão 95 (FASE 6 parte 39 — Dashboard polish 6 queixas: badge "parada há X dias" removido, cores de estado das tarefas stone/violet/emerald (paleta separada da prioridade), bolinha indigo de tarefas activas minhas com Realtime (use-my-active-tasks.ts), chips de encomenda no kanban; + Vistas/Filtros/Colunas guardadas em Preservação (preservacao-views.ts, views-bar.tsx). Sem migração) comprimida. -->

<!-- Sessão 94 (FASE 6 parte 38 — PWA: matcher do proxy exclui manifest.webmanifest + sw.js (senão o Android nunca oferece "Instalar app"), safe zone do maskable 60→80%, CACHE_VERSION v4. Detalhe no histórico condensado) comprimida. -->

<!-- Sessão 93 (FASE 6 parte 37 — 3 anexos de fatura) comprimida no Histórico condensado em baixo. -->
<!-- Sessão 92 (FASE 6 parte 36 — Kanban dos Afazeres globais redesenhado) comprimida no Histórico condensado em baixo. -->
<!-- Sessão 91 (FASE 6 parte 35) comprimida no Histórico condensado em baixo. -->

---

## Sessões recentes (detalhe)

### Sessão 96 📱 Mobile polish — workbench, sidebar, tabelas alinhadas + email do form com mês por extenso

Lote de afinações pós-uso pedido pela Maria. Foi um pedido único com 6 sub-tarefas mais 1 que apareceu a meio (desalinhamento de tabelas) — total 7 alterações. A Maria escolheu "tudo menos push notifications" (essas ficam para sessão dedicada por serem trabalho pesado: VAPID + service worker + endpoint + subscriptions).

**Decisões fixadas em conversa:**
- Push notifications no telemóvel → **sessão futura dedicada** (só Android, Web Push).
- "40% pedidos?" e "30% pedidos?" ficam **ao lado da "Contactada"** no cabeçalho (não dentro da caixa Finanças).
- Mobile workbench reordering → **`display: contents` nas colunas em mobile** + `order-N` por card (forma mais limpa de reordenar entre colunas sem duplicar JSX).
- Email do form → editar **directamente no `fbr-website`** (Maria abriu o repo) em vez de só deixar nota.
- Sem migração nova — campos `payment_40_requested` / `payment_30_requested` já existiam (mig 018) e estavam ligados ao diálogo de status. Agora aparecem também como CheckRow persistente no cabeçalho.

**A. Tabelas alinhadas entre grupos** — [preservacao-client.tsx:760](src/app/(admin)/preservacao/preservacao-client.tsx#L760):
- Diagnóstico: cada `GroupSection` renderiza o seu próprio `<table>` com `table-layout: auto`. Cada tabela calcula larguras independentemente conforme o conteúdo (`"30/09/2025"` vs `"08/06/2026"`, `"Em mãos"` vs `"Recolha no local"`, header `"ENVIO DAS FLORES"` vs `"RECEÇÃO DO QUADRO"`). Daí o desalinhamento entre Pré-reservas / Reservas / Preservação e design.
- Fix: `tableLayout: 'fixed'` + `width:` explícito em cada `<th>` (em vez de `min-width:`). Cliente sem width — coluna elástica que absorve o espaço extra. Larguras fixas: Handle=40, Data=110, Localização=140 (xl-only), Envio=140, Estado=200, Orçamento=110, Pagamento=150, Acção=80. `minWidth = 830 + sum(COLUMN_MIN_PX)` para colunas extra.
- Cells já têm `truncate` onde precisam (Cliente, Localização). Sem rebentar nada.

**B. "Contactada" esconde após qualquer pagamento** — [workbench-client.tsx:608](src/app/(admin)/preservacao/[id]/workbench-client.tsx#L608):
- `showContactadaPrompt = local.payment_status === "100_por_pagar"`. Quando há qualquer pagamento (30/70/100), o cliente foi obviamente contactado — a checkbox era ruído visual.

**C. Novos prompts "40% pedidos?" e "30% pedidos?"** — mesmo padrão que Contactada:
- `reachedFloresRecebidas`: set de estados de `flores_recebidas` até `quadro_recebido`. `reachedQuadroPronto`: set de `quadro_pronto` em diante.
- `show40Prompt = reachedFloresRecebidas && payment_status NOT IN ['70_pago','100_pago']` — aparece a partir de flores_recebidas até receber 40%.
- `show30Prompt = reachedQuadroPronto && payment_status !== '100_pago'` — aparece a partir de quadro_pronto até receber final.
- Liga aos campos `payment_40_requested` / `payment_30_requested` existentes (mig 018). **Sem migração nova**.
- Mantém o diálogo existente que pergunta ao mudar status — agora há a CheckRow visível como reforço.

**D. Workbench mobile redesenhado** — 3 alterações no [workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx):
- **D1. Cabeçalho compacto**: `gap-x-3 gap-y-2 py-2 px-3` → `gap-x-2 gap-y-1.5 py-1.5 px-2.5` em mobile (mantém `sm:gap-x-3 sm:gap-y-2 sm:py-3 sm:px-6`). Removido `basis-full sm:basis-auto` do bloco nome+ID — agora flui na linha em vez de ocupar a linha inteira. StatusSelect passa de `w-full sm:w-56 order-last` para `flex-1 basis-full sm:basis-auto sm:flex-none sm:w-56 order-last sm:order-none` — agora partilha a linha com CheckRows.
- **D2. URL da foto só em clique**: `imageUrlMobileOpen` state novo. Tap area `<button className="absolute inset-0 sm:hidden z-10">` em cima da imagem alterna o estado. Overlay usa `imageUrlMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"` em mobile e mantém `sm:opacity-0 sm:group-hover:opacity-100` em desktop. Quando não há `photoUrl`, mostra sempre (precisa de poder colar URL).
- **D3. Cards reordenados em mobile**: chave foi `display: contents` nas 3 colunas. `<aside className="contents lg:block lg:col-span-3">` + inner `<div className="contents lg:block lg:space-y-4 lg:space-y-5 lg:sticky lg:top-2">` — em mobile os wrappers desaparecem do layout (display:contents), expondo os cards directamente à grid exterior (grid-cols-1). Cada card recebe `className="order-N lg:order-none"` (Card ganhou prop `className` opcional). Ordem mobile: Hero(1) → Alertas(2) → **Finanças(3) → Comunicações(4) → Envio(5) → Flores(6)** → Tarefas(7) → Parceria(8) → Inventário(9) → Galeria(10) → Assistente(11) → Origem(12) → Entrega+feedback(13) → Cupão(14). Em desktop tudo intocado (memory: [[feedback-desktop-prioridade]]).

**E. Sidebar mobile compactada** — [layout.tsx:354](src/app/(admin)/layout.tsx#L354):
- Separado o bloco de fundo em renderings dedicados a desktop vs mobile (em vez de um único bloco com `isDesktop` ternários inline).
- Mobile: 1 linha — `<div className="p-2 border-t flex items-center gap-1.5">` com avatar 7x7 + nome (flex-1 truncate) + Sair como botão-ícone `h-9 w-9` + ThemeToggle. Antes ocupava ~100px (3 linhas verticais); agora ~50px.
- Desktop: mantém-se igual (3 linhas: perfil / Sair / tema+collapse).

**F. Email do form com mês por extenso** — repositório [fbr-website](../fbr-website):
- Helper novo `formatDatePT(isoDate)` em [app/_lib/api-helpers.js](../fbr-website/app/_lib/api-helpers.js): recebe `"YYYY-MM-DD"` do input HTML, devolve `"8 de Junho de 2026"`. Validação por regex (rejeita formato inválido devolvendo o input original).
- Aplicado em [reservar-preservacao/route.js](../fbr-website/app/api/reservar-preservacao/route.js) para `data.dataEvento` e em [vale-presente/route.js](../fbr-website/app/api/vale-presente/route.js) para `data.dataEnvio`. Smoke test inline (`node -e ...`) confirmou: `"2026-06-08" → "8 de Junho de 2026"`. Maria queixou-se que `06/08/2026` a confundia.

**Memórias actualizadas:**
- Nova: [project_supabase_public_grants_2026.md](../../C:/Users/maria/.claude/projects/c--Users-maria-Documents-fbr-admin2/memory/project_supabase_public_grants_2026.md) — email do Supabase a 30/05/2026 anunciou que a partir de **30/10/2026** tabelas novas no schema `public` em projectos existentes precisam de GRANT explícito. Não afecta tabelas existentes nem o projecto até essa data. Lembrete para acrescentar `GRANT ... TO authenticated, anon;` no fim de migrações novas a partir de Outubro 2026.

**Preflight `tsc + next build` limpos** no fbr-admin2. Build sem warnings novos.

**Maria: passos manuais (2 repos):**

1. **fbr-admin2 (este repo)**:
   - **Push para Vercel** (sem migrações).
   - **Smoke browser PC** → `/preservacao`:
     - Tabela: colunas alinhadas verticalmente entre grupos (antes "DATA EVENTO" do Pré-reservas estava à esquerda da "DATA EVENTO" do Reservas).
   - **Smoke browser PC** → abrir uma encomenda em workbench:
     - Cabeçalho intocado (mantém-se igual ao anterior em desktop).
     - Encomenda com `payment_status='30_pago'` → caixa "Contactada" **desaparecida**.
     - Encomenda no estado `flores_recebidas` com `payment_status='30_pago'` → aparece **"40% pedidos?"** ao lado do estado. Tica → fica verde.
     - Mudar payment para `70_pago` → "40% pedidos?" desaparece.
     - Estado `quadro_pronto` com `payment_status='70_pago'` → aparece **"30% pedidos?"**.
     - Mudar payment para `100_pago` → "30% pedidos?" desaparece.
   - **Smoke browser mobile (DevTools 375px)** → abrir uma encomenda:
     - Cabeçalho mais compacto, nome alinha na linha do back/nav (não toma linha sozinho).
     - Foto: por defeito sem URL visível. Toca na foto → overlay com input do URL aparece. Toca de novo → esconde.
     - Por baixo do hero: ordem **Finanças → Comunicações → Envio → Flores → ...** (em vez de Flores → Envio → ... → Comunicações → ... → Finanças).
     - Sidebar drawer aberto: rodapé com 1 linha (avatar+nome+Sair icon+Tema), em vez de 3 linhas.
   - **Smoke browser mobile** → vista tabela `/preservacao` continua a ter scroll horizontal (table-layout: fixed pode aumentar largura ligeiramente; min-width recalculado para 830+extras).

2. **fbr-website (repo separado)**:
   - **Push para Vercel** (apenas 3 ficheiros mudados: api-helpers.js + 2 routes).
   - **Smoke**: submete um form de teste no site público → confirma que o email recebido tem **"8 de Junho de 2026"** em vez de `2026-06-08` ou `08/06/2026`. Idem para o vale-presente.

3. **Supabase** (informativo, **sem acção agora**):
   - A partir de **30/10/2026**, tabelas novas no schema `public` precisam de GRANT explícito. Tabelas existentes não mexem. Lembrar-me dentro de uns meses ou no Dashboard Supabase → Advisors → Security.



Lote grande de afinações pós-uso pedidas pela Maria numa única mensagem. Apresentei plano com 1 pergunta de cor (escolheu **indigo**) e 1 pergunta de scope para a feature de Preservação (escolheu a opção mais ambiciosa — "mas fica fixe, nunca usei Linear/Notion").

**Dashboard — 6 queixas resolvidas:**

- **G (remover "parada há X dias")** — Maria: "não percebi para que serve". Removido em 2 sítios: na tabela [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) (badge na coluna Cliente quando `daysSinceUpdate >= 7`) e no header do workbench [workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx) (junto ao ID da encomenda). Variáveis órfãs (`isTerminalState`, `daysSinceUpdate`, `showStaleBadge`, `isStaleAlert`) limpas. Comportamento adicionado na sessão 63 a pedido de inércia; Maria descobriu que era ruído.

- **B (cores estado vs prioridade)** — antes `TASK_STATUS_COLORS` e `TASK_PRIORITY_COLORS` partilhavam slate/sky/amber → o mesmo pill amber significava "alta prioridade" OU "a fazer hoje" consoante o sítio. Reescritas em [src/types/tasks.ts](src/types/tasks.ts): estado passa a usar paleta exclusiva `stone/violet/emerald` (`por_comecar/a_fazer_hoje/em_curso`), prioridade mantém-se semântica `slate/sky/amber/rose`. `TASK_STATUS_DOT_COLOR` actualizado em conformidade. Sem colisão com `TASK_CATEGORY_COLORS` (dead code desde sessão 87, mantido).

- **A (bolinha tarefas activas indigo)** — Maria: "uma bolinha que nunca desaparece, só se a pessoa tiver 0 tarefas por fazer". Hook novo [src/hooks/use-my-active-tasks.ts](src/hooks/use-my-active-tasks.ts) com mesma estrutura de `useUnreadChatCount`: select de `tasks` filtrado por `done=false AND deleted_at IS NULL`, Realtime para INSERT/UPDATE/DELETE; reduce final filtra por `assignee_emails.includes(currentEmail)`. Em [layout.tsx](src/app/(admin)/layout.tsx): `useUnreadTasks` → `useMyActiveTasksCount`; tirada a condicional que zerava quando `pathname === "/"` (a bolinha persiste); cor dinâmica `badgeColorClass = showTasksBadge ? "bg-indigo-600" : "bg-sky-500"` aplicada às 2 instâncias (sidebar collapsada e expandida). `useUnreadTasks` continua no repo porque `markTasksSeenAction` no `dashboard-client.tsx` ainda usa o conceito de "tarefas novas" para o toast inicial — toast e bolinha passaram a ser conceitos distintos.

- **D (nome do cliente em vez do código)** — chip indigo de encomenda/vale dentro do card kanban passa a mostrar `client_name` ou `sender_name` (legível) em vez do código alfanumérico curto. Href continua a apontar para `/preservacao/<code>` ou `/vale-presente/<code>`. [page.tsx](src/app/(admin)/page.tsx) ganha 2 mapas novos: `orderClientById` e `voucherSenderById`; [dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx) propaga-os; [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx) passa-os até ao `DraggableTaskTile` que faz fallback ao código se o lookup falhar.

- **C (colunas vazias estreitas no PC)** — kanban deixa de usar `sm:grid sm:grid-cols-3 lg:grid-cols-6`; passa a **flex** no PC. Cada `CategoryColumn` decide o seu próprio width: vazia = `sm:w-[110px] sm:max-w-[110px] sm:flex-none` (só cabeçalho com ícone + contagem `0`); com tarefas = `sm:w-auto sm:max-w-none sm:flex-1 sm:basis-0 sm:min-w-[160px]`. Resultado: 5 colunas vazias + 1 com 6 tarefas → essa coluna ganha ~80% da largura do card em vez de 1/6. Mobile (`<sm`) intocado — mantém snap horizontal 85vw/42vw da sessão 92.

- **E (título vertical demais)** — `PriorityPill` saiu do `absolute top-1.5 right-1.5 z-10` que reservava `pr-14` no `flex` do título → sobravam ~90px e o título partia em 4-5 linhas. Agora vive na mesma linha que `StatusPill` (novo `flex gap-1.5 flex-wrap` abaixo da descrição). Título passa a usar a largura toda do card. Em combinação com (C), os títulos respiram de vez nas colunas com tarefas.

**Preservação — F (Vistas + Filtros + Colunas opcionais):**

A Maria pediu colunas opcionais ("ver só as que têm parceiro", "ver só Instagram") e escolheu a opção ambiciosa do menu (vistas guardáveis ao estilo Linear/Notion, "mas nunca usei isso"). Arquitectura escolhida: tudo localStorage, sem migração nova.

- **Helpers + tipos — [src/lib/preservacao-views.ts](src/lib/preservacao-views.ts) (novo, ~170 linhas):**
  - `OPTIONAL_COLUMNS` const tuple: `partner | origem | tipo_evento | nif | telefone | email | comissao | cupao` (8 colunas; `localizacao` ficou de fora — já existe como xl-only).
  - `FilterConfig` com 6 dimensões: `partner` (`'any' | 'with' | 'without' | { id: string }`), `origin`, `payment`, `eventType`, `couponStatus`, `nif`. Valor neutro `'any'`; outros valores reflectem os enums do schema. `EMPTY_FILTERS` para reset.
  - `applyFilters(orders, f)` faz curto-circuito quando `countActiveFilters === 0` (custo zero quando ninguém filtrou). Lógica por dimensão isolada num único `filter`.
  - `SavedView = { id, name, columns: ColumnKey[], filters: FilterConfig }`; `readStorage()` / `writeStorage()` com `try/catch` para tolerar quota / privacy mode; `makeId()` short random sem dependência externa.
  - `COLUMN_MIN_PX` em vez de `%` — `min-width` em pixels é mais robusto quando há muitas colunas (a tabela ganha scroll horizontal nativo via `style.minWidth` calculado em runtime).

- **UI — [src/app/(admin)/preservacao/_components/views-bar.tsx](src/app/(admin)/preservacao/_components/views-bar.tsx) (novo, ~600 linhas):**
  - 4 componentes internos: `ViewsMenu` (selector de vista), `FiltersPopover`, `ColumnsPopover`, `SaveViewPopover`. Um quinto, `ActiveFilterChips`, mostra cada filtro activo abaixo da barra com X para remover.
  - **Importante**: `PopoverTrigger` deste projecto vem de `@base-ui/react`, **não** aceita `asChild`. Em vez de wrappar `<Button>`, usa-se uma const `TRIGGER_BASE` + `TRIGGER_NEUTRAL`/`TRIGGER_ACTIVE` com classes equivalentes ao `Button variant="outline" size="sm"`. Estado "activo" (filtros ou colunas aplicados) destaca-se a indigo.
  - Mudar qualquer filtro ou coluna **chama `setActiveViewId(null)`** — assim que se desvia da vista guardada, deixa de estar marcada como activa (até gravar de novo).
  - Narrowing manual na branch do filtro Parceiro: `const partner = filters.partner; if (partner !== 'any') {...}` — TS não infere o estreitamento dentro de JSX se a comparação for em `filters.partner` directamente.

- **Integração — [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx):**
  - `useState` + hidratação `useEffect` para `extraColumns`, `filters`, `savedViews`, `activeViewId` (flag `viewsHydrated` evita escrever vazio antes da hidratação). Cada mudança escreve `localStorage`.
  - Pipeline de filtragem: `optimistic → search → applyFilters(filters)`. Grouping local sempre que há `search || optimisticMoves || activeFiltersCount > 0`.
  - `<ViewsBar>` renderizada num bloco novo entre o header e o conteúdo (`bg-cream-50/50` com border), **só na vista tabela** e não em arquivados.
  - `GroupSection` + `OrderRow` ganham props `extraColumns` + `partnerNameById`. `<colgroup>` antigo (que usava `%` rígidos) substituído por `<thead>` com `min-width` por coluna + `style={{ minWidth: 760 + sum(COLUMN_MIN_PX) }}` para a tabela crescer em scroll.
  - Novo componente local `ExtraCell` switch-case por coluna: render apropriado para cada uma (chip Cupão, mono NIF, etc.). Empty state consistente "—" cocoa-500.
  - [page.tsx](src/app/(admin)/preservacao/page.tsx) ganha query nova a `partners` (id+name, ordenado por nome) — alimenta o dropdown do filtro Parceiro e o display da coluna "Parceiro".

**Preflight `tsc + next build` limpos** após 2 ciclos de correcção (asChild → className inline; type narrowing manual; `string | null` no `onValueChange`). Build em ~62s.

**Memórias actualizadas:** nada novo — todas as decisões caíram em padrões já memorizados (`feedback-aplicar-padroes-em-areas-analogas`, `feedback-valores-euro-direita`, `feedback-desktop-prioridade`, `feedback-simplificar-antes-de-redesenhar`).

**Maria: passos manuais (sem migração nova):**

1. **Push para Vercel**.
2. **Sem nada para correr no Supabase** — toda a feature de Preservação usa `localStorage`.
3. **Smoke browser** — abrir `https://admin.floresabeirario.pt/`:
   - **Sidebar (qualquer página)**: ao item Dashboard, bolinha **indigo** com nº das tuas tarefas activas. Esconde só quando vais a 0.
   - **Dashboard → kanban**:
     - Cards têm chip de estado (stone/violet/emerald) **distinto** do chip de prioridade (slate/sky/amber/rose). Antes "ALTA" e "Hoje" eram ambos amber idênticos.
     - Coluna sem tarefas no PC ficou bem mais estreita (~110px); colunas com tarefas ocupam o resto. No mobile, o snap horizontal mantém-se igual.
     - Card com tarefa ligada a encomenda → chip indigo no topo mostra **nome do cliente**, não o código alfanumérico.
     - Título do card respira (já não parte em 4-5 linhas estreitas).
     - Prioridade desceu para a mesma linha que o estado, no fundo do card.
   - **Preservação → tabela**: nova barra cream em cima do conteúdo com 3 botões `Vista: Todas ▾`, `Filtros`, `Colunas`.
     - **Filtros** → popover com Parceiro / Origem / Pagamento / Tipo de evento / Cupão / NIF. Escolhe "Origem: Instagram" → tabela filtra-se; aparece chip indigo "Origem: Instagram" abaixo. Clica no X para remover.
     - **Colunas** → checkbox de 8 colunas opcionais. Liga "Parceiro" → coluna nova aparece entre Estado e Orçamento com o nome do parceiro (ou — se sem).
     - **Guardar vista** → após aplicar filtros/colunas, aparece botão "Guardar vista" → dá-lhe um nome → fica na lista do selector de Vista. Mudar de vista carrega tudo de uma só vez. Cada vista tem X para apagar (hover).
   - **Workbench → header** já não tem o badge "parada há X dias" junto ao ID.
4. **Esperado em produção**: as preferências de coluna/filtros/vistas ficam guardadas **por browser/dispositivo** (não sincroniza com o telemóvel — `localStorage` é local). Se Maria quiser sincronizar entre dispositivos no futuro, requer mig nova para tabela `user_preferences`.

### Sessão 96 📱 Mobile polish (workbench/sidebar/tabela) + email do form com mês por extenso

Lote pós-uso (2026-05-30): (a) tabelas de `/preservacao` alinhadas entre grupos via `tableLayout:'fixed'` + `width:` explícito por `<th>` (coluna Cliente elástica); (b) prompt "Contactada" esconde após qualquer pagamento (`payment_status==='100_por_pagar'`); (c) novos prompts persistentes "40% pedidos?"/"30% pedidos?" no header (campos `payment_40_requested`/`payment_30_requested` da mig 018, sem migração); (d) workbench mobile redesenhado (header compacto, overlay de URL da foto toggle por tap, reordenação de cards via `display:contents`+`order-N` só mobile); (e) sidebar mobile compactada (bloco de fundo numa linha); (f) **fbr-website**: `formatDatePT()` em api-helpers.js → emails do form com mês por extenso ("8 de Junho de 2026") em reservar-preservacao + vale-presente. Sem migrações; preflight limpo.

### Sessão 93 🧾 3 anexos de fatura por encomenda + tarefa automática "Enviar fatura"

Maria explicou que cada pagamento do cliente gera uma fatura separada (sinal 30%, intermédio 40%, final 30% — ou variações 70/30, 100% à cabeça). Até agora `orders.invoice_attachment_url` guardava apenas 1 link na BD, perdendo o histórico das outras 2 facturas. Pediu também que **assim que o link da fatura é colado** (NULL → URL), seja criada automaticamente uma tarefa a pedir para enviar a fatura à cliente.

**Decisões fixadas em conversa:**
- **3 campos fixos** em `orders` (renomeio do existente + 2 novos) — Maria rejeitou tabela `order_invoices` separada. Facturas ficam na Drive como antes; BD guarda apenas URL.
- **Tarefa automática** com título `Enviar fatura — {client_name} ({sinal|intermédio|final})`, categoria `administrativo`, prioridade `alta`, **sem prazo**.
- **Aplicar padrão também ao Vale-Presente** (memória [[feedback-aplicar-padroes-em-areas-analogas]]): vales têm 1 só fatura mas a mesma lógica de NULL → URL → criar tarefa.

**Migração 060 — [supabase/migrations/060_split_invoice_urls.sql](supabase/migrations/060_split_invoice_urls.sql):**
- `ALTER TABLE orders RENAME COLUMN invoice_attachment_url TO invoice_url_sinal`. Mantém os dados existentes (sinal era o caso mais comum).
- `ADD COLUMN invoice_url_intermedio TEXT` + `invoice_url_final TEXT`.
- `CREATE OR REPLACE FUNCTION anonymize_order` actualizada (mig 024) para limpar os 3 campos novos em vez de só `invoice_attachment_url`.
- Policy `orders_public_insert` (mig 016) reescrita para validar que os 3 campos são NULL na submissão do form público (admin é que anexa depois). Vouchers ficam com nome `invoice_attachment_url`.

**Tipos — [src/types/database.ts](src/types/database.ts):**
- `Order.invoice_attachment_url` → substituído por `invoice_url_sinal`, `invoice_url_intermedio`, `invoice_url_final` (todos `string | null`).
- Comentário inline explica o mapping por pagamento.

**Workbench Preservação — [workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx):**
- `invoiceSlotsVisible` calcula slots a mostrar consoante `payment_status`: sinal aparece com qualquer pagamento (`30_pago`+); intermédio só com `70_pago` ou `100_pago`; final só com `100_pago`.
- `missingInvoice` passa a só disparar se NENHUM dos 3 slots estiver preenchido (em vez de só o antigo `invoice_attachment_url`).
- Bloco da fatura redesenhado: `Label` "Anexos das faturas (Drive)" + lista de `<div>` filtrados pelo slot.show, cada um com etiqueta lateral (`Sinal` / `Intermédio` / `Final` numa coluna de 80px) + `Input` URL + ícone Paperclip se preenchido.

**Server action — [src/app/(admin)/preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts):**
- `needsPrev` ganha 3 novos triggers (qualquer dos `invoice_url_*` em updates).
- Select de `prev` inclui agora os 3 campos.
- `newInvoiceSlots: Array<'sinal'|'intermedio'|'final'>` acumula transições NULL → URL detectadas no `if (prev)`. **Substituir URL não conta** (assume-se correcção de erro de cópia, não fatura nova).
- Após UPDATE bem-sucedido, faz `supabase.auth.getUser()` para saber quem é o autor e insere em massa `tasks` (1 por slot) com `assignee_emails=[user.email]`, `order_id=updatedOrder.id`, `status='por_comecar'`, sem `due_date`. Silencioso em erro (não bloqueia UPDATE).

**Server action — [src/app/(admin)/vale-presente/actions.ts](src/app/(admin)/vale-presente/actions.ts):**
- Refactor do `updateVoucherAction`: select de `prev` agora condicional a `needsPrev` (igual padrão da preservação), inclui `invoice_attachment_url`.
- `newInvoiceLink` boolean detecta NULL → URL. Após UPDATE, insere 1 tarefa `Enviar fatura — {sender_name}` com `voucher_id`. Mesmo padrão de fallback silencioso.

**Export CSV — [src/lib/export-csv.ts](src/lib/export-csv.ts):**
- Coluna "Anexo fatura" do `COLUMNS` (encomendas) substituída por 3 colunas: `Anexo fatura (sinal)`, `Anexo fatura (intermédio)`, `Anexo fatura (final)`. Vouchers ficam com 1 coluna.

**Preflight `tsc + next build` limpos** em ~120s.

**Maria: passos manuais:**
1. **Correr [mig 060](supabase/migrations/060_split_invoice_urls.sql)** no Supabase SQL Editor. Verificar:
   ```sql
   SELECT column_name FROM information_schema.columns
     WHERE table_name='orders' AND column_name LIKE 'invoice_url_%';
   -- → 3 linhas: invoice_url_sinal, invoice_url_intermedio, invoice_url_final
   ```
2. **Push para Vercel**.
3. **Smoke browser** → abrir uma encomenda 100% paga existente em `/preservacao/[id]`:
   - O URL que estava em `invoice_attachment_url` antes deve aparecer agora no slot "Sinal" (migrado automaticamente pelo RENAME).
   - Os slots "Intermédio" e "Final" aparecem vazios (correcto).
   - Colar um URL Drive no slot "Final" → após save (~900ms debounce + flush) recarregar `/` → aparece tarefa nova `Enviar fatura — {nome} (final)` em "Por começar" → administrativo.
4. **Smoke vale**: abrir um vale, colar URL no "Anexo da fatura" → tarefa nova `Enviar fatura — {sender_name}` no Dashboard.
5. **Verificar que substituir URL não cria tarefa**: trocar o link existente do "Sinal" por outro → não deve haver tarefa nova (só URL→URL, não NULL→URL).

### Sessão 92 🎯 Kanban dos Afazeres globais redesenhado + estado GTD + mobile snap-scroll

Maria pediu inspiração no kanban do Bitrix24 (screenshot partilhado). Triplo pedido: (a) melhorar design no PC e responsividade no mobile; (b) acrescentar um estado por tarefa tipo "não comecei / a fazer"; (c) mostrar há quantos dias a tarefa foi criada; (d) **desactivar drag no mobile** (queixa concreta: ao fazer scroll, cards e colunas iam parar a sítios errados).

**Decisões fixadas em conversa (4 perguntas → respostas Maria):**
- **3 estados estilo GTD**: `por_comecar` / `a_fazer_hoje` / `em_curso`. `done` continua separado (checkbox).
- **Mobile = scroll horizontal estilo Bitrix** (uma coluna inteira visível, snap por coluna).
- **"Há X dias"**: discreto cinzento no fundo do card, **substitui** o slot do prazo quando não há prazo (Maria escolheu as duas opções — implementação: o slot ou mostra prazo OU mostra "há X dias" ou fica vazio se a tarefa está concluída).

**Migração 059 — [supabase/migrations/059_tasks_status.sql](supabase/migrations/059_tasks_status.sql):**
- `ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'por_comecar' CHECK (status IN ('por_comecar','a_fazer_hoje','em_curso'))`.
- Backfill implícito via DEFAULT (todas as tarefas existentes ficam em `por_comecar`).
- Index parcial `tasks_status_idx` em `(status)` filtrado por `deleted_at IS NULL AND done = false` (idêntico ao padrão do `tasks_category_idx`).

**Tipos — [src/types/tasks.ts](src/types/tasks.ts):**
- `TaskStatus = "por_comecar" | "a_fazer_hoje" | "em_curso"`.
- `Task.status: TaskStatus` (não-opcional — a BD garante sempre presença via DEFAULT).
- `TASK_STATUS_LABELS` (full: "Por começar/A fazer hoje/Em curso"), `TASK_STATUS_SHORT` (compacto: "Por começar/Hoje/Em curso"), `TASK_STATUS_COLORS` (slate / amber / sky), `TASK_STATUS_DOT_COLOR` (bola no chip), `TASK_STATUS_ORDER` (em_curso=0 sobe ao topo).

**UI — [src/app/(admin)/_components/dashboard/tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- **`useIsMobile()` hook**: `useSyncExternalStore` em cima de `matchMedia("(max-width: 639px)")`. Pattern escolhido para evitar setState-em-useEffect (regra ESLint) e mismatch de hidratação (SSR devolve false). Boolean primitivo = sem armadilha de getSnapshot.
- **Sort de tarefas**: novo critério primário `TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]` antes do prazo. Em curso vai sempre ao topo dentro da coluna.
- **Form nova tarefa**: grelha passa de 3 para 4 colunas (Categoria / Estado / Prioridade / Prazo). Estado default `por_comecar`.
- **`handleStatusChange`**: idêntico aos outros handlers (optimistic + server action + rollback em erro).
- **`StatusPill`** novo componente (irmão do `PriorityPill`): chip rounded-full com dot + abreviatura; popover para mudar estado; abre na linha abaixo do título.
- **Layout do container** das colunas: `flex overflow-x-auto snap-x snap-mandatory -mx-5 px-5` no mobile; `sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible sm:snap-none` no PC. `-mx-5 + px-5` faz edge-bleed para o scroll horizontal usar a largura toda da tela.
- **Cada `CategoryColumn`**: ganha `snap-start shrink-0 w-[85vw] max-w-[320px]` no mobile e `sm:w-auto sm:max-w-none sm:shrink` no PC. Header: ícone passa de h-6 para h-7; contagem passa de texto solto para badge pill branco (`bg-white/70 rounded-full`); padding global +1 step.
- **Cada `DraggableTaskTile`**: padding passa de `px-2 py-1.5` para `px-2.5 py-2`; border-radius `lg`. Quando não tem prazo e está activa, mostra "há X dias" italic em cinzento claro no slot onde antes estaria o prazo.
- **Drag desactivado no mobile**: em ambos `CategoryColumn` (header) e `DraggableTaskTile` (card inteiro), só se spreaded `setNodeRef + attributes + listeners` se `!isMobile`. Classes `touch-none cursor-grab active:cursor-grabbing` também só no PC. PointerSensor: `activationConstraint.distance` passa de 6 para 9999 no mobile (segunda linha de defesa — mesmo se a árvore DnD ficasse activa, drag nunca dispara). Hooks `useDraggable`/`useDroppable` continuam a ser chamados em todas as renders (não condicionalmente) para respeitar rules of hooks.

**Pequeno polish:**
- `formatDoneAgo` reutilizado (estava em `format-helpers.ts` para "Concluídas recentes" — funciona tal e qual para "criada há X").
- Edição inline (`TaskEditForm`) não muda — a Maria pode mudar estado pelo `StatusPill` directo no card.

**Preflight `tsc + next build` limpos.** Build em ~50s (TypeScript). Sem warnings novos.

**Maria: passos manuais:**
1. **Correr [mig 059](supabase/migrations/059_tasks_status.sql)** no Supabase SQL Editor. Verificar:
   ```sql
   SELECT column_name, column_default FROM information_schema.columns
     WHERE table_name='tasks' AND column_name='status';
   -- → 1 linha, default 'por_comecar'

   SELECT status, count(*) FROM tasks
     WHERE deleted_at IS NULL GROUP BY status;
   -- → todas em 'por_comecar'
   ```
2. **Push para Vercel** (alterações em types/tasks.ts + tasks-card.tsx).
3. **Smoke browser (PC)** → `/`:
   - Cada card tem agora 3 partes verticais: título + checkbox + prioridade no topo; **estado (chip cinzento "Por começar")** no meio; avatares + prazo/"há X dias" no fundo.
   - Click no chip de estado → popover com 3 opções. Mudar para "Em curso" → tarefa sobe ao topo da coluna.
   - Tarefa sem prazo: aparece "há 2 dias" (ou "agora" se acabada de criar) em cinzento italic no canto inferior direito.
   - Drag de card e drag de header de coluna continuam a funcionar como antes.
4. **Smoke browser (mobile / DevTools < 640px)** → `/`:
   - Os 6 grupos aparecem em scroll horizontal — vês 1 coluna inteira de cada vez, com snap a encaixar na próxima.
   - **Scroll vertical dentro de uma coluna funciona sem mover cards** (era a queixa).
   - **Scroll horizontal entre colunas funciona sem reordenar grupos** (era a outra queixa).
   - Tentar arrastar um card: nada acontece (drag desactivado por design).
   - Checkbox, pills de estado/prioridade e avatares continuam tocáveis.

### Sessão 91 💰 COGS tudo-ou-nada + snapshot capturado a 100% pago (2 partes)

#### Parte 1 — Regra COGS tudo-ou-nada

Maria observou que não percebia como a margem estava a ser calculada. Investigação revelou que o COGS era contado **proporcional ao %pago** (paidRatio × cogs_full) — herança da sessão 88-F, com a intenção de "manter receita e custo em sintonia". Maria explicou (resumido por mim na conversa, confirmado por ela): contar 30% do custo quando o cliente só pagou 30% sub-valoriza o que realmente foi gasto, porque os materiais entram de uma vez quando a encomenda vai para produção. Regra escolhida: **COGS conta tudo ou nada, dependendo apenas do `payment_status='100_pago'`**. Receita e comissões mantêm-se proporcionais (essas continuam a fazer sentido proporcionais — são compromissos parciais).

**Decisões fixadas em conversa:**
- COGS é tudo-ou-nada: 100% pago = `cogs_full`; tudo o resto = 0.
- Receita continua proporcional (100%/70%/30%/0).
- Comissões continuam proporcionais ao %pago (intocado).
- `margin_recognized` passa a ser `revenue_recognized − cogs_recognized − commission_recognized` em vez de `margin_full × ratio` — antes coincidiam, agora divergiriam silenciosamente. Não há callers a usar `margin_recognized` fora do tipo, mas a semântica fica correcta para futuros usos.

**Mudanças em [src/lib/finance.ts](src/lib/finance.ts):**
- `cogsRecognizedFromOrder`: passa de `cogsFullFromOrder(order) * paidRatio(...)` para `order.payment_status === "100_pago" ? cogsFullFromOrder(order) : 0`.
- `orderPnL`: variáveis intermédias (`isFullyPaid`, `cogs_recognized`, `revenue_recognized`, `commission_recognized`) calculadas explicitamente para clareza; `margin_recognized` agora `revenue_recognized − cogs_recognized − commission_recognized`.
- JSDoc actualizado com nota da decisão Maria 2026-05-22.

**Novo action — [src/app/(admin)/preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts):**
- `backfillProductionCostSnapshotsAction()` — devolve `{ updated: number; skipped: 0 }`. Faz select uma vez de `production_cost_items`, constrói o snapshot, e UPDATE em massa via `.in("id", ids)` em todas as encomendas com `production_cost_snapshot IS NULL AND deleted_at IS NULL`. **Idempotente**: pode correr-se quantas vezes for preciso; só toca em encomendas sem snapshot. `revalidatePath` para `/preservacao` e `/financas`. **Aproximação aceitável**: usa preços actuais, não os do tempo da encomenda (não há forma de saber os preços históricos pré-mig 034).

**UI — [src/app/(admin)/financas/financas-client.tsx](src/app/(admin)/financas/financas-client.tsx):**
- Comentário interno em `FaturacaoTab` actualizado: "COGS tudo-ou-nada: só conta quando a encomenda está 100% paga".
- Texto explicativo no fundo da Faturação: parágrafo do "Custo de produção" passa a dizer "**contado apenas quando a encomenda está 100% paga** (encomendas a 30%/70%/por pagar contribuem 0)".
- Novo componente `BackfillCogsSection` no fundo do `CatalogoTab` (admin only via `canEdit`): rounded box cream com explicação curta + botão "Preencher snapshots" (`Wand2` icon). Confirmação via `window.confirm` (operação one-shot, AlertDialog seria exagero). `useTransition` para estado pendente; toast info/success/error. `router.refresh()` após sucesso para o Painel/Faturação reflectir o backfill imediatamente.

#### Parte 2 — Snapshot capturado no momento de 100% pago

Maria observou: "uma pessoa faz agora uma reserva para 2027 e eu sei lá quais vão ser os custos em 2027". O snapshot capturado na criação (`createOrderAction`) ficava desactualizado para reservas a longo prazo. **Nova regra**: snapshot capturado quando a encomenda passa a `payment_status='100_pago'`, com a tabela rosa vigente nesse momento (preços mais próximos da produção real).

**Implicações que Maria confirmou aceitar:**
- Encomendas em curso (30%/70%/por pagar) deixam de ter snapshot.
- Na aba **P&L por encomenda**, coluna COGS mostra "—" para essas (em vez de cogs_full do snapshot antigo).
- Painel e Faturação intocados (já contavam 0 para essas pela regra da Parte 1).
- Snapshot de encomendas existentes a 30%/70% é **limpo** via migração 058 (escolheu "limpar as em curso").

**Mudanças em [src/app/(admin)/preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts):**
- `createOrderAction`: bloco que lia `production_cost_items` e fazia `buildProductionCostSnapshot` removido. Comentário explica a decisão. Encomendas novas nascem com `production_cost_snapshot=NULL`.
- `updateOrderAction`: variável `captureProductionSnapshot` boolean. Detecção da transição (linha ~358): `updates.payment_status === "100_pago" && prev.payment_status !== "100_pago"`. Imediatamente antes do UPDATE, se a flag é true, lookup à `production_cost_items` e injecta no `updates.production_cost_snapshot` (atómico com a mudança de pagamento). `console.warn` se a tabela rosa estiver vazia (improvável; não bloqueia a transição).
- `backfillProductionCostSnapshotsAction` ajustado para filtrar por `.eq("payment_status", "100_pago").neq("status", "cancelado")`. Alinhado com a nova regra (só preencher 100% pagas).

**Migração — [supabase/migrations/058_clear_inprogress_production_snapshots.sql](supabase/migrations/058_clear_inprogress_production_snapshots.sql):**
- `UPDATE orders SET production_cost_snapshot = NULL WHERE payment_status <> '100_pago' AND status <> 'cancelado' AND deleted_at IS NULL AND production_cost_snapshot IS NOT NULL`.
- Encomendas 100% pagas mantêm o snapshot que tinham. Canceladas e soft-deleted ficam intocadas (sem impacto financeiro; melhor preservar histórico).

**UI ajustada — [src/app/(admin)/financas/financas-client.tsx](src/app/(admin)/financas/financas-client.tsx):**
- `BackfillCogsSection`: título passa a "encomendas 100% pagas antigas"; texto explica que encomendas em curso não são afectadas (snapshot capturado automaticamente quando passam a 100%).
- Confirmação `window.confirm` actualizada para mencionar "100% pagas".

**Sem migração nova na Parte 1.** Apenas migração 058 (Parte 2). Preflight `tsc + next build` limpos em ambas as partes.

**Maria: passos manuais (Parte 1 + 2 combinados):**
1. **Correr [mig 058](supabase/migrations/058_clear_inprogress_production_snapshots.sql)** no Supabase SQL Editor. Verificar:
   ```sql
   SELECT payment_status,
     count(*) FILTER (WHERE production_cost_snapshot IS NOT NULL) AS com_snapshot,
     count(*) FILTER (WHERE production_cost_snapshot IS NULL) AS sem_snapshot
   FROM orders
   WHERE deleted_at IS NULL AND status <> 'cancelado'
   GROUP BY payment_status
   ORDER BY payment_status;
   ```
   → linhas que não sejam `100_pago` devem ter `com_snapshot = 0`.
2. **Push para Vercel** — código (parte 1 + 2).
3. **Smoke browser** → `/financas`:
   - **P&L por encomenda**: encomendas 100% pagas pré-mig 034 (Joana, Rita, Sandra, Maria Inês no screenshot da sessão) continuam a mostrar COGS="—" até clicares no botão de backfill (passo 4). Encomendas a 70%/30% mostram "—" também (correcto pela regra nova).
   - **Catálogo** → fundo da aba: clicar "Preencher snapshots" → confirmação → toast "N encomendas actualizadas" (N = nº de 100% pagas sem snapshot).
   - Voltar ao P&L → as 4 linhas a 100% passam a mostrar COGS com valor.
4. **Smoke fluxo novo**: criar encomenda nova, marcar pagamento a 100% → ir ao P&L → COGS deve aparecer (snapshot capturado automaticamente na transição).

### Sessão 90 🎯 Catálogo editável — verde substitui PrecosTab + consumíveis para extras autónomos

**Continuação intra-sessão** (parte B): depois de descobrir que mig 035 não estava aplicada na produção (vazia tabela rosa), Maria correu mig 035, depois pediu para acrescentar 3 colunas à tabela rosa "Outros custos recorrentes": 20x25 mini, Ornamento, Pendente. Foi feito via mig 056 e o cost_fbr criado mais cedo na mesma sessão (mig 054) ficou deprecated — o custo dos extras autónomos no Bloco 2 da verde passa a derivar dos consumíveis em vez de campo dedicado. Mais coerente: cada produto tem o seu custo somado dos consumíveis na rosa, sem dupla via.

Maria pediu para simplificar a sub-aba Catálogo. Observação dela: as 3 subsecções da antiga `PrecosTab` (azul Moldura, lilás Suplemento, amber Extras) eram redundantes com a tabela verde de "Margem teórica" que estava em cima. Decisão final após várias iterações: a verde passa a ser **a interface editável principal de preços**, e os preços-base + suplementos só se editam lá. As 6 tabelas de Custos de produção em baixo mantêm-se intocadas (são a fonte dos custos derivados na verde).

**Decisões de design fixadas em conversa (referência crítica):**
- **Verde como single source of truth de preços ao cliente**: PrecosTab eliminada inteiramente.
- **Custos de produção mantêm-se em 6 tabelas separadas**: Maria viu o screenshot e disse "vamos manter estas 6 tabelas, acho que fazem sentido existir". Não colapsadas, não fundidas. Verde apenas mostra o subtotal por linha (read-only) derivado delas.
- **Mini 20x25 entra no Bloco 1 com 3 fundos** (não no Bloco 2 como extra avulso): tem a mesma estrutura de margem que os 3 tamanhos principais. Preço-base vive em `pricing_items.extra.mini_frame` (não em `base_frame` — herança do schema original); helper trata da divergência.
- **Base partilhada via rowspan**: 1 célula `Base` cobre as 3 linhas de cada tamanho (transparente/preto/foto). Resolve a ambiguidade que a Maria levantou ("se editar a do preto, e a do transparente é igual…").
- **+€ Supl. só editável na linha fotografia**: as outras linhas mostram "—". Para transparente/preto/cor o suplemento é sempre 0.
- **Fotografia mini também tem suplemento**: novo item `background_supplement.fotografia_mini` (placeholder 0€, Maria edita quando souber). Implica alteração ao `computePricingSnapshot` para somar este suplemento por cada mini quando fundo=fotografia.
- **Custo FBR de ornamento + pendente é editável na verde** (Bloco 2): nova coluna `pricing_items.cost_fbr` guarda esse valor. Mini não usa cost_fbr — custo deriva das tabelas de produção. Maria começa com 0 e edita "depois".

**Aprendizagem da sessão:** No início da conversa, afirmei à Maria que os pricing items dos extras (`mini_frame`, `christmas_ornament`, `necklace_pendant`) não existiam na BD. Estava errado — existiam em [mig 025](supabase/migrations/025_pricing.sql:142-144) com preços 45/25/15. Tinha feito grep só na mig 033 (que tinha um seed parcial). Maria reparou: "no workbench quando o cliente seleciona extra tu calculas o preçço" — observação correcta que devia ter feito sozinho. Memória nova: [[feedback-verificar-existencia-bd]] — antes de afirmar "X não existe na BD", procurar em todas as migrações + verificar se o código (lib/, types/) já referencia a key (se referencia, existe — ou o sistema estaria rebentado em produção).

**Migração 054 — [supabase/migrations/054_pricing_cost_fbr_and_mini_photo.sql](supabase/migrations/054_pricing_cost_fbr_and_mini_photo.sql):**
- `ALTER TABLE pricing_items ADD COLUMN cost_fbr NUMERIC(10,2)`: custo interno FBR por unidade para extras autónomos (ornamento, pendente). NULL para itens cujo custo vem das tabelas de produção (mini_frame) ou onde o conceito não se aplica (base_frame, background_supplement).
- `UPDATE` inicializa `cost_fbr=0` em `christmas_ornament` + `necklace_pendant` (placeholder editável).
- `INSERT` novo item `background_supplement.fotografia_mini` (price 0, position 8) para o suplemento foto do mini 20x25.

**Tipos — [src/types/pricing.ts](src/types/pricing.ts):**
- `PricingItem.cost_fbr: number | null` adicionado.
- `PricingItemInsert` e `PricingItemUpdate` agora aceitam `cost_fbr`.

**Lógica do orçamento — [src/lib/pricing.ts](src/lib/pricing.ts:99-119):**
- Novo bloco "3b" em `computePricingSnapshot`: quando `frame_background === 'fotografia'` E `extra_small_frames === 'sim'` E `qty > 0`, lookup do item `background_supplement.fotografia_mini` e adiciona linha `qty × unit_price` ao snapshot. Skip se `price <= 0` (evita poluir snapshot com linhas a 0€).

**UI — [src/app/(admin)/financas/financas-client.tsx](src/app/(admin)/financas/financas-client.tsx):**
- `CatalogoTab` simplificada: renderiza apenas `MargemTeoricaSection` + `CustosTab`. Removida a chamada a `PrecosTab`.
- `MargemTeoricaSection` reescrita do zero (~280 linhas). Agora aceita `canEdit`, renderiza Bloco 1 (quadros 4×3 com rowspan em Base) + Bloco 2 (2 extras autónomos), todas as células editáveis usam o novo componente `EditableEuro` (input com onBlur save, padrão "store info from previous renders" para sincronizar draft local).
- Novo `SIZES: SizeMeta[]` mapeia cada tamanho à sua chave de pricing (`base_frame.30x40` vs `extra.mini_frame`) e à sua chave de suplemento foto (`fotografia_30x40` vs `fotografia_mini`). Resolve a divergência de schema sem hardcode.
- Helper `rowCost(size, bg)` calcula o custo derivado: usa `computeProductionCost` para 30x40/40x50/50x70 (paridade garantida com encomendas reais), e calcula manualmente para mini (frame line + photo print se foto), porque o mini não tem caminho próprio em `computeProductionCost`.
- `EditableEuro({ item, field, canEdit, align })`: input numérico genérico que persiste `item[field]` via `updatePricingItemAction({ [field]: next })`. Usado para todas as células editáveis (Base, Supl., Preço extra, Custo extra). Formato europeu (vírgula decimal, sem milhares).
- **PrecosTab e PriceRow eliminadas**: ~200 linhas de código morto removidas. Imports `PRICING_CATEGORY_LABELS / HELPER` e tipo `PricingCategory` também removidos do ficheiro.

**Preflight `tsc + next build` limpos** após 1 falso positivo inicial (cache do Next.js typecheck — `npx tsc --noEmit` standalone passou). Build em ~32s.

**Migração 056 — [supabase/migrations/056_consumables_extras_keys.sql](supabase/migrations/056_consumables_extras_keys.sql):**
- `ALTER CONSTRAINT production_cost_items_size_key_check`: expande o enum para aceitar `christmas_ornament` e `necklace_pendant` como size_keys. O nome "size_key" fica (renomear seria invasivo) mas o COMMENT da coluna esclarece que agora é "identificador de produto vendável", não apenas tamanho físico.
- `cost_fbr` da pricing_items (criada na mig 054) fica deprecated. Não fizemos DROP COLUMN para evitar destruição — a coluna fica lá, ignorada pela UI. Migração futura pode limpar.

**Tipos — [src/types/production-cost.ts](src/types/production-cost.ts):**
- `ProductionCostSize`: adicionar `"christmas_ornament" | "necklace_pendant"`.
- `PRODUCTION_SIZE_LABELS`: "Ornamento" + "Pendente".
- `PRODUCTION_SIZES_ORDER` (em financas-client.tsx) mantém 4 tamanhos físicos — apenas a `ConsumablesSection.sizes` foi expandida para 6.

**Tipos — [src/types/pricing.ts](src/types/pricing.ts):**
- `PricingItem.cost_fbr` removido. Comment explica que a coluna na BD ficou deprecated após mig 056.

**Server action — [src/app/(admin)/financas/actions.ts](src/app/(admin)/financas/actions.ts):**
- `createConsumableAction(label)`: passa de 3 para 6 INSERTs (30x40, 40x50, 50x70, mini_20x25, christmas_ornament, necklace_pendant). Maria edita o custo onde se aplica e deixa 0 nos restantes.

**UI — [src/app/(admin)/financas/financas-client.tsx](src/app/(admin)/financas/financas-client.tsx):**
- `ConsumablesSection.sizes` passa de 3 para 6 elementos.
- `MargemTeoricaSection` ganha helper `consumablesCostByProduct: Map<string, number>` (soma de cost por size_key) + `consumablesCost(productKey)` lookup.
- Bloco 2 da verde: coluna "Custo FBR (€)" editável → coluna "Custo" derivada (read-only, rose). Mostra `consumablesCost("christmas_ornament")` e `consumablesCost("necklace_pendant")` respectivamente.
- `EditableEuro.field` simplificado de `"price" | "cost_fbr"` para `"price"` (cost_fbr deixou de ser usado).
- Texto explicativo no Bloco 2: "Custo deriva dos consumíveis das colunas Ornamento e Pendente na tabela 'Outros custos recorrentes' em baixo."

**Preflight tsc + next build limpos.**

**Aprendizagem da sessão:** No início da conversa, afirmei à Maria que os pricing items dos extras (`mini_frame`, `christmas_ornament`, `necklace_pendant`) não existiam na BD. Estava errado — existiam em [mig 025](supabase/migrations/025_pricing.sql:142-144) com preços 45/25/15. Tinha feito grep só na mig 033 (que tinha um seed parcial). Maria reparou: "no workbench quando o cliente seleciona extra tu calculas o preçço" — observação correcta que devia ter feito sozinho. Mais tarde na sessão, a tabela rosa apareceu vazia com erro ao Adicionar — diagnóstico: mig 035 nunca aplicada na produção (PROGRESS dizia que sim, mas não). Memória: [[feedback-verificar-existencia-bd]].

**Maria: passos manuais (3 migrações):**
1. **Correr [mig 054](supabase/migrations/054_pricing_cost_fbr_and_mini_photo.sql)** — feito (confirmado por query SQL: `mig_054_aplicada=true`).
2. **Correr [mig 035](supabase/migrations/035_production_consumables.sql)** — feito durante a sessão (tabela rosa passou a ter consumíveis).
3. **Correr [mig 056](supabase/migrations/056_consumables_extras_keys.sql)** — NOVA, ainda por correr. Verificar com:
   - `SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name='production_cost_items_size_key_check';` → contém `christmas_ornament` e `necklace_pendant`.
4. **Push para Vercel**.
5. **Smoke browser** → `/financas` → "Catálogo":
   - **Tabela rosa "Outros custos recorrentes"** agora tem 6 colunas: 30x40, 40x50, 50x70, 20x25 mini, Ornamento, Pendente. Cada consumível existente passa a mostrar 6 cells (mas só as 3 originais têm valor seeded; as 3 novas começam em 0 — Maria edita conforme aplicável).
   - Editar um custo na coluna "Ornamento" (ex.: "Caixa de cartão" para Ornamento = 1€) → vê a coluna **Custo** do Bloco 2 da verde no topo actualizar para 1€ (assumindo só esse consumível tem valor); Margem ajusta.
   - Adicionar consumível novo via "+" → cria 6 linhas (uma por produto). Em SQL: `SELECT count(*) FROM production_cost_items WHERE label='novo nome' AND deleted_at IS NULL;` → 6.

**Pendente (não bloqueia):** Auditoria completa de migrações 035-053 com query consolidado (proposta no fim da sessão). Recomendo correr para confirmar que mais nenhuma migração ficou para trás silenciosamente.

### Sessão 89 💼 Finanças redesenhada — Painel + P&L por encomenda + Catálogo + comissões como dedução

Sessão grande de arquitectura. Maria pediu redesenho profundo da aba Finanças com lógica de gestão sólida (Arquitecto de CRM + Finanças). Trabalho organizado em 8 fases planeadas; **fases 1, 4, 5, 8, 3 e 6 entregues nesta sessão** (a 2 e a 7 ficam para sessão futura).

**Decisões de design fixadas em conversa (referência crítica):**
- **IVA**: Maria isenta. Receita = orçamento bruto, sem ajustes.
- **Comissões a parceiros**: dedução à receita. Conta proporcional ao %pago, excluindo estados `na` (sem parceiro) e `nao_aceita` (parceiro recusou). Estados que contam: `parceiro_informado`, `a_aguardar`, `a_aguardar_resposta`, `paga`.
- **Custos avulsos**: ficam como despesa global, sem `expenses.order_id` (Maria não quer ligar despesas a encomendas específicas).
- **Cashflow vs accrual**: ambos, com toggle global futuro. Por agora cashflow proporcional ao %pago em todas as agregações (mantém coerência entre receita, COGS, comissões).
- **Quadro mais lucrativo**: ambos (€ e %); priorizar **ranking por SKU** (tamanho/fundo/extras) em vez de top encomendas individuais — Maria preferiu isto porque dá inteligência estratégica sobre o portfólio.
- **Fundos preto/branco/cor**: têm os mesmos custos (vidro/cartão). Fundo fotografia tem custos próprios por tamanho — **já capturados em mig 033/034** sem necessidade de mudanças (preços 15/25/35€; custos 6,72/11,20/19,60€).

**Helpers financeiros — [src/lib/finance.ts](src/lib/finance.ts) (ficheiro novo, 195 linhas):**
- `AccountingType`: cinco tipos contabilísticos derivados das 9 categorias de despesa existentes — `cogs_variavel` (flores/molduras/materiais), `operacional` (software/serviços/transporte/outros), `marketing`, `financeira` (taxas), `investimento` (placeholder). Mapping derivado (sem migração nova) para evitar duplicar dimensão. Função `aggregateExpensesByAccountingType` agrega para o Painel.
- `paidRatio(status)`: 0/0.3/0.7/1 conforme `payment_status`.
- `commissionFullFromOrder` + `commissionFromOrder` (proporcional ao %pago) — `na`/`nao_aceita` devolvem 0.
- `cogsFullFromOrder` + `cogsRecognizedFromOrder` — total do snapshot via `computeProductionCost`, 0 se snapshot ausente.
- `orderPnL`: P&L composto por encomenda devolvendo `revenue_full`, `revenue_recognized`, `cogs_full`, `cogs_recognized`, `commission_full`, `commission_recognized`, `margin_full`, `margin_recognized`, `margin_pct`, `paid_ratio`. **Fonte única de verdade financeira por encomenda.**

**Reestruturação das sub-abas — [financas-client.tsx](src/app/(admin)/financas/financas-client.tsx):**
- `TabKey` passa de `"despesas" | "precos" | "custos" | "faturacao" | "competicao"` para `"painel" | "pnl" | "catalogo" | "despesas" | "faturacao" | "competicao"`.
- Default tab: `"painel"` (era `"despesas"`).
- Grelha de tabs: `lg:grid-cols-5` → `sm:grid-cols-3 lg:grid-cols-6` para acomodar 6 sub-abas.
- `Preços` + `Custos de produção` (duas sub-abas separadas) → fundidas em `Catálogo` (uma só sub-aba que renderiza `MargemTeoricaSection` no topo + `PrecosTab` + `CustosTab` como secções colapsáveis).

**Novos componentes:**
- `PainelTab` (~250 linhas): resumo executivo do mês actual. Aggregator genérico de período devolve `revenueGross/Net`, `cogs`, `commission`, `expensesTotal`, `expensesByType`, `profit`, `marginPct`, counts. 6 KPIs principais com delta vs mês anterior (Receita líquida com sub-texto "Bruta", COGS, Comissões, Despesas, Lucro líquido com delta, Margem %). 4 KPIs secundários (Encomendas no mês, Ticket médio, Quadro mais lucrativo com nome do cliente + margem %, Pipeline pendente com conversão vales). Breakdown de despesas em 5 cards por tipo contabilístico. Tabela `RankingTable` por tamanho de moldura e por tipo de fundo (ano corrente, valores plenos) — ordenada por margem €, com linha de totais.
- `PnLTab` (~150 linhas): tabela ordenável por colunas (event_date / client_name / budget / margin_eur / margin_pct / paid_ratio). Selector de ano (todos os anos disponíveis pelos `event_date` das encomendas). 5 KPIs de totais. Colunas: ID, Cliente, Data, Estado, Preço, COGS, Comissão, Margem €, Margem %, %pago. Linhas com cores condicionais (margem ≥50% emerald, ≥30% amber, senão rose). Cancelado excluído.
- `MargemTeoricaSection`: tabela de margem teórica para 9 combinações (3 tamanhos × 3 fundos comuns), tudo moldura "baixa". Usa `computeProductionCost` com pseudo-orders para garantir paridade exacta com o cálculo real. Agrupada por tamanho.
- `CatalogoTab`: wrapper que renderiza margem teórica + `PrecosTab` + `CustosTab`.
- `PipelineBucket`: card 4-bucket por estado da encomenda (`nao_confirmado` = pré-reservas; `confirmado_por_produzir`; `em_producao` = da prensa ao quadro enviado; `recebido` = quadro_recebido).

**Alterações no FaturacaoTab existente:**
- 5 KPIs em vez de 4 por linha (Receita | Despesas | Custo prod | **Comissões** | Lucro), em todas as 3 grelhas (mês actual, ano actual, ano antigo).
- Sub-texto "Líquida: X€" debaixo da Receita quando comissões > 0.
- Fórmula de lucro: `revenue − cogs − commission − expenses` (antes era `revenue − cogs − expenses`).
- Card "Potencial total" (3 cells) substituído por **Pipeline 4-bucket** com count + total por bucket + total geral no header.
- Helpers `paidRatio` e `cogsFromOrder` locais removidos; reusam `lib/finance.ts`.
- `KpiBox` ganha props opcionais `subValue` + `subLabel`.

**Query expandida — [src/app/(admin)/financas/page.tsx](src/app/(admin)/financas/page.tsx):**
- Select de `orders` ganha `client_name`, `partner_commission`, `partner_commission_status`.
- Tipos `FaturacaoOrder` e `Props.orders` actualizados em conformidade.

**O que ficou de fora (TODOs futuros):**
- **Fase 2 — View SQL `order_pnl`**: não implementada porque `orderPnL` em JS já é a fonte única e nada na app actual precisa de query SQL ad-hoc. Pode entrar quando quisermos exports CSV ou queries no Supabase Dashboard.
- **Fase 7 — Mover Competição para Parcerias**: pausada deliberadamente. Toca em 2 páginas (queries Supabase, layout de tabs em Parcerias) e merece sessão própria. Maria ainda não viu o destino — propus sub-aba "Concorrência" em Parcerias mas faz sentido confirmar com ela.
- **Cor (fundo)** com possível impressão diferente: confirmado que preto/branco/cor têm os mesmos custos. Só fotografia tem custo distinto, já capturado.

**Preflight:** `tsc --noEmit` limpo + `next build` limpo em 16,7s. Aviso pré-existente sobre Google Sans font fallback (não relacionado).

**Maria: passos manuais:**
1. Push para Vercel.
2. Smoke browser → `/financas`:
   - Abre por defeito em **Painel** (não em Despesas).
   - 6 sub-abas visíveis: Painel | P&L por encomenda | Catálogo | Despesas | Faturação | Competição.
   - **Painel**: 6 KPIs principais do mês actual + 4 secundários + breakdown despesas por tipo + tabela "Onde está o lucro" por tamanho e por fundo.
   - **P&L por encomenda**: tabela ordenável; clica nas colunas Cliente / Preço / Margem € / Margem % para ordenar.
   - **Catálogo**: nova sub-aba que mostra margem teórica por SKU no topo + Preços + Custos de produção fundidos (antes eram 2 abas separadas).
   - **Faturação**: agora tem KPI **Comissões** em todas as grelhas; Receita mostra "Líquida" como sub-texto quando há comissões; Pipeline 4-bucket substitui o card "Potencial total".
   - **Lucro**: valor menor que antes em períodos onde tens comissões (porque agora subtrai comissões).

<!-- Sessões 88-F e 88-E comprimidas no Histórico condensado em baixo. -->

<!--
### Sessão 88-F 💰 COGS visível em Finanças → Faturação (KPI + gráfico + lucro real)

Continuação directa da 88-E. Ao retirar o `ProductionCostBadge` do workbench, os custos de produção ficavam invisíveis em todo o sistema (a aba "Custos de produção" é só o wiki dos preços unitários, não agrega por encomenda). Esta sessão põe o COGS por encomenda na aba **Faturação**, onde a Maria já olha para a receita.

**Query expandida — [src/app/(admin)/financas/page.tsx](src/app/(admin)/financas/page.tsx):**
- Select de `orders` ganha `frame_size, frame_background, pyramid_frame, frame_internal_type, extra_small_frames, extra_small_frames_qty, production_cost_snapshot` — todos os campos de que `computeProductionCost` precisa.
- O Pick<Order, ...> propagado para o client passa a refletir essas colunas.

**Cálculo proporcional — [financas-client.tsx](src/app/(admin)/financas/financas-client.tsx) FaturacaoTab:**
- Novo helper `paidRatio(o)` extraído de `revenueFromOrder` (0 / 0.3 / 0.7 / 1 conforme `payment_status`); `revenueFromOrder` agora reusa-o.
- Novo `cogsFromOrder(o)`: se a encomenda tem snapshot, calcula o breakdown via `computeProductionCost(o, snapshot)` e **multiplica pelo `paidRatio`**. Decisão deliberada: contar o COGS na mesma proporção que a receita é contada evita que um mês com uma entrega grande e só 30% paga apareça com prejuízo enorme; quando os outros 70% chegam, o COGS sobe também na mesma proporção e a margem mantém-se coerente. Encomendas anteriores à mig 034 (sem snapshot) somam 0.
- `cogsMonth` / `cogsYear` somam por janela igual à receita (filtro por `event_date` da encomenda).
- Lucro: `profitMonth = revenueMonth - expensesMonth - cogsMonth` (antes era só `- expensesMonth`). Mesma alteração no `profitYear`.

**KPIs reorganizados — grelha 4 colunas simétrica:**
- Ano actual primário (4): Receita do mês | Despesas do mês | **Custo de produção** | Lucro do mês.
- Ano actual secundário (4, antes eram 2): Receita {ano} | Despesas {ano} | **Custo produção {ano}** | Lucro {ano}.
- Ano antigo / "Todos" (4, antes eram 3): Receita | Despesas | **Custo produção** | Lucro.
- KPI de COGS usa `Frame` icon + `amber` (coerente com a cor da aba "Custos de produção").
- Removido o label "Receita do ano" da grelha primária (não fazia sentido aparecer ao lado de "Receita do mês"; passou para a segunda linha onde os 4 KPIs são todos anuais).

**Gráfico de 3 barras — [financas-client.tsx](src/app/(admin)/financas/financas-client.tsx):**
- `chartData` ganha campo `cogs` por bucket (mensal ou anual). `maxBarValue` inclui agora as 3 séries.
- Cada bucket renderiza 3 barras lado-a-lado: emerald (receita), rose (despesas), **amber (produção)**. Barras passam de `w-3` para `w-2.5` (sm) / `w-2` (base) para caberem 3 em vez de 2.
- Legenda actualizada: "Receita / Despesas / **Produção**".
- Título da card: "Receita vs despesas vs custo de produção".

**Texto explicativo no fundo da Faturação reescrito** para enumerar os 4 conceitos (Receita / Custo de produção / Despesas / Lucro) com a fórmula explícita e o alerta de que encomendas anteriores à mig 034 não somam para o COGS.

**Sem migrações nesta sessão.** Preflight `tsc + next build` limpos.

**Maria: passos manuais:**
1. Push para Vercel (assumindo que mig 053 da sessão 88-E já foi aplicada — se ainda não, correr primeiro).
2. Smoke browser → `/financas` → aba "Faturação":
   - Grelha de KPIs no ano actual: 4 + 4 = 8 KPIs, agora inclui "Custo de produção" amber em ambas as linhas.
   - "Lucro do mês" agora é receita − despesas − produção (era só receita − despesas) → valor menor que antes.
   - Gráfico tem 3ª barra amber em cada mês.
   - Encomendas anteriores à mig 034 (com `production_cost_snapshot=NULL`) somam 0 para o COGS — confirmar que isto não rebenta o cálculo.
   - Trocar ano: KPIs e gráfico actualizam.

### Sessão 88-E 🏷️ Custos de produção saem do workbench + default `frame_internal_type='baixa'`

Maria observou que (1) o "tipo de moldura interno" estava sempre vazio em encomendas novas, o que deixava os custos de produção a "Cálculo parcial — falta tipo de moldura"; e (2) os custos+margem que apareciam no workbench eram ruído porque para ela isso é informação só relevante na aba Finanças, não na gestão por encomenda. Pediu o default automático + saída do badge do workbench.

**Migração 053 — [supabase/migrations/053_default_frame_internal_type_baixa.sql](supabase/migrations/053_default_frame_internal_type_baixa.sql):**
- `UPDATE orders SET frame_internal_type='baixa' WHERE frame_internal_type IS NULL AND pyramid_frame=false AND deleted_at IS NULL` — backfill. Pirâmides ficam de fora porque o valor é irrelevante para essas (a função `effectiveFrameType` ignora `frame_internal_type` quando `pyramid_frame=true`).
- `ALTER TABLE orders ALTER COLUMN frame_internal_type SET DEFAULT 'baixa'` — segunda linha de defesa para qualquer INSERT directo (seeds, scripts manuais).
- `COMMENT ON COLUMN` actualizado a reflectir que default agora é `'baixa'`.

**Server action — [src/app/(admin)/preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts):**
- `createOrderAction` ganha `frame_internal_type: order.frame_internal_type ?? "baixa"` no payload (linha ~106). Garante que toda a encomenda nova nasce já com o valor, mesmo se o caller (admin UI) não o enviar. Como `pyramid_frame` é separado, isto não conflita com pirâmides — `effectiveFrameType` lida com a prioridade.

**Workbench — [src/app/(admin)/preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx):**
- Import `ProductionCostBadge` removido (linhas 145-148 → uma única linha de `BudgetSnapshotBadge`).
- JSX `<ProductionCostBadge .../>` debaixo do orçamento removido (~6 linhas) — o cálculo (`computeProductionCost`) continua a existir mas deixa de ser mostrado aqui.
- Hint do dropdown "Tipo de moldura (interno)" passou de "só afecta margem, não o preço" (enganador — afecta o custo de produção, não a margem em sentido contabilístico) para "Baixa (2x2cm, default) ou Caixa (2x3cm, flores altas). Cliente paga igual; afecta custo de produção."

**Componente `ProductionCostBadge` em [budget-badges.tsx](src/app/(admin)/preservacao/[id]/_components/budget-badges.tsx) mantido**: não é apagado porque pode ser reutilizado na aba Finanças se for preciso mostrar margem por encomenda lá. Idem para `captureOrderProductionCostAction` em actions.ts. Ficam órfãos no código mas a janela é curta — próximo passo natural é levá-los para Finanças.

**Aviso ⚠️ — produção não está visível em lado nenhum agora:**
- Workbench já não mostra custo+margem.
- Aba Finanças → "Custos de produção" é só o **wiki dos custos unitários** (preços por tipo de moldura/vidro/consumível), não mostra COGS por encomenda nem margem.
- Faturação só mostra receita, sem subtrair COGS.
- Se a Maria quiser ver margem por encomenda ou COGS total do mês, precisamos de adicionar isso ao FaturacaoTab numa sessão futura. Os dados existem (`production_cost_snapshot` + `computeProductionCost`), só falta UI.

**Preflight:** `tsc --noEmit && next build` limpos em 27s + 24s. Aviso pré-existente sobre Google Sans font fallback (não relacionado).

**Maria: passos manuais:**
1. Aplicar migração 053 na BD do Supabase (Dashboard → SQL → colar contents).
2. Push para Vercel.
3. Smoke browser:
   - Abrir qualquer encomenda existente (não-pirâmide) → "Tipo de moldura (interno)" mostra "Baixa (2x2cm)" preenchido (antes estava "—").
   - Criar uma nova encomenda → nasce com "Baixa" já preenchido.
   - Abrir uma pirâmide → continua a mostrar "Pirâmide" em italic (intocado).
   - Confirmar que orçamento (Sparkles roxo) continua a aparecer, mas o badge cinzento "Custo €X · margem Y%" já não existe.
   - Hint debaixo do dropdown agora explica claramente que afecta custo, não preço ao cliente.
-->

<!-- Sessões 88-A, 88-B, 88-C e 88-D comprimidas no Histórico condensado em baixo. -->


---

## Passos manuais antigos (sessões 80-95) — todos já aplicados em produção

**Sessão 95 — passos manuais (SEM migração):**

1. **Push para Vercel** (~6 ficheiros alterados, ~3 ficheiros novos).
2. **Sem nada para correr no Supabase** — toda a feature de Vistas/Filtros/Colunas usa `localStorage` por dispositivo.
3. **Smoke browser**:
   - **Sidebar**: bolinha **indigo** no item Dashboard (nº das minhas tarefas activas). Esconde só quando vou a 0. Mensagens continuam azul `sky-500`; encomendas por abrir também `sky-500`.
   - **Dashboard / kanban**: cores de estado (stone/violet/emerald) já não colidem com prioridade (slate/sky/amber/rose). Coluna vazia no PC ~110px (em vez de 1/6); colunas com tarefas ocupam o resto. Cards: nome do cliente no chip indigo do topo (era código). Título do card respira (prioridade desceu para a linha do estado).
   - **Workbench Preservação** → header: já não tem badge "parada há X dias" junto ao ID. Tabela: também não tem.
   - **Preservação → tabela**: nova barra cream no topo com `Vista: Todas ▾` / `Filtros` / `Colunas`. Aplica "Origem: Instagram" → tabela filtra-se; aparece chip indigo abaixo com X para remover. Liga "Parceiro" em Colunas → coluna nova aparece entre Estado e Orçamento. Botão **Guardar vista** aparece quando há ajustes — dá nome → fica no selector de Vista; mudar entre vistas carrega tudo de uma só vez; X em hover apaga.
4. **Sem `npm run smoke` automatizado nesta sessão** — Playwright não está instalado neste ambiente; é manual.

**Sessão 93 — passos manuais (mig 060 + UI):**

1. **Correr [mig 060](supabase/migrations/060_split_invoice_urls.sql)** no Supabase SQL Editor. Verifica com:
   ```sql
   SELECT column_name FROM information_schema.columns
     WHERE table_name='orders' AND column_name LIKE 'invoice_url_%';
   ```
   → 3 linhas: `invoice_url_sinal`, `invoice_url_intermedio`, `invoice_url_final`.
2. **Push para Vercel**.
3. **Smoke browser**:
   - `/preservacao/[id]` de encomenda 100% paga: ver 3 slots "Sinal / Intermédio / Final"; o link antigo aparece em "Sinal".
   - Colar URL num slot vazio → após save (debounce ~900ms) recarregar `/` → tarefa nova `Enviar fatura — {nome} ({slot})` aparece em "Por começar" administrativo.
   - Vale-presente: colar URL no "Anexo da fatura" → tarefa `Enviar fatura — {sender_name}` no Dashboard.
   - Substituir URL existente → NÃO cria tarefa (correcção de erro).

**Sessão 92 — passos manuais (mig 059 + UI):** já aplicado (ver detalhe acima).

**Sessão 91 — passos manuais (sem migração):**

1. **Push para Vercel** — alterações apenas em TS (lib/finance.ts + financas-client.tsx + preservacao/actions.ts).
2. **Smoke browser** → `/financas`:
   - **Faturação**: KPI "Custo de produção" do mês muda — antes contava 30% do COGS para encomendas a 30%, 70% para as a 70%; agora só 100% para as 100% pagas. Lucro do mês recalcula em conformidade.
   - **Painel**: COGS mensal/anual segue a mesma regra; "Quadro mais lucrativo" continua a usar `margin_full` (não muda).
   - **Catálogo** → fundo da aba: nova secção cream "Backfill de snapshots". Clicar "Preencher snapshots" → confirmação `window.confirm` → toast com count. Imediatamente depois, COGS na Faturação sobe nas linhas de encomendas antigas 100% pagas.
3. **Query SQL opcional** (antes ou depois do backfill, para auditar):
   ```sql
   SELECT payment_status,
     count(*) FILTER (WHERE production_cost_snapshot IS NOT NULL) AS com_snapshot,
     count(*) FILTER (WHERE production_cost_snapshot IS NULL) AS sem_snapshot
   FROM orders
   WHERE deleted_at IS NULL AND status NOT IN ('cancelado','entrega_flores_agendar')
   GROUP BY payment_status;
   ```

**Sessão 90 — passos manuais (parte B; após mig 035 + 054 já corridas):**

1. **Correr [mig 056](supabase/migrations/056_consumables_extras_keys.sql)** no Supabase SQL Editor. Verificar:
   - `SELECT check_clause FROM information_schema.check_constraints WHERE constraint_name='production_cost_items_size_key_check';` → contém `christmas_ornament` e `necklace_pendant`.
2. **Push para Vercel**.
3. **Smoke browser** → `/financas` → "Catálogo":
   - **Tabela rosa** agora tem 6 colunas: 30x40, 40x50, 50x70, 20x25 (mini), Ornamento, Pendente.
   - **Bloco 2 verde** (Extras) já não tem "Custo FBR" editável — passou a "Custo" derivado da soma dos consumíveis nas colunas Ornamento/Pendente da tabela rosa em baixo.
   - Adiciona consumível novo "Teste" → cria 6 linhas (uma por produto, cost=0). Edita "Teste" na coluna Ornamento para 2€ → vê o Custo do Ornamento no Bloco 2 da verde subir 2€.
   - Custos pré-existentes (caixa, lavanda, sílica, etc.) continuam intactos nas 3 primeiras colunas (30x40/40x50/50x70). As 3 colunas novas começam em 0 — Maria preenche conforme aplicável.
4. **Recomendado**: correr query de auditoria de migrações 035-053 para confirmar que mais nenhuma ficou para trás (ver fim da sessão).

**Sessão 89 — passos manuais (sem migração nova):**

1. **Sem migrações** — todo o trabalho é UI + helpers TS. Não há nada para correr no Supabase.
2. **Push para Vercel**.
3. **Smoke browser** → `/financas`:
   - Abre por defeito em **Painel** (não em Despesas como antes).
   - 6 sub-abas: Painel | P&L por encomenda | Catálogo | Despesas | Faturação | Competição.
   - **Painel**: 6 KPIs no topo do mês actual (Receita líquida com sub-texto "Bruta" quando há comissões, COGS, Comissões, Despesas, Lucro líquido com delta, Margem %). 4 KPIs secundários (Encomendas, Ticket médio, Quadro mais lucrativo do mês com nome do cliente, Pipeline pendente). Breakdown de despesas em 5 cards por tipo contabilístico. Tabela "Onde está o lucro" por tamanho de moldura e por tipo de fundo (ano corrente).
   - **P&L por encomenda**: tabela com cliente, data, estado, preço, COGS, comissão, margem €, margem %, %pago. Cliques nos cabeçalhos Cliente / Preço / Margem € / Margem % / %pago ordenam. Cores nas margens (verde ≥50%, amber ≥30%, rose senão).
   - **Catálogo**: cabeçalho de "Margem teórica por quadro" (9 linhas: 3 tamanhos × 3 fundos comuns). Em baixo, Preços + Custos de produção (antes eram 2 abas separadas).
   - **Faturação**: 5 KPIs por linha em vez de 4 (Receita | Despesas | Custo prod | Comissões | Lucro). Receita mostra "Líquida: X €" debaixo quando comissões > 0. Card "Pipeline" 4-bucket substitui o antigo "Potencial total" (Não confirmado / Confirmado por produzir / Em produção / Recebido pelo cliente, com count + total por bucket + total geral).
   - **Lucro do mês**: valor menor que antes em meses com comissões (porque agora `lucro = receita − despesas − cogs − comissões`).

**TODO futuro (não bloqueia nada):**
- View SQL `order_pnl` (fase 2 do plano original) — útil para exports e queries ad-hoc.
- Mover Competição para Parcerias (fase 7). Decidir: sub-aba "Concorrência" em Parcerias ou nova aba "Inteligência" no menu principal.

**Sessão 88-F — passos manuais (UI apenas, sem mig nova):**

1. **Confirmar que mig 053 (sessão 88-E) está aplicada** — sem ela, encomendas com `frame_internal_type=NULL` não somam para o COGS.
2. **Push para Vercel**.
3. **Smoke browser** → `/financas` → aba "Faturação":
   - Ano actual: ver 2 linhas de 4 KPIs cada (8 no total). Linha 1: Receita mês | Despesas mês | Custo produção mês | Lucro mês. Linha 2: mesmas 4 mas anuais. KPI de produção é amber com ícone Frame.
   - "Lucro do mês" agora é menor que antes (subtrai COGS além de despesas).
   - Gráfico mostra 3 barras por mês (emerald/rose/amber).
   - Trocar ano no selector: tudo recalcula.
   - Encomendas com `production_cost_snapshot=NULL` (antigas, pré-mig 034) somam 0 para COGS — comportamento esperado, não bloqueia nada.

**Sessão 88-E — passos manuais (mig 053 + UI):**

1. **Correr [supabase/migrations/053_default_frame_internal_type_baixa.sql](supabase/migrations/053_default_frame_internal_type_baixa.sql)** no Supabase SQL Editor. Verificar:
   - `SELECT count(*) FROM orders WHERE frame_internal_type IS NULL AND pyramid_frame=false AND deleted_at IS NULL;` → 0 (todas backfilled).
   - `SELECT column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='frame_internal_type';` → `'baixa'::text`.
2. **Push para Vercel**.
3. **Smoke browser:**
   - Abrir encomenda existente não-pirâmide → dropdown "Tipo de moldura (interno)" mostra "Baixa (2x2cm)" preenchido.
   - Mudar para "Caixa (2x3cm)" e guardar — sem badge cinzento de custo a aparecer debaixo do orçamento (foi removido).
   - Criar encomenda nova (botão "+" em /preservacao) → nasce com "Baixa" preenchido.
   - Abrir encomenda com `pyramid_frame=true` → continua a mostrar "Pirâmide" em italic; comportamento inalterado.
   - Hint debaixo do dropdown agora diz "afecta custo de produção" (era "não afecta preço").

**Sessão 88-B — passos manuais (UI; precisa mig 052 já corrida):**

1. **Verificar que a mig 052 (sessão 88-A) já foi corrida** — se não, correr primeiro: [supabase/migrations/052_task_templates_and_voucher_link.sql](supabase/migrations/052_task_templates_and_voucher_link.sql).
2. **Push para Vercel**.
3. **Smoke browser** — abrir `/preservacao/[qualquer id]`:
   - Topo da coluna direita: card "Tarefas" (border indigo, ícone CheckSquare).
   - Click "+ Nova tarefa" → popover com 5 opções (em branco + 4 templates).
   - "Passar fatura com NIF" → diálogo com 30/40/70/100% (calculados do orçamento) + campo manual. Encomendas sem orçamento mostram só o campo manual.
   - Form inline com título interpolado (`{nome_cliente}`, `{nif}` substituídos), 3 avatares para assignees (eu activo), prioridade default do template, data opcional.
   - "Criar" → tarefa aparece na lista E no kanban do Dashboard (categoria correcta) com € à direita.
   - Templates sem amount (feedback, comprovativo, parceiro) → vão direto ao form.
   - Checkbox done → some da lista; Trash em hover → apaga.

**Sessão 88-A — passos manuais (BD apenas, UI vem na 88-B):**

1. **Correr [supabase/migrations/052_task_templates_and_voucher_link.sql](supabase/migrations/052_task_templates_and_voucher_link.sql)** no Supabase SQL Editor. Verificar:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('voucher_id','amount');` → 2 linhas.
   - `SELECT count(*) FROM task_templates WHERE is_seed = true;` → 4.
   - `SELECT slug, scope, needs_amount FROM task_templates ORDER BY position;` → `passar_fatura/both/true`, `anexar_comprovativo/both/false`, `pedir_feedback/order/false`, `avisar_parceiro_comissao/order/false`.
2. **Push para Vercel** (build a passar; nada visível na UI ainda — schema+tipos+seeds só).
3. **Sem smoke browser nesta sessão** — bloco "Tarefas desta encomenda" e picker de templates vêm na sessão 88-B.

**Sessão 86 — passos manuais:**

1. **Correr migrações no Supabase SQL Editor** (por ordem):
   - [supabase/migrations/050_tasks_category.sql](supabase/migrations/050_tasks_category.sql) — se ainda não.
   - [supabase/migrations/051_checklist_description.sql](supabase/migrations/051_checklist_description.sql).
   - Verificar:
     - `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='category';` → 1 linha.
     - `SELECT column_name FROM information_schema.columns WHERE table_name='personal_checklist' AND column_name='description';` → 1 linha.
2. **Push para Vercel**.
3. **Smoke**:
   - `/` → afazeres globais com 6 colunas, cada com ícone único (📦/🌸/🌐/📷/📄/⋯) e barra colorida no topo. Sem pills coloridas.
   - Hover num tile → ícones Pencil + Trash aparecem. Click Pencil → forma edita inline com título/detalhes/prioridade/data.
   - "+": form de criação inclui campo "Detalhes (opcional)".
   - **Arrastar tile** para outra coluna → muda categoria. Coluna destino fica com ring escuro.
   - Checklist pessoal: Pencil em cada item → editar texto/detalhes/prioridade/data.

**Sessão 83 — passos manuais:**

1. **Correr [supabase/migrations/049_checklist_priority_due_date.sql](supabase/migrations/049_checklist_priority_due_date.sql)** no Supabase SQL Editor. Verificar:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='personal_checklist' AND column_name IN ('priority','due_date');` → 2 linhas.
2. **Push para Vercel**.
3. **Smoke**:
   - `/` → checklist pessoal já não estica à altura da card de afazeres.
   - Carregar no "+" do header da checklist pessoal → form com input + prioridade + data (sem assign).
   - Criar item → aparece com pill de prioridade e badge de data se preenchida.
   - Afazeres globais: ícone indigo, avatares com ring indigo. Recolhas mantêm violet.
   - Tarefa global atribuída a 2+ pessoas → na checklist pessoal aparece com avatares pequenos (em vez de "+1"); sem pill "Global".

**Sessão 82 — passos manuais (só BD):**

1. **Correr [supabase/migrations/048_auto_mark_voucher_trigger.sql](supabase/migrations/048_auto_mark_voucher_trigger.sql)** no Supabase SQL Editor (cola, Run).
2. **Correr os 5 smoke tests em comentário no fim do ficheiro** (substituir `XXXXXX` por um código de vale real `preservacao_nao_agendada + 100_pago`):
   - INSERT manual com código válido → vale passa a `preservacao_agendada`.
   - INSERT com código inválido → não bloqueia.
   - UPDATE noutra coluna → não dispara o trigger.
   - `SELECT tgname FROM pg_trigger WHERE tgrelid='orders'::regclass AND NOT tgisinternal` deve incluir `orders_auto_mark_voucher_insert` + `orders_auto_mark_voucher_update`.
3. **Sem push para Vercel** (esta sessão é só BD).
4. **Smoke real:** ir ao site público `floresabeirario.pt/reservar-preservacao` em incognito, submeter uma reserva com um `Código vale-presente` válido. Confirmar que no admin o vale aparece como "Preservação agendada" sem intervenção manual.

**Sessão 81 — passos manuais (se ainda não corridos):**

1. **Correr [supabase/migrations/047_orders_seen_by.sql](supabase/migrations/047_orders_seen_by.sql)** no Supabase SQL Editor (cola, Run). Confirmar com:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='seen_by';` → 1 linha
   - `SELECT count(*) FILTER (WHERE cardinality(seen_by) = 0) FROM orders;` → 0
2. **Push para Vercel**.
3. **Smoke**:
   - `/preservacao` → encomendas existentes sem badge "Nova" (backfill); nome do cliente truncado em 1 linha, badges abaixo.
   - Criar encomenda nova → bolinha sky `1` na sidebar + badge "Nova" sky na tabela.
   - Abrir workbench dessa encomenda → ao voltar, "Nova" desaparece para mim (mas outros utilizadores continuam a ver).

**Sessão 80 — passos manuais (se ainda não corridos):**

1. **Correr [supabase/migrations/046_team_members_centralized.sql](supabase/migrations/046_team_members_centralized.sql)** no Supabase SQL Editor:
   - Cola o ficheiro inteiro → Run. Deve dizer "Success".
   - Correr as 5 queries de verificação que estão em comentário no fim do ficheiro (uma a uma):
     - `SELECT email, name, role FROM team_members ORDER BY email;` → 3 linhas
     - `SELECT is_team_admin('info+antonio@floresabeirario.pt');` → TRUE
     - `SELECT is_team_admin('info+ana@floresabeirario.pt');` → FALSE
     - `SELECT is_team_member('info+ana@floresabeirario.pt');` → TRUE
     - `SELECT polname, polcmd FROM pg_policy WHERE polrelid='orders'::regclass ORDER BY polname;` → lista deve incluir `admins_all` + `viewer_select`
2. **Push para Vercel** — afecta `/preservacao` (dupla contagem de vales).
3. **Smoke test (Maria):**
   - **C1 (admins centralizados)**: António/MJ continuam a poder editar encomendas; Ana continua a ver mas não a editar; form público de reserva continua a aceitar submissões. Se algo bloquear inesperadamente, a função `is_team_admin` tem fallback e ninguém deve ficar bloqueado.
   - **Dupla contagem de vales**: criar uma encomenda nova manualmente com `gift_voucher_code` preenchido (ou editar uma existente e adicionar o código). Verificar em /vale-presente que o vale correspondente passou automaticamente para "Preservação agendada".
4. **Smoke da Ana (viewer)**: login como Ana → /preservacao → deve continuar a ver mas não editar; / (Dashboard) → tarefas continuam editáveis (Ana tem permissão de edição em tarefas).

**Passos manuais antigos (sessões 52-65)** — já foram aplicadas em produção. Se montares ambiente do zero, vê os ficheiros das migrações 034-044 directamente e o histórico condensado abaixo.

---

## Histórico condensado (sessões 1-88D)

### Fase 6 — Integrações + PWA + RGPD (sessões 35-94)
- **94** — PWA Android: matcher do [proxy.ts](src/proxy.ts) expandido para excluir `manifest.webmanifest`+`sw.js` (302 cross-origin sem cookies estava a invalidar PWA install); safe zone maskable 60%→80%; `purpose:any` para android-chrome + `purpose:maskable` separado; SW `CACHE_VERSION` v3→v4. Resultado: Chrome Android passa a oferecer "Instalar app" e o ícone do ecrã principal mostra flores grandes.
- **93** — Mig 060 + tarefas auto: `orders.invoice_attachment_url` → 3 colunas `invoice_url_sinal/intermedio/final`; workbench Preservação mostra 1-3 slots etiquetados consoante `payment_status`; `updateOrderAction` cria tarefa `Enviar fatura — {nome} ({slot})` ao detectar NULL→URL (admin, alta, sem prazo); padrão replicado em `updateVoucherAction`. Export CSV com 3 colunas.
- **92** — Mig 059: `tasks.status` GTD (`por_comecar/a_fazer_hoje/em_curso`). Kanban: estado-pill no card, mobile snap-scroll horizontal por coluna (queixa de drag indesejado), drag desactivado no mobile (PointerSensor distance=9999). "Há X dias" italic substitui slot do prazo quando tarefa sem prazo. Hook novo `useIsMobile()` via `useSyncExternalStore` boolean primitivo.
- **91** — COGS tudo-ou-nada (mig 058 limpa snapshots de em-curso) + snapshot capturado a 100% pago. `cogsRecognizedFromOrder`: passa de `× paidRatio` para `payment_status==='100_pago' ? full : 0`. `updateOrderAction` captura snapshot na transição NULL→100%. Botão backfill em Catálogo para snapshots antigos. `margin_recognized = revenue_recognized − cogs_recognized − commission_recognized` (deixa de coincidir com `margin_full × ratio`).
- **90** — Catálogo verde substitui PrecosTab; 6 tabelas de produção mantêm-se. Mini 20x25 entra no Bloco 1 com 3 fundos. Base partilhada via rowspan. Mig 054 (`pricing_items.cost_fbr`, deprecated em 056) + mig 056 (consumíveis 30x40/40x50/50x70/mini/ornament/pendente — `production_cost_items_size_key_check` expandido). Custo extras autónomos no Bloco 2 deriva da rosa "Outros custos recorrentes". Memória nova: [[feedback-verificar-existencia-bd]].
- **89** — Finanças redesenhada: 6 sub-abas (Painel default + P&L por encomenda + Catálogo + Despesas + Faturação + Competição). [lib/finance.ts](src/lib/finance.ts) novo com `orderPnL` fonte única (revenue/cogs/commission recognized + full). Comissões a parceiros subtraem da receita (proporcional ao %pago, excluindo `na`/`nao_aceita`). 4 KPIs primários + 4 secundários no Painel + ranking por SKU. P&L tabela ordenável. Decisões: IVA isenta; cashflow proporcional; quadro+fundo como dimensões principais (Maria preferiu sobre top encomendas individuais).
- **88-F** — COGS visível em Finanças→Faturação: select de orders expandido com campos de `computeProductionCost`; `cogsFromOrder` proporcional ao %pago (decisão depois revertida na 91 para tudo-ou-nada); grelha de KPIs 4×3 inclui "Custo de produção" amber; gráfico ganha 3ª barra amber.
- **88-E** — Mig 053 default `frame_internal_type='baixa'` + backfill non-pyramid. `createOrderAction` força `?? 'baixa'`. `ProductionCostBadge` retirado do workbench (Maria: ruído na gestão por encomenda); componente mantido órfão para reuso futuro em Finanças. Hint do dropdown reescrita.
- **88-D** — Página CRUD de templates de tarefas em `/settings/templates-tarefas`: server actions `create/update/archive/restore TaskTemplateAction` (`is_seed=false` em criados via UI); page admin-only com tabela (Nome+Seed badge, Título mono, Escopo colorido, Categoria, Prioridade, Valor) + diálogo de edição com botões "+ {variável}" que injectam no Textarea + checkbox "Este template pede um valor (€)" com input "Etiqueta do diálogo". Topbar: entrada existente renomeada `Templates → Mensagens` + nova entrada `Tarefas`. Optimistic updates + revalidatePath. Fecha o ciclo 88-A→88-D (schema + workbench Preservação + workbench Vale-Presente + CRUD).
- **88-C** — Tarefas no workbench Vale-Presente + linkage clicável no Dashboard: componente `_components/order-tasks-block.tsx` promovido a `src/components/workbench-tasks-block.tsx` com API genérica `link: { type: 'order'|'voucher'; id }` e `paymentOptions: AmountOption[]`. Vale-Presente ganha card "Tarefas" no topo da coluna direita (mesma posição que Preservação); picker filtra para templates `scope=voucher|both`; diálogo só mostra 1 opção "Total (€X)" porque vales são pagos 100% num só momento. Dashboard: lookups `orderCodeById`/`voucherCodeById` em [src/app/(admin)/page.tsx](src/app/(admin)/page.tsx) cascateados até [_components/dashboard/tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx); tile mostra chip indigo `Link2 + code` clicável (stopPropagation no drag) + valor € à direita na bottom row. Helper novo `computeAmountOptionsForVoucher(amount)`.
- **88-B** — UI Tarefas no workbench Preservação: card "Tarefas" como primeiro item da coluna 3 (accent indigo). Picker com 5 templates seed + "Tarefa em branco"; diálogo "Qual é o valor a faturar?" com 4 botões 30/40/70/100% calculados do `orders.budget` para templates com `needs_amount=true`. Helpers `interpolateTaskTemplate(template, ctx)` + `computeAmountOptionsFromBudget(budget)` em [src/lib/task-templates.ts](src/lib/task-templates.ts). PopoverTrigger usa `@base-ui/react` (não Radix), sem `asChild`. Reusa `createTaskAction` existente.
- **88-A** — Mig 052: `tasks.voucher_id` (simétrico a `order_id`), `tasks.amount NUMERIC(10,2)`, índices parciais. Nova tabela `task_templates` (espelha `message_templates`) com 4 seeds: `passar_fatura` (needs_amount, scope=both), `anexar_comprovativo` (scope=both), `pedir_feedback` (scope=order), `avisar_parceiro_comissao` (scope=order). Tipos `TaskTemplate` + `TASK_TEMPLATE_VARIABLES`. Memória nova: valores em € sempre alinhados à direita.
- **87** — Dashboard refinado pós-uso: remoção da card "Checklist pessoal" (redundante com filtro "Minhas" do kanban; tabela `personal_checklist` na BD intacta); Estúdio `Camera/purple` → `Palette/lime` (não colidia com violet das recolhas); Admin `zinc` → `teal-600`; Outros `stone-300` mais claro; `PriorityPill` (URG/ALTA/MÉD/BAIXA) absolute top-right + popover de 4 opções (`onPointerDown stopPropagation` para não capturar drag); filtro "Todas/Minhas/Feitas" → 3 avatares multi-select no header + toggle Activas/Concluídas; reordenação de colunas via `useDraggable` no header + persistência em `localStorage.fbr.dashboard.tasksColumnOrder.v1` (hydration safe com flag `orderHydrated`)
- **86** — Kanban refinado + DnD invisível + título/detalhes editáveis (mig 051 `personal_checklist.description`): substituição de pills de categoria por barra colorida no topo + borda esquerda 3px no tile; `@dnd-kit` PointerSensor distance=6 com `stopPropagation` em cada elemento clicável; Pencil em hover → form inline; campo "Detalhes" no form de criação; checklist com paridade visual (mesmo Pencil)
- **85** — Afazeres globais agrupados em kanban por categoria (mig 050 `tasks.category` TEXT DEFAULT 'outros' CHECK 6 valores): TasksCard sai da grelha 2×2 e ocupa linha inteira no topo do Dashboard; grelha `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` com 6 colunas sempre visíveis (placeholder "—"); cada raia com fundo cream-50/50 e scroll independente
- **84** — Vermelho ≠ "evento próximo" (Maria via screenshot): vermelho era ansiogénico para eventos a 5d. Split `urgentEvent` em `overdueEvent` (passados, red+AlertTriangle) + `soonEvent` (≤5d, amber-200/400/900 bold + Clock). Helper `isEventAlertRelevant(status)` esconde alerta a partir de `flores_recebidas`; banner do workbench, badge da timeline e célula da tabela usam mesma lógica
- **83** — Dashboard paridade checklist↔afazeres (mig 049 `personal_checklist.priority + due_date`): form "+" expansível com prioridade+data igual ao tasks-card; pill "Global" removida (cor do checkbox distingue: cocoa=checklist, indigo=task); avatares mini em vez de `+N`; cor afazeres violet→indigo (não bate com recolhas); grid 2×2 `items-start` para cards não esticarem
- **82** — Mig 048: trigger SQL `auto_mark_voucher_used()` SECURITY DEFINER fecha caminho do form público (PostgREST anon) que não passava pelo helper TS da sessão 80; EXCEPTION WHEN OTHERS para nunca bloquear INSERT em orders; WHEN clauses filtram disparos só para `gift_voucher_code` preenchido E mudado
- **81** — Preservação fix célula Cliente (nome wrap + badges descem para 2ª row); mig 047 `orders.seen_by TEXT[]` + RPC `mark_order_seen`; hook `useUnreadOrdersCount(currentEmail)` per-user; auto `markOrderSeenAction` fire-and-forget ao abrir workbench; badge "Nova" sky (não amber, para não competir com recolha no local)
- **80** — Fim da dupla contagem de vales: helper TS `markVoucherAsScheduled` em `createOrderAction`+`updateOrderAction` (não cobre form público — coberto na sessão 82). Mig 046 C1 progressivo: tabela `team_members` + funções `is_team_admin/is_team_member` SECURITY DEFINER com fallback hardcoded; só policies de `orders` migradas (POC; restantes em sessões futuras)
- **79** — Preservação destaque "Nova" (heurística 24h em `OrderRow` + `OrderCard`, amber); cupão único c/ retry e idempotente em [src/lib/coupon.ts](src/lib/coupon.ts) (`generateUniqueCouponCode` valida contra UNIQUE antes de devolver); Finanças tabs `grid-cols-2 lg:grid-cols-5`; refactor [src/app/(admin)/dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx) 1051→112 linhas (extracção mecânica para 8 ficheiros em `_components/dashboard/`). Sem migrações; comportamento intocado.
- **78** — Dashboard: `Square/CheckSquare` substituem `Circle/CheckCircle2` (affordance de checkbox); toast "Anular" 5s ao marcar feita; secção "Concluídas recentes (N)" colapsável em ChecklistCard + TasksCard com botão "Reabrir" no hover; novo `RecentDoneRow`. `metrics.ts`: `previousEqualRange` + `baselineRangeForPreset` (corrige percentagens em ranges anuais e "Últimos N meses"); `monthlyRevenue` com `locale: pt`
- **77** — Preservação fix drag-and-drop entre grupos: `pointerWithin`+`rectIntersection` híbrido como collisionDetection; novo state `optimisticMoves: Map` para mover linha imediatamente; helper `runMove` consolida optimistic→action→refresh+clear com error toast; `handleDragEnd` com `over=null` deixa de ser silencioso (info toast)
- **76** — Finanças/Despesas: descrição passa a ser o campo primário (obrigatório); fornecedor opcional e auto-detect URL→link (mig 045); novo KPI "Total desde sempre" inclui subscrições acumuladas via `subscriptionTotalToDate`
- **75** — Tarefas multi-assignee Opção A (mig 044): `tasks.assignee_emails TEXT[]` (qualquer assignee marca = some para todos); `seen_by TEXT[]` + RPC `mark_tasks_seen`; checklist mescla tarefas atribuídas; bolinha sky na sidebar + toast inicial; UI multi-assignee com 3 avatares clicáveis
- **74** — Tabela Preservação: botão "Sem resposta" removido (drag-and-drop substitui); larguras de colgroup restauradas (Cliente 16%, Estado 16%, Pagamento 14%, Acções 6%); workbench `SelectTrigger` do Pagamento ganha `w-full max-w-full` para pill "100% por pagar" não transbordar coluna 3fr
- **73** — Tabela Preservação: ícone "Em mãos" sky → emerald (contraste com violet "Recolha no local"); alinhado com `FLOWER_DELIVERY_METHOD_COLORS` (badges workbench/métricas já eram emerald). Convenção final: maos=emerald, ctt=amber/sky, recolha_evento=violet, nao_sei=stone
- **72** — Métricas: +5 gráficos com paletas semânticas alinhadas aos badges (`flowerDeliveryDist`, `frameDeliveryDist`, `contactPrefDist`, `couponUsageDist`, `upsellsBreakdown` em `metrics.ts`); `PieDist` ganhou prop `fills?: string[]` para cor por chave
- **71** — Coerência visual "Recolha no local" = 🚗 Car + violet em toda a app; CTT quadro violet → rose (`dashboard.ts`, `entregas-recolhas-client.tsx`, `calendar-view.tsx`, `preservacao-client.tsx`)
- **70** — Chat interno: bolinha sky de mensagens por ler na sidebar (mig 043 RPC `mark_chat_messages_read` SECURITY DEFINER; hook `useUnreadChatCount` com Realtime; auto mark-as-read em chat-client.tsx; esconde em `/chat`)
- **69** — Finanças: selector de ano + "Potencial total" exclui pré-reservas/sem-resposta/canceladas; `metrics.ts` usa lógica proporcional (igual a Finanças); regra de atribuição ao ano (orders → event_date, vouchers → created_at, despesas → expense_date)
- **68** — Workbench Preservação mobile: coluna central `order-1`, gaps/paddings menores `<lg:` (desktop intocado)
- **67** — Comunicações: tab default segue `contact_preference`; WhatsApp log abre scrollado ao fim
- **66** — Healthchecks deixam de enviar email; bolinha 🟢🟡🔴 na sidebar Sistema; status persistido em `system_settings` via cron diário
- **65** — Fase B comunicações: registo manual de WhatsApp no workbench Preservação (mig 042) — parser do export PT, bolhas estilo WhatsApp, importar/editar/apagar, screenshots como URLs Drive
- **64** — Fase A comunicações: biblioteca de 29 templates pré-populados PT+EN com variáveis `{nome}`/`{valor_sinal}`/`{dados_pagamento}` (mig 041); UI Sistema → Templates; picker no workbench Preservação + Vale-Presente; sem IA
- **63** — Limpeza estrutural: `formatEUR()` centralizado, scroll horizontal mais curto (colunas verbosas escondidas <xl), split workbench Preservação 2988→2111 linhas (_components/), chat mobile + emoji picker, healthchecks automáticos diários (Vercel Cron + Resend), badge "parada há X dias"
- **62** — Favicon PWA round 2: CORP cross-origin para manifest+favicon, simplificação dos icons (só maskable+favicon-32), SW cache v3
- **61** — Turnstile nos forms públicos do `fbr-website`; mig 040 fecha enumeration de vouchers (drop policy `vouchers_public_read`)
- **60** — CAPTCHA Turnstile no login admin (graceful sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)
- **59** — Hardening 2 (mig 039): bloquear INSERT directo do anon no audit_log; RPC `get_voucher_by_code`; CSP minimal (frame-ancestors/base-uri/form-action)
- **58** — Auditoria de segurança + hardening (mig 038): orders.authenticated_all → split admin/viewer; audit_log só admin; vouchers anon column-level; HSTS + X-Frame-Options + Permissions-Policy + COOP
- **57** — Compatibilidade mobile (overrides `<sm:` só, desktop intocado) + favicon PWA maskable com fundo cocoa
- **56** — Aba Ecossistema: ferramentas externas (Gmail, WhatsApp Web, Instagram, FB, FB Ads, CTT, Site.pt, GSC) + limpeza de texto desactualizado
- **55** — Afinações Google Calendar (migs 036+037): 🚐→🚗, descrição mais leve, data por extenso, ID clicável, 💐 nos títulos, contacto da recolha (pickup_contact_name/phone), botão "No Calendar" persistente via `calendar_event_html_link`
- **54** — HOTFIX React #185 no workbench Preservação: `getSnapshot` do `useSyncExternalStore` devolvia objecto novo a cada render → cache modular ([[feedback_useSyncExternalStore_pitfall]]); criado `scripts/smoke.mjs` Playwright
- **53** — Custos de produção UX + consumíveis recorrentes (mig 035): € visível, V/V→Vidro/Cartão, 8 consumíveis × 3 tamanhos editáveis
- **52** — Slide entre workbenches (◀ ▶ "12 / 47", atalhos ← →); Custos de produção COGS (mig 034); moldura pirâmide com suplemento + `ProductionCostBadge` (margem verde/âmbar/rosa)
- **51** — Feedback visual em cliques: barra de progresso global, active states, Loader2 no chat
- **50** — Refactor Finanças: tabs grandes, sub-tabs Únicas/Subscrições, anexo factura Drive, Potencial total, fotografia por tamanho (mig 033)
- **49** — Afinações workbench Preservação: responsivo mobile, edição contacto cliente, condicionais por método de envio, badges com ícones na tabela
- **48** — Status mostra `couple_names` quando casamento (admin + site público; mig 032)
- **47** — Redesign Entregas e Recolhas: fix "Atrasadas" + agenda focada em HOJE + mapa interactivo Google Maps + notas de recolha (mig 031)
- **46** — Lote A/B/C/D/E: sidebar reorg, calendário Semana/Mês/Ano com popover, "Sistema" consolidado (5 sub-tabs), Maps Places autocomplete, Calendar com info de recolha+contactos
- **45** — Dark mode: palette FBR (cream/cocoa em CSS vars com swap automático) + ~70 ficheiros convertidos via [scripts/darkmode-tokens.ps1](scripts/darkmode-tokens.ps1)
- **44** — Pesquisa global Cmd+K em 5 tipos com race-condition guard
- **43** — Lacunas pós-42: comissão condicional, exports CSV vales/parceiros, Livro de Receitas (mig 028), Chat interno texto+Realtime (mig 029), Despesas (mig 030), Faturação, Healthchecks, RGPD PDF
- **42** — Tabela de preços com cálculo automático (mig 025), Ideias Futuras (mig 026), Entregas/Recolhas, Ecossistema, audit log UI (mig 027); fix botão "Vale digital"
- **41** — RGPD avançado: exportação JSON+PDF, retenção 10 anos com anonimização (mig 024)
- **40** — Mobile-friendly: drawer mobile, tabelas com `min-w`, tap targets ≥40px; fix ícone PWA
- **39** — PWA: manifest, service worker (assets-only), install prompt iOS+Android
- **38** — Google Calendar: criação automática de eventos all-day ao 1º pagamento (mig 023)
- **37** — Foundation OAuth Google + auto-criação pastas Drive ao 1º pagamento (8 subpastas) (mig 022)
- **36** — Fix fase pública "A finalizar o quadro": shift 7→8 nas messages (mig 021)
- **35** — `status.floresabeirario.pt` ligado ao Supabase (mig 020); substituiu o Google Sheets manual

### Fase 5.5 — Afinações pós-uso (sessões 28-34)
- **34** — Métricas mais coloridas (areas/donuts/heatmap), Finanças "Competição" (mig 019), autocomplete Nominatim em Parcerias
- **33** — Drag-and-drop entre grupos na tabela Preservação (@dnd-kit)
- **32** — Dashboard checklist com 3 fotos em vez de dropdown
- **31** — Bugfix `a_finalizar_quadro` desaparecia da tabela; rede de segurança `STATUS_TO_GROUP` exaustivo replicado a Vale+Parcerias; grupos fim-de-linha colapsados por default
- **30** — Alinhamento de colunas Vale/Parcerias com padrão Preservação (selects rounded-md, grupos vazios abríveis, padding consistente)
- **29** — Refactor workbench Vale-Presente: fundir pagamento+fatura, secção Parceria, sticky note, indicador idioma + RGPD na metadata
- **28** — Pacote grande pós-uso parte 1: novo estado `a_finalizar_quadro`, recolha no local, inventário JSONB, sticky notes, alertas 40%/30%/aprovação, partner combobox cmdk, opção "recomendação IA" (mig 018)

### Fase 5 — Forms públicos + Parcerias (sessões 23-27)
- **27** — Eliminação: arquivar (soft) + apagar definitivamente com justificação (HardDeleteDialog)
- **26** — Form público: 4 campos em falta (event_type, couple_names cond., event_location, gift_voucher_code cond.)
- **25** — Forms públicos Monday→Supabase: consent RGPD, policies INSERT/anon, `INSERT...RETURNING` precisa GRANT SELECT (migs 016+017)
- **24** — Importação Monday de 171 parceiros + 232 interações; telemóveis em JSONB com etiquetas (migs 014+015)
- **23** — Aba Parcerias completa: 4 categorias, workbench 3 colunas, mapa SVG Portugal, interações/acções JSONB, FK orders/vouchers (mig 013)

### Fase 4 — Dashboard + Tarefas + Métricas (sessão 22)
- **22** — Tarefas + checklist pessoal (mig 012); Dashboard 2×2; aba Métricas com recharts (KPIs, mensal, pies, top parceiros, insights)

### Fase 3 — Vale-Presente + Status (sessões 13, 18-21)
- **21** — `voucher.floresabeirario.pt` ligado ao Supabase (mig 010 + GRANT SELECT anon)
- **20** — Vale-Presente alinhamento com PDF: campos novos (`recipient_contact`, `recipient_address`, `ideal_send_date`), GRANTs em falta (mig 011)
- **19** — Afinações: labels vale, cards sem foto em alguns grupos, datas dd/MM/yyyy
- **18** — Vale-Presente admin completo: tabela `vouchers`, código 6-char alfanumérico, sheet, workbench (mig 009)
- **13** — Aba Status completa: mapeamento 12 fases públicas, mensagens PT/EN, data prevista auto +6m (mig 005)

### Fase 2 — Preservação (sessões 3-17, excepto 13)
- **17** — Remoção do `30_por_pagar` (equivalente a `70_pago`); cores distintas para pagamento (mig 008)
- **16** — Ordenação por data evento; mover manualmente para "Sem resposta" (mig 007)
- **15** — Importação histórica Monday (17 encomendas, mig 006); cupão sem `0`/`O`; florista obrigatória
- **14** — Permissões admin/viewer; Ana = viewer; `<fieldset disabled>` em cascata
- **12** — Vistas Calendário + Timeline; constantes em [_styles.ts](src/app/(admin)/preservacao/_styles.ts)
- **11** — Pacote grande pós-uso: pagamento inline, export CSV, cores estados, NIF, cupão editable, ID editável, helper [drive-url.ts](src/lib/drive-url.ts)
- **10** — Tabela redesenhada: colunas adaptadas ao ciclo (Envio flores / Receção quadro condicionais)
- **9** — Bug visual SelectValue (base-ui): labels em vez de valor cru via prop `labels`
- **8** — Cards substituem "Workbench" na listagem; URL `/preservacao/<order_id>` curto
- **7** — Workbench 3 colunas com paleta por secção (border-l + ícone)
- **6** — Tabela com edição inline (estado + "Marcar contactada"); diálogo NIF no pagamento
- **5** — Workbench completo: hero foto, extras, peças extras, galeria, NIF, fatura, parceiro placeholder
- **4** — Fix 500 form Nova Encomenda: faltavam GRANTs em `authenticated` (mig 003)
- **3** — Schema BD (mig 001+002), tabela com grupos colapsáveis, form Nova Encomenda

### Fase 1 — Fundação (sessões 1-2)
- **2** — Login Netflix com fotos no Vercel (email+password+subendereços Gmail)
- **1** — Leitura PDF spec, plano por fases definido


### Sessão 130 (2026-07-03) — Notificações push internas da PWA
- **O quê:** Web Push + VAPID próprio (sem serviço externo). **Na hora:** 🌸 nova encomenda do form (admins), ✅ tarefa atribuída (ao próprio), 📅 data de entrega das flores preenchida, 💬 WhatsApp de cliente recebido (SÓ António, colapsado por conversa), 🎁 novo vale-presente. **Diárias (cron 7h, 1 push por evento — Maria recusou digest):** 📦 recolha amanhã, 💐 flores amanhã/em mãos, 🧊 congelador 120h completas, 🚑 healthcheck→vermelho, prazos de tarefa (3d e 1d antes, aos assignees). **Lembrete pontual data+hora** em tarefas (`tasks.reminder_at`, badge 🔔): GitHub Actions [reminders.yml](.github/workflows/reminders.yml) toca em [/api/cron/reminders](src/app/api/cron/reminders/route.ts) de 10/10min (marca `reminder_sent_at` ANTES de enviar; editar data repõe NULL).
- **Ficheiros-chave:** [lib/push/send.ts](src/lib/push/send.ts) + [daily.ts](src/lib/push/daily.ts) (lógica pura testável), [push-toggle.tsx](src/components/push-toggle.tsx) (sino na sidebar, por dispositivo), [sw.js](public/sw.js) v6, rotas `/api/internal/notify-order` + `notify-voucher` (Bearer `INTERNAL_NOTIFY_SECRET`, chamadas pelo fbr-website).
- **Migrações:** [088](supabase/migrations/088_push_subscriptions.sql) (corrida) + [089](supabase/migrations/089_task_reminders.sql). Env: 4 VAPID_* (a NEXT_PUBLIC antes do build!) + INTERNAL_NOTIFY_SECRET nos 2 repos + CRON_SECRET no GitHub.
- **Regra:** nada de envio automático a clientes — tudo interno. 92 testes ✅. Só funciona em produção (SW).

### Sessão 131 (2026-07-04) — WhatsApp: avatares, etiquetas geríveis, vistos
- **O quê:** aba `/whatsapp` com layout à WhatsApp mas cores da marca. **Avatares** (iniciais + cor determinística; foto do quadro da encomenda ligada como foto de perfil — match últimos 9 dígitos do telefone, `toEmbeddableImageUrl`, fallback com `onError`). **Vistos** ✓/✓✓/✓✓ azul (o antigo 📱 passou a ✓ cinza "enviada"). **Etiquetas:** de 3 fixas evoluiu para sistema gerível pela Maria — recolorir/renomear/criar (paleta pronta de 14 cores, classes Tailwind literais), definições em `system_settings["whatsapp_labels"]`; etiquetas automáticas Cliente/Lead/Cancelado derivadas do estado da encomenda ligada (prioridade cliente>lead>cancelado; sem encomenda → sem chip; "Cancelado" nunca é gravado), manual sobrepõe.
- **Ficheiros:** [whatsapp-client.tsx](src/app/(admin)/whatsapp/whatsapp-client.tsx), [page.tsx](src/app/(admin)/whatsapp/page.tsx), [actions.ts](src/app/(admin)/whatsapp/actions.ts), novo [lib/whatsapp/labels.ts](src/lib/whatsapp/labels.ts). Removidos 2 NUL bytes pré-existentes no `NotesArea` (faziam o grep tratar o ficheiro como binário).
- **Migrações:** [090](supabase/migrations/090_whatsapp_category.sql) (corrida) + [091](supabase/migrations/091_whatsapp_category_freeform.sql) (**correr ANTES do deploy** — drop do CHECK).
- **Limitação Meta (não insistir):** a Cloud API NÃO dá fotos de perfil, labels do Business nem vistos de mensagens enviadas pelo telemóvel — [[project_whatsapp_cloud_api_limits]].
- **Commits:** bc73f8e, 55a098f, bdbf9c7, 35391ce, 2463ea4. Preflight + lint OK.
- **Smoke (Maria):** gerir etiquetas (cor/nome/nova), atribuir a conversa, chips na lista, ✓ nas enviadas.

### Sessão 132 (2026-07-04) — Arrumação do workflow (sem código da plataforma)
- **O quê:** PROGRESS.md 180 KB→compacto (histórico integral movido para [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)); secções "Próximas frentes"/"Ideias" dessincronizadas actualizadas (Gmail/WhatsApp/AI/push/backup/filtros já estavam FEITOS); permissões duráveis em [.claude/settings.json](.claude/settings.json) e `settings.local.json` esvaziado + gitignored (estava tracked com 60 KB de histórico); CLAUDE.md corrigido (login é password, não Google OAuth) + secção "Como trabalhar neste repo"; skills novas `/fechar-sessao` e `/nova-migracao` em `.claude/skills/`; memórias do PROGRESS fundidas.
- **Limpeza de ficheiros:** `public/` só pode ter o que é para servir — saíram para `_privado/` (gitignored): `plataforma admin.pdf` (a spec interna estava **servida publicamente** no deploy!), 1 extracção .txt (a duplicada foi apagada) e o xlsx do GSC de 26/05; apagados os 5 SVGs boilerplate do create-next-app (sem referências). ⚠️ Estes ficheiros continuam no **histórico** do git — a sessão de expurgo (item 2c, filter-repo) deve removê-los junto com as conversas WhatsApp. *(Nota da sessão 139: expurgo FEITO a 11/07/2026.)*
- **Migrações:** nenhuma. **Smoke:** n/a (só ficheiros de processo; zero código tocado).

### Sessão 133 (2026-07-04) — Auditoria de segurança + ecossistema + correcções aplicadas
- **Auditoria (Fable):** 4 repos + RLS/GRANTs das 91 migrações + lógica financeira. **0 críticos, 3 moderados, 5 menores.** Relatório: https://claude.ai/code/artifact/eca9f339-da8e-4fa5-944d-e9a3fbc27403
- **Correcções aplicadas e EM PRODUÇÃO (admin `1114903` + voucher `37488f8` pushed):** m4 helper `isAuthorizedCron` timing-safe ([lib/auth/cron.ts](src/lib/auth/cron.ts)) nas 3 rotas de cron; m1 proxy só isenta `/api/whatsapp/webhook/` (media/suggest/retry voltam ao gate, têm auth própria); m3 callback Google não põe `detail` do erro no URL; **C1** Ideias + Livro de Receitas passam a `requireAdmin` (Maria confirmou: Ana edita só Tarefas/Parcerias/Chat — reverter = requireUser); m2 rate limit 30/min/IP no lookup de vales (fbr-voucher).
- **fbr-website (develop `1cdc431`, NÃO em produção — entra no merge pendente):** M1 `isVercelPreview` só aceita `fbr-website-*.vercel.app`; M2 `verifyTurnstile` fail-closed em produção + alarme no `monitor-forms` se `TURNSTILE_SECRET` sumir. **C2 confirmado:** `TURNSTILE_SECRET` existe em Production na Vercel do site (screenshot da Maria).
- **Não corrigido de propósito:** M3 webhook WhatsApp sem HMAC (limitação Dualhook, risco aceite — rodar path token 1x/ano); m5 CLAUDE.md diz "11 estados públicos" (são 13). Ver [[project_auditoria_133_pendentes]].
- **Ecossistema:** plataformas todas adequadas; Monday/Sheets/Excel eliminados. Recomendação a prazo: absorver fbr-tracking no fbr-website (lógica de fases duplicada, hoje em sincronia).
- **Ganhos pequenos (mesma sessão, admin `8c566bd`):** varrimento `formatDateTimeLisbon` completo (metricas/healthchecks/chat/audit/parcerias×2/receitas/painel; novos helpers `formatTimeLisbon` e `...WithSeconds`); CLAUDE.md 11→13 fases.
- **fbr-website merge→main `711ca4b` + perf `074b08a` (EM PRODUÇÃO):** correcções de segurança + sessão 126 foram live; **performance:** imagens de origem sobredimensionadas reduzidas 60MB→8MB (sharp, 1920px/q82 — [scripts/downsize-images.mjs](../fbr-website/fbr-website/scripts/downsize-images.mjs)) + removidos 5 vídeos mortos sem referências (~60MB). Causa da lentidão: fotos da equipa a 12MP/10MB e vídeos gigantes no deploy. **Preflight admin OK + build website OK.**
- *(Nota: hashes de commits do fbr-admin citados acima foram reescritos no expurgo RGPD da sessão 139 — já não existem.)*

### Sessão 136 (2026-07-08) — Fonte única das fases públicas + docs cross-repo do ecossistema
- **O quê:** eliminada a duplicação estado→fase pública (o footgun cross-repo: dois repos, dois mapas para manter em sincronia). Nova RPC **`get_public_order_status`** (mig 092, `SECURITY INVOKER`) é a fonte única em runtime; o **fbr-tracking** deixou de ter mapas (−142 linhas, só chama a RPC e formata). `public-status.ts` fica só para a UI síncrona do admin, com teste `public-status-sync.test.ts` a garantir que não diverge da SQL. Docs cross-repo novos em `docs/`: **ECOSYSTEM** (contrato + teste `ecosystem-contract.test.ts`), **SECRETS** (registo + rotação — inclui webhook WhatsApp 1×/ano), **MIGRATIONS-STATUS**, **REPOS** (build dos 4 repos). Contexto: pergunta da Maria sobre como melhorar a comunicação entre os 4 repos.
- **Ficheiros:** [mig 092](supabase/migrations/092_public_phase_defs.sql), [public-status.ts](src/lib/public-status.ts), 2 testes novos, `docs/`×4; fbr-tracking [utils/supabase.js](../fbr-tracking/fbr-tracking/fbr-tracking/utils/supabase.js).
- **Migrações + passos manuais:** mig 092 ✅ **aplicada** (08/07). Nenhum passo manual pendente.
- **Deploys:** admin→`master` (`e532463`+`651cd88`); fbr-tracking merge `develop→main`, **em produção**. Também committado o [layout.tsx](src/app/(admin)/layout.tsx) (fix mobile do título centrado, sessão 135, estava por commitar).
- **Smoke:** ✅ FEITO por script contra dados reais (RPC + `getEncomendaById`): fases 0-12/cancelada, PT/EN, datas — tudo certo; status.floresabeirario.pt 200. **Nada por smokar.** (Fica só o smoke visual mobile da sessão 135, no pendente.)
- **Parte 2 (mesma sessão):** **CI nos 4 repos** (website: build env dummy — `npm install` porque o lock de Windows não tem binários linux; tracking: build env dummy, `.github` na RAIZ do git — armadilha do aninhamento; voucher: `scripts/smoke.mjs` com `SMOKE_CHANNEL=bundled`); **Dependabot** nos 4 (mensal agrupado; já abriu PRs verdes em tracking/voucher); **estratégia de branches por repo** documentada no [REPOS.md](docs/REPOS.md); **teste de contrato de colunas** website↔orders/vouchers ([website-form-contract.test.ts](src/lib/__tests__/website-form-contract.test.ts) — extrai as chaves dos payloads do site e valida contra o schema das migrações; skip na CI sem sibling). 100 testes ✅.
- **Pendente:** nada desta sessão. Frente futura registada: absorver o fbr-tracking no fbr-website (agora que o tracking é apresentação pura, ~46 linhas de lógica).
- *(Nota dos hashes do expurgo aplica-se também aos commits do fbr-admin desta sessão.)*

### Sessão 137 (2026-07-08) — fbr-website: análise visitante + correcções factuais + páginas de momentos
- **O quê:** análise design/conteúdos do site na ótica do visitante, seguida de 3 pacotes aplicados. **Quick wins factuais (PT+EN):** Sustentabilidade dizia "4 a 6 semanas" de entrega (é até 6 meses!) e "Preenche" (tu); FAQ do Bouquet dizia 40% "na aprovação da composição" (é na receção das flores); "Almaláques"→"Almalaguês"; prazo máximo de entrega uniformizado para 6 dias (Como Funciona dizia 5; hint do form dizia "2 a 3"→"1 a 3"); "guardamos o seu lugar sem compromisso" removido (a vaga só fica garantida com o sinal). **Limpeza + selo:** chaves mortas apagadas dos json (galeria do bouquet nunca renderizada + CSS, home.momentoTitle/momentoDesc/prontoTitle, weekendNote); selo "Recebemos ao fim de semana" implementado no hero do Bouquet (CSS já existia). **Páginas de momentos ×4** (aniversário/batizado/luto/pedido): prova social "★★★★★ 5,0" com links Google+casamentos.pt no hero (novo `MomentoProofBar`, chave `common.provaSocial`), foto de trabalho real no corpo (novo `MomentoFoto`; LaurenJcloseup/detalhe/sandra1/fotoquadrocloseup3), barra fixa mobile de CTAs (classe `momento-page--sticky`; hero CTAs escondidos em mobile como no bouquet; desktop intocado).
- **Google Images (3 frentes aplicadas):** (1) `max-image-preview:large` + `max-snippet/-video:-1` no robots do [layout.js](../fbr-website/fbr-website/app/[locale]/layout.js) (sem isto o Google mostra as fotos em miniatura reduzida); (2) **29 fotos de trabalhos renomeadas** para nomes ricos em palavras-chave PT (ex.: `fotoquadro1.webp`→`quadro-flores-prensadas-preservadas.webp`, `sandra1`→`flores-homenagem-preservadas-quadro`, `moldurapreta`→`moldura-preta-flores-preservadas`) — script Node fez 80 substituições em 38 ficheiros (jsx/js/json/**mdx frontmatter**/blog.js+metadata defaults), ficheiros movidos com `git mv` (histórico preservado); NÃO renomeadas: equipa (mj/antonio/ana), voucher (vale1/2), APCC, og-homepage, ritaherophoto, passos de envio/recriação (já descritivos); (3) **imagens no [sitemap.js](../fbr-website/fbr-website/app/sitemap.js)** via campo `images` por rota (mesma foto PT+EN) → 42 `image:loc` no sitemap.xml gerado.
- **Ficheiros (fbr-website):** `messages/pt.json`+`en.json`, `app/globals.css`, `app/_components/MomentoProofBar.jsx`+`MomentoFoto.jsx` (novos), 4 clientes de momentos, `BouquetNoivaClient.jsx`, `[locale]/layout.js`, `app/sitemap.js`, +38 ficheiros com refs de imagem renomeadas, +29 webp em `public/` movidos.
- **Migrações:** nenhuma. **Build:** ✅ OK (2×, depois dos renames + sitemap). **Smoke (Maria, antes de push):** abrir as 4 páginas de momentos (desktop + telemóvel — barra fixa, foto no corpo, linha 5,0) + hero do Bouquet (selo fim de semana) + CTA Sustentabilidade (6 meses) + **verificar que as imagens carregam** em opções-e-preços, bouquet-noiva, blog, contactos (foram as mais afectadas pelos renames).
- **Bug de scroll em Opções e Preços (corrigido):** o hero "colava" ao 1.º scroll e saltava tudo ao 2.º (relatado pela Maria). Causa: o wrapper raiz de [OpcoesClient.jsx](../fbr-website/fbr-website/app/opcoes-e-precos/OpcoesClient.jsx) usava `overflow-x: hidden` inline, que por spec força `overflow-y: auto` → cria contentor de scroll que o Safari mobile "prende" no 1.º gesto. Contactos tem hero idêntico (useScroll fade + 100svh) mas usa `clip` e não tinha o bug → isolou a causa. Corrigido `hidden`→`clip` (raiz + wrapper do carrossel de fundos), alinhado com a convenção do resto do site. Sem mudança visual; build ✅.
- **EM PRODUÇÃO:** commit `f4f9b8e` (develop) + merge `4c2c0bd` (main, `git merge --no-ff` = convenção do repo, NÃO fast-forward) pushed a 08/07. Deploy Vercel automático do main. Verificação pré-push: build ✅, script confirmou 137 refs de imagem todas resolvem + 6 chaves i18n novas em PT+EN + 0 refs a chaves apagadas.
- **Pendente:** galeria "Trabalhos reais" do Bouquet ficou POR FAZER (recuperável: copy+CSS no histórico git desta sessão). **Passos manuais Google (Maria):** no Search Console pedir re-indexação + submeter sitemap; medir em Desempenho › tipo "Imagem" nas próximas semanas. **Smoke visual (Maria):** as 4 páginas de momentos no telemóvel + scroll de Opções + imagens a carregar em opções/bouquet/blog/contactos.

### Sessão 138 (2026-07-08) — fbr-voucher: melhorias de design/UX do vale (9 aprovadas pela Maria)
- **O quê:** sugestões de melhoria pedidas pela Maria, aprovadas em bloco ("faz tudo, sem estragar nada"). **(1) Envelope personalizado:** "Um presente para si" → **"Para {destinatário}"** quando os dados da API chegam (classe `env-brand--nome` com quebra para nomes longos; testado com 37 chars em 390px). **(2) Pétalas a cair** ao abrir o envelope (7 SVGs assimétricos estilo botânico, família ouro, animação única ~3s). **(3) Nomes-exemplo fora do HTML** — overlays começam vazios até a API responder (ligações lentas já não mostram "Joana"). **(4) Copiar código:** célula do código no resumo é botão (clique/Enter → clipboard, label "Copiado ✓" 1,6s, ícone; fallback execCommand) e o CTA "Reservar agora" passa a levar **`?vale=CODIGO`**. **(5) Aviso de vale expirado** (validade MM/YYYY → fim do mês; caixa terracota discreta + validade a terracota; o vale continua a abrir — fecha o pendente "decisão de produto" da leva 2). **(6) Botão "Partilhar este vale"** (navigator.share; fallback copia o link + "Link copiado ✓"). **(7) Imagem OG dedicada** `img/og-voucher.jpg` 1200×630 (capa fechada do cartão sobre creme; novo [render-og.mjs](../fbr-voucher/fbr-voucher/scripts/render-og.mjs), Edge headless; `api/share.js` aponta para ela + og:image:width/height/alt — antes era o favicon 512px). **(8) prefers-reduced-motion:** CSS desliga os loops decorativos; JS abre o cartão sem mola (com troca manual dos canvases da capa) e sem pétalas. **(9) Zoom do browser permitido** (acessibilidade): viewport sem `user-scalable=no`; o pinch custom do cartão fica protegido por `touch-action: pan-y` no `.hero-section` + handler limitado a alvos dentro do hero — fora do hero o pinch volta a ser do browser.
- **Ficheiros (fbr-voucher):** `index.html` (CSS+HTML+i18n+JS), `api/share.js`, `img/og-voucher.jpg` (novo), `scripts/render-og.mjs` (novo), `scripts/smoke.mjs` (+14 verificações: personalização, pétalas, copiar+clipboard, partilhar, `?vale=`, expirado PT/EN re-traduzido, reduced-motion).
- **Migrações:** nenhuma. **Smoke:** ✅ 43/43 verdes (Playwright+Edge com mock local) + screenshots inspeccionados (desktop, mobile 390px, envelope com nome longo, cartão aberto mobile com auto-zoom, expirado EN, OG image).
- **Afinações pós-deploy (feedback da Maria):** (1) "a pill é estranha" → a marca "Flores à Beira-Rio" perdeu a cápsula com blur, wordmark solto em TAN Memories (`f8a17df`); (2) "quero o título visível no scroll" → `.brand` fica `fixed` mas a legibilidade sobre o cartão vem de um véu de gradiente creme no topo (`.brand-scrim`), não de caixa; (3) "o envelope diz 'Um presente para si' e muda para o nome 1s depois" → o título do envelope começa invisível e revela-se com fade já com o texto final (fallback 2s para o genérico se a API demorar). (4) "quero que o refresh volte sempre ao topo" → `history.scrollRestoration = 'manual'` + `scrollTo(0,0)` no load e no `pageshow` (a experiência recomeça no envelope). Commits `b41489d` + `1d24981` pushed, smoke re-corrido ✅ (44 verificações). Memória nova: [[wordmark-sem-pill]].
- **Pendente:** **fbr-website** ainda não lê `?vale=` no form de reserva — pré-preencher código + "como conheceu" em [ReservarPreservacaoForm.jsx](../fbr-website/fbr-website/app/reservar-preservacao/ReservarPreservacaoForm.jsx) numa próxima sessão (mudança pequena; o voucher já envia o parâmetro, é inofensivo até lá). Smoke da Maria em produção no topo deste ficheiro.

### Sessão 139 (2026-07-11) — Expurgo RGPD do histórico git (item 2c) + verificações
- **O quê:** histórico do fbr-admin reescrito com **git-filter-repo** (clone-espelho + force push; Python 3.12 + filter-repo instalados via winget/pip). Removidos de **TODO o histórico** 14 paths: `public/conversas whatsapp/` (16 clientes + 1 .vcf), `mondayexport.xlsx`, 4 xlsx de parcerias, `scripts/_monday-parceiros-parsed.json` (PII de parceiros — apanhado na verificação, não estava no inventário da 132), spec interna (pdf + 2 txt), export GSC, `.claude/settings.local.json`, e o **conteúdo das migs 006/014** (17 clientes + 171 parceiros com emails/telemóveis inline — decisão da Maria) → substituídas por **stubs no-op** que preservam a numeração. 267→265 commits.
- **Verificação:** diff de árvore (com hashes de blobs) HEAD antigo vs novo = **exactamente** as 2 migrações; grep ao histórico inteiro limpo; preflight completo ✅ (tsc + 100 testes + build) — schema-drift e contrato do website não dependiam do conteúdo expurgado.
- **⚠️ Hashes antigos do fbr-admin citados neste ficheiro/ARQUIVO já não existem** (histórico reescrito); branches do dependabot também foram reescritos (PRs continuam válidos). Objectos antigos podem persistir em caches do GitHub até ao gc deles — repo privado, risco baixo; remoção imediata só via GitHub Support.
- **Backup:** bundle completo PRÉ-expurgo em `_privado/backup-pre-expurgo/` (gitignored) — **contém o PII**, apagar quando houver confiança (pendente no topo do PROGRESS.md).
- **Também:** confirmado que M1/M2 do fbr-website já estavam em produção (pendente obsoleto fechado); PROGRESS da 137/138 estava por commitar — committado antes da reescrita. **Migrações:** nenhuma nova (só stubs). **Smoke:** nada visual a testar (zero mudanças de comportamento; preflight cobre).
