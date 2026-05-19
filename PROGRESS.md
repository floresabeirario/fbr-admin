# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 31) — Sessão 88-D: **CRUD de templates de tarefas em Sistema → Tarefas**. Página nova `/settings/templates-tarefas` com lista + diálogo de edição + variáveis clicáveis. Renomeada entrada "Templates" da topbar para "Mensagens" (clareza vs nova "Tarefas"). Funcionalidade "tarefas a partir do workbench" completa.

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
- **Finanças**: Despesas (únicas + subscrições, anexo factura Drive), Tabela de preços (cálculo auto), Custos de produção + consumíveis, Faturação (potencial 100% pago), Competição
- **Entregas e Recolhas** com agenda + mapa Google Maps + notas de recolha
- **Livro de Receitas** (wiki por flor) + **Chat interno** (texto + Realtime) + **Ideias** + **Healthchecks** + **Ecossistema**
- **Pesquisa global** Cmd+K em 5 tipos
- **PWA** instalável (iOS + Android); mobile-friendly
- **Integrações Google**: OAuth foundation, auto-criação pastas Drive ao 1º pagamento, eventos Calendar com info de recolha
- **RGPD**: exportação JSON+PDF, retenção 10 anos com anonimização, audit log UI
- **Templates de mensagens** (sessão 64): biblioteca de 29 templates pré-populados (PT+EN) com variáveis ({nome}, {valor_sinal}, {dados_pagamento}, {saudacao}…); UI de gestão em Sistema → Templates; picker no workbench Preservação + Vale-Presente com sugestões automáticas por estado da encomenda. Zero IA, zero tokens.
- **Registo manual WhatsApp** (sessão 65): tab "WhatsApp" no workbench Preservação com bolhas estilo WhatsApp, composer rápido, importação de ficheiros exportados do WhatsApp Web (parser PT do formato dd/MM/yy), edit/delete por entrada, screenshots como URLs Drive.
- **Tarefas multi-assignee + notificações** (sessão 75): `tasks.assignee_emails TEXT[]` (Opção A — qualquer assignee marca como feita = some para todos); checklist pessoal do Dashboard mescla itens privados + tarefas atribuídas a mim (badge "Global"); bolinha sky na sidebar do item Dashboard + toast inicial via RPC `mark_tasks_seen` (mig 044). UI multi-assignee = 3 avatares clicáveis com ring violet quando activos.
- 49 migrações aplicadas; smoke test em Playwright (`npm run smoke`)

---

## Sessões recentes (detalhe)

### Sessão 88-D 🗂️ Página CRUD de templates de tarefas (Sistema → Tarefas)

Fecha o ciclo da funcionalidade "tarefas a partir do workbench" iniciada em 88-A. Maria precisava de poder editar/criar/arquivar templates sem mexer em BD.

**Server actions — [src/app/(admin)/settings/templates-tarefas/actions.ts](src/app/(admin)/settings/templates-tarefas/actions.ts):**
- `createTaskTemplateAction(input)` — insere com `is_seed=false` (templates criados via UI nunca são seeds). Aceita `TaskTemplateInsert`.
- `updateTaskTemplateAction(id, patch)` — exclui `slug` e `is_seed` do patch (defensivo; UI não os edita).
- `archiveTaskTemplateAction(id)` / `restoreTaskTemplateAction(id)` — soft delete via `deleted_at`. Templates seed podem ser arquivados (somem do picker) e restaurados.
- Todos com `requireAdmin()` + `revalidatePath("/settings/templates-tarefas")`.

**Page — [src/app/(admin)/settings/templates-tarefas/page.tsx](src/app/(admin)/settings/templates-tarefas/page.tsx):**
- Server component. `getCurrentRole()` → redirect a `/` se não admin.
- Query `task_templates` ordenado por scope, position, name. Inclui arquivados (deleted_at) — UI filtra.

**Client — [src/app/(admin)/settings/templates-tarefas/templates-tarefas-client.tsx](src/app/(admin)/settings/templates-tarefas/templates-tarefas-client.tsx):**
- Header: ícone ListTodo + título + toggle "Ver activos/arquivados" + botão "+ Novo template".
- Bloco "Variáveis disponíveis" com cada `TASK_TEMPLATE_VARIABLES.key` como chip clicável (copy-to-clipboard) e tooltip com descrição + scope.
- Tabela: Nome (com badge "Seed" se aplicável), Título (mono, truncated), Escopo (badge colorido sky/violet/emerald), Categoria, Prioridade, Valor (ícone Receipt se `needs_amount`), Acções (editar/arquivar/restaurar).
- Diálogo de edição (`Dialog` modal, `sm:max-w-2xl`):
  - Nome + Escopo (grid 2 colunas)
  - Título da tarefa (Textarea, font-mono) — abaixo botões "+ {variável}" que fazem append ao textarea
  - Descrição opcional (Textarea)
  - Categoria default + Prioridade default (grid 2 colunas)
  - Caixa colapsável "Este template pede um valor (€)" — checkbox; quando true, mostra input "Etiqueta do diálogo" (ex.: "Valor a faturar")
- Optimistic updates ao guardar/arquivar/restaurar (server revalidatePath ainda corre para garantir consistência).

**Topbar — [src/components/sistema-topbar.tsx](src/components/sistema-topbar.tsx):**
- Adicionada entrada `Tarefas` com ícone `ListTodo` → `/settings/templates-tarefas` (adminOnly).
- Renomeada entrada existente de `Templates` para `Mensagens` (existing page agora cobre só message templates; nome mais claro).

**Sem migrações nesta sessão.** Preflight `tsc --noEmit` + `next build` limpos. Página `/settings/templates-tarefas` aparece na lista de rotas.

**Maria: passos manuais:**
1. Push para Vercel.
2. Smoke browser:
   - `/settings/google` ou qualquer página `/settings/*` → topbar mostra agora `Mensagens` (em vez de `Templates`) e nova entrada `Tarefas`.
   - Click `Tarefas` → vê os 4 seeds com badge "Seed", título com variáveis em mono, escopo colorido. Botão Edit em cada um.
   - "+" → diálogo aberto com campos vazios + variáveis clicáveis. Escrever nome "Teste", título "Cliente: {nome_cliente}", click no chip "+ {nif}" no rodapé do textarea → adicionado ao final. Guardar → toast.
   - Editar um seed → mudar prioridade default → guardar. Tarefa criada com esse template a seguir usa a nova prioridade.
   - Marcar "Este template pede valor" → input "Etiqueta do diálogo" aparece. Guardar. No workbench, ao escolher esse template → abre diálogo com a label escolhida.
   - Arquivar um template → desaparece da lista activa e do picker do workbench. Toggle "Ver arquivados" → vê-o; restaurar.

**Funcionalidade completa!** O ciclo "criar tarefa a partir do workbench com templates editáveis" está fechado:
- 88-A: schema (mig 052) — `tasks.voucher_id`, `tasks.amount`, tabela `task_templates` com 4 seeds
- 88-B: UI workbench Preservação (bloco + picker + diálogo de valor)
- 88-C: UI workbench Vale-Presente (mesmo bloco, opção "Total") + linkage do tile do kanban → workbench + € à direita
- 88-D: CRUD de templates em Sistema → Tarefas

### Sessão 88-C 🧷 Tarefas no Vale-Presente + linkage clicável no Dashboard

Estende a sessão 88-B aos dois sítios em falta: workbench Vale-Presente e tile do kanban do Dashboard.

**Componente promovido — [src/components/workbench-tasks-block.tsx](src/components/workbench-tasks-block.tsx):**
- O antigo `_components/order-tasks-block.tsx` da Preservação foi generalizado e movido para `src/components/`. Nome `WorkbenchTasksBlock`.
- API nova: `link: { type: "order" | "voucher"; id }` (discriminator) substitui o `orderId`; `paymentOptions: AmountOption[]` substitui `budget` (parent precomputa). Action call: `order_id` ou `voucher_id` set conforme o link.
- Empty state e descrição do diálogo passam a depender de `link.type` ("vale" vs "encomenda").
- Botões de pagamento no diálogo: layout 2 colunas para encomendas (4 opções); 1 coluna para vales (1 opção "Total").
- Ficheiro antigo `_components/order-tasks-block.tsx` **apagado**.

**Preservação — [src/app/(admin)/preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx):**
- Import migrado para `@/components/workbench-tasks-block` + `computeAmountOptionsFromBudget` do helper.
- Card "Tarefas" agora chama o componente partilhado com `link={{ type: "order", id }}` e `paymentOptions={computeAmountOptionsFromBudget(local.budget)}`.

**Vale-Presente — [src/app/(admin)/vale-presente/[code]/page.tsx](src/app/(admin)/vale-presente/[code]/page.tsx):**
- `Promise.all` ganha 3ª query: `task_templates` com `scope IN ('voucher','both')`. A seguir, query separada de `tasks` com `eq voucher_id` filtrada por `voucher.id`.
- `currentEmail` carregado via `getCurrentEmail()`.
- 3 props novos passados ao client: `taskTemplates`, `voucherTasks`, `currentEmail`.

**Vale-Presente workbench — [src/app/(admin)/vale-presente/[code]/workbench-client.tsx](src/app/(admin)/vale-presente/[code]/workbench-client.tsx):**
- Props `taskTemplates`/`voucherTasks`/`currentEmail` no `Props` interface (opcionais com default vazio para retro-compat).
- Imports: `WorkbenchTasksBlock`, `computeAmountOptionsForVoucher`, tipos `Task`/`TaskTemplate`, ícone `CheckSquare`.
- `<Section title="Tarefas">` inserida **no topo** da coluna direita (antes de "Pagamento e fatura"). Mesma posição que no workbench Preservação para coerência.
- `paymentOptions={computeAmountOptionsForVoucher(data.amount)}` — uma única opção "Total (€X)" porque vales são pagos 100% num só momento.
- `context.client_name = data.sender_name` (remetente é quem compra o vale, é com ele que se interage).

**Helper de valor para vales — [src/lib/task-templates.ts](src/lib/task-templates.ts):**
- `computeAmountOptionsForVoucher(amount)` devolve `[{ label: "Total (€X,XX)", value: amount }]`. Retorna `[]` se amount é null/0 (campo manual fica como única opção).

**Dashboard linkage — [src/app/(admin)/page.tsx](src/app/(admin)/page.tsx):**
- Constrói dois lookups uuid→código curto a partir dos `orders`/`vouchers` já carregados: `orderCodeById` (`order.id → order.order_id`) e `voucherCodeById` (`voucher.id → voucher.code`).
- Passa ambos para `DashboardClient`.

**Cascata de props até ao tile — [src/app/(admin)/dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx), [src/app/(admin)/_components/dashboard/tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- `DashboardClient` → `TasksCard` → `CategoryColumn` → `DraggableTaskTile` — todas as quatro camadas passam `orderCodeById`/`voucherCodeById` para baixo. Defaults `{}` permitem chamadas legacy sem partir.

**Tile do kanban — [src/app/(admin)/_components/dashboard/tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- **Badge de encomenda/vale:** IIFE no topo do tile lookup o código curto a partir de `task.order_id` ou `task.voucher_id`; renderiza um `<Link>` indigo com `Link2` icon + código mono, truncado a 120px. `onPointerDown stopPropagation` evita disparar drag. URL: `/preservacao/{order_id}` ou `/vale-presente/{code}`. Não renderiza nada se nenhum dos dois.
- **Valor € à direita:** `<span tabular-nums>` antes do badge de data na bottom row (`ml-auto` group). Só renderiza quando `task.amount != null`. Formatado via `formatEUR()` (€135,00 no formato europeu). Regra universal de € à direita aplicada — não vai inline no texto da tarefa.

**Preflight `tsc --noEmit` + `next build` limpos.** **Maria: passos manuais:**
1. Sem migrações nesta sessão (mig 052 já basta).
2. **Push para Vercel**.
3. **Smoke browser:**
   - Abrir `/vale-presente/[código]` — topo da coluna direita: card "Tarefas" border indigo, igual ao da Preservação. "+" → popover só com templates `scope=voucher` ou `both` (ex.: "Passar fatura com NIF" aparece; "Pedir feedback ao cliente" NÃO aparece — esse é só de encomenda).
   - Click "Passar fatura com NIF" → diálogo com **uma só** opção "Total (€X)" + campo manual. Escolher → form inline; criar.
   - Voltar ao Dashboard → tarefa aparece na kanban (categoria Administrativo). No tile vês: chip indigo no topo com `Link2` + código curto do vale; valor € à direita na bottom row; click no chip → abre `/vale-presente/[code]`.
   - Mesma coisa para encomenda: criar tarefa no workbench Preservação → tile no kanban mostra chip com `order_id` curto (16 chars) → click navega para `/preservacao/[order_id]`.
   - Tarefa sem `order_id`/`voucher_id` (criada directamente no Dashboard): tile sem chip; € à direita só aparece se foi criada via template `passar_fatura` (com amount).

**Próxima sessão (88-D):** Página CRUD de templates de tarefas em Sistema → Templates de tarefas, com lista de variáveis disponíveis (`TASK_TEMPLATE_VARIABLES`).

### Sessão 88-B 🧰 Tarefas no workbench Preservação — UI completa (picker, templates, diálogo de valor)

UI do plano da sessão 88-A. Não toca em schema; usa a mig 052 + tipos da sessão anterior.

**Helper de interpolação — [src/lib/task-templates.ts](src/lib/task-templates.ts):**
- `interpolateTaskTemplate(template, ctx)` substitui `{nome_cliente}`, `{nif}`, `{nome_parceiro}`, `{valor_comissao}`, `{valor}` por valores reais; variáveis sem dados ficam como `"—"` (evita mostrar literalmente `{nif}` numa fatura).
- `computeAmountOptionsFromBudget(budget)` devolve as 4 opções 30%/40%/70%/100% formatadas (`"30% (€135,00)"` + valor numérico) para o diálogo da fatura. Retorna `[]` se budget é null/0 (UI mostra só o campo manual).
- `TaskTemplateContext` type — `client_name`, `nif`, `partner_name`, `partner_commission`, `amount`.

**Page server-side — [src/app/(admin)/preservacao/[id]/page.tsx](src/app/(admin)/preservacao/[id]/page.tsx):**
- Adicionado import de `Task`, `TaskTemplate` e `getCurrentEmail`. `Promise.all` ganha 3ª query: `task_templates` com `scope IN ('order','both')` ordenado por position. A seguir, query separada de `tasks` para a encomenda (`eq order_id` + `is deleted_at null`) — depende do `order.id` resolvido do lookup anterior, por isso fora do Promise.all.
- Props passadas ao client: `taskTemplates`, `orderTasks`, `currentEmail`.

**Componente novo — [src/app/(admin)/preservacao/[id]/_components/order-tasks-block.tsx](src/app/(admin)/preservacao/[id]/_components/order-tasks-block.tsx):**
- Estado interno: `tasks[]` (mutável; sync inicial via prop), `showPicker`, `amountDraft` (template a precisar de valor), `draft` (template + título + amount + assignees + prioridade + dueDate).
- Fluxo: click "+ Nova tarefa" → popover com lista de templates + "Tarefa em branco" → click template → se `needs_amount=true`, abre `<Dialog>` "Qual é o valor a faturar?" com 4 botões 30/40/70/100% (calculados de `orders.budget`) + input manual; sem budget, só input manual; depois de valor escolhido → form inline aparece com título já interpolado (variáveis substituídas) + assignees default=eu + prioridade default do template + data opcional.
- TaskRow: checkbox done, título quebra linhas (`break-words`), pill de prioridade `URG/ALTA/MÉD/BAIXA` (cores `TASK_PRIORITY_COLORS`), mini avatares de assignees (h-4), badge de data com `Calendar` (rose se overdue), **€ alinhado à direita** (regra universal), trash em hover.
- `createTaskAction({order_id, amount, ...})` — a action já aceitava `TaskInsert` completo desde sempre; só preciso passar os campos novos.

**Workbench — [src/app/(admin)/preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx):**
- Imports: `OrderTasksBlock`, `Task`, `TaskTemplate`, `CheckSquare`.
- Props novos no WorkbenchClient: `taskTemplates`, `orderTasks`, `currentEmail` (defaults vazios para retro-compat).
- Card "Tarefas" inserido como **primeiro** card da coluna direita (antes de Finanças), accent indigo, ícone CheckSquare. Decisão: tasks são o item mais "accionável" do workbench — ficam no topo da coluna 3 para visibilidade. Inside o bloco, contador `"N tarefas por fazer"` no topo.
- `partner_name` resolvido inline a partir da lista `partners` já carregada (procura por `id === local.partner_id`).

**Pickers de Popover/Trigger:** este projecto usa `@base-ui/react` (não Radix). `PopoverTrigger` é `<button>` directo, sem `asChild`. Coerente com [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx) (PriorityPill).

**Preflight `tsc --noEmit` + `next build` limpos.** **Maria: passos manuais:**
1. Confirmar que correste a mig 052 (sessão 88-A) — caso contrário, esta UI vai falhar (não há tabela `task_templates`).
2. **Push para Vercel**.
3. **Smoke browser** (em /preservacao/[qualquer id]):
   - Topo da coluna direita: card "Tarefas" com border indigo. Se não houver tarefas, vê "Sem tarefas pendentes para esta encomenda" + botão "+ Nova tarefa".
   - Click "+ Nova tarefa" → abre popover com 5 opções: "Tarefa em branco", "Passar fatura com NIF" (ícone Receipt verde), "Anexar comprovativo de pagamento", "Pedir feedback ao cliente", "Avisar parceiro da comissão".
   - Click "Passar fatura com NIF" → abre diálogo com 4 botões (30/40/70/100% calculados do orçamento) + campo manual €. Em encomendas sem orçamento, só aparece o campo manual.
   - Escolher 30% → form inline aparece com título `"Passar fatura para João Silva — NIF: …"` + bloco com `€XX,XX` à direita + 3 avatares (eu activo por default) + prioridade ALTA (default do template) + data vazia. Editar título à mão → guardado. Click "Criar" → tarefa aparece na lista; ir ao Dashboard, kanban Administrativo → tarefa lá. Voltar ao workbench → contador "1 tarefa por fazer" no topo.
   - Click "Tarefa em branco" → form inline com título vazio (sem diálogo de valor). Criar normalmente.
   - Checkbox numa tarefa → some da lista (filtra `done`). Hover → ícone Trash; click confirma e apaga.
   - Templates sem `needs_amount` (feedback, comprovativo, parceiro) → vão direto ao form, título já preenchido com variáveis interpoladas (ou `"—"` se a encomenda não tem NIF/parceiro).
   - Ana (viewer) → vê tarefas mas não vê o botão "+ Nova tarefa" nem o ícone Trash (canEdit=false).

### Sessão 88-A 🧱 Tarefas a partir do workbench — fundação BD (mig 052)

Maria pediu para conseguir **criar tarefas a partir do workbench** (de uma encomenda específica) e que essas tarefas:
1. Tenham **templates** para casos frequentes (passar fatura com NIF, anexar comprovativo, pedir feedback, avisar parceiro da comissão) — editáveis em Sistema → Templates de tarefas
2. Suportem **variáveis** ({nome_cliente}, {nif}, {nome_parceiro}, {valor_comissao}, {valor}) que se expandem com dados da encomenda
3. Para faturas, **mini-diálogo a pedir o valor** com opções calculadas do orçamento (30%/40%/70%/100%/outro) — texto sai como `"Passar fatura para João Silva — NIF: 123456789"` com **€135 alinhado à direita** (regra universal de € à direita, guardada em memória)
4. **Bloco "Tarefas desta encomenda (N por fazer)"** no workbench Preservação e Vale-Presente
5. No Dashboard, badge clicável com encomenda quando aplicável

**Plano em 4 sessões:** A (fundação BD) ← agora, B (workbench Preservação), C (workbench Vale + Dashboard linkage + € à direita), D (página CRUD de templates).

**Migração 052 — [supabase/migrations/052_task_templates_and_voucher_link.sql](supabase/migrations/052_task_templates_and_voucher_link.sql):**
- `tasks.voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL` — simétrico ao `order_id` que já existia desde a mig 012 (mas nunca foi populado via UI). No máximo um dos dois preenchido por tarefa.
- `tasks.amount NUMERIC(10,2)` — valor associado à tarefa (€), usado por templates com `needs_amount=true`. Mostra-se à direita na lista. Independente dos pagamentos da encomenda — é só o número que vai na fatura/recibo dessa tarefa.
- Índices parciais em `order_id` e `voucher_id` (WHERE deleted_at IS NULL AND ... IS NOT NULL).
- Tabela `task_templates` (espelha padrão de `message_templates` da mig 041): `slug` único, `name`, `title_template`, `description_template`, `default_category` (TaskCategory), `default_priority` (TaskPriority), `needs_amount` BOOLEAN, `amount_label` TEXT, `scope` (`order`/`voucher`/`both`), `position`, `is_seed`.
- RLS: admins escrevem/editam; toda a gente autenticada (incluindo Ana viewer) lê — para que o picker funcione no workbench em modo leitura.
- Audit log via trigger `log_task_template_changes()`.
- Seed de 4 templates `is_seed=true`:
  1. `passar_fatura` — "Passar fatura para {nome_cliente} — NIF: {nif}" / administrativo / alta / **needs_amount=true** / amount_label="Valor a faturar" / scope=both
  2. `anexar_comprovativo` — "Anexar comprovativo de pagamento — {nome_cliente}" / administrativo / media / scope=both
  3. `pedir_feedback` — "Pedir feedback a {nome_cliente}" / outros / baixa / scope=order
  4. `avisar_parceiro_comissao` — "Avisar {nome_parceiro} da comissão de {valor_comissao}" / administrativo / media / scope=order

(Maria pediu para retirar "Confirmar dados para envio" do seed original.)

**Tipos — [src/types/tasks.ts](src/types/tasks.ts):**
- `Task` ganha `voucher_id: string | null` e `amount: number | null` (`order_id` já existia).
- Novo `TaskTemplate` interface + `TaskTemplateScope = "order" | "voucher" | "both"` + `TaskTemplateInsert` / `TaskTemplateUpdate`.
- `TASK_TEMPLATE_VARIABLES` exportado — lista das 5 variáveis suportadas com descrição e scope; vai ser mostrada na página de gestão (sessão D) para a Maria saber o que pode escrever.

**Memória nova guardada:** `feedback_valores_euro_direita` — valores em € sempre alinhados à direita em qualquer lista/tabela, nunca inline no texto. Regra universal a partir de agora.

**Preflight tsc + next build limpos.** **Maria: passos manuais:**
1. **Correr [supabase/migrations/052_task_templates_and_voucher_link.sql](supabase/migrations/052_task_templates_and_voucher_link.sql)** no Supabase SQL Editor. Verificar:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('voucher_id','amount');` → 2 linhas.
   - `SELECT count(*) FROM task_templates WHERE is_seed = true;` → 4.
   - `SELECT slug, scope, needs_amount FROM task_templates ORDER BY position;` → 4 linhas na ordem certa.
2. **Push para Vercel** (esta sessão só mexe em schema+tipos — nada visível na UI ainda; build a passar é suficiente).
3. **Sem smoke browser nesta sessão** — UI vem na sessão B.

**Próxima sessão (88-B) — Workbench Preservação:**
- Bloco "Tarefas desta encomenda (N)" no workbench
- Botão "+ nova tarefa" com dropdown de templates (filtrar por `scope IN ('order', 'both')`)
- Função de interpolação de variáveis no cliente
- Mini-diálogo "Qual é o valor a faturar?" para templates com `needs_amount=true`, com opções calculadas a partir do `orders.budget` (30/40/70/100/outro)
- Server action `createTaskFromTemplate` ou expandir `createTaskAction` para aceitar `order_id`/`voucher_id`/`amount`

### Sessão 87 🧹 Dashboard: fora checklist + pill prioridade + reordenar colunas + estúdio lime + admin teal + filtro avatares

Maria via screenshot do Dashboard, em 2 iterações:

**Iteração 1:** (1) checklist pessoal era redundante (filtro "Minhas" do kanban basta); (2) ícone de câmara + roxo no Estúdio confundia-se com o violet das Recolhas no local — "estúdio" para ela é atelier/materiais, não fotografia; (3) o pill "Alta/Média" da prioridade ocupava demasiado espaço no tile; (4) não dava para reordenar as colunas do kanban.

**Iteração 2 (mesma sessão):** (5) o pontinho de prioridade não era explícito — pediu para arranjar outra forma; (6) Admin (zinc) e Outros (stone) eram indistinguíveis; (7) filtro "Todas/Minhas/Feitas" não chegava — quer **avatares dos 3 membros no topo** (multi-select, default todas).

**Decisões pré-implementação (perguntei à Maria):**
- Eliminar checklist por completo do UI — manter tabela `personal_checklist` na BD intacta (defensivo).
- Estúdio → `Palette` + `lime`.
- Prioridade → pontinho colorido + popover (1ª iter) → **pill com abreviatura URG/ALTA/MÉD/BAIXA** + popover (2ª iter, após "não são explícitas").
- Reordenação de colunas com drag-and-drop, persistência em **localStorage** (preferência por browser, não justifica BD).
- Admin → **teal** (era zinc); Outros → stone muito mais claro para separar dos 5 restantes.
- Filtro por membro: **3 avatares** no header (multi-select, default todas); substitui o select "Todas/Minhas". "Feitas" passa a um botão toggle Activas/Concluídas (estado independente).

**Dashboard sem checklist — [page.tsx](src/app/(admin)/page.tsx) e [dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx):**
- Query a `personal_checklist` removida do `Promise.all` da page; props `checklist`/`role` removidos do `DashboardClient`; toast de tarefas-novas-atribuídas + `markTasksSeenAction` mantidos (independentes da checklist).
- Ficheiro [checklist-card.tsx](src/app/(admin)/_components/dashboard/checklist-card.tsx) apagado. `RecentDoneRow` continua a existir (usado por `TasksCard`).
- Tabela e server actions de checklist deixadas intactas — sem migração de drop. Maria pode reverter abrindo o componente novamente se mudar de ideias.

**Cores das colunas — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx) `CATEGORY_META`:**
- Estúdio: `Camera`/purple → **`Palette`/lime** (`border-t-lime-500`, `bg-lime-100`, `text-lime-700`, `from-lime-50/40`, `border-l-lime-400`). Distinto de cyan (presença online) e do violet das recolhas no local.
- Admin: zinc → **teal-600/700** (`border-t-teal-600`, `bg-teal-100`, `text-teal-700`, `from-teal-50/40`, `border-l-teal-500`). Visualmente distinto de cyan (mais frio/azulado) e dos cinzentos.
- Outros: stone-400/600 → **stone-300/500 com tint 30**: borda topo mais fina, ícone mais pálido, fundo praticamente neutro. Coluna "lixeira" fica deliberadamente discreta para o olhar não competir com as 5 categorias com identidade.

**Prioridade — pill compacto com abreviatura + popover — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- 1ª tentativa (rejeitada pela Maria): bola 8px colorida (`PriorityDot`). Demasiado subtil.
- 2ª (aceite): sub-componente `PriorityPill` — pill `h-4 px-1 text-[9px] font-bold` com abreviatura curta (`URG`/`ALTA`/`MÉD`/`BAIXA`) e cores reaproveitadas de `TASK_PRIORITY_COLORS` (coerência com Preservação/Métricas).
- Click no pill abre popover com as 4 prioridades em lista, cada uma com bolinha colorida + label completa.
- `onPointerDown={(e) => e.stopPropagation()}` no trigger e na content para o drag-and-drop dos tiles não capturar o click.
- Modo edição inline **mantém** o `Select` original — há espaço lá.
- 3ª iter: Maria pediu o pill no canto superior direito (era inline à esquerda do título e estava a empurrar/cortar o título em 4 linhas). Resolvido com **`absolute top-1.5 right-1.5 z-10`** + `pr-14` na title row para reservar espaço. Edit/trash icons saíram da title row e foram para a bottom row, ao lado da data (alinhados ao fim com `ml-auto`).

**Filtro por avatares no header — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- State antigo `filter: "todas" | "minhas" | "feitas"` substituído por **dois states** ortogonais:
  - `selectedMembers: string[]` — emails seleccionados (default = todos os 3 TEAM_MEMBERS).
  - `viewDone: boolean` — true mostra concluídas em vez de activas (default false).
- Helper `allMembersSelected` (todos os 3 seleccionados) — neste caso o filtro por responsável **não** se aplica (tarefas sem assignee continuam visíveis). Quando há subset, tarefa só passa se algum dos seus assignees estiver no set; tarefas sem assignee ficam escondidas.
- Header da card: 3 avatares (h-7 w-7) com ring indigo + offset quando activos; quando desactivos ficam `opacity-30 grayscale`. Click alterna. Tooltip por avatar: "Mostrar/Esconder tarefas de Nome".
- Botão "Activas/Concluídas" ao lado dos avatares: variant `default` (preenchido) quando a ver concluídas, `ghost` quando a ver activas. Click alterna `viewDone`.
- Empty state diferencia 4 casos: 0 membros seleccionados, ver concluídas vazias, subset sem resultados, sem tarefas global.

**Reordenação de colunas — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- Novo state `columnOrder: TaskCategory[]` (default = `TASK_CATEGORY_ORDER`). Render usa `columnOrder.map(...)` em vez da constante hardcoded.
- Persistência em `localStorage.fbr.dashboard.tasksColumnOrder.v1`. Leitura faz-se no primeiro `useEffect` (não no initializer) para evitar hydration mismatch — flag `orderHydrated` evita re-escrita prematura. Validação ao ler: filtra categorias inválidas, completa com defaults se faltar alguma (forward-compat com categorias futuras).
- Cabeçalho de cada coluna é agora um `useDraggable` com `id=col:<category>` e `data: { type: "column", category }`. `setNodeRef`/`attributes`/`listeners` aplicados ao header; cursor `grab`/`grabbing`; `select-none touch-none`.
- O `useDroppable` existente em cada coluna (id=category) passa a aceitar **dois tipos de drop**: tasks (mover entre categorias) E columns (reordenar). Branching no `handleDragEnd` por `active.data.current.type`.
- Visual: durante drag de coluna → ring indigo na coluna sob o pointer (distingue do ring cocoa quando se arrasta task). Coluna a ser arrastada fica a 40% opacity. `DragOverlay` mostra mini-cabeçalho com ícone + label.
- `reorderColumn(from, to)`: splice clássico — remove `from` e insere na posição de `to`.

**Preflight tsc + next build limpos.** **Maria: passos manuais:**
1. **Sem migrações** nesta sessão.
2. **Push para Vercel**.
3. **Smoke**:
   - `/` → Dashboard mostra só Afazeres globais (kanban) + Recolhas + Alertas. Sem card "Checklist pessoal".
   - Header da card tem **3 avatares** seguidos do botão "Concluídas" e do "+". Por default todos os avatares activos (ring indigo). Click num avatar → fica grey, e as tarefas onde só essa pessoa é responsável desaparecem.
   - Coluna Estúdio: ícone paleta verde-lima. Coluna Admin: teal. Coluna Outros: cinza muito claro (deliberadamente discreta).
   - Cada tile mostra **pill com abreviatura** (`URG`/`ALTA`/`MÉD`/`BAIXA`) colorida à esquerda do título. Click → popover lista as 4 prioridades; selecionar → muda.
   - Botão "Concluídas" no header → muda toda a kanban para tarefas done; rótulo passa a "Activas" para voltar.
   - Arrastar cabeçalho de uma coluna para cima de outra → trocam de ordem; recarregar página → ordem fica.
   - Continuar a poder arrastar tiles entre colunas.


## Próximo passo CONCRETO

**Sessão 88-D — passos manuais (UI; sem BD):**

1. **Push para Vercel**.
2. **Smoke browser:**
   - Abrir qualquer `/settings/*` → topbar tem agora `Mensagens` (era `Templates`) e nova entrada `Tarefas`.
   - Click `Tarefas` → `/settings/templates-tarefas`. Vê os 4 seeds (Passar fatura, Anexar comprovativo, Pedir feedback, Avisar parceiro) com badge "Seed".
   - Bloco "Variáveis disponíveis" — click num chip → copia para clipboard + toast.
   - Editar um template → diálogo abre com todos os campos. Botões "+ {variável}" no rodapé do título adicionam ao texto.
   - Criar novo template — checkbox "Este template pede valor" mostra/esconde o campo "Etiqueta".
   - Arquivar → some da lista. Toggle "Ver arquivados" → vê-o; restaurar.
   - Workbench Preservação → picker reflecte alterações (template renomeado, arquivados desaparecem).

**Sessão 88-C — passos manuais (UI; precisa mig 052 já corrida):**

1. **Sem migrações** nesta sessão.
2. **Push para Vercel**.
3. **Smoke browser:**
   - **Vale-Presente workbench** (`/vale-presente/[código]`) — topo coluna direita: card "Tarefas" (indigo). "+" → popover só com 2 templates (`passar_fatura` + `anexar_comprovativo` — os de scope `voucher` ou `both`). Click "Passar fatura" → diálogo com **uma** opção "Total (€X)" + manual. Criar.
   - **Dashboard kanban** — tarefas com `order_id` mostram chip indigo `Link2 + ORDERID` no topo do tile; click → abre `/preservacao/[order_id]`. Tarefas com `voucher_id` análogo → `/vale-presente/[code]`.
   - **€ à direita** — tile do kanban mostra `€135,00` na bottom row para tarefas com `amount`. Para todas as outras tarefas (sem amount), bottom row continua igual.

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

**Sessão 87 — passos manuais (só código, sem BD):**

1. **Sem migrações** nesta sessão.
2. **Push para Vercel**.
3. **Smoke**:
   - `/` → Dashboard mostra só Afazeres globais (kanban) + Recolhas + Alertas. Sem card "Checklist pessoal".
   - Header da card: 3 avatares + botão Concluídas + "+". Por default todos avatares activos (ring indigo). Click num → grey, tarefas dessa pessoa somem.
   - Estúdio: Palette + lime. Admin: teal. Outros: stone muito light.
   - Tile: pill com abreviatura (URG/ALTA/MÉD/BAIXA) ao lado do título. Click → popover muda prioridade.
   - "Concluídas" no header → kanban mostra done.
   - Arrastar cabeçalho de coluna → reordena; recarregar → ordem mantém-se.
   - Continuar a poder arrastar tiles entre colunas.

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

## Histórico condensado (sessões 1-86)

### Fase 6 — Integrações + PWA + RGPD (sessões 35-86)
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
