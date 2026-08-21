# FBR Admin — Estado do Projecto

> Lido no início de cada sessão; actualizado em tempo real durante a sessão.
> **Regras deste ficheiro:** máximo ~30 KB. Só as últimas 5 sessões ficam aqui, em formato compacto
> (template: O quê / Ficheiros / Migrações + passos manuais / Smoke / Pendente, máx ~15 linhas).
> Ao entrar a 6ª sessão, a mais antiga move-se **na íntegra** para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)
> (que NÃO é lido por defeito — todo o histórico das sessões 1-132 está lá). O detalhe fino vive nos commits do git.
> ⚠️ Hashes de commits do fbr-admin anteriores a 11/07/2026 foram reescritos no expurgo RGPD (sessão 139) — já não existem.

---

## Onde estamos

**Fase 6 — Integrações + PWA + RGPD (em curso).** Sessões recentes: **156** (2026-08-21, templates listam os extras + mensagem pública editável no workbench, mig 103 corrida) e **155** (2026-08-19 a 21, detalhes da recolha no formulário público do site — **única sessão recente já fechada e confirmada pela Maria**, smoke feito). Antes: **154** (evento no Calendar para as secas, por committar), **153** (assistente do WhatsApp reconstruído) e **152** (converter encomenda para secas), todas **em produção mas sem smoke feito**. A 152 e a 153 correram em paralelo no mesmo dia — daí a colisão de numeração.

### ⚠️ Pendentes de confirmação da Maria (verificar antes de assumir)
- [ ] **Sessão 156 — Templates passam a listar os extras + mensagem pública editável no workbench (por committar/deploy):** **Mig 103** ([`103_templates_resumo_encomenda.sql`](supabase/migrations/103_templates_resumo_encomenda.sql)) ✅ **CORRIDA** (Maria, 21/08). **Smoke:** ver bloco da 156 em baixo.
- [ ] **Sessão 154 — Flores secas geram evento no Calendar (sem migração, por committar/deploy):** as secas não têm data do evento, por isso o Calendar nunca disparava. Passa a valer a **data de entrega das flores**. **Smoke:** ver bloco da sessão 154 em baixo.
- [ ] **Sessão 153 — Assistente do WhatsApp reconstruído (EM PRODUÇÃO 17/08, 8 deploys, último `6f077f4`):** ponto de partida da Maria: *"o sistema de templates dá-me imenso trabalho e não me relaciono com o que o assistente diz"*. **Mig 102** ([`102_suggestion_edits.sql`](supabase/migrations/102_suggestion_edits.sql)) ✅ **CORRIDA** (Maria, 17/08). Nada disto está confirmado por ela ainda.
  - **Diagnóstico:** (a) o prompt nunca teve **uma única mensagem real dela** — só a persona escrita à mão e os 29 templates, por isso soava a template; (b) a query do `suggest` omitia ornamentos/pendentes/quadros extra/extras/tipo de flores, logo respondia às cegas a quem marcou "Mais info"; (c) as edições dela eram deitadas fora, o sistema nunca aprendia.
  - **7 frentes, todas live:** (1) o assistente **lê os campos do formulário** + secção **OBRIGATÓRIO** com o que a mensagem tem de cobrir (`requiredContentPoints`); (2) **voz aprendida** — 8 mensagens reais dela (`sent_echo`) anonimizadas e escolhidas pela situação entram no prompt, auto-alimenta-se; (3) **UX telemóvel** — fim do toast "Copiado" preso, botão "Abrir no WhatsApp" (wa.me com o texto), toques a 44px; (4) **rascunhos persistentes** em localStorage (sobrevivem ao Android matar a PWA) + **histórico `‹2/3›`**; (5) **afinação por texto livre** ("mais curta") que reescreve em vez de refazer; (6) **ciclo de aprendizagem** — ao copiar guarda o par gerado/usado; no Cérebro do Claude ela pede a análise e aceita/rejeita regras que entram no prompt; (7) sugestão **encolhível** para ler a conversa por trás.
  - **Decisões dela (não voltar a propor o contrário):** explicações dos extras **sem preços**; fundo do quadro não gera pendência; **sem atalhos de um toque** na afinação, só texto livre.
  - **🔴 SMOKE — nada confirmado:** (a) conversa com ornamentos/pendentes em "Mais info" ou envio "Não sei" → sugestão explica sozinha e sem preços; (b) o tom soa-lhe a ela e **nenhum nome de outra cliente** aparece; (c) copiar → "✓ Copiado" sem tapar botões; (d) "Abrir no WhatsApp" cai na conversa certa com o texto; (e) escrever meia mensagem → ir ao WhatsApp → voltar → texto lá; (f) Refazer 2-3× → `‹2/3›` e dá para recuar; (g) "mais curta" → Aplicar → encurta mantendo valores/datas; (h) chevron encolhe e vê-se a conversa; (i) usar 5+ vezes → Cérebro do Claude → "N por analisar" → Analisar → aceitar regra → Guardar → respeitada na sugestão seguinte.
  - **Por decidir (não aprovado):** textos canónicos dos extras (hoje o Claude improvisa); guia de voz destilado do corpus todo; rascunho pré-gerado ao abrir a conversa (U5); botão de microfone. Custos API: Haiku ~2,50€/mês · Sonnet ~9€/mês · Opus 5 ~19,50€/mês (10 sugestões/dia); modelo mantém-se `claude-sonnet-4-6`.
  - **⚠️ Efeito colateral no desktop:** a caixa da sugestão perdeu a pega de redimensionar (`resize-none`) porque cresce sozinha. Reverte-se se ela quiser.
  - **Correcção pós-deploy (21/08, `f45ea22`, EM PRODUÇÃO):** a Maria carregou em **"Refazer" e saiu exactamente o mesmo texto**. Causa: o prompt é **byte a byte idêntico** entre as duas chamadas, e a tarefa é constrangida demais (templates + pontos obrigatórios + exemplos de voz + factos fixos) para a aleatoriedade do modelo dar a volta sozinha — **mexer na `temperature` não resolveria, já está no default 1.0**. Correcção: o cliente manda as **2 últimas versões** em `avoid` e o prompt ganha um bloco **SEGUNDA TENTATIVA** que mostra o que já saiu e pede uma alternativa claramente diferente **na forma** (outra abertura, outra ordem, outras frases), mantendo factos/valores/datas/pontos obrigatórios. Só se aplica ao Refazer; a afinação por texto livre continua a reescrever a versão actual. **Smoke:** gerar → Refazer → estrutura diferente e `‹2/2›` no cabeçalho.
  - **Nota de método (sessões paralelas):** este commit foi feito com a sessão 156 a meio de trabalho no mesmo [suggest/route.ts](src/app/api/whatsapp/suggest/route.ts). Sem sobreposição de linhas; committado só o desta sessão construindo o blob "HEAD + as minhas alterações" e usando `git hash-object` + `git update-index --cacheinfo` (não mexe no working tree). ⚠️ **Armadilha:** a 1.ª tentativa reconstruiu o ficheiro por replace num heredoc e converteu `\n` em quebras de linha reais → literal de string multi-linha = **erro de sintaxe**. Apanhado antes do commit validando o blob com o parser do TypeScript. Se for preciso repetir isto, **partir do working tree e remover o que é da outra sessão**, nunca reaplicar as próprias alterações sobre o HEAD.
- [ ] **Sessão 152 — Converter encomenda para "flores secas" no workbench (EM PRODUÇÃO 17/08, `2dc4a7c`, sem migração):** select "Tipo de serviço" no rodapé passa a ter os 3 tipos, com diálogo de confirmação (preços passam a `secas_*`, orçamento recalcula só se ainda for o automático, "Flores na prensa" sai da timeline). Selo SECAS em **castanho da marca** (verde batia com a pílula "Contactada"); cartão do workbench verde. **Smoke:** abrir a encomenda da noiva → mudar para secas → orçamento cai, tag castanha, cartão verde, dropdown sem "Flores na prensa"; site de acompanhamento sem esse passo.
- [ ] **Sessão 151 — "No desidratador" + "na prensa há X" (migs 099/100/101 ✅ todas CORRIDAS):** selo/botão só na janela de ~1 mês após entrar na prensa; contador desde `in_dehydrator_at` (não desde a prensa). Botão de inverter ordem na vista Cards, persistido. **Smoke:** pôr um card no desidratador → selo laranja + "No desidratador há X"; tirar → some; encomenda >1 mês na prensa sem flag → sem botão; Concluídos/Cancelamentos colapsados.
- [ ] **Sessão 149 — Serviço "Recriação" (EM PRODUÇÃO 10/08, mig 098 ✅ CORRIDA):** carimbo interno, mesmos preços e acompanhamento público, nada no fbr-tracking. **Smoke:** abrir encomenda → tag "Recriação" no cabeçalho + rodapé "Tipo de serviço" → mudar → badge violeta na lista + aba no filtro.
- [ ] **Status das secas esconde "Flores na prensa" (2 repos, EM PRODUÇÃO 10/08, mig 097 ✅ verificada):** timeline pública renumera sozinha; selector de estado do admin esconde a fase. **Smoke:** (site) status de encomenda secas → sem "Flores na prensa", "Etapa X de 11" sem saltos; preservação → 12 passos. (admin) dropdown de estado das secas sem essa opção.
- [ ] **Sessão 148 — Templates "indeciso" + bug do desconto (mig 096 ✅ CORRIDA):** o orçamento editado à mão passa a mandar sobre o `pricing_snapshot` em todos os `{valor_*}`. Já em produção com os deploys da 153. **Smoke:** encomenda com desconto manual → template de pré-reserva mostra sinal proporcional ao orçamento editado.
- [ ] **Sessão 145 — Emoldurar Flores Secas (EM PRODUÇÃO 26/07, mig 094 ✅ CORRIDA + bucket `bouquet-photos` criado):** **Smoke (site):** `/reservar-emoldurar-flores-secas` (e `/en/book-dried-flower-framing`) → submeter pedido de teste com fotos → entra no admin com badge "Secas" e secção verde. **Smoke (admin):** marcar 1º pagamento com Google ligado → pasta Drive criada e fotos movidas do Storage. **Adiado:** criar encomenda secas à mão no admin; actualizar **Ecossistema** + `docs/ECOSYSTEM.md` com o form novo, o bucket e as rotas/tabelas da 153 ([[feedback_novas_plataformas_ecossistema]]).
- [ ] **Smokes antigos ainda por fazer (detalhe nos commits):** **144** fbr-voucher no telemóvel (envelope centrado, sem zoom preso); **143** fbr-website forms (telefone formata sozinho e valida por indicativo, sugestão de typo no email, `?vale=` pré-preenche, ecrã de sucesso repete o contacto); **141** fbr-website (FAQ do bouquet, link no CTA de Opções) + **GSC: pedir reindexação** das 6 páginas; **140** cards colapsados, diálogo de tracking CTT, bloco Comissões do parceiro; **138** fbr-voucher (envelope personalizado, pétalas, copiar código, partilhar); **135** título "FBR Admin" centrado no telemóvel; **133** login dos 3 perfis + aba WhatsApp + Ana sem editar Ideias/Livro de Receitas; **131** etiquetas do WhatsApp; **130** sino das notificações na PWA.
- [x] **Google Maps — ✅ RESOLVIDO na 155 (19/08):** a Maria pôs cartão no Google Cloud. Ficam **3 chaves ao todo**: a antiga "Maps Platform API Key" (browser, referrer, 4 APIs) que serve o **admin**, mais duas novas no **fbr-website** (`GOOGLE_MAPS_KEY` servidor + `NEXT_PUBLIC_GOOGLE_MAPS_KEY` browser). Custo real 0€. Ela criou a chave de servidor no projecto **fbr-admin2 por engano** à primeira (o selector de projecto da Vercel fica no último aberto) e já a **apagou de lá ✅**. Nada pendente.
- [ ] **Backup pré-expurgo (sessão 139):** `_privado/backup-pre-expurgo/fbr-admin-completo-2026-07-11.bundle` CONTÉM histórico antigo com PII — apagar depois de umas semanas de confiança.

### Próximo passo concreto
1. **A Maria usar o assistente do WhatsApp uns dias e fazer os smokes da 153.** É o passo mais valioso e não é código: nunca se mediu quantas mensagens `sent_echo` existem na BD, e é esse número que decide se a peça da voz funciona. O ciclo de aprendizagem também precisa de 5+ pares para ter o que analisar.
2. Depois disso, por ordem: **textos canónicos dos extras** (barato, sem migração, tira improvisação) → **guia de voz destilado do corpus todo** → **U5, rascunho pré-gerado** ao abrir a conversa (gasta API, deixar para quando a qualidade base estiver validada).
3. ~~Decidir a Google Maps~~ ✅ **RESOLVIDO na 155:** a Maria pôs cartão no Google Cloud, criou 2 chaves e o Maps está live no site e no admin. Custo real 0€ (dentro dos 10.000 pedidos grátis/mês de cada API).
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

### Sessão 156 (2026-08-21) — Templates deixam de esquecer os extras + mensagem pública editável no workbench
- **O quê (2 pedidos da Maria):** ① *"os templates não estão a incluir os extras: escolheu o quadro 30x40 (300€) + 2 ornamentos de Natal. Só menciona sempre o quadro principal, apesar de as contas estarem certas. Já te tinha pedido isto."* ② No workbench, editar a **mensagem pública** da encomenda sem ir à aba Status procurar o nome da cliente.
- **Causa do ①:** a variável `{resumo_encomenda}` foi criada na **sessão 147** no motor ([lib/templates.ts](src/lib/templates.ts)) mas **nunca foi posta em nenhum corpo de template** — existia e não era usada. Os corpos continuavam com `Escolheu o quadro {tamanho_quadro} ({valor_quadro})`, que por definição só fala da moldura.
- **Correcção ①:** `resumoEncomendaLinhas()` (exportada) rende o snapshot de preços item a item, com **rótulos para cliente em PT e EN** (a BD guarda rótulos internos com travessão, proibido nas mensagens), linha de `Total:` só quando há mais de um item, e o **desconto do orçamento editado à mão absorvido na linha do quadro** (mesma regra do `{valor_quadro}`, para os itens somarem sempre o total pedido). Sem snapshot cai numa linha só com o orçamento. **Mig 103** põe a variável nas 6 templates que descrevem o que foi escolhido (`pre_reserva_tamanho_escolhido`, `pre_reserva_tamanho_indeciso`, `reajuste_pagamento_tamanho`, PT+EN) por REPLACE cirúrgico (padrão da 095: não apaga afinações feitas à mão). A 103 corrige ainda um **erro de contas na "indeciso"**: dizia "o sinal é 30% do quadro mais pequeno" mas o `{valor_sinal}` é 30% do total (quadro provisório **+ extras**) — passa a mostrar a soma provisória inteira e a pedir 30% dela.
- **O assistente do WhatsApp tinha o mesmo buraco:** a query do `suggest` não trazia `pricing_snapshot`, por isso ele sabia o total e os extras mas nunca o preço de cada um → falava só do quadro. Passa a receber o orçamento **item a item**, já formatado como sai nas templates. (Não colide com a decisão da 153 de explicar extras *sem preços*: essa é para os "Mais info", que não entram no snapshot.)
- **Correcção ②:** o diálogo saiu da aba Status para [components/public-status-message-dialog.tsx](src/components/public-status-message-dialog.tsx) e é usado nos dois sítios. No workbench é um **lápis ao lado do selector de estado** — nada de texto novo no hero (**ela rejeitou a 1ª versão, que punha uma prévia da mensagem no hero: "não preciso de mais ruído e mais texto no workbench"** — [[feedback_menos_ruido_workflow]]). O pop-up passa a ter **tudo o que a linha da aba Status tem**: mensagem PT, mensagem EN, idioma (PT/EN/ambos) e data prevista de entrega, mais link para a página da cliente.
- **Ficheiros:** lib/templates.ts · api/whatsapp/suggest/route.ts · components/public-status-message-dialog.tsx (NOVO) · status/status-client.tsx · preservacao/[id]/page.tsx + workbench-client.tsx + _components/header.tsx · lib/__tests__/templates.test.ts (+5 testes) · mig 103.
- **Preflight ✅** (tsc + 161 testes + build).
- **🔴 SMOKE:** (a) encomenda com extras → Comunicações/template de pré-reserva → a mensagem lista quadro **e** extras com `Total:`; (c) encomenda só com quadro → uma linha, sem total repetido; (d) encomenda com desconto manual → itens somam o orçamento editado; (e) template EN → rótulos em inglês; (f) sugestão do WhatsApp para essa encomenda → também menciona os extras; (g) workbench → lápis ao lado do estado → mudar texto, idioma e data prevista → guardar → a aba Status e a página pública mostram o mesmo.

### Sessão 155 (2026-08-19 a 21) — Detalhes da recolha no formulário público (fbr-website) ✅ FECHADA
- **O quê:** quem escolhe a recolha no form de preservação não dizia onde, quando nem a que horas, e as moradas à mão vinham incompletas. Bloco condicional novo: **Dia → Morada (Google Maps + mapa interactivo) → Janela de horas → Notas**. Tudo **opcional**, cada campo com **"Ainda não sei"** (distingue "não sabe" de "saltou" — para orçamentar é diferente). Depois: botão **"Voltar à morada"** no mapa; labels PT+EN sem "no local"/"at the venue"; extras do quadro passam a dizer **"Não tem qualquer custo adicional"** a negrito (pergunta mais repetida pelas clientes).
- **Ficheiros (todos no fbr-website):** `api/places-autocomplete/route.js`, `api/place-details/route.js`, `_components/AddressAutocomplete.jsx`, `_components/PickupMap.jsx` (NOVOS) · ReservarPreservacaoForm.jsx · EmoldurarForm.jsx · ReservarPreservacaoClient.css · next.config.mjs (CSP) · supabase-mappings.js · api/reservar-preservacao/route.js · messages pt+en.
- **Migrações: nenhuma.** As colunas `pickup_*` existem desde as migs 018/031 e já apareciam no workbench; só nunca tinham sido perguntadas à cliente. Os "Ainda não sei" vão em texto para `pickup_notes` (DATE/TIME não guardam texto).
- **Passos manuais (Maria, ✅ AMBOS FEITOS):** 2 chaves distintas na Vercel do **fbr-website** — `GOOGLE_MAPS_KEY` (servidor, restrição de aplicação Nenhuma, só Places API (New)) e `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (browser, restrição Sites em `floresabeirario.pt`, só Maps JavaScript API). Porquê duas e as armadilhas: [docs/SECRETS.md](docs/SECRETS.md).
- **Deploy:** 8 deploys, fbr-website `main` `157eb8d`. **Smoke ✅ FEITO pela Maria (21/08)** — pinça do mapa e reserva de teste a chegar ao admin. **Nada pendente.**
- **⚠️ 4 armadilhas que valem para o futuro:**
  - **CSP.** O mapa nunca aparecia e não era a Google: a `Content-Security-Policy` do site não listava `maps.googleapis.com`. **Invisível ao `next build`, ao `curl` e à validação da chave — só um browser real a apanha** ([[feedback_csp_dominios_novos]]). `fonts.googleapis.com` fica DE FORA de propósito (RGPD): gera 3 violações esperadas e inofensivas.
  - **`label` ≠ `valor` nas opções dos forms.** O texto visível já não diz "no local", mas o `valor` guardado sim. **`valor` é chave estrangeira de facto** para `COMO_ENVIAR_FLORES` em `supabase-mappings.js` e para o `RECOLHA_VALOR` do form (`/recolha no local/i`) — "arrumá-lo" parte as reservas em silêncio.
  - **`elementosHint` é partilhado** pelos forms de preservação e de flores secas: ao passar um para `t.rich`, o outro tem de ir junto ou mostra `<b>` em cru à cliente.
  - **fbr-website não usa ff-merge** (ao contrário do fbr-tracking): `main` tem commits de merge próprios, `git merge --ff-only` falha sempre. Usar `--no-ff`.
- **💡 Truque reutilizável:** nenhum repo tem Playwright instalado, mas os **browsers estão em `%LOCALAPPDATA%/ms-playwright/chromium-1228/chrome-win64/chrome.exe`**. `npm i playwright-core` no scratchpad + `executablePath` → testar produção num browser real sem tocar nas dependências. Foi assim que se apanhou a CSP e 3 defeitos de layout mobile que nem eu nem a Maria tínhamos visto.
- **Por vigiar (não bloqueia):** a frase "não tem custo adicional" foi escrita a partir do que a Maria disse, **não foi verificada contra o catálogo de preços** — se a opção "Fotografia" custar nalgum caso, está errada em letra bem visível.

### Sessão 154 (2026-08-19) — Flores secas passam a gerar evento no Google Calendar
- **O quê (bug reportado pela Maria):** numa reserva de flores secas ela mete a **data de entrega das flores** e não aparecia evento nenhum no Calendar. Causa: **todo** o caminho do Calendar estava trancado ao `event_date` (`upsertOrderEvent`, `upsertOrderCalendarEvent`, a Server Action do botão e o próprio botão do workbench) — e o form das secas **não pergunta data do evento** (as flores já estão secas; ver comentário no mapper do site). Resultado: `event_date` NULL → nunca havia evento.
- **Correcção:** regra única e pura `effectiveCalendarDate()` — recolha/em mãos manda, senão `event_date`, senão qualquer data de entrega preenchida. Todos os caminhos passam a usá-la. Novo gatilho `calendarDateBecomesAvailable()`: nas secas a data só aparece **depois** do 1º pagamento (o gatilho normal), por isso cria-se o evento no momento em que a encomenda ganha data, se já estiver paga e não cancelada. Botão do workbench deixa de estar cinzento e a mensagem de erro passa a falar das duas datas.
- **Ficheiros:** [calendar-date.ts](src/lib/google/calendar-date.ts) (NOVO, pura e client-safe — `calendar.ts` é `server-only`) · [calendar.ts](src/lib/google/calendar.ts) · [order-calendar-trigger.ts](src/lib/google/order-calendar-trigger.ts) · [actions.ts](src/app/(admin)/preservacao/actions.ts) · [hero.tsx](src/app/(admin)/preservacao/[id]/_components/hero.tsx) · [fields.tsx](src/app/(admin)/preservacao/[id]/_components/fields.tsx) · [calendar-date.test.ts](src/lib/__tests__/calendar-date.test.ts) (NOVO, 10 testes).
- **Migrações:** nenhuma. **Preflight:** ✅ tsc + 156 testes + build.
- **🔴 SMOKE (por fazer):** encomenda de secas paga → meter data de entrega em mãos → evento aparece no calendário "Preservação de Flores" nesse dia, sem "⏳ entrega por combinar" no título; botão "Evento Calendar" activo no workbench; encomenda de preservação normal continua a criar no dia do evento como antes.

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

> Sessões 127-146, 147 e 150 movidas para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md).

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
- **CSP bloqueia domínios externos novos e é INVISÍVEL ao build** — ao adicionar qualquer script/imagem/fetch de um domínio novo no fbr-website, actualizar a `Content-Security-Policy` em `next.config.mjs`. Nem `next build`, nem `curl`, nem validar a chave apanham isto: só um browser real (sessão 155)
- **`vitest run` falha esporadicamente no Windows** com "13 failed / no tests" — é flakiness do pool, não regressão; correr outra vez antes de investigar (visto na 146 e na 153)
- **Smoke test obrigatório** antes de fechar sessões que mexem em páginas críticas ([[feedback_smoke_test_obrigatorio]])
- **Ecos do WhatsApp (mensagens que a Maria envia do telemóvel) chegam com atraso** — vêm por um canal separado da Meta (`smb_message_echoes`), mais lento que as mensagens das clientes (`messages`), e agora com o salto extra do Dualhook. A aba `/whatsapp` É tempo real (Supabase Realtime, INSERT em `whatsapp_messages`), por isso aparecem sozinhas quando chegam. Se uma mensagem enviada do telemóvel demora segundos/1-2min a aparecer, é o eco lento da Meta, **não um bug** — o webhook e a inserção estão OK (confirmado 09/08: 200 + zero erros nos logs). Só investigar se uma mensagem de **cliente** falha, ou se demora muitos minutos / nunca chega.
