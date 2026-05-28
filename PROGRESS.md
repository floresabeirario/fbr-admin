# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 37) — Sessão 93: **3 anexos de fatura por encomenda + tarefa automática "Enviar fatura"** (2026-05-28). Maria pediu: cada pagamento gera uma fatura separada (sinal 30%, intermédio 40%, final 30% — ou variações 70/30, 100% à cabeça); quando se anexa o link da fatura na Drive, criar automaticamente tarefa a pedir para enviar à cliente. **Novidades**: (1) Mig 060 renomeia `orders.invoice_attachment_url` → `invoice_url_sinal` e adiciona `invoice_url_intermedio` + `invoice_url_final`; actualiza `anonymize_order` (mig 024) e policy `orders_public_insert` (mig 016). (2) Workbench [preservação](src/app/(admin)/preservacao/[id]/workbench-client.tsx): a antiga `Field` "Anexo da fatura" passa a um bloco com até 3 inputs etiquetados (Sinal / Intermédio / Final), visíveis consoante `payment_status` — sinal aparece com qualquer pagamento, intermédio só com 70%+, final só com 100%. Alerta "Falta anexar fatura" passa a só disparar se NENHUM dos 3 estiver preenchido. (3) [updateOrderAction](src/app/(admin)/preservacao/actions.ts) detecta transição NULL → URL em cada slot e insere uma tarefa por slot: título `Enviar fatura — {client_name} ({sinal|intermédio|final})`, categoria `administrativo`, prioridade `alta`, `status='por_comecar'`, `order_id` ligado, `assignee_emails=[email do utilizador autenticado]`, sem prazo. Substituir um link (URL → outro URL) NÃO conta (assume-se correcção). (4) Mesmo padrão aplicado em [updateVoucherAction](src/app/(admin)/vale-presente/actions.ts) (1 fatura só, `voucher_id` ligado). (5) Export CSV passa de 1 coluna "Anexo fatura" para 3 colunas no export de encomendas; vouchers mantêm 1. Preflight `tsc + next build` limpos.

## Fase anterior: FASE 6 (parte 36) — Sessão 92: **Kanban dos Afazeres globais redesenhado + estado GTD + mobile snap-scroll** (2026-05-28). Maria pediu inspiração no kanban do Bitrix24. **Novidades**: (1) Coluna `tasks.status` com 3 estados (`por_comecar` / `a_fazer_hoje` / `em_curso`) — não substitui `done` (checkbox continua a marcar feita). Sort: em_curso primeiro. (2) `StatusPill` no card (chip com dot+abreviatura, popover para mudar). (3) **"Há X dias"** no fundo do card quando não há prazo (substitui o slot do prazo) — formato reutiliza `formatDoneAgo`. (4) **Mobile**: layout passa de `grid grid-cols-2` espremidas para `flex overflow-x-auto snap-x snap-mandatory` com cada coluna a ocupar ~85vw (max 320px) — Bitrix-style. (5) **Drag-and-drop desactivado no mobile** (era a queixa principal: scroll arrastava cards/colunas por engano) via `useIsMobile` hook (matchMedia `(max-width: 639px)` com `useSyncExternalStore`); na prática não se anexa `setNodeRef/attributes/listeners` aos elementos draggable e remove-se `touch-none cursor-grab`. (6) Header da coluna: ícone maior (h-7), badge de contagem em pill branco redondo, padding +1 step. Card: padding +1 step (px-2.5 py-2), border-radius lg. PC layout inalterado nas dimensões da grelha. Mig 059 adiciona a coluna `status` com default `por_comecar` + index parcial. Preflight `tsc + next build` limpos.

<!-- Sessão 91 (FASE 6 parte 35) comprimida no Histórico condensado em baixo. -->


### Fases do projecto
- [x] **Fase 1** — Fundação: Supabase ligado, autenticação, layout/navegação ✅
- [x] **Fase 2** — Preservação de Flores: tabela, workbench, estados, orçamento, permissões ✅
- [x] **Fase 3** — Vale-Presente (admin + site público `voucher.floresabeirario.pt`) + Status ✅
- [x] **Fase 4** — Dashboard + Tarefas + Métricas ✅
- [x] **Fase 5** — Formulários públicos + Parcerias ✅
- [~] **Fase 5.5** — Afinações pós-uso (parte 1 ✅; parte 2 quase fechada — falta `fbr-website`)
- [~] **Fase 6** — Integrações + PWA + RGPD completo ← **EM CURSO**

---

## O que está feito (estado actual da plataforma)

- Next.js 16 + shadcn/ui + Supabase ligado, deploy em `admin.floresabeirario.pt`
- Login Netflix com fotos (António admin, MJ admin, Ana viewer); permissões admin/viewer em todas as abas
- **Preservação**: 4 vistas (Tabela / Cards / Calendário Semana/Mês/Ano / Timeline), grupos colapsáveis, drag-and-drop entre grupos, workbench 3 colunas com slide ◀ ▶, edição inline, alertas 40%/30%/aprovação, sticky note, inventário, recolha no local, dark mode
- **Vale-Presente** admin + site público `voucher.floresabeirario.pt`
- **Status** admin + site público `status.floresabeirario.pt` (12 fases públicas PT/EN, data prevista auto +6m)
- **Parcerias** completas (4 categorias, mapa Portugal, interações, acções, autocomplete Nominatim)
- **Dashboard** com checklist pessoal, afazeres globais, recolhas/entregas, alertas
- **Métricas** com 4 KPIs + insights + 3 donuts + top parceiros
- **Finanças** (redesenhada nas sessões 89-90): 6 sub-abas — **Painel** (default, resumo executivo com 6 KPIs principais + 4 secundários + breakdown despesas por tipo contabilístico + ranking de lucro por tamanho/fundo), **P&L por encomenda** (tabela ordenável com margem por quadro), **Catálogo** (sessão 90: tabela "Margem teórica" editável — 12 linhas de quadros + 2 de extras, custos derivam das 6 tabelas de produção em baixo), **Despesas** (únicas + subscrições, anexo factura Drive), **Faturação** (KPIs do mês/ano com receita bruta/líquida + comissões + pipeline 4-bucket por estado + gráfico 3-barras), **Competição** (a mover para Parcerias no futuro). Comissões a parceiros subtraem da receita (decisão Maria sessão 89). Helpers financeiros centralizados em [lib/finance.ts](src/lib/finance.ts).
- **Entregas e Recolhas** com agenda + mapa Google Maps + notas de recolha
- **Livro de Receitas** (wiki por flor) + **Chat interno** (texto + Realtime) + **Ideias** + **Healthchecks** + **Ecossistema**
- **Pesquisa global** Cmd+K em 5 tipos
- **PWA** instalável (iOS + Android); mobile-friendly
- **Integrações Google**: OAuth foundation, auto-criação pastas Drive ao 1º pagamento, eventos Calendar com info de recolha
- **RGPD**: exportação JSON+PDF, retenção 10 anos com anonimização, audit log UI
- **Templates de mensagens** (sessão 64): biblioteca de 29 templates pré-populados (PT+EN) com variáveis ({nome}, {valor_sinal}, {dados_pagamento}, {saudacao}…); UI de gestão em Sistema → Templates; picker no workbench Preservação + Vale-Presente com sugestões automáticas por estado da encomenda. Zero IA, zero tokens.
- **Registo manual WhatsApp** (sessão 65): tab "WhatsApp" no workbench Preservação com bolhas estilo WhatsApp, composer rápido, importação de ficheiros exportados do WhatsApp Web (parser PT do formato dd/MM/yy), edit/delete por entrada, screenshots como URLs Drive.
- **Tarefas multi-assignee + notificações** (sessão 75): `tasks.assignee_emails TEXT[]` (Opção A — qualquer assignee marca como feita = some para todos); checklist pessoal do Dashboard mescla itens privados + tarefas atribuídas a mim (badge "Global"); bolinha sky na sidebar do item Dashboard + toast inicial via RPC `mark_tasks_seen` (mig 044). UI multi-assignee = 3 avatares clicáveis com ring violet quando activos.
- 56 migrações aplicadas; smoke test em Playwright (`npm run smoke`)

---

## Sessões recentes (detalhe)

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

<!-- Sessões 88-A, 88-B, 88-C e 88-D comprimidas no Histórico condensado em baixo. -->

## Próximo passo CONCRETO

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

### Fase 6 — Integrações + PWA + RGPD (sessões 35-88D)
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

---

## Pendências externas (outros repos)

- **`fbr-website`** — 6 mudanças do antigo `PHASE_5_5_TODO.md` (Maria confirmou "D feito" na sessão 43 — reconfirmar visualmente)
- **Datas dd/MM/yyyy** — admin OK; confirmar `fbr-website` em PT + EN

---

## Próximas frentes (Fase 6 pendente — [[feedback_fase6_ordem_integracoes]])

- **Gmail API** — histórico emails por encomenda no workbench (foundation OAuth pronta desde sessão 37)
- **WhatsApp manual** — screenshot/texto no workbench (sem API oficial)
- **Anthropic API** — assistente de resposta AI no workbench
- **Chat interno — media** — versão sessão 43 só tem texto; adicionar upload foto/vídeo/áudio
- **Backup automático** — DECISÃO Maria: NÃO é necessário (skip)

---

## Ideias futuras / Pendências (a planear)

- **Calculadora de transporte** em Entregas e Recolhas (placeholder na sessão 42 → na sessão 62 substituído por link CTT)
- **Aba "Healthchecks"** — versão útil entregue na sessão 43, mas pode crescer (form checks, SEO, etc.)
- **Filtros guardáveis em Preservação** (proposto na sessão 62, adiado pela Maria) — chips ao lado da pesquisa com filtros pré-feitos: "Urgentes (≤7 dias)", "Pagamento pendente", "Em prensa", etc. Reduz cliques no dia-a-dia. Estimativa: 1h, risco zero. Avaliar também em Parcerias.
- **Push notifications PWA** (pedido pela Maria na sessão 75, adiado por complexidade) — usar Web Push API + VAPID keys para notificar no telemóvel/desktop nativo quando uma tarefa é atribuída (ou pré-reserva nova chega, etc.). Service worker já existe (PWA da sessão 39). Implica: subscribe no client, guardar push subscriptions na BD por user+device, endpoint server que envia via VAPID, fallback gracioso para browsers sem permissão.
- Outras ideias geridas dentro da própria aba `/ideias` desde a sessão 42

---

## Armadilhas conhecidas (anti-repetição)

- **`useEffect+setState` viola ESLint** — usar "store info from previous renders" ([[feedback_react_set_state_in_effect]])
- **`useSyncExternalStore` snapshot** tem de devolver referência cacheada ou dá React #185 ([[feedback_useSyncExternalStore_pitfall]])
- **`SUPABASE_URL` sem `/rest/v1`** — o client adiciona automaticamente
- **Vercel não auto-redeploya** ao mudar env vars — forçar
- **`INSERT...RETURNING` precisa de GRANT SELECT** — não só GRANT INSERT (ver [[feedback_supabase_rls_pitfalls]])
- **`CREATE TABLE IF NOT EXISTS` é silencioso** se a tabela existe — usar `ALTER TABLE` em migrações subsequentes
- **Smoke test obrigatório** antes de fechar sessões que mexem em páginas críticas ([[feedback_smoke_test_obrigatorio]])
