# FBR Admin — Estado do Projecto

> Lido no início de cada sessão; actualizado em tempo real durante a sessão.
> **Regras deste ficheiro:** máximo ~30 KB. Só as últimas 5 sessões ficam aqui, em formato compacto
> (template: O quê / Ficheiros / Migrações + passos manuais / Smoke / Pendente, máx ~15 linhas).
> Ao entrar a 6ª sessão, a mais antiga move-se **na íntegra** para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)
> (que NÃO é lido por defeito — todo o histórico das sessões 1-132 está lá). O detalhe fino vive nos commits do git.
> ⚠️ Hashes de commits do fbr-admin anteriores a 11/07/2026 foram reescritos no expurgo RGPD (sessão 139) — já não existem.

---

## Onde estamos

**Fase 6 — Integrações + PWA + RGPD (em curso).** Última sessão: **153** (2026-08-17, assistente do WhatsApp reconstruído em 7 frentes: lê os campos da encomenda, escreve na voz real da Maria, aprende com as correcções dela, e UX do telemóvel). A **152** correu em paralelo no mesmo dia (converter encomenda para "flores secas") — daí a colisão de numeração. Ambas em produção, **nenhuma com smoke feito**.

### ⚠️ Pendentes de confirmação da Maria (verificar antes de assumir)
- [ ] **Sessão 153 — Assistente do WhatsApp reconstruído (EM PRODUÇÃO 17/08, 8 deploys, último `6f077f4`):** ponto de partida da Maria: *"o sistema de templates dá-me imenso trabalho e não me relaciono com o que o assistente diz"*. **Mig 102** ([`102_suggestion_edits.sql`](supabase/migrations/102_suggestion_edits.sql)) ✅ **CORRIDA** (Maria, 17/08). Nada disto está confirmado por ela ainda.
  - **Diagnóstico:** (a) o prompt nunca teve **uma única mensagem real dela** — só a persona escrita à mão e os 29 templates, por isso soava a template; (b) a query do `suggest` omitia ornamentos/pendentes/quadros extra/extras/tipo de flores, logo respondia às cegas a quem marcou "Mais info"; (c) as edições dela eram deitadas fora, o sistema nunca aprendia.
  - **7 frentes, todas live:** (1) o assistente **lê os campos do formulário** + secção **OBRIGATÓRIO** com o que a mensagem tem de cobrir (`requiredContentPoints`); (2) **voz aprendida** — 8 mensagens reais dela (`sent_echo`) anonimizadas e escolhidas pela situação entram no prompt, auto-alimenta-se; (3) **UX telemóvel** — fim do toast "Copiado" preso, botão "Abrir no WhatsApp" (wa.me com o texto), toques a 44px; (4) **rascunhos persistentes** em localStorage (sobrevivem ao Android matar a PWA) + **histórico `‹2/3›`**; (5) **afinação por texto livre** ("mais curta") que reescreve em vez de refazer; (6) **ciclo de aprendizagem** — ao copiar guarda o par gerado/usado; no Cérebro do Claude ela pede a análise e aceita/rejeita regras que entram no prompt; (7) sugestão **encolhível** para ler a conversa por trás.
  - **Decisões dela (não voltar a propor o contrário):** explicações dos extras **sem preços**; fundo do quadro não gera pendência; **sem atalhos de um toque** na afinação, só texto livre.
  - **🔴 SMOKE — nada confirmado:** (a) conversa com ornamentos/pendentes em "Mais info" ou envio "Não sei" → sugestão explica sozinha e sem preços; (b) o tom soa-lhe a ela e **nenhum nome de outra cliente** aparece; (c) copiar → "✓ Copiado" sem tapar botões; (d) "Abrir no WhatsApp" cai na conversa certa com o texto; (e) escrever meia mensagem → ir ao WhatsApp → voltar → texto lá; (f) Refazer 2-3× → `‹2/3›` e dá para recuar; (g) "mais curta" → Aplicar → encurta mantendo valores/datas; (h) chevron encolhe e vê-se a conversa; (i) usar 5+ vezes → Cérebro do Claude → "N por analisar" → Analisar → aceitar regra → Guardar → respeitada na sugestão seguinte.
  - **Por decidir (não aprovado):** textos canónicos dos extras (hoje o Claude improvisa); guia de voz destilado do corpus todo; rascunho pré-gerado ao abrir a conversa (U5); botão de microfone. Custos API: Haiku ~2,50€/mês · Sonnet ~9€/mês · Opus 5 ~19,50€/mês (10 sugestões/dia); modelo mantém-se `claude-sonnet-4-6`.
  - **⚠️ Efeito colateral no desktop:** a caixa da sugestão perdeu a pega de redimensionar (`resize-none`) porque cresce sozinha. Reverte-se se ela quiser.
- [ ] **Sessão 152 — Converter encomenda para "flores secas" no workbench (EM PRODUÇÃO 17/08, `2dc4a7c`, sem migração):** select "Tipo de serviço" no rodapé passa a ter os 3 tipos, com diálogo de confirmação (preços passam a `secas_*`, orçamento recalcula só se ainda for o automático, "Flores na prensa" sai da timeline). Selo SECAS em **castanho da marca** (verde batia com a pílula "Contactada"); cartão do workbench verde. **Smoke:** abrir a encomenda da noiva → mudar para secas → orçamento cai, tag castanha, cartão verde, dropdown sem "Flores na prensa"; site de acompanhamento sem esse passo.
- [ ] **Sessão 151 — "No desidratador" + "na prensa há X" (migs 099/100/101 ✅ todas CORRIDAS):** selo/botão só na janela de ~1 mês após entrar na prensa; contador desde `in_dehydrator_at` (não desde a prensa). Botão de inverter ordem na vista Cards, persistido. **Smoke:** pôr um card no desidratador → selo laranja + "No desidratador há X"; tirar → some; encomenda >1 mês na prensa sem flag → sem botão; Concluídos/Cancelamentos colapsados.
- [ ] **Sessão 149 — Serviço "Recriação" (EM PRODUÇÃO 10/08, mig 098 ✅ CORRIDA):** carimbo interno, mesmos preços e acompanhamento público, nada no fbr-tracking. **Smoke:** abrir encomenda → tag "Recriação" no cabeçalho + rodapé "Tipo de serviço" → mudar → badge violeta na lista + aba no filtro.
- [ ] **Status das secas esconde "Flores na prensa" (2 repos, EM PRODUÇÃO 10/08, mig 097 ✅ verificada):** timeline pública renumera sozinha; selector de estado do admin esconde a fase. **Smoke:** (site) status de encomenda secas → sem "Flores na prensa", "Etapa X de 11" sem saltos; preservação → 12 passos. (admin) dropdown de estado das secas sem essa opção.
- [ ] **Sessão 148 — Templates "indeciso" + bug do desconto (mig 096 ✅ CORRIDA):** o orçamento editado à mão passa a mandar sobre o `pricing_snapshot` em todos os `{valor_*}`. Já em produção com os deploys da 153. **Smoke:** encomenda com desconto manual → template de pré-reserva mostra sinal proporcional ao orçamento editado.
- [ ] **Sessão 145 — Emoldurar Flores Secas (EM PRODUÇÃO 26/07, mig 094 ✅ CORRIDA + bucket `bouquet-photos` criado):** **Smoke (site):** `/reservar-emoldurar-flores-secas` (e `/en/book-dried-flower-framing`) → submeter pedido de teste com fotos → entra no admin com badge "Secas" e secção verde. **Smoke (admin):** marcar 1º pagamento com Google ligado → pasta Drive criada e fotos movidas do Storage. **Adiado:** criar encomenda secas à mão no admin; actualizar **Ecossistema** + `docs/ECOSYSTEM.md` com o form novo, o bucket e as rotas/tabelas da 153 ([[feedback_novas_plataformas_ecossistema]]).
- [ ] **Smokes antigos ainda por fazer (detalhe nos commits):** **144** fbr-voucher no telemóvel (envelope centrado, sem zoom preso); **143** fbr-website forms (telefone formata sozinho e valida por indicativo, sugestão de typo no email, `?vale=` pré-preenche, ecrã de sucesso repete o contacto); **141** fbr-website (FAQ do bouquet, link no CTA de Opções) + **GSC: pedir reindexação** das 6 páginas; **140** cards colapsados, diálogo de tracking CTT, bloco Comissões do parceiro; **138** fbr-voucher (envelope personalizado, pétalas, copiar código, partilhar); **135** título "FBR Admin" centrado no telemóvel; **133** login dos 3 perfis + aba WhatsApp + Ana sem editar Ideias/Livro de Receitas; **131** etiquetas do WhatsApp; **130** sino das notificações na PWA.
- [ ] **Google Maps — decisão adiada e já vencida (14/08):** o trial do Google Cloud expirou. Se as sugestões de morada em Entregas/Recolhas pararam, decidir se se põe cartão (custo real ~0€, mas exige cartão). Degrada com elegância: campos passam a texto manual, dados intactos, mapa das Parcerias é SVG e não é afectado.
- [ ] **Backup pré-expurgo (sessão 139):** `_privado/backup-pre-expurgo/fbr-admin-completo-2026-07-11.bundle` CONTÉM histórico antigo com PII — apagar depois de umas semanas de confiança.

### Próximo passo concreto
1. **A Maria usar o assistente do WhatsApp uns dias e fazer os smokes da 153.** É o passo mais valioso e não é código: nunca se mediu quantas mensagens `sent_echo` existem na BD, e é esse número que decide se a peça da voz funciona. O ciclo de aprendizagem também precisa de 5+ pares para ter o que analisar.
2. Depois disso, por ordem: **textos canónicos dos extras** (barato, sem migração, tira improvisação) → **guia de voz destilado do corpus todo** → **U5, rascunho pré-gerado** ao abrir a conversa (gasta API, deixar para quando a qualidade base estiver validada).
3. Decidir a **Google Maps** (prazo já vencido, ver pendentes).
4. Roadmap 124 que sobra: tipos gerados do Supabase no preflight (precisa do access token dela); vista "Hoje" no Dashboard + relatório mensal interno.

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
- 92 migrações (006/014 são stubs — conteúdo com PII expurgado do histórico na sessão 139); 100 testes vitest; smoke Playwright (`npm run smoke`)

---

## Últimas sessões (detalhe compacto)

### Sessão 153 (2026-08-17) — Assistente do WhatsApp reconstruído (7 frentes, 8 deploys)
- **O quê:** a Maria disse que reescrevia tudo à mão e não se relacionava com o que o assistente escrevia. Diagnóstico: o prompt nunca teve **uma mensagem real dela** (só persona + 29 templates), a query do `suggest` **omitia** metade dos campos que a cliente preenche, e as edições dela eram deitadas fora. Corrigidas as três, mais UX do telemóvel.
- **Frentes:** campos do formulário + secção OBRIGATÓRIO (`requiredContentPoints`) · voz aprendida das `sent_echo` anonimizadas · UX (toast preso, "Abrir no WhatsApp", toques 44px) · rascunhos em localStorage + histórico `‹2/3›` · afinação por texto livre que reescreve · ciclo de aprendizagem (par gerado/usado → regras aprovadas por ela) · sugestão encolhível.
- **Ficheiros:** [voice-examples.ts](src/lib/whatsapp/voice-examples.ts) · [composer-drafts.ts](src/lib/whatsapp/composer-drafts.ts) · [suggest-edit/route.ts](src/app/api/whatsapp/suggest-edit/route.ts) · [voice-rules/route.ts](src/app/api/whatsapp/voice-rules/route.ts) (todos NOVOS) + [suggest/route.ts](src/app/api/whatsapp/suggest/route.ts), [templates.ts](src/lib/templates.ts), [whatsapp-client.tsx](src/app/(admin)/whatsapp/whatsapp-client.tsx), [claudio-client.tsx](src/app/(admin)/comunicacoes/claudio/claudio-client.tsx), [sonner.tsx](src/components/ui/sonner.tsx).
- **Migrações:** **102** ✅ CORRIDA (tabela `suggestion_edits` + chave `claude_voice_rules`).
- **Bugs meus apanhados em produção pela Maria:** sugestão saía **sem nome** (os exemplos anonimizados ensinavam que as mensagens não levam nome → o nome desta conversa passa a entrar nos exemplos + `preencherNome()` limpa em código); o botão "Abrir no WhatsApp" **agravava** a perda de rascunhos (manda-a para fora da app) → localStorage; o rodapé cresceu tanto que **tapava a conversa** → tecto relativo ao ecrã + chevron para encolher.
- **Armadilhas:** ESLint apanhou um `useRef` tocado durante o render (reset por mudança de conversa) → `useState`; `onClick={handleSuggest}` passava o evento do clique como 1.º argumento, o que partiria a afinação.
- **Preflight:** ✅ tsc + **146 testes** (eram 103) + build + ESLint. **Smoke:** ver bloco de pendentes no topo — **nada confirmado ainda**.


### Sessão 152 (2026-08-17) — Converter encomenda para "flores secas" + cor própria do serviço
- **O quê (pedido da Maria):** uma noiva reservou preservação mas o ramo já vinha quase todo seco → não faz sentido cobrar preços de preservação. O select "Tipo de serviço" no rodapé do workbench passa a ter os **3** tipos (secas era selo read-only desde a 149). Trocar de/para secas abre `ServiceChangeDialog` novo que explica antes de aplicar: tabela de preços muda, orçamento recalcula **só se ainda for o automático** (editado à mão fica intocado + dica do botão "Recalcular"), "Flores na prensa" sai/entra da timeline pública e do selector, campos das secas ficam vazios (veio pelo form de preservação) e aviso extra se a encomenda estiver mesmo em "Flores na prensa". Preservação ↔ Recriação continua instantâneo (mesmos preços).
- **Recalculo do orçamento:** `service_type` entra no `needsPrev` e no `pricingFieldChanged` de `updateOrderAction` (só quando muda de valor **e** `budget == pricing_snapshot.total`). `computePricingSnapshot` já escolhia a base `secas_` pelo `service_type` — nada a mudar em pricing.ts.
- **Cor do serviço (2.ª parte do pedido, 2 rondas):** na lista o selo SECAS, "Entrega agendada" e "30% pago" eram todos âmbar. Decisão da Maria: **cores de estado e pagamento NÃO mudam** e **sem bolinhas** → mudou só o serviço "secas". 1.ª tentativa verde-esmeralda em tudo → ela viu que o selo **batia com a pílula verde "Contactada"** na mesma linha. Final: **selo/tag/aba em castanho da marca** (`bg-cocoa-900 text-cream-50` — o único chip escuro da linha, não colide com pastéis) e **cartão do workbench fica verde** (accent/ring/bg/links; lá não há pílulas a competir). "Entrega agendada" e "30% pago" continuam ambos âmbar entre si — limite aceite desta opção.
- **Armadilha para a próxima:** as pílulas da lista já ocupam quase toda a paleta pastel (estados 16 cores, pagamento 4, "Contactada" verde, "Nova" sky, "Recriação" violeta). Para etiquetas NOVAS na lista, preferir chip escuro/neutro em vez de procurar mais um pastel livre.
- **Ficheiros:** [closing-cards.tsx](src/app/(admin)/preservacao/[id]/_components/closing-cards.tsx) (`ServiceChangeDialog` + MetaFooter), [actions.ts](src/app/(admin)/preservacao/actions.ts), [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx), [header.tsx](src/app/(admin)/preservacao/[id]/_components/header.tsx), [dried-flowers-card.tsx](src/app/(admin)/preservacao/[id]/_components/dried-flowers-card.tsx).
- **Migrações:** nenhuma. **Smoke:** preflight ✅ (tsc + 103 testes + build) + eslint limpo nos 5 ficheiros; smoke no browser fica para a Maria (bloco de pendentes).
- **Pendente:** confirmar no browser e, se a conversão for frequente, avaliar oferecer o mesmo select na lista (por agora só no workbench, para não haver conversões acidentais).

### Sessão 150 (2026-08-10) — Pôr live o trabalho não-committado de 5 sessões paralelas
- **O quê:** a Maria tinha 5 sessões Claude que trabalharam em simultâneo, todas terminadas, com código por committar espalhado. Consolidei e pus tudo em produção, com verificação das migrações antes de fazer deploy do que delas depende.
- **fbr-admin (`master` `46c944d`, Vercel READY):** um commit com as DUAS frentes que estavam no working tree — (1) **Recriação** (mig 098) e (2) **status secas esconde "Flores na prensa"** no lado admin (mig 097). tsc + 103 testes + build OK (preflight verde). Ficheiros: database.ts, _styles.ts, preservacao-client.tsx, fields.tsx, closing-cards.tsx, workbench-client.tsx, public-status-sync.test.ts (reaponta p/ 097), migs 097+098.
- **fbr-tracking (`develop`+`main` `854998a`):** commit do lado site do "esconder Flores na prensa" (supabase.js/timeline.js/[id].js). Diff real só 65 linhas (o resto era churn de CRLF — commit limpo confirmado por `git diff --cached`). ff-merge develop→main.
- **Migrações verificadas ANTES do deploy (regra [[feedback_migracoes_supabase_aplicadas]]):** 098 confirmada pela Maria; **097 verificada em produção** — chamei a REST com a anon key e o anon já lê `orders.service_type` (só possível com o GRANT da 097). O `supabase.js` do tracking tem fallback `|| 'preservacao'`, portanto nunca partiria mesmo sem a migração.
- **Nota (não-bloqueante):** 3 deploys de commits anteriores da Maria no fbr-admin (mobile workbench: `40d3fa8`/`9edd6b2`/`7b6ab9e`) ficaram em **ERROR** na Vercel, mas o meu commit por cima buildou READY → produção sã. Provável flutuação transitória do turbopack (preflight local, que inclui build, passa). Vale a pena um olho se voltar a acontecer.
- **Outros repos:** fbr-website e fbr-voucher com working tree limpo e develop==main — nada por pôr live. Templates da sessão 148 já estavam committados+pushed (`9b65700`, live).
- **Smoke (Maria):** os das duas frentes (ver bloco de pendentes acima).

### Sessão 147 (2026-08-09) — Lote de afinações UX/fluxo (Maria) em 3 repos + poke + fix de navegação
- **O quê (fbr-admin):** (1) push "Data de entrega das flores" já não dispara em pré-reserva; (2) nova var `{resumo_encomenda}` nas templates (itens+preços, com quantidade e unitário: "2× Mini 20x25 (2 × 90€ = 180€)"); (3) CTT esconde custo/pago (flores e quadro); (4) `{dados_pagamento}` PT inclui Titular; (5) cabeçalho do WhatsApp fixo (min-h-0 só a lista faz scroll); (6) editar tarefas no telemóvel (botões deixam de ser só-hover); (7) tarefa concluída no workbench: toast Anular + secção "N concluídas"; (8) datas de recolha/entrega em mãos bloqueiam antes do evento; (9) "Entrega agendada" âmbar (distinta do rosa da pré-reserva); (10) **poke** em tarefas (👋 → push interno ao responsável, `pokeTaskAction`); (11) vista Cards colapsa Sem resposta/Pré-reservas/Reservas.
- **Fix de navegação (alargado a pedido da Maria):** vista activa da Preservação (Tabela/Cards/…) e sub-aba+modo das Parcerias passam a PERSISTIR (localStorage via `useSyncExternalStore`) — abrir um detalhe e voltar traz de volta a mesma vista (antes recaía sempre na tabela). Novos campo `activeView` em [preservacao-views.ts](src/lib/preservacao-views.ts) e [parcerias-views.ts](src/lib/parcerias-views.ts) NOVO; colapso das Parcerias recalculado pelo padrão "render anterior" (sem setState-em-effect [[feedback_react_set_state_in_effect]]). Vale-presente não tem alternador de vistas → não se aplica.
- **fbr-tracking + fbr-website:** "Em breve" no status público → "Cerca de 6 meses após recebermos as flores + atualizamos a previsão ao longo do processo" (PT/EN); exemplo da localização do evento no form passa a "Coimbra" + dica pede só a cidade.
- **Migrações:** [095](supabase/migrations/095_templates_link_status_wording.sql) ✅ **CORRIDA** (troca a frase do `{link_status}` nas 6 templates PT+EN por uma que explica acompanhamento vivo de todas as fases + previsão da data de entrega). Só dados, idempotente.
- **Deploy:** fbr-admin `master` (este commit); **fbr-tracking `main` `827f844`** e **fbr-website `main` `cc7440e`** já em produção (pushed nesta sessão).
- **Smoke (Maria):** Cards → abrir encomenda → voltar continua em Cards; Parcerias idem (sub-aba+vista); telemóvel: editar tarefa + campo "🔔 Lembrar-me" ao criar (se não aparecer, print); poke a tarefa com outro responsável → notificação; template de confirmação com frase nova do link; status público de encomenda em pré-reserva → texto novo do ~6 meses; CTT sem campos custo/pago.
- **Pendente:** alertas por email no link de status (email opt-in + botão manual) ficaram registados nas "Próximas frentes" (Maria fá-lo quando tiver tempo).

### Sessão 146 (2026-08-09) — Migração Dualhook: chave outbound `dh_live_` (deadline Meta 12/08)
- **O quê:** email + dashboard do Dualhook avisavam que **a partir de 12/08/2026** os pedidos de **saída** que usam a autorização Meta do Dualhook têm de ir por `https://api.dualhook.com` com a chave `dh_live_` (em `WHATSAPP_ACCESS_TOKEN`), senão a Meta rejeita-os. Webhooks de **entrada** não são afectados (continuam a chegar directamente da Meta). Único outbound da plataforma = **download da multimédia recebida** ([media-fetch.ts](src/lib/whatsapp/media-fetch.ts)); envio não implementado.
- **Ficheiros:** [media-fetch.ts](src/lib/whatsapp/media-fetch.ts) — host `graph.facebook.com`→`api.dualhook.com` (const `WHATSAPP_API_BASE`) + o download dos bytes passa a usar a **rota `/content` do Dualhook** (o `url` temporário devolvido pela Meta aponta para o CDN dela e exigia o token Meta original, que já não temos com a `dh_live_`).
- **Passos manuais (Maria, feitos):** criou a chave no dashboard Dualhook (Connection → Overview → Create key), substituiu `WHATSAPP_ACCESS_TOKEN` na Vercel (Production) pela `dh_live_...CzAM` + redeploy. Guardou o token Meta **antigo** numa nota (rede de segurança). Sem migração de BD.
- **Smoke:** deploy `master` `e8b2000` READY em produção (verificado via Vercel MCP); varredura confirmou **zero** `graph.facebook.com` no código e `WHATSAPP_ACCESS_TOKEN` só usado no media-fetch; **teste real da Maria: enviou foto por WhatsApp → guardada na Drive ✅**. tsc limpo + 100 testes.
- **Fix CI/preflight (mesma sessão):** o CI estava vermelho há semanas (emails "CI: All jobs have failed", 11 annotations) e o preflight local falhava — o **pool paralelo do vitest v4** rebenta a carregar vários ficheiros ao mesmo tempo ("Cannot read properties of undefined (reading 'config')"), no ubuntu do CI e no Windows local. Não era bug do código. Correcção: `fileParallelism: false` em [vitest.config.ts](vitest.config.ts) → 100 testes passam em série (~9-12s).
- **Também triado (não são acção nossa):** email Google Maps "Apple Silicon/iOS SDK" = irrelevante (FBR usa Maps só na web, sem app iOS); GitHub "Lembretes de tarefas cancelled" = concorrência normal (cancela disparos sobrepostos de propósito); **Google Cloud trial a expirar (~14/08):** Drive/Gmail/Calendário são grátis e mantêm-se; só a **Google Maps** (sugestões de morada + mapa Entregas/Recolhas) exige cartão — degrada com elegância (campos passam a texto manual, dados intactos; mapa Portugal das Parcerias é SVG, não é Google). Maria inclina-se a **não pagar**; custo real seria ~0€ mas exige cartão. Link "abrir no Maps" em Entregas/Recolhas é URL grátis (não parte). **A decidir depois de 14/08 se as sugestões pararem.**
- **Pendente:** apagar o token Meta antigo da nota após ~1 semana de confiança; PR **Dependabot #3** (`npm-mensal`) continua vermelha na Vercel — bump de TypeScript 7 incompatível com Next 16 ("does not provide the compiler API"); fechar/ignorar a PR (não é produção). Ecossistema/`SECRETS.md` já mencionam o Dualhook; rever se convém anotar o outbound.

> Sessões 127-145 movidas para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md).

---

## Pendências externas (outros repos)

Tudo o que está aqui **já está em produção**; o detalhe vive nos commits. Só falta o que está marcado.

- **fbr-voucher** — 3 levas feitas (cartão 3D em WebP −94%, fontes locais/RGPD, versão EN com selector, envelope personalizado + pétalas + partilhar, OG image, código de exemplo `EXEMPLO`/`EXAMPLE`). **Falta:** smoke visual da Maria em `/EXEMPLO` (PT e EN) e num vale real no telemóvel. **Não feito de propósito:** Umami no voucher (à espera da palavra dela).
- **fbr-website** — links "Ver um exemplo do vale digital" no vale-presente e em `/oferecer-preservacao` (live). Relatório mensal do Clarity ✅ automatizado (cron + Resend). **Em aberto (auditoria 122):** `aggregateRating`? subtítulo no hero? data nas páginas legais? vídeo `tracking.mp4` (a Maria ainda não tem). Umami continua manual (API paga) — [[project_website_analytics]].
- **Análise mercado/conversão/blog do fbr-website (06/07)** — concorrentes PT, estratégia resina, prova social em falta nas páginas de decisão, 6 artigos propostos. **POR IMPLEMENTAR** ([[project_website_mercado_conversao_2026-07]]).
- **⚠️ Sessões paralelas:** este working tree é partilhado com outras sessões Claude. `git status` antes de commitar, sempre ([[project_parallel_sessions_worktree]]). Hoje houve colisão de numeração (duas sessões chamaram-se 152).

---

## Próximas frentes (por ordem — ver "Próximo passo concreto" no topo)

- Varrimento `formatDateTimeLisbon` (129) → tipos gerados Supabase no preflight → vista "Hoje" + relatório mensal → expurgo WhatsApp do git (sessão dedicada) → cadência de comunicação (104)
- **Alertas por email no link de status** (a Maria fá-lo quando tiver tempo, sessão 147): cliente opta por receber avisos no `status.floresabeirario.pt` (email + consentimento RGPD numa tabela `status_subscriptions` nova, com GRANT/RLS); no admin (aba Status) um botão **"Notificar cliente desta atualização"** que **só envia quando a Maria carrega** (mudanças de estado acidentais nunca enviam nada); email PT/EN via Resend. Aprovado o approach "email opt-in + botão manual" (nunca automático — [[feedback_nada_de_envio_automatico]]).
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
- **Refs não se tocam durante o render** — o reset por mudança de props corre no render, e aí `ref.current = x` viola `react-hooks/refs`. Usar `useState` (sessão 153). Primo do [[feedback_react_set_state_in_effect]]
- **Estado em memória não sobrevive à PWA ser morta** — o Android/iOS mata a app em segundo plano; qualquer coisa que a Maria esteja a escrever tem de ir para localStorage a cada tecla, não só ao submeter (sessão 153)
- **Exemplos few-shot uniformes ensinam padrões que ninguém escreveu** — anonimizar as mensagens dela (`{nome}`) fez o modelo aprender que as mensagens da Maria não levam nome. Ao mudar dados de exemplos, perguntar sempre que ESTILO isso ensina (sessão 153)
- **`onClick={fn}` passa o evento como 1.º argumento** — inofensivo até a função ganhar um parâmetro; usar `onClick={() => fn()}` quando houver hipótese de crescer (sessão 153)
- **Cada linha nova no rodapé do WhatsApp custa conversa visível** — o rodapé passou dos 500px e tapava as mensagens no telemóvel; tectos de altura relativos ao ecrã, não fixos ([[feedback_simplificar_antes_de_redesenhar]])
- **`vitest run` falha esporadicamente no Windows** com "13 failed / no tests" — é flakiness do pool, não regressão; correr outra vez antes de investigar (visto na 146 e na 153)
- **Smoke test obrigatório** antes de fechar sessões que mexem em páginas críticas ([[feedback_smoke_test_obrigatorio]])
- **Ecos do WhatsApp (mensagens que a Maria envia do telemóvel) chegam com atraso** — vêm por um canal separado da Meta (`smb_message_echoes`), mais lento que as mensagens das clientes (`messages`), e agora com o salto extra do Dualhook. A aba `/whatsapp` É tempo real (Supabase Realtime, INSERT em `whatsapp_messages`), por isso aparecem sozinhas quando chegam. Se uma mensagem enviada do telemóvel demora segundos/1-2min a aparecer, é o eco lento da Meta, **não um bug** — o webhook e a inserção estão OK (confirmado 09/08: 200 + zero erros nos logs). Só investigar se uma mensagem de **cliente** falha, ou se demora muitos minutos / nunca chega.
