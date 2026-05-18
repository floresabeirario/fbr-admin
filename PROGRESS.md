# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 25) — Preservação: redesenho da célula "Cliente" (nome em linha própria + badges abaixo, evita wrap caótico em colunas estreitas); bolinha de notificação na sidebar ao lado de "Preservação de Flores" para encomendas criadas <24h

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
- 46 migrações aplicadas; smoke test em Playwright (`npm run smoke`)

---

## Sessões recentes (detalhe)

### Sessão 81 🎨 Preservação — fix layout célula "Cliente" + bolinha "novas encomendas" na sidebar

Maria reportou via screenshot: na linha de "Pré-reservas", o nome do cliente "Flores à Beira-Rio" (longo) wrappa em 4 linhas verticais quando combinado com os badges NOVA + Contactada na mesma flex row — visualmente caótico. Também pediu uma bolinha na sidebar ao lado de "Preservação de Flores" sempre que há "uma nova reserva por abrir".

**Fix da célula Cliente — [src/app/(admin)/preservacao/preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) `OrderRow`:**
- Antes: 1ª `<div flex items-center gap-1.5>` continha `<span>{client_name}</span>` + badges (Nova, Vale, Contactada) → o nome wrappava no espaço estreito mas os badges mantinham-se inline, criando "escada vertical".
- Agora: nome em `<span>` próprio com `truncate` + `title={client_name}` (mostra completo no tooltip). Todos os badges (Nova, Vale, Contactada, parada-há-X-dias) descem para a 2ª row alongside `event_type`, num único `<div flex items-center gap-1.5 flex-wrap mt-0.5>`. Cada badge ganhou `shrink-0` para não ser comprimido.
- Resultado: a 1ª linha tem só o nome (truncado se preciso); a 2ª tem o tipo de evento + todos os pills coloridos a wrappar livremente. Funciona com nomes longos, curtos, e qualquer combinação de badges. `OrderCard` (vista cards) já usava `truncate` — não tocado.

**Bolinha na sidebar — novo hook [src/hooks/use-new-orders.ts](src/hooks/use-new-orders.ts):**
- `useNewOrdersCount()` subscreve a `orders` (Realtime INSERT + UPDATE), filtra `deleted_at IS NULL` + `created_at >= now-24h`, devolve a contagem.
- Re-avalia a janela de 24h a cada 5 minutos (interval) — sem isto, uma encomenda criada há 23h59m continuaria a contar para sempre na mesma sessão do browser.
- Mesmo critério que o badge "Nova" do row/card (`differenceInHours < 24`, sessão 79) — coerente.

**[src/app/(admin)/layout.tsx](src/app/(admin)/layout.tsx):**
- Import do hook + `const rawNewOrders = useNewOrdersCount();` + `const newOrders = pathname.startsWith("/preservacao") ? 0 : rawNewOrders;` (esconde quando já estou na página).
- Novo `isPreservacao` + `showOrdersBadge` + extensão de `showBadge`/`badgeValue` para incluir o caso. Mesmo visual sky pill que Chat interno e Dashboard.
- `titleParts` ganha `"N encomenda(s) nova(s) (últimas 24h)"`; `aria-label` actualizado em ambas as renderizações (colapsada e expandida) para o caso `showOrdersBadge`.

**Sem mudanças de schema, sem migrações.** `npm run preflight` (tsc + build) OK. **Maria: push para Vercel → smoke (1) abrir `/preservacao` → a célula Cliente deve mostrar o nome numa linha (com `…` se muito longo) e todos os badges abaixo, alinhados horizontalmente; em qualquer grupo (Pré-reservas, Reservas, etc.); (2) na sidebar, ao lado de "Preservação de Flores" deve aparecer uma bolinha sky com o número de encomendas criadas nas últimas 24h — desaparece quando entras em `/preservacao`; (3) criar uma encomenda nova (manualmente ou via form público) → bolinha deve aparecer/incrementar em tempo real via Realtime.**

---

### Sessão 80 🧰 Fim da dupla contagem de vales + C1 (mig 046) progressivo

Continuação da limpeza pós-análise global (sessão 78). Dois itens da lista de pendentes.

**Dupla contagem de vales** — antes: vale `100_pago + preservacao_nao_agendada` contava para receita ao mesmo tempo que a encomenda nova que o usava, durante a janela em que a Maria não actualizava o vale manualmente. Resultado: faturação sobre-estimada. [src/app/(admin)/preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts):
- Novo helper local `markVoucherAsScheduled(supabase, code)` — UPDATE silencioso e idempotente (`.neq("usage_status", "preservacao_agendada")` evita writes inúteis). Falhas (vale não existe, RLS) loggadas mas não bloqueiam a operação principal.
- `createOrderAction`: depois do INSERT bem sucedido, se `payload.gift_voucher_code` está preenchido, chama o helper + `revalidatePath("/vale-presente")`.
- `updateOrderAction`: `gift_voucher_code` adicionado à condição `needsPrev` e ao SELECT prev; nova variável `voucherToMark` capturada quando o código muda; helper chamado depois do UPDATE + Drive/Calendar triggers.
- **Limitação conhecida**: encomendas criadas via form público (repo `fbr-website`) fazem INSERT directo via PostgREST anon — não passam pelo action, logo não são automaticamente cobertas. Para cobrir esse caso seria preciso um trigger SQL (fica como follow-up).

**C1 — centralizar admins (mig 046, progressivo)** — abordagem A (só BD) com **fallback de segurança**. Maria delegou ("faz como achares melhor mas quero o melhor possível") e eu escolhi conservadora — B (alterar código TS para async) toca em muitos sítios subtis (sidebar, layout, middleware) e tem alto risco de regressão. [supabase/migrations/046_team_members_centralized.sql](supabase/migrations/046_team_members_centralized.sql):
- Tabela `team_members(email PK, name, role CHECK admin|viewer, photo, deleted_at)` com seed dos 3 utilizadores actuais; trigger updated_at + audit_log.
- RLS na própria tabela: admins escrevem (hardcoded — galinha-e-ovo); todos os authenticated lêem.
- **Função `is_team_admin(p_email)` `STABLE SECURITY DEFINER`** — lookup à tabela primeiro; **fallback** para os 2 emails hardcoded se a lookup falhar/devolver nada. GRANT EXECUTE a authenticated + anon.
- **Função `is_team_member(p_email)`** análoga (admin OU viewer).
- **POC progressivo**: só as policies de `orders` foram migradas para usar as funções (`admins_all` + `viewer_select` em [supabase/migrations/038_security_hardening.sql](supabase/migrations/038_security_hardening.sql) DROP + recriadas com `is_team_admin/member`). As policies de `tasks`, `personal_checklist`, `message_templates`, `system_settings`, `chat_messages`, `audit_log` + RPCs `mark_chat_messages_read`/`mark_tasks_seen` continuam com emails hardcoded — migram em sessões futuras se esta correr bem.
- **Código TS continua hardcoded** ([roles.ts](src/lib/auth/roles.ts), [layout.tsx](src/app/(admin)/layout.tsx), [_components/dashboard/team-members.ts](src/app/(admin)/_components/dashboard/team-members.ts)) — não toquei. Mudar utilizadores agora exige: (1) `INSERT INTO team_members` (RLS funciona logo); (2) editar 3 ficheiros TS para o UI (nomes, fotos). Progresso parcial mas seguro.

Preflight `tsc --noEmit` + `next build` limpos. **Maria: (1) Correr [supabase/migrations/046_team_members_centralized.sql](supabase/migrations/046_team_members_centralized.sql) inteiro no Supabase SQL Editor. (2) Correr as queries de verificação no fim do ficheiro — confirmar 3 linhas em team_members, funções devolvem valores correctos. (3) Push para Vercel. (4) Smoke: António edita encomenda → continua a funcionar (passou a usar `is_team_admin` via RLS); Ana abre `/preservacao` → continua a ver mas não a editar; form público de reserva → continua a aceitar submissões. Se algo bloquear inesperadamente, a função tem fallback e ninguém deve ficar bloqueado.**

---

### Sessão 79 🧰 Preservação destaque "Nova"; Finanças grid; cupão único; refactor Dashboard

Após análise global da plataforma (sessão 78), Maria autorizou um lote de quick wins seguros + um refactor mecânico. Trabalhos desta sessão:

**Finanças — grid de tabs (zero risco):** [src/app/(admin)/financas/financas-client.tsx:181](src/app/(admin)/financas/financas-client.tsx#L181) — `grid-cols-2 lg:grid-cols-4` → `grid-cols-2 lg:grid-cols-5`. Antes deixava 1 tab sozinho na 2ª linha; agora as 5 tabs alinham numa linha em desktop. Mobile (2 cols) intocado.

**Cupão único c/ retry — B1 da análise:** [src/lib/coupon.ts](src/lib/coupon.ts) ganhou `generateUniqueCouponCode(supabase, maxAttempts=5)` que valida contra `orders.coupon_code` (UNIQUE) antes de devolver. Resolve futura colisão silenciosa: o INSERT/UPDATE rebentava com `duplicate key (23505)` quando o random batia num código existente — provável com escala. [src/app/(admin)/preservacao/actions.ts:178](src/app/(admin)/preservacao/actions.ts#L178) passa a usar o helper async e é **idempotente** — não gera cupão novo se já existir um (re-passar por `a_ser_emoldurado` não cria duplicado). [src/lib/supabase/orders.ts:85](src/lib/supabase/orders.ts#L85) (`updateOrderStatus`, não usado em runtime mas mantido) também actualizado para consistência. `coupon_expiry` (B2) **adiado a pedido da Maria** — fica `NULL` como hoje.

**Destaque "Nova" — encomenda criada há <24h:** Maria pediu visual fácil para encomendas que nunca abriu. Escolheu abordagem simples (heurística 24h) em vez de coluna `seen_by` por utilizador. [src/app/(admin)/preservacao/preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx):
- Import `differenceInHours` adicionado.
- `OrderRow` (tabela): `isNew = differenceInHours(now, created_at) < 24`. `<tr>` ganha `bg-amber-50/50` quando isNew. Badge "Nova" amber pill junto ao nome do cliente, com tooltip mostrando a data de criação.
- `OrderCard` (vista cards): mesma lógica. Card border passa a `border-amber-300 bg-amber-50/60` quando isNew. Badge "Nova" mais pequeno ao lado do nome.
- O destaque some sozinho ao fim de 24h — todos os utilizadores veem o mesmo (não é por pessoa). Calendário e Timeline intocados (não fazem sentido pelo mesmo critério).

**Refactor Dashboard — C2 da análise:** [src/app/(admin)/dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx) passou de **1051 → 112 linhas** (orquestrador puro). Lógica extraída para 8 ficheiros em `src/app/(admin)/_components/dashboard/`:
- `team-members.ts` (15 linhas) — `TEAM_MEMBERS` + `memberName` helpers
- `format-helpers.ts` (37) — `formatDate`, `formatRelativeDays`, `formatDoneAgo`
- `section-card.tsx` (30) — wrapper visual genérico (header + corpo)
- `recent-done-row.tsx` (50) — linha das concluídas, partilhada entre checklist e tasks
- `pickups-card.tsx` (75) — recolhas e entregas próximas
- `alerts-card.tsx` (48) — alertas
- `checklist-card.tsx` (450) — checklist pessoal + tarefas atribuídas mescladas
- `tasks-card.tsx` (504) — afazeres globais

**Zero mudança visual ou de comportamento** — só código a mover. Mesmo estado interno, mesmos handlers, mesmas RLS, mesmas chamadas a actions. `TEAM_MEMBERS` continua duplicado de `roles.ts` (consolidação fica para C1 — unificar admins numa só tabela — adiada para sessão dedicada).

Preflight `tsc --noEmit` + `next build` limpos. Sem migrações. **Maria: push para Vercel → smoke (1) abrir Finanças → confirmar 5 tabs numa só linha em desktop; (2) abrir Preservação → criar nova encomenda (ou ver as criadas <24h) → confirmar fundo amber + badge "Nova" na tabela; trocar para vista cards → mesmo destaque; (3) abrir Dashboard → tudo deve estar EXACTAMENTE igual ao que estava antes — se notares qualquer diferença visual ou de comportamento, é regressão do refactor.**

---

### Sessão 78 🧰 Dashboard — checkbox + Undo + "Concluídas recentes (10)"; fix baseline Métricas

Maria pediu para repensar o "marcar como feito": a bolinha `Circle` confundia-se com checkbox de selecção múltipla, e queria poder recuperar as últimas 10 tarefas/itens caso clicasse sem querer. Antes, na checklist pessoal as feitas ficavam no fim com strikethrough mas sem botão de reabrir; nas tarefas globais desapareciam por completo (filtro `!t.done`).

**[src/app/(admin)/dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx):**
- Trocados `Circle` / `CheckCircle2` por `Square` / `CheckSquare` (lucide) em ambos os cards — affordance inequívoca de checkbox.
- `handleToggle` (checklist), `handleToggleTask` (tarefa global a partir da lista mesclada) e `handleToggle` (TasksCard) emitem agora `toast.success("Feita: …", { action: { label: "Anular", onClick: revert } })` com `duration: 5000` quando marcam como feita. O `done_at` é optimisticamente preenchido com `new Date().toISOString()` e revertido em caso de erro.
- Novo `MergedItem` `visibleItems` excluí explicitamente `done === true` (antes incluía e ordenava para o fim) — feitas vão para a secção dedicada.
- Novo `recentDone` (checklist+tasks atribuídas) ordenado por `done_at ?? updated_at` desc, top 10.
- Nova secção colapsada "Concluídas recentes (N)" no fim da `ChecklistCard` (chevron + contador), com novo componente `RecentDoneRow` (CheckSquare emerald + strikethrough + "há X min/h/d" + botão "↺ Reabrir" no hover).
- `TasksCard` ganhou versão equivalente: `recentDoneTasks` (respeita filtro "Minhas"), state `showDoneTasks`, helper `reopenTask`. A secção esconde-se quando filtro é "Feitas" (porque aí a lista já é o histórico completo).
- Imports actualizados: `Square`, `CheckSquare`, `ChevronDown`, `RotateCcw` adicionados; `Circle`, `CheckCircle2` removidos.

**[src/lib/metrics.ts](src/lib/metrics.ts) — fix de baselines incorrectas (ponto B da análise):**
- Antes: `revenuePctChange` e `newOrdersPctChange` usavam sempre `previousMonthRange(range)`. Em ranges anuais ou "Últimos N meses", isto comparava com uma janela deslocada apenas 1 mês — sobreposição + percentagens sem significado.
- Novo helper `previousEqualRange(range)`: janela imediatamente anterior com a mesma duração.
- Novo helper `baselineRangeForPreset(preset, range)`: escolhe `previousMonthRange` para presets mensais, `previousYearRange` para anuais, `previousEqualRange` para "Últimos 3/6 meses" e "Personalizado".
- `computeMetrics(..., preset?: RangePreset = "este_mes")` ganha parâmetro opcional `preset` e usa o baseline correcto internamente; variável morta `prevYearRange` removida.
- Caller `metricas-client.tsx` passa `preset` na chamada.

**[src/lib/metrics.ts:528](src/lib/metrics.ts) — fix locale (ponto C da análise):**
- `monthlyRevenue` formatava `MMM yy` com `locale: undefined` (inglês). Trocado para `locale: pt` — eixo do gráfico passa a "jan 26" em vez de "Jan 26".

Preflight `tsc --noEmit` + `next build` limpo. Sem migrações. **Maria: abrir Dashboard → confirmar (1) que os items/tarefas têm agora checkbox quadrado; (2) marcar uma como feita → toast com "Anular" durante 5s — testar o anular; (3) expandir "Concluídas recentes" → ver últimas 10, com botão "Reabrir" no hover; (4) abrir Métricas → trocar preset entre "Este mês", "Últimos 3 meses", "Este ano" → confirmar que as percentagens debaixo dos KPIs fazem sentido (e não 800% ou -∞); (5) gráfico "Receita mensal" mostra "jan 26", "fev 26", etc.**

---

### Sessão 77 🛠️ Preservação — fix drag-and-drop entre grupos (linha snap-back silencioso)

Maria reportou: "arrasto para mover para outro grupo, mas a linha nao fica no outro grupo" — confirmou que conseguia agarrar com o rato, mas a linha voltava para o grupo original. Diagnóstico em [src/app/(admin)/preservacao/preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) revelou 3 problemas combinados que tornavam a falha invisível:

1. **Catch blocks completamente silenciosos** (`catch { // silencioso }` × 3) — qualquer falha do `updateOrderAction` (RLS, schema, rede) era engolida sem feedback.
2. **Collision detection default (`rectIntersection`)** exige que o rect do overlay (card pequeno de ~280px) intersecte o rect do grupo — falha quando se solta perto das margens.
3. **Sem optimistic update** — a linha só se movia depois do `router.refresh()` completar, o que dava a sensação de "snap-back" mesmo quando o update tinha corrido bem.

**Fix em [src/app/(admin)/preservacao/preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx):**
- Import `pointerWithin` + `rectIntersection` + `type CollisionDetection` de `@dnd-kit/core`; import `toast` de `sonner`.
- Nova função `collisionDetection` híbrida: tenta `pointerWithin` primeiro (mais intuitivo — basta o cursor estar dentro do grupo), com `rectIntersection` como fallback. Aplicada via prop `collisionDetection` no `DndContext`.
- Novo state `optimisticMoves: Map<orderId, {status, manually_no_response}>` — override óptico por encomenda. Limpo com `setTimeout` 600ms depois de `router.refresh()` (deixa os dados novos chegar) ou imediatamente em falha.
- Helper `runMove(order, updates, optimisticStatus, optimisticNoResp)` consolida o padrão: aplica optimistic → chama action → refresh + clear; em catch faz `console.error` + `toast.error("Não foi possível mover \"<nome>\". <msg>")`.
- `handleDragEnd` quando `over` é null deixa de ser silencioso: `console.warn` + `toast.info("Larga em cima de um grupo (cabeçalho ou linhas) para mover.")`.
- Cálculo do `grouped` agora aplica overrides ópticos antes de filtrar/agrupar: `ordersWithOptimistic` mescla `initialOrders` com o map; `grouped` reagrupa local quando há pesquisa OU overrides activos.

`tsc --noEmit` + `eslint` limpos. Sem migrações, sem nova tabela. **Maria: push para Vercel + abrir `/preservacao` → arrastar uma encomenda para outro grupo → deve mover-se imediatamente e ficar lá. Se algo falhar, agora vês toast vermelho com o motivo (envia screenshot).**

---

## Próximo passo CONCRETO

**Sessão 81 — passos manuais (UI only, sem migração):**

1. **Push para Vercel** (zero schema, só código).
2. **Smoke (Maria):**
   - Abrir `/preservacao` → linha de qualquer grupo: o nome do cliente deve aparecer numa única linha (truncado com `…` se for muito longo, tooltip mostra completo); todos os badges (Nova/Vale/Contactada/parada-há-X) descem para a linha de baixo, alongside tipo de evento.
   - Na sidebar, ao lado de "Preservação de Flores" → confirmar bolinha sky azul com o número de encomendas criadas nas últimas 24h (mesmo critério do badge "Nova" da tabela). Entrar em `/preservacao` → bolinha desaparece; sair → reaparece.
   - Criar uma encomenda nova (manualmente ou via form público) com browser noutro separador → bolinha aparece/incrementa em tempo real (Realtime).

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

## Histórico condensado (sessões 1-66)

### Fase 6 — Integrações + PWA + RGPD (sessões 35-76)
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
