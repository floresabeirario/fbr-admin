# FBR Admin — Estado do Projecto

> Lido no início de cada sessão; actualizado em tempo real durante a sessão.
> **Regras deste ficheiro:** máximo ~30 KB. Só as últimas 5 sessões ficam aqui, em formato compacto
> (template: O quê / Ficheiros / Migrações + passos manuais / Smoke / Pendente, máx ~15 linhas).
> Ao entrar a 6ª sessão, a mais antiga move-se **na íntegra** para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)
> (que NÃO é lido por defeito — todo o histórico das sessões 1-132 está lá). O detalhe fino vive nos commits do git.
> ⚠️ Hashes de commits do fbr-admin anteriores a 11/07/2026 foram reescritos no expurgo RGPD (sessão 139) — já não existem.

---

## Onde estamos

**Fase 6 — Integrações + PWA + RGPD (em curso).**

- **179** (08/10) pesquisa sem acentos, status público volta ao default ao mudar de fase, scroll reposto ao voltar atrás — EM PRODUÇÃO, smoke por fazer.
- **178** (04-08/10) **livro de pagamentos**: `order_payments` passa a ser a verdade do dinheiro e `payment_status` só a fase da cobrança — EM PRODUÇÃO `a11775b`, migs 114 e 115 corridas, smoke por fazer.
- **177** (17/09) barra de selectores da Preservação numa linha só — EM PRODUÇÃO `84f4ece`. ⚠️ pelo meio percebi mal o pedido e estraguei a célula do Cliente no telemóvel; revertido.
- **176** (17/09) o autosave do workbench perdia o que ela acabava de escrever — EM PRODUÇÃO `c52497d`.
- **175** (17/09) fbr-website: o "Sucesso" do Turnstile lia-se como pedido enviado — EM PRODUÇÃO `main` `67497d7`.
- **171 a 174** e tudo o que é anterior: detalhe no [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md); todas em produção.

### ⚠️ Pendentes de confirmação da Maria (verificar antes de assumir)
- [ ] **Sessão 178 — Livro de pagamentos (✅ EM PRODUÇÃO 08/10, `master` `a11775b`; **migs 114 e 115 ✅ CORRIDAS e verificadas**):** `order_payments` é a verdade do dinheiro e `payment_status` passa a ser só a fase da cobrança. Falta o **smoke (a)-(f)** do bloco da 178 e, do lado dos dados, pôr orçamento na **Alessandra Antunes** (70% pago sem orçamento) e decidir o que fazer às 2 encomendas antigas com orçamento a 0.
- [ ] **Sessão 177 — Barra de selectores da Preservação (revert `84f4ece` ✅ EM PRODUÇÃO 17/09; merge das barras em `3e53539`, **PUSH POR FAZER**, sem migração):** pill "+N quadros" fora da tabela + as duas barras de selectores numa linha só. Falta o **smoke (a)-(e)** do bloco da 177. ⚠️ Confirmar com ela que o nome do cliente voltou ao normal no telemóvel depois do revert.
- [ ] **Sessão 176 — Autosave do workbench (✅ EM PRODUÇÃO 17/09, `master` `c52497d`, push pedido por ela "mete live", sem migração):** ela relatou perder o que escrevia nos campos de recolha/entrega; 3 causas identificadas e corrigidas. Falta só o **smoke (a)-(e)** do bloco da 176. Efeito visível: gravar deixa de esperar pelo Google Calendar e passa a haver aviso do browser ao sair com coisas por gravar.
- [ ] **Sessão 175 — fbr-website (✅ EM PRODUÇÃO 17/09, `main` `67497d7`, push feito a pedido dela "ok mete no main", sem migração):** Turnstile invisível até pedir interação + erros a vermelho + aviso ao sair. Falta o **smoke (a)-(d)** do bloco da 175. ⚠️ Depois do push, um **pedido de teste real** para confirmar que com o widget invisível o formulário continua a chegar ao admin.
- [ ] **Sessão 174 — Finanças e Métricas (✅ EM PRODUÇÃO 17/09, `d7addfb` … `5502c90` em `master`, push pedido por ela; migs 110 e 111 ✅ CORRIDAS 17/09; **migs 111, 112 e 113 ✅ CORRIDAS 17/09; nada pendente na BD**):** Nota: a mig 111 herdou do audit_log a data da IMPORTAÇÃO do Monday como data de pagamento das encomendas importadas (a auditoria registou os INSERTs), o que atira a receita delas toda para o mês da importação; a 112 apaga esses carimbos (voltam à data do evento). Apanhado na auditoria pedida por ela. A 1.ª query de verificação da mig 111 diz quantas encomendas pagas ficaram sem data (esperado: só as importadas do Monday); falta pôr os 3 preços da pirâmide em Finanças → Catálogo. Bug das subscrições corrigido; vidro normal é o default do custo; "valor novo a partir de" nas subscrições; período no Painel; **receita passa a contar pela data de cada pagamento** (Faturação/Painel/Métricas mudam de valores). **Smoke** (a) a (q) no bloco da 174 em baixo.
- [ ] **Sessão 172 — React #418 no `/whatsapp` (`3145f63` em `master`, PUSH FEITO 17/09, sem migração):** causa **CONFIRMADA** (17/09, query dela no SQL Editor): **23 conversas** têm CR/controlos C0 na pré-visualização da última mensagem, e bastava uma para partir a hidratação em todos os carregamentos. Falta só o **smoke** e ver o cartão do healthcheck voltar a verde (bloco da 172 em baixo).
- [ ] **Smokes antigos por fazer (sessões 139 a 166), detalhe nos commits e no [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md):** **166** assistente (saudação + "Mais info", `c83b518`) · **164** templates fundidas · **163** formulário com pílulas + quadros adicionais (mig 107) · **162** assistente + pesquisa por telemóvel · **158** healthcheck · **157** vidro museu pago (migs 104/105) · **156** extras nas templates (mig 103) · **154** Calendar nas secas · **153** assistente do WhatsApp reconstruído (mig 102; decisões dela na memória `feedback_assistente_templates_e_elogios`) · **152** converter para secas · **151** desidratador (migs 099-101) · **149** Recriação (mig 098) · **148** templates "indeciso" (mig 096) · **145** Emoldurar Flores Secas (mig 094) · **144** fbr-voucher no telemóvel · **143** forms do site · **141** FAQ do bouquet + reindexação GSC · **140** cards colapsados · **138** fbr-voucher · **135** título no telemóvel · **133** login dos 3 perfis · **131** etiquetas do WhatsApp · **130** sino das notificações. Todas em produção e com as migrações corridas.
- [ ] **Backup pré-expurgo (sessão 139):** `_privado/backup-pre-expurgo/fbr-admin-completo-2026-07-11.bundle` CONTÉM histórico antigo com PII — apagar depois de umas semanas de confiança.

### Próximo passo concreto
0. **Sessão 178 — Livro de pagamentos (a frente aberta; mig 114 ✅ corrida, Fase B1 feita, POR COMMITAR e por fazer deploy):** (1) o **smoke (a)-(h)** do bloco da 178, que eu não consigo fazer aqui; (2) confirmar as verificações **2** e **4** no SQL Editor; (3) depois, **Fase C** — `revenueInPeriod`/`commissionInPeriod`/`cogsInPeriod`/`outstandingFromOrder` em [finance.ts](src/lib/finance.ts) passam a somar as linhas do livro por `paid_at` (hoje ainda é `budget × paidRatio`), e `{sinal_pago}`/`{valor_em_falta}` dos templates passam ao livro em vez de `budget_at_first_payment`; (4) **Fase D**, o vale como linha de pagamento. A Fase B2 do plano **deixou de ser necessária** (os gatilhos ficam onde estão). Fases C e D mudam números das Finanças; a D altera meses já fechados, por isso corre-se no início de um mês.
0. **Sessão 175 — site (✅ EM PRODUÇÃO 17/09):** smoke (a)-(d) do bloco da 175 e um pedido de teste real para confirmar que o Turnstile invisível não bloqueia. A **medida 2** (frase por cima do botão + "Enviar" em vez de "Submeter") fica à espera de OK dela.
0. **Sessão 174 — Finanças e Métricas:** (1) migs 111, 112 e 113 ✅ corridas 17/09; (2) pôr os 3 preços da pirâmide; (3) smoke (a)-(q) em `/financas` e `/metricas`. Recusado por ela: mover Competição para Parcerias; Métricas abrir noutro preset que não "Desde sempre" (não voltar a propor).
0. **Sessão 164 ✅ FECHADA e em produção:** a Maria testa a sugestão na encomenda da Isadora (uma mensagem só, sem `---`). Se ainda sair separado, o problema já não é o prompt: ver se `fieldSuggestionBases` devolveu outra combinação de templates (só `opcoes_entrega_flores` e `recolha_orcamento` são blocos).
0. **Sessão 163 ✅ FECHADA:** mig 107 corrida, admin e site em produção. Só falta o **smoke** da Maria no telemóvel (bloco da 163) e uma submissão real do formulário com quadros adicionais, para confirmar que a coluna chega ao admin.
1. **A Maria usar o assistente do WhatsApp uns dias e fazer os smokes da 153.** É o passo mais valioso e não é código: nunca se mediu quantas mensagens `sent_echo` existem na BD, e é esse número que decide se a peça da voz funciona. O ciclo de aprendizagem também precisa de 5+ pares para ter o que analisar.
2. Depois disso, por ordem: **textos canónicos dos extras** (barato, sem migração, tira improvisação; **na 162 a Maria confirmou que quer as mensagens antigas dela como base**, ver "fica por fazer" da 162) → **guia de voz destilado do corpus todo** → **U5, rascunho pré-gerado** ao abrir a conversa (gasta API, deixar para quando a qualidade base estiver validada).
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

### Sessão 179 (2026-10-08) — Pesquisa sem acentos, status público volta ao default ao mudar de fase, tarefas de canceladas fecham, scroll repõe-se ao voltar atrás + pesquisa das listas guardada (**EM PRODUÇÃO 08/10**, push pedido por ela "mete", sem migração, **smoke por fazer**)
- **O quê:** (1) `joao` = `joão` em todas as caixas de pesquisa e no Cmd+K (que deixou o `ilike` e filtra em JS, 2000 linhas/tabela). (2) Mudar o estado para outra **fase pública** apaga o texto personalizado do status (PT+EN); na mesma fase mantém-se. (3) Cancelar uma encomenda fecha as tarefas abertas ligadas a ela; o Dashboard esconde as que já estavam abertas de canceladas antigas. (4) Pesquisa da Preservação passa a apanhar noivos e telemóvel. (5) Voltar atrás/avançar repõe o scroll: [scroll-restoration.tsx](src/components/scroll-restoration.tsx) no `<main id="admin-main">` + áreas `data-scroll-restore` (listas Preservação/Vale/Parcerias/Figuras e os 4 workbenches).
- **Ficheiros:** [search-text.ts](src/lib/search-text.ts) (novo), [search/actions.ts](src/app/(admin)/search/actions.ts), 13 clientes de pesquisa; `publicPhaseChanges` em [public-status.ts](src/lib/public-status.ts); [preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts) (status público + fechar tarefas); [page.tsx do Dashboard](src/app/(admin)/page.tsx); [layout.tsx](src/app/(admin)/layout.tsx). Testes: `search-text.test.ts`, `public-status-reset.test.ts`. Preflight OK (331 testes).
- **Smoke (não feito, precisa de login):** (a) Cmd+K e caixa da Preservação: `joao` = `joão`; noivos e telemóvel com espaços encontram a encomenda; (b) texto público personalizado → mudar para estado de outra fase → texto por defeito; `entrega_agendada`↔`flores_enviadas` mantém; (c) cancelar encomenda com tarefa aberta → sai do Dashboard; (d) descer na lista da Preservação → abrir encomenda → voltar → mesma posição (também Vale, Parcerias, Status, Finanças, e no telemóvel com o gesto de voltar).
- **Pesquisa das listas guardada:** Preservação, Vale-Presente e Parcerias guardam o texto da pesquisa no sessionStorage ([use-session-search.ts](src/hooks/use-session-search.ts)); abrir uma ficha e voltar mantém a pesquisa (smoke (e)).
- **Recusado por ela (não voltar a propor nesta forma):** vale `preservacao_agendada` que não reverte ao cancelar; validade do cupão automática. Disse "não, avança só a pesquisa das listas".

### Sessão 178 (2026-10-04 a 08) — Livro de pagamentos: os euros com data substituem a percentagem (**EM PRODUÇÃO 08/10**, `master` `a11775b`; **migs 114 e 115 ✅ CORRIDAS**)

- **O quê:** queixa dela — *"às vezes pagam quantias que não correspondem a nenhuma das percentagens previstas, ou mudam a encomenda e os 30% deixam de ser 30%"*. `payment_status` respondia a duas perguntas ao mesmo tempo. Separaram-se: **`order_payments`** (tabela nova) é o dinheiro, com valor e data; **`payment_status`** passa a significar só a **fase da cobrança** e continua a ser decidida por ela. O que falta é a conta entre os dois.
- **Decisões dela (não voltar a propor o contrário):** plano **sempre 30/40/30**, sem planos por encomenda · a fase **nunca** se deriva do dinheiro (uma falta de 50 cêntimos combinada com a cliente não pode pôr a encomenda em "por pagar"; e o momento de cobrar é dela, às vezes aos 40%, às vezes na última fase) · **sem diálogo de confirmação**: mudar a fase regista o pagamento sozinho · a linha do vale **nasce ao meter o código** · a receita de um vale conta **no mês em que foi pago** e fica lá.
- **Correcções importantes ao diagnóstico, todas com dados reais:** (1) as etiquetas dela **não mentiam** — ela cobra o marco acumulado do total novo menos o já entrado (90€ + **260€**, e não 40% de 500€), e o que não existia era **registo dos acertos**, que não mudam o degrau (os 189€ de uma cliente estavam na conta e em lado nenhum); (2) o vale **não** deixava encomendas em dívida, porque ela marca a fase a 100%; (3) o registo tinha de viver **no servidor**: o `payment_status` muda pelo workbench **e** pelo selector da lista, e eu só tratei do primeiro.
- **Ficheiros:** migs [114](supabase/migrations/114_order_payments.sql) e [115](supabase/migrations/115_voucher_credit_as_payment.sql) · [finance.ts](src/lib/finance.ts) (`outstandingTotal`/`dueAtPhase`/`paymentPhaseReached`/`voucherRevenue`; `revenueTranches` apagada) · [payments-block.tsx](src/app/(admin)/preservacao/[id]/_components/payments-block.tsx) (novo) · [actions.ts](src/app/(admin)/preservacao/actions.ts) (registo automático + `addVoucherCreditLine`) · finanças, métricas, templates e assistente passam ao livro. **Apagados:** `budget-adjustment.ts` e o `PaymentChangeDialog`.
- **Migrações:** 114 e 115 ✅ corridas e verificadas (118 linhas no livro, 1 acerto de 189€ recuperado, 4 créditos de vale com os totais intactos). **Preflight:** ✅ tsc + 332 testes + build.
- **🔴 SMOKE POR FAZER** (não testável aqui, sem credenciais): (a) mudar a fase **pela lista** e ver a linha aparecer no workbench; (b) registar um valor estranho → "Falta ao todo" desce exactamente nesse valor; (c) corrigir uma linha estimada → o selo cai; (d) o caso dos **50 cêntimos**: registar 230€ onde o marco pedia 230,50€ → a fase não se mexe e fica "Falta ao todo: 0,50 €"; (e) meter um código de vale → linha de vale aparece sozinha; tirar → desaparece; (f) a Ana (viewer) vê a lista mas não vê Registar/Corrigir/Apagar.
- **Pendente dela (dados, não código):** **Alessandra Antunes** está a 70% pago **sem orçamento** — pôr o valor e registar o pagamento à mão; e duas encomendas antigas com orçamento a 0 (Maria Inês Cachulo Damasceno, Maria Alice do Nascimento Gonçalves), ao critério dela.
- **Lição da sessão:** três vezes diagnostiquei um problema que ela já resolve à mão, e a correcção certa foi sempre menor do que o plano previa. Confirmar com dados o que ela faz **antes** de desenhar a partir do que o código deixa acontecer. Detalhe em [[project_livro_pagamentos]].

### Sessão 177 (2026-09-17) — Preservação: barra de selectores numa linha só + fim da pill "+N quadros" (**EM PRODUÇÃO 17/09**, `master` `84f4ece`, sem migração)

- **O quê:** a Maria pediu duas coisas simples: (1) tirar a pill **"+N quadros"** da tabela; (2) as **duas barras de selectores** por cima da lista (Vista/Filtros/Colunas + abas Todos/Preservação/Recriação/Flores secas) ficarem numa linha só.
- **⚠️ Erro meu (corrigido):** li "estas 2 linhas" como sendo a **célula do Cliente** (nome numa linha, evento+etiquetas noutra) e meti-as em linha no commit `6b9ddf0`. No telemóvel o nome do cliente ficou reduzido a `V..`/`M.` — **inutilizável**. Ela apanhou em produção. **Revertido em `84f4ece`** (a célula do Cliente está exactamente como estava; só a pill é que saiu). *Lição:* quando ela aponta para um screenshot, confirmar a que elemento se refere antes de mexer — e nunca reestruturar uma célula que não foi mencionada.
- **Ficheiros:** [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) (pill fora da tabela; abas de serviço extraídas para a variável `serviceTabs`), [views-bar.tsx](src/app/(admin)/preservacao/_components/views-bar.tsx) (prop `children` renderizada na mesma linha dos botões; linha passa a `flex-nowrap overflow-x-auto` no telemóvel e `sm:flex-wrap` daí para cima, logo **o desktop não muda de comportamento**).
- A pill "+N quadros" **mantém-se na vista Cards**; a informação continua no workbench (cartão das Flores), no CSV e no contexto do assistente do WhatsApp.
- **Migrações:** nenhuma.
- **Smoke (por fazer):** (a) `/preservacao` vista Tabela → **uma** barra só, com as abas a seguir a Colunas; (b) telemóvel → a barra desliza na horizontal, sem partir em duas; (c) abrir Filtros/Colunas/Vista no telemóvel → os popovers abrem inteiros (não são cortados pelo overflow); (d) vistas Cards/Calendário/Timeline → as abas continuam por cima do conteúdo, e nos Cards o botão de ordenação continua à direita; (e) o **nome do cliente** vê-se por inteiro na tabela, como sempre.
- **Pendente:** a barra com as abas está com fundo `cream-50/50` por baixo de abas `cream-50/60` — se ela achar que se lê mal, dar mais contraste às abas.

### Sessão 176 (2026-09-17) — Workbench: o autosave perdia o que ela acabava de escrever (**EM PRODUÇÃO 17/09**, `master` `c52497d`, sem migração)

- **Queixa dela:** *"meto o contacto da pessoa, depois meto o nome, faço refresh e a plataforma só guardou o contacto. Parece que só consegue guardar uma coisa de cada vez. Nunca sei se o que estou a escrever vai ser guardado."* Campos de recolha / entrega em mãos.
- **Diagnóstico (3 causas que se somam):** (1) o autosave do workbench só dispara **900 ms depois da última tecla** e não havia **nada** a forçar a gravação ao sair do campo ou da página (zero `beforeunload`/`blur` em todo o `src/`); (2) os campos `pickup_*`/`hand_delivery_*` estão na lista de [calendarFieldsChanged](src/lib/google/order-calendar-trigger.ts), por isso cada gravação **esperava** por uma ida e volta à API do Google Calendar (`await`, segundos) mais um UPDATE; (3) o cliente **despacha server actions uma de cada vez** (doc do Next 16: *"The client currently dispatches and awaits them one at a time"*), logo a gravação do nome ficava na fila atrás da do telemóvel, presa no Google — um refresh pelo meio cancelava-a antes de chegar ao servidor. Bónus: o `catch` do flush era vazio e as chaves já tinham saído da fila antes do envio, portanto uma falha **apagava os dados em silêncio**.
- **(1) Calendar fora do caminho crítico** ([actions.ts](src/app/(admin)/preservacao/actions.ts)): o upsert passa a `after()` **só na actualização**; criação e remoção ficam `await` (são raras e o botão "No Calendar" aparece/desaparece logo a seguir). A doc do Next confirma que `cookies()` é legal dentro de `after()` em Server Functions, e o `setAll` do cliente Supabase já engole o erro de escrita.
- **(2) Gravar ao sair do campo e da página** ([workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx)): `onBlur` na raiz do workbench (o blur do React borbulha, por isso um handler só cobre todos os cartões sem lhes tocar) + `pagehide`/`visibilitychange` (Android a matar a PWA) + `beforeunload` que **pergunta** se ainda houver pendências.
- **(3) Erros deixam de ser silenciosos:** o `catch` devolve as chaves à fila (as edições mais recentes ficam por cima), retenta com afastamento (4s → 8s → 16s → 30s) e o cabeçalho mostra **"Por guardar"** a vermelho, visível **também no telemóvel** (o indicador era `hidden sm:block`; "A guardar"/"Guardado" continuam só em desktop, que fica intocado).
- **Ficheiros:** os 2 acima + [header.tsx](src/app/(admin)/preservacao/[id]/_components/header.tsx). Mesma família de problema que a sessão 175 resolveu no site público, mas por outra causa.
- **Migrações:** nenhuma. **Preflight:** ✅ tsc + 285 testes + `next build`; eslint limpo nos 3 ficheiros e em `src/app/(admin)/preservacao`.
- **Nota de ambiente:** a meio da sessão o `node_modules` apareceu partido (`.bin/` e vários pacotes em falta, sem nenhum processo a correr — provável colisão com a sessão paralela). Reposto com `npm ci`; `package.json` e `package-lock.json` ficaram intactos. Se voltar a acontecer, é isso e não o código.
- **Smoke (Maria, workbench de uma encomenda com "Recolha no local"):** (a) escrever o telemóvel do contacto e **saltar para o campo do nome** (Tab ou clique) → o cabeçalho mostra "A guardar/Guardado" logo, sem esperar pelos 900 ms; (b) escrever o nome e fazer **F5 imediatamente** → ou grava, ou o browser pergunta antes de sair (nunca desaparece em silêncio); (c) preencher 3 campos seguidos depressa e refrescar → estão lá todos; (d) no telemóvel, escrever, mudar de app e voltar → gravado; (e) mudar a data/hora da recolha → o evento do Google Calendar continua a actualizar-se (agora uns segundos **depois** de "Guardado", já não bloqueia a gravação).

### Sessão 175 (2026-09-17) — fbr-website: uma cliente leu o "Sucesso" do Turnstile como pedido enviado (✅ EM PRODUÇÃO 17/09, `main` `67497d7`, sem migração)

- **O quê:** uma senhora de mais idade viu a caixa verde "Sucesso" do widget anti-spam (sempre visível, mesmo por cima do botão de submeter, com um visto igual ao do ecrã de confirmação) e fechou a página sem submeter. Diagnóstico + 4 medidas propostas; a Maria aprovou **1, 3 e 4**. A **2** (frase por cima do botão + "Enviar a pré-reserva" em vez de "Submeter") ficou de fora por decisão dela.
- **(1) Turnstile invisível até pedir interação:** `appearance: "interaction-only"` em [TurnstileWidget.jsx](../fbr-website/fbr-website/app/_components/TurnstileWidget.jsx). A caixa "Sucesso" desaparece para quase toda a gente; só aparece se a Cloudflare precisar do clique. Verificação no servidor igual. Serve os 3 formulários. (Não se mudou o widget para "Invisível" no painel da Cloudflare: nesse modo quem falha a verificação silenciosa fica bloqueado sem desafio.)
- **(3) Erros a vermelho vivo:** `--erro`/`--erro-escuro`/`--erro-fundo` em `globals.css`; mensagens 0,85rem peso 500 com ícone "!"; campos e pílulas com borda vermelha (sombra de 1px, sem mudar o tamanho da caixa); resumo de erros e erro de envio com barra lateral de 6px. `:hover` do erro (senão no PC a borda voltava a dourado) e override no tema verde das flores secas ([EmoldurarReservar.css](../fbr-website/fbr-website/app/emoldurar-flores-secas/EmoldurarReservar.css), tinha mais especificidade e deixava a borda verde). CSS em `ReservarPreservacaoClient.css` (serve também as secas) e `ValeApresenteClient.css`.
- **(4) Aviso ao sair com dados por enviar:** [use-aviso-ao-sair.js](../fbr-website/fbr-website/app/_lib/use-aviso-ao-sair.js) (`beforeunload`; `temConteudo` passou a exportado do `use-rascunho.js`), chamado nos 3 formulários com `status !== "success" && temConteudo(form, INIT)`. **O texto é sempre do browser** (desde 2016 nenhum deixa personalizar, ela perguntou); Safari iOS ignora; Chrome Android não avisa ao fechar pelo gestor de separadores. É rede no PC; no telemóvel é o rascunho que salva.
- **Ficheiros (site):** os 3 acima + `use-rascunho.js`, `globals.css`, os 2 CSS, e os 3 formulários (`ReservarPreservacaoForm.jsx`, `ValeApresenteForm.jsx`, `EmoldurarForm.jsx`). Nada no admin além deste PROGRESS.
- **Migrações:** nenhuma. **Preflight (site):** `next build` ✅ (Next 16.2.6, TypeScript ok). **eslint não corre no site** (pré-existente, não é desta sessão): `next lint` já não existe no Next 16 e o `.eslintrc.json` legacy parte no ESLint 9 (estrutura circular ao validar). Pendência pequena: migrar para `eslint.config.mjs`.
- **Smoke (feito localmente, `next start` + chromium 390px):** erros vermelhos com "!" nos 3 formulários (estilos computados + capturas), `beforeunload` inactivo com o form vazio e activo depois de escrever o nome, 0 erros de consola. **Não testável localmente:** o Turnstile (não há site key no `.env.local`).
- **Smoke da Maria (depois do push):** (a) `/reservar-preservacao` no telemóvel → **não** aparece a caixa da Cloudflare; preencher e submeter um pedido de teste → chega ao admin; (b) carregar em "Submeter pré-reserva" com campos vazios → resumo vermelho no topo e erros com "!" nos campos; (c) no PC, escrever o nome e fechar o separador → o browser pergunta se quer sair; depois de submeter com sucesso, fechar sem pergunta; (d) `/vale-presente` e `/reservar-emoldurar-flores-secas`: o mesmo de (b).
- **Pendente:** medida 2 só com OK dela. Push feito 17/09 a pedido dela ("ok mete no main"); levou também o `f4c0fe9` da 174.

### Sessões 171 a 174 (2026-09-17) — movidas na íntegra para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)

- **174** Finanças e Métricas a fundo (migs 110-113, todas corridas) · **172** React #418 no `/whatsapp` (texto de clientes com CR) · **171** selo "Recomendado" no WhatsApp nos formulários do site. Todas em produção.

### Sessões 160 a 170 (2026-09-06 a 17) — movidas na íntegra para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)

- **170** análise estratégica de tráfego (Umami + Clarity + Search Console) a partir da pasta `export relatorio/` + **mig 109 ✅ corrida** (fecha a leitura anónima de `orders`) + títulos EN dos 2 artigos (EM PRODUÇÃO). Recomendações por decidir na memória `project_analise_trafego_2026-09`. **162** assistente: template base preenchida + saudação por hora + elogios com medida + pesquisa por telemóvel (EM PRODUÇÃO 06/09, smoke por fazer). **161** "Abrir no WhatsApp" nos templates. **160** resumo da encomenda ao vivo no formulário do site + orçamento gravado ao entrar + Termos 2.0 (EM PRODUÇÃO, aprovado por ela; em aberto: Livro de Reclamações).

## Pendências externas (outros repos)

- **fbr-website `main` `67497d7` ✅ EM PRODUÇÃO 17/09** (push feito na sessão 175 a pedido dela; levou também o `f4c0fe9` da 174, espelho da pirâmide em `app/_lib/orcamento.js`). Falta só o smoke do bloco da 175.
Tudo o que está aqui **já está em produção**; o detalhe vive nos commits. Só falta o que está marcado.

- **fbr-voucher** — 3 levas feitas (cartão 3D em WebP −94%, fontes locais/RGPD, versão EN com selector, envelope personalizado + pétalas + partilhar, OG image, código de exemplo `EXEMPLO`/`EXAMPLE`). **Falta:** smoke visual da Maria em `/EXEMPLO` (PT e EN) e num vale real no telemóvel. **Não feito de propósito:** Umami no voucher (à espera da palavra dela).
- **fbr-website** — links "Ver um exemplo do vale digital" no vale-presente e em `/oferecer-preservacao` (live). Relatório mensal do Clarity ✅ automatizado (cron + Resend). **Em aberto (auditoria 122):** `aggregateRating`? subtítulo no hero? data nas páginas legais? vídeo `tracking.mp4` (a Maria ainda não tem). Umami continua manual (API paga) — [[project_website_analytics]].
- **Análise mercado/conversão/blog do fbr-website (06/07)** — concorrentes PT, estratégia resina, prova social em falta nas páginas de decisão, 6 artigos propostos. **POR IMPLEMENTAR** ([[project_website_mercado_conversao_2026-07]]).
- **⚠️ Sessões paralelas:** este working tree é partilhado com outras sessões Claude. `git status` antes de commitar, sempre ([[project_parallel_sessions_worktree]]). Hoje houve colisão de numeração (duas sessões chamaram-se 152).

---

## Próximas frentes (por ordem — ver "Próximo passo concreto" no topo)

- **Relatório mensal em PDF** (sugestão 7 da sessão 174, aprovada por ela, adiado): página imprimível com os números do último mês fechado a partir das Finanças (receita por data de pagamento, despesas, lucro, por receber) e da Métricas (pedidos, taxa de confirmação, antecedência, cancelamentos, resposta no WhatsApp). Sem migração.
- ~~Finanças, ponto 4 (receita por data de pagamento)~~ ✅ **FEITO na 174** (mig 111 + trigger + backfill).
- Varrimento `formatDateTimeLisbon` (129) → tipos gerados Supabase no preflight → vista "Hoje" + relatório mensal → expurgo WhatsApp do git (sessão dedicada) → cadência de comunicação (104)
- **Alertas por email no link de status** (a Maria fá-lo quando tiver tempo, sessão 147): cliente opta por receber avisos no `status.floresabeirario.pt` (email + consentimento RGPD numa tabela `status_subscriptions` nova, com GRANT/RLS); no admin (aba Status) um botão **"Notificar cliente desta atualização"** que **só envia quando a Maria carrega** (mudanças de estado acidentais nunca enviam nada); email PT/EN via Resend. Aprovado o approach "email opt-in + botão manual" (nunca automático — [[feedback_nada_de_envio_automatico]]).
- **Calculadora do custo da recolha** (adiado pela Maria em 06/09/2026, sessão 160): a partir da morada de recolha já geocodificada no formulário, calcular km ida e volta × €/km + **portagens reais** + tempo × €/h + margem. Portagens têm de ser **valores concretos, não estimativas por km** (ela usa a ViaMichelin, que não tem API pública) → usar a **Routes API da Google** (`computeRoutes` com `extraComputations: ["TOLLS"]`, devolve `travelAdvisory.tollInfo` em EUR para Portugal; chave já existe no Google Cloud dela). Faltam 3 números dela (€/km, €/hora, valor mínimo). Começar **só no admin** (cartão da recolha no workbench) e comparar meia dúzia de casos com a ViaMichelin antes de mostrar ao cliente no resumo.
- **Chat interno — media** (upload foto/vídeo/áudio; hoje só texto)
- ~~Mover Competição de Finanças para Parcerias~~ **recusado pela Maria (sessão 174): fica nas Finanças.**
- View SQL `order_pnl` para exports/queries ad-hoc (nice-to-have)
- Outras ideias vivem na aba `/ideias` da plataforma

---

## Armadilhas conhecidas (anti-repetição)

- **Texto de pessoas com CR parte a hidratação (React #418)** — o parser de HTML converte CR em LF e come os controlos C0, o React não; qualquer texto de cliente que vá para SSR passa por `hydrationSafeDeep` na fronteira servidor→cliente (sessão 172)
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
