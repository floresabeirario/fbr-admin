# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 30) — Sessão 87: Dashboard sem **Checklist pessoal** + **prioridade em pill com abreviatura** (URG/ALTA/MÉD/BAIXA) com popover; **reordenação de colunas** via drag; Estúdio → **Palette + lime**; Admin → **teal** (era zinc, indistinguível do stone do Outros); **filtro por avatares** (3 fotos no header, multi-select, default todas)

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

### Sessão 86 🎨 Kanban refinado + drag-and-drop invisível + título/detalhes editáveis (mig 051)

Maria iterou na sessão 85: (1) o botão "↔" para mover entre colunas era ruidoso e desnecessário — quer DnD invisível; (2) as pills coloridas das categorias eram indistinguíveis das outras pills da app; (3) cada task (global E pessoal) precisa de título + detalhes; (4) tem que dar para editar items da checklist pessoal.

**Migração 051 — [supabase/migrations/051_checklist_description.sql](supabase/migrations/051_checklist_description.sql):**
- `ALTER TABLE personal_checklist ADD COLUMN IF NOT EXISTS description TEXT;`
- Tasks já tinham `description` desde a mig 012; agora a checklist pessoal tem paridade.

**Tipo — [src/types/tasks.ts](src/types/tasks.ts):** `ChecklistItem.description: string | null`.

**Identidade visual nova por categoria — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- `CATEGORY_META` map com ícone (lucide) + cor de barra superior + tom subtil de fundo + accent da borda esquerda do tile. Combinação distintiva:
  - Packaging → `Package` + orange-500 barra
  - Flores → `Flower2` + pink-500
  - Presença online → `Globe` + cyan-500
  - Estúdio → `Camera` + purple-500
  - Administrativo → `FileText` + zinc-500
  - Outros → `MoreHorizontal` + stone-400
- Cabeçalho da coluna: barra colorida 3px no topo + ícone num quadradinho com tint da categoria + label semibold + contador. **Zero pills.**
- Tile: borda esquerda 3px na cor da categoria (sinal subtil de identidade).

**Drag-and-drop (sem botão visível) — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- `DndContext` + `useDraggable` em cada tile + `useDroppable` em cada coluna. PointerSensor com `distance: 6` para não capturar cliques nos pills/checkbox.
- Cada elemento interactivo do tile (checkbox, avatares, Select, edit/delete) tem `onPointerDown={(e) => e.stopPropagation()}` para não disparar drag.
- `DragOverlay` mostra mini-card do título+detalhes durante o drag. Coluna destino ganha `ring-2 ring-cocoa-400` quando o pointer está em cima; placeholder muda de "—" para "Largar aqui" se vazia.
- Drop em coluna diferente → `handleCategoryChange` é chamado (mesmo path do antigo botão "↔"). Drop na própria coluna é no-op.
- Botão "↔" **removido**.

**Título + detalhes — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx) e [checklist-card.tsx](src/app/(admin)/_components/dashboard/checklist-card.tsx):**
- Tile do kanban: título em font-medium + `description` por baixo em text-cocoa-600 text-[11px] `whitespace-pre-wrap` (preserva quebras de linha).
- Checklist pessoal: paridade — text em font-medium + description abaixo. Aplica-se também às tarefas mostradas na checklist pessoal (vista mesclada).
- Form de criação ganha `Textarea` "Detalhes (opcional)" entre o título e os selects.

**Modo edição inline — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx) e [checklist-card.tsx](src/app/(admin)/_components/dashboard/checklist-card.tsx):**
- Estado `editingId: string | null` no card.
- Ícone Pencil aparece na hover dos tiles (afazeres globais) e dos items da checklist pessoal (a par do botão de apagar).
- Click em Pencil → tile/row substituído por sub-componente `TaskEditForm` / `ChecklistEditForm`: Input para título + Textarea para detalhes + Select prioridade + Input date + botões Check (guardar) / X (cancelar).
- Save: optimistic update local + `updateTaskAction` / `updateChecklistItemAction`. Validação básica — título não pode ficar vazio.

**Dashboard layout — [dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx):** sem mudanças relativas à sessão 85 (TasksCard full-width no topo, restantes 3 cards na grelha 2×2 abaixo).

Preflight `tsc --noEmit` + `next build` limpos. **Maria: passos manuais:**
1. **Correr migrações 050 e 051** (se 050 ainda não foi). Verificar:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='personal_checklist' AND column_name='description';` → 1 linha.
   - `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='category';` → 1 linha.
2. **Push para Vercel**.
3. **Smoke**:
   - `/` → afazeres globais com 6 colunas, cada uma com **ícone único** + barra colorida no topo.
   - Hover num tile → aparecem ícones de Pencil (editar) e Trash. Click no Pencil → tile transforma-se em formulário com título/detalhes/prioridade/data + ✓/✗ no canto.
   - Criar tarefa nova → o form agora tem campo "Detalhes (opcional)".
   - Arrastar um tile para outra coluna → muda de categoria. Drop na mesma coluna não faz nada.
   - Checklist pessoal: mesmo Pencil em cada item; descrição nova editável; tarefas atribuídas a mim mostram também description quando preenchida.

### Sessão 85 🗂️ Afazeres globais — kanban por categoria (mig 050 + layout full-width)

Maria pediu para agrupar visualmente os afazeres globais por categorias. Sugeriu 5 (packaging / flores / presença online / estúdio / outros); propus adicionar "administrativo" (fatura/NIF/contabilidade) para que "Outros" não se torne lixeira. Total: 6 categorias.

1ª iteração foi com agrupamento vertical (cabeçalhos colapsáveis). Maria pediu para passar a **colunas (kanban)**. Optei por full-width no Dashboard porque 6 colunas em meio-ecrã ficavam ~110px e ilegíveis.

**Migração 050 — [supabase/migrations/050_tasks_category.sql](supabase/migrations/050_tasks_category.sql):**
- `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'outros' CHECK (...)`.
- Index parcial `tasks_category_idx` sobre tarefas vivas e não feitas.
- Default `'outros'` garante backfill imediato e seguro e que inserts pré-migração continuam a funcionar.

**Tipo — [src/types/tasks.ts](src/types/tasks.ts):**
- `TaskCategory`: `packaging | flores | presenca_online | estudio | administrativo | outros`.
- `Task.category: TaskCategory` (obrigatório, default da BD).
- Constantes `TASK_CATEGORY_LABELS` (PT), `TASK_CATEGORY_COLORS` (amber/rose/sky/violet/slate/stone — distintas de prioridades), `TASK_CATEGORY_ORDER`.

**Layout Dashboard — [dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx):**
- TasksCard sai da grelha 2×2 e passa a ocupar **linha inteira** no topo do Dashboard.
- Por baixo: 2×2 com Checklist + Pickups na 1ª linha e Alerts na 2ª (com 1 célula livre — `items-start` evita stretch).

**UI kanban — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- Form de criação: grid 3 colunas (categoria + prioridade + data). Default `outros`.
- Lista renderiza **grelha `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`** com 6 colunas estáveis (sempre visíveis, mesmo vazias — placeholder "—"). Empty columns servem como destino para mover.
- Cada coluna é uma "raia" com fundo `cream-50/50` e cabeçalho fixo (badge categoria + contador). Body com `max-h-[440px]` + `overflow-y-auto` por coluna (scroll independente).
- Tile compacto por tarefa: checkbox + título + Apagar (hover); linha de 3 avatares pequenos (h-4); linha de pills (prioridade + botão "↔" para mover + data se houver). Botão "↔" abre Select que move a tarefa entre colunas (substitui o pill da categoria do tile — redundante porque a coluna já mostra).
- Filtro Todas/Minhas/Feitas continua a funcionar — aplica-se **antes** do agrupamento.
- `recentDoneTasks` mantém-se flat no fundo da card.

Preflight `tsc --noEmit` + `next build` limpos. **Maria: passos manuais:**
1. **Correr [supabase/migrations/050_tasks_category.sql](supabase/migrations/050_tasks_category.sql)** no Supabase SQL Editor. Verificar:
   - `SELECT column_name, column_default FROM information_schema.columns WHERE table_name='tasks' AND column_name='category';` → 1 linha, default `'outros'`.
   - `SELECT category, count(*) FROM tasks WHERE deleted_at IS NULL GROUP BY category;` → todas em `outros`.
2. **Push para Vercel**.
3. **Smoke**:
   - `/` → afazeres globais ocupa toda a largura por cima do Checklist/Pickups/Alerts.
   - 6 colunas visíveis em `lg:` (2 em mobile, 3 em sm); coluna "Outros" tem as tarefas existentes; restantes têm "—".
   - "+": form com 3 colunas (categoria + prioridade + data). Criar tarefa em "Packaging" → tile aparece na coluna amber.
   - No tile, clicar no botão "↔" → abre Select com 6 categorias → tarefa muda de coluna imediatamente.
   - Verificar em telemóvel: 2 colunas + scroll vertical.

### Sessão 84 🟠 Vermelho ≠ "evento próximo" — passa a âmbar; vermelho só para passados; esconder após flores_recebidas

Maria via screenshots (Timeline + Tabela): eventos a 5 dias estavam marcados a vermelho com ⚠ ("5d") mesmo sem terem acontecido. Causava ansiedade — o vermelho parece alarme de "perdeste/falhaste algo". Em 2ª iteração pediu também: (1) esconder o alerta a partir de `flores_recebidas` ou `flores_na_prensa` (já temos as flores, a data do evento deixa de ser sinal de acção); (2) âmbar mal se distinguia do cream — bump da saturação + trocar ícone para algo mais visível.

**Mudança transversal — 3 cortes lógicos:**
1. Substituí o flag único `urgentEvent` (≤5 dias && ≥0) por **`overdueEvent`** (`daysAway < 0`) e **`soonEvent`** (`0 ≤ daysAway ≤ 5`).
2. Helper novo em [src/app/(admin)/preservacao/_styles.ts](src/app/(admin)/preservacao/_styles.ts): `isEventAlertRelevant(status)` — `true` só para `entrega_flores_agendar | entrega_agendada | flores_enviadas`. A partir de `flores_recebidas` devolve `false` e ambos os flags ficam falsos.
3. Cores e ícone: vermelho mantém `AlertTriangle` + `há Xd`. Âmbar sobe de `bg-amber-50/border-amber-200/text-amber-800` para **`bg-amber-200 border-amber-400 text-amber-900 font-bold`** + ícone `Clock` (escolhido entre Clock/Timer/Bell — não bate com nenhum `STATUS_ICONS`).

Ficheiros tocados:
- [src/app/(admin)/preservacao/_styles.ts](src/app/(admin)/preservacao/_styles.ts) — `EVENT_ALERT_RELEVANT_SET` + `isEventAlertRelevant`.
- [src/app/(admin)/preservacao/timeline-view.tsx](src/app/(admin)/preservacao/timeline-view.tsx) — pill de data lateral (passados em stone separado de overdue em red) + badge inline com `Clock`.
- [src/app/(admin)/preservacao/preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) — `OrderRow` usa `currentStatus` (respeita optimistic), `OrderCard` usa `order.status`. Célula `DATA EVENTO` da tabela com Clock inline.
- [src/app/(admin)/preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx) — banner topo, border+bg do Input `Data do evento`, texto relativo abaixo.

Mantém a spec do CLAUDE.md ("Diferenciação visual quando faltam ≤5 dias para data do evento") — continua a haver diferenciação para os estados em que ainda há acção a tomar; nos restantes a data do evento é metadado e fica neutra. Preflight OK.

### Sessão 83 🎨 Dashboard — paridade checklist↔afazeres + indigo + cards não esticam (mig 049)

Maria via screenshot do Dashboard: (1) checklist pessoal estava esquisitamente alta (estava a esticar à altura da card de afazeres globais); (2) checklist pessoal devia ter histórico igual ao global (já existia mas só visível quando há concluídas — Maria confirmou que basta isso); (3) `+1` (Users icon) nas tarefas partilhadas não diz quem é; (4) pill "Global" em cada tarefa é ruído; (5) violet das afazeres globais bate com violet das recolhas; (6) form "Nova tarefa pessoal" devia ter o mesmo visual da global (sem assign).

**Migração 049 — [supabase/migrations/049_checklist_priority_due_date.sql](supabase/migrations/049_checklist_priority_due_date.sql):**
- `ALTER TABLE personal_checklist ADD COLUMN priority TEXT NOT NULL DEFAULT 'media' CHECK (...)` + `due_date DATE`.
- Index parcial `personal_checklist_due_date_idx` para ordenar por prazo.
- Não há assignee — `owner_email` já manda; é checklist pessoal por construção.

**Type — [src/types/tasks.ts](src/types/tasks.ts):** `ChecklistItem` ganha `priority: TaskPriority` + `due_date: string | null`. `ChecklistItemInsert` mantém só `owner_email + text` como obrigatórios; os defaults da BD tratam do resto.

**Refactor [checklist-card.tsx](src/app/(admin)/_components/dashboard/checklist-card.tsx):**
- Form de criação saiu do fundo (sempre visível) e passou a header com "+". Toggle com `showNew` state. Form expandido tem `<Input title>` + grid de `<Select priority>` + `<Input type=date>` — igual ao tasks-card mas **sem** avatares de assignee.
- `createChecklistItemAction` passa a receber `priority + due_date`.
- Items de checklist pessoal mostram pill de prioridade (cor por `TASK_PRIORITY_COLORS`) + badge de data com ícone calendar (rose se overdue, slate se futura) — paridade com tasks na lista mesclada.
- Sort da lista mesclada compara `due_date` (item ou task) primeiro e prioridade depois — não só prioridade de tasks como antes.
- Avatares partilhados: substituído o ícone `Users + "+N"` por uma fila de bolinhas pequenas (h-4 w-4) com foto de cada team member partilhado. Tooltip por avatar + tooltip do contentor.
- Pill "Global" **removida** (era ruído visual). A diferença visual entre checklist e task na lista mesclada agora é a cor do checkbox: `text-[#C4A882]` (mesma da checklist) para checklist; `text-indigo-500` para task (subtil mas presente).
- Empty state ajustado para "Carrega em + para criar um item" (já não há input no fundo).
- Recent done mantém-se como estava — só aparece quando N > 0 (Maria confirmou na pergunta 3).

**Cor afazeres globais — [tasks-card.tsx](src/app/(admin)/_components/dashboard/tasks-card.tsx):**
- `iconColor: "text-violet-600"` → `"text-indigo-600"`.
- Ring dos avatares no form de criação: `ring-violet-600` → `ring-indigo-600`.
- Ring dos avatares assignee inline em cada task: `ring-violet-600` → `ring-indigo-600`.
- Não toquei nos `TASK_PRIORITY_COLORS` (esses são pills de prioridade, não da card).

**Cards não esticam — [dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx):**
- Grid 2×2 (`grid-cols-1 lg:grid-cols-2 gap-6`) ganhou `items-start`. Antes cada cell esticava à altura da linha (default `align-items: stretch`), o que fazia a checklist pessoal vazia parecer enorme. Agora cada card sizing por conteúdo; ainda há gap visual entre rows mas é só o `gap-6`. O `SectionCard` continua `flex flex-col` + body `flex-1 min-h-0` para suportar o "Concluídas recentes" no fundo quando há.

Preflight `tsc --noEmit` + `next build` limpo (warning preexistente do Google Sans fallback, sem relação). **Maria: passos manuais:**
1. **Correr [supabase/migrations/049_checklist_priority_due_date.sql](supabase/migrations/049_checklist_priority_due_date.sql)** no Supabase SQL Editor. Verificar com:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='personal_checklist' AND column_name IN ('priority','due_date');` → 2 linhas.
2. **Push para Vercel**.
3. **Smoke**:
   - Abrir `/` → checklist pessoal já não estica à altura da card de afazeres (se uma das colunas tiver pouco conteúdo, ficam alturas diferentes, lado a lado).
   - Carregar no "+" do header da checklist pessoal → form expande com input + prioridade + data + Cancelar/Criar (sem avatares de assign).
   - Criar item: aparece na lista com pill de prioridade e (se preenchida) badge de data.
   - Afazeres globais: ícone agora é indigo (azul escuro), os avatares activos no form e nas linhas têm ring indigo. As recolhas mantêm-se violet — já não há confusão.
   - Tarefa global atribuída a 2+ pessoas: na checklist pessoal aparece com avatares pequenos das pessoas com quem é partilhada (em vez de "+1"). Pill "Global" deixou de existir.

---

### Sessão 82 🔐 Mig 048 — trigger SQL fecha caminho do form público (anti-dupla-contagem)

Maria perguntou o que era "trigger SQL" (mencionei como follow-up na sessão 80). Expliquei + ela autorizou ("faz o que achares melhor, sê ponderado, considera o que pode correr mal").

**Contexto:** Na sessão 80, o helper TS `markVoucherAsScheduled` foi adicionado a `createOrderAction` e `updateOrderAction` para auto-marcar `vouchers.usage_status = 'preservacao_agendada'` quando uma encomenda usa um código de vale (anti-dupla-contagem na faturação). Mas isso cobria só o caminho do admin — encomendas vindas do form público (PostgREST anon directo) não passavam pelo action e portanto o vale continuava "preservacao_nao_agendada", duplicando.

**Migração 048 — [supabase/migrations/048_auto_mark_voucher_trigger.sql](supabase/migrations/048_auto_mark_voucher_trigger.sql):**
- Função `auto_mark_voucher_used()` `SECURITY DEFINER` (bypassa RLS de vouchers). Faz `UPDATE vouchers SET usage_status='preservacao_agendada', updated_at=now() WHERE code=NEW.gift_voucher_code AND deleted_at IS NULL AND usage_status <> 'preservacao_agendada'`.
- **EXCEPTION WHEN OTHERS** envolto à volta do UPDATE — se algo falhar (RLS, FK, qualquer coisa), `RAISE NOTICE` para os logs do Postgres mas **NUNCA bloqueia** o INSERT/UPDATE em orders. Encomenda nunca falha por causa do trigger.
- Trigger `orders_auto_mark_voucher_insert` AFTER INSERT, com `WHEN (NEW.gift_voucher_code IS NOT NULL AND TRIM(...) <> '')` — só dispara se a linha vier com código preenchido.
- Trigger `orders_auto_mark_voucher_update` AFTER UPDATE OF gift_voucher_code, com `WHEN (NEW IS DISTINCT FROM OLD AND NEW IS NOT NULL AND TRIM(...) <> '')` — só dispara quando a coluna específica muda E o novo valor é válido. Evita disparar em todos os saves da Maria.
- Idempotente: `WHERE usage_status <> 'preservacao_agendada'` evita writes inúteis (e ciclos).

**Sem alterações no código TS** — o helper `markVoucherAsScheduled` da sessão 80 fica como está. "Belt and suspenders": dois caminhos (TS + trigger) cobrem todos os fluxos, ambos idempotentes, sem risco de duplicação. O helper TS ainda tem valor próprio: faz `revalidatePath("/vale-presente")` (refresh imediato no admin) que o trigger não consegue.

Preflight `tsc --noEmit` limpo (nada em TS mudou). **Maria: passos manuais:**
1. Correr [supabase/migrations/048_auto_mark_voucher_trigger.sql](supabase/migrations/048_auto_mark_voucher_trigger.sql) no Supabase SQL Editor.
2. Correr os 5 smoke tests que estão em comentário no fim do ficheiro (substituir `XXXXXX` por um código real). O importante é confirmar (a) INSERT com código válido marca o vale; (b) INSERT com código inválido não bloqueia a encomenda; (c) UPDATE noutra coluna NÃO dispara o trigger.
3. Sem push para Vercel (esta sessão é só BD).

---

### Sessão 81 🎨 Preservação — célula "Cliente" + notificações per-user (mig 047 orders.seen_by)

Dois pedidos da Maria via screenshot:
1. Na linha de "Pré-reservas", o nome do cliente "Flores à Beira-Rio" wrappa em 4 linhas verticais quando combinado com os badges NOVA + Contactada na mesma flex row.
2. Bolinha de notificação na sidebar ao lado de "Preservação de Flores" para encomendas por abrir; depois de uma 1ª iteração com heurística "criada <24h global", Maria pediu **per-user** ("tipo mensagem lida/não lida"): a bolinha some assim que **esse** utilizador abrir o workbench. Também: tirar o fundo amber da linha (já há badge na tabela) e mudar a cor do badge "Nova" — agora sky em vez de amber, para não competir com o amber dos badges "Recolha no local" (warning).

**Fix da célula Cliente — [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) `OrderRow`:**
- Antes: 1ª `<div flex items-center gap-1.5>` continha `<span>{client_name}</span>` + badges (Nova, Vale, Contactada) → o nome wrappava no espaço estreito e os badges mantinham-se inline, criando "escada vertical".
- Agora: nome em `<span>` próprio com `truncate` + tooltip. Todos os badges (Nova, Vale, Contactada, parada-há-X-dias) descem para a 2ª row alongside `event_type`, num único `<div flex items-center gap-1.5 flex-wrap mt-0.5>`. Cada badge ganhou `shrink-0`.

**Migração 047 — [supabase/migrations/047_orders_seen_by.sql](supabase/migrations/047_orders_seen_by.sql):**
- `ALTER TABLE orders ADD COLUMN seen_by TEXT[] NOT NULL DEFAULT '{}'`.
- Backfill: todas as encomendas existentes ficam marcadas como vistas pelos 3 utilizadores conhecidos (António/MJ/Ana). Sem isto, no 1º login depois da migração apareceriam 24 encomendas "novas" — não é o objectivo.
- Nova RPC `mark_order_seen(p_order_id uuid)` SECURITY DEFINER (mesmo padrão que `mark_tasks_seen` da mig 044): valida que `auth.jwt() ->> 'email'` está na lista de 3 emails permitidos, faz `array_append(seen_by, user_email)` só quando ainda não lá está. GRANT a `authenticated` (Ana inclusive — viewer também precisa de marcar "lida" para si).

**Hook + sidebar — [src/hooks/use-new-orders.ts](src/hooks/use-new-orders.ts):**
- Renomeado para `useUnreadOrdersCount(currentEmail)`. Subscreve `orders` (Realtime INSERT/UPDATE), select `id, seen_by, deleted_at`, filtra `!seen_by.includes(currentEmail)`. Per-user.
- [layout.tsx](src/app/(admin)/layout.tsx): hook chamado com `profile?.email`; bolinha esconde quando `pathname.startsWith("/preservacao")`. `titleParts` agora diz "N encomenda(s) por abrir" (já não "últimas 24h").

**Marcar como visto ao abrir workbench — [preservacao/[id]/page.tsx](src/app/(admin)/preservacao/[id]/page.tsx):**
- Nova server action `markOrderSeenAction(id)` em [preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts) — usa `requireUser` (não `requireAdmin`, para Ana funcionar) + `supabase.rpc("mark_order_seen", { p_order_id: id })`. Silencioso em falha — abrir o workbench nunca pode falhar por causa disto.
- Chamado fire-and-forget (`void markOrderSeenAction(order.id)`) imediatamente depois do load da encomenda. Idempotente a partir da 2ª visita (a RPC verifica `NOT user_email = ANY(seen_by)`).

**Cores + isNew per-user — [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx):**
- `Order` type ganha `seen_by: string[]` em [types/database.ts](src/types/database.ts).
- `isNew = !!currentEmail && !(order.seen_by ?? []).includes(currentEmail)` em ambos OrderRow e OrderCard.
- `<tr>` perde a classe `bg-amber-50/50 hover:bg-amber-50` (só ficamos com `hover:bg-cream-50` neutro). Card perde `border-amber-300 bg-amber-50/60 hover:border-amber-400`.
- Badge "Nova" passa de `bg-amber-100 border-amber-300 text-amber-800` para `bg-sky-100 border-sky-300 text-sky-800` (tabela e cards). Tooltip mudado de "Criada há <24h" para "Ainda não abriste esta encomenda". Import `differenceInHours` removido (já não usado).
- `PreservacaoClient`/`GroupSection`/`CardGroup` ganham prop `currentEmail` (vem do page.tsx via `getCurrentEmail()`); cascateia para `OrderRow` e `OrderCard`.

`npm run preflight` (tsc + build) OK. **Maria: passos manuais:**
1. **Correr [supabase/migrations/047_orders_seen_by.sql](supabase/migrations/047_orders_seen_by.sql)** no Supabase SQL Editor. Verificar:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='seen_by';` → 1 linha
   - `SELECT count(*) FILTER (WHERE cardinality(seen_by) = 0) FROM orders;` → 0 (todas as encomendas existentes marcadas como vistas)
2. **Push para Vercel**.
3. **Smoke**:
   - Abrir `/preservacao` → nenhuma encomenda existente deve mostrar badge "Nova" (porque o backfill marcou todas como vistas por ti). Linha sem fundo amber; nome na linha 1, badges na linha 2.
   - Criar uma encomenda nova manualmente → na sidebar aparece bolinha sky `1` ao lado de "Preservação de Flores"; na tabela a linha tem badge "Nova" sky junto ao tipo de evento. Entrar em `/preservacao` → bolinha some (estou na lista). Abrir o workbench da encomenda nova → ao voltar, o badge "Nova" some para mim (mas o António ainda vê).
   - Smoke com 2 navegadores/utilizadores: António cria encomenda → ambos veem badge "Nova" e bolinha; António abre workbench → para o António some; para a MJ continua até ela abrir.

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

---

## Próximo passo CONCRETO

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

## Histórico condensado (sessões 1-66)

### Fase 6 — Integrações + PWA + RGPD (sessões 35-79)
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
