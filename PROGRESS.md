# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 20) — Finanças/Despesas: descrição como campo principal + fornecedor opcional (texto ou link) + KPI "Total desde sempre"

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
- 44 migrações aplicadas; smoke test em Playwright (`npm run smoke`)

---

## Sessões recentes (detalhe)

### Sessão 76 ✅ Finanças/Despesas — descrição primária + fornecedor opcional (texto ou link) + KPI "Total desde sempre"

Maria pediu: (a) ao inserir despesas, trocar a hierarquia — descrição passa a ser o principal (obrigatório), fornecedor secundário (opcional); (b) o fornecedor pode ser um link OU só texto; (c) a página deve mostrar também o total de despesas desde sempre. Confirmadas todas as 4 opções recomendadas (fornecedor opcional, campo único auto-detect URL, total inclui subscrições acumuladas, aplicar a subscrições também).

**Migração 045 — [supabase/migrations/045_expenses_supplier_optional.sql](supabase/migrations/045_expenses_supplier_optional.sql):**
- `ALTER TABLE expenses ALTER COLUMN supplier DROP NOT NULL`. Regra "descrição obrigatória" é só ao nível do formulário (não bloqueia linhas históricas sem descrição).

**Types — [src/types/expense.ts](src/types/expense.ts):**
- `Expense.supplier: string | null`.
- `ExpenseInsert` agora requer `description: string` (em vez de `supplier`).
- Nova `subscriptionTotalToDate(expense, at)` — calcula total acumulado de uma subscrição desde o início até `at` (ou até `recurrence_end_date` se terminou antes), usando `monthlyEquivalent × meses elapsed` (inclusivo no mês de início).

**Forms + tabelas — [src/app/(admin)/financas/financas-client.tsx](src/app/(admin)/financas/financas-client.tsx):**
- Helper `renderSupplier(s)`: auto-detecta `^https?://` ou `^www\.` → link clicável (sky-700, ExternalLink icon, target=_blank, stopPropagation, truncate 220px); caso contrário texto puro; null/empty → `—`.
- KPIs: grid `sm:grid-cols-2 lg:grid-cols-4` (de 3 para 4). Novo KPI **"Total desde sempre"** (emerald) = `sum(unicas.amount) + sum(subscriptionTotalToDate(sub, now))`.
- Form despesas únicas: Input **Descrição** no lugar do antigo "Fornecedor" (autoFocus, required). Input **Fornecedor (opcional)** no lugar do antigo Textarea descrição, com hint "texto ou link".
- Form subscrições: mesmo padrão — `<label>Descrição *</label>` no topo (autoFocus, ex.: "Vercel Pro, Adobe CC"); Input Fornecedor opcional substitui o Textarea de notas no fim.
- ExpenseRow: ordem das colunas trocada — `Data | Descrição | Categoria | Fornecedor (xl+) | Valor | …`. Em ecrãs <xl, fornecedor mostra-se por baixo da descrição (`xl:hidden`) para não desaparecer. Descrição com fallback `(sem descrição)` italic quando null.
- SubscriptionRow: igual — `Estado | Descrição | Categoria | …`, fornecedor inline por baixo se existir.
- Pesquisa: placeholder "Pesquisar descrição ou fornecedor…", agora inclui ambos os campos no filtro.
- Import `Textarea` mantido (ainda usado no `InvoiceCell`).

**Actions — [src/app/(admin)/financas/actions.ts](src/app/(admin)/financas/actions.ts):**
- `uploadExpenseInvoiceAction` selecciona também `description`; usa-a como fallback para o nome do ficheiro no Drive quando `supplier` é null (`folderLabel = supplier || description || "sem-fornecedor"`).

`tsc --noEmit` + `next build` limpos (preflight OK).

**Maria: passos manuais:**
1. Correr **migração 045** no Supabase SQL Editor → verificar: `SELECT is_nullable FROM information_schema.columns WHERE table_name='expenses' AND column_name='supplier';` → `YES`
2. Push para Vercel
3. Smoke: abrir `/financas` → ver 4 KPIs em vez de 3 (último = "Total desde sempre"). Criar nova despesa única: preencher só descrição + valor (sem fornecedor) → deve registar. Criar despesa com fornecedor `https://amazon.es/produto` → na tabela aparece clicável. Mesmo na sub-aba "Subscrições".
4. Confirmar que despesas antigas (que tinham só supplier sem description) continuam a aparecer com `(sem descrição)` em italic + supplier por baixo.

---

### Sessão 75 ✅ Tarefas multi-assignee (Opção A) + checklist mescla tarefas + notificações

Maria pediu: (a) ao atribuir uma tarefa global a alguém, essa tarefa deve aparecer na checklist pessoal dessa pessoa; (b) poder atribuir uma tarefa a duas pessoas — Opção A escolhida: qualquer assignee marca como feita = some para todos; (c) sistema de notificações quando me atribuem tarefa — bolinha na sidebar + toast ao abrir a plataforma. Push notifications guardadas para futuro.

**Migração 044 — [supabase/migrations/044_tasks_multi_assignee_and_seen.sql](supabase/migrations/044_tasks_multi_assignee_and_seen.sql):**
- `tasks.assignee_email TEXT` → `tasks.assignee_emails TEXT[] NOT NULL DEFAULT '{}'` com backfill (`assignee_email` único → array de 1). Coluna antiga removida (sem backwards-compat — Vercel deploya tudo de uma vez). Índice GIN para membership rápida.
- `tasks.seen_by TEXT[] NOT NULL DEFAULT '{}'` — emails que já viram a atribuição. Tarefas pré-existentes ficam pré-marcadas como `seen_by = assignee_emails` (não fazer a Maria ver tarefas antigas como "novas").
- RPC `mark_tasks_seen(uuid[])` SECURITY DEFINER — só consegue acrescentar o email do JWT ao `seen_by` e só se o user for assignee. Mesmo padrão da `mark_chat_messages_read` (mig 043).

**Types + actions — [src/types/tasks.ts](src/types/tasks.ts) + [src/app/(admin)/actions.ts](src/app/(admin)/actions.ts):**
- `Task.assignee_emails: string[]` + `Task.seen_by: string[]`.
- Nova `markTasksSeenAction(taskIds)` chama a RPC.

**Hook + sidebar — [src/hooks/use-unread-tasks.ts](src/hooks/use-unread-tasks.ts) + [src/app/(admin)/layout.tsx](src/app/(admin)/layout.tsx):**
- `useUnreadTasks(email)` faz `SELECT id, title, assignee_emails, seen_by, done, deleted_at` (limit 500, `done=false`) e subscreve INSERT/UPDATE no canal `tasks-unread`. Devolve `{count, tasks}`.
- Bolinha sky no item Dashboard (igual à do Chat interno): em colapsado mostra no canto do ícone, em expandido à direita do label. Esconde quando `pathname === "/"`.
- Lógica `showBadge / badgeValue / badgeLabel` unificada entre chat e tarefas para evitar duplicação.

**Dashboard — [src/app/(admin)/dashboard-client.tsx](src/app/(admin)/dashboard-client.tsx):**
- `useEffect` ao montar: filtra `initialTasks` por unseen (assignee + !done + !seen_by), mostra toast (sonner) com título da primeira tarefa + "(+N)", chama `markTasksSeenAction` server-side. Ref `seenOnMount.current` impede re-execução. Não actualiza estado local — viola ESLint `react-hooks/set-state-in-effect` ([[feedback_react_set_state_in_effect]]); próximo SSR vem com `seen_by` actualizado.
- **ChecklistCard** mescla `personal_checklist` do owner + `tasks` onde `viewingEmail ∈ assignee_emails && !done`. Tarefas têm badge violet "Global" + prioridade + prazo + chip `+N Users` quando partilhada. Toggle de tarefa chama `updateTaskAction({done: true})` — qualquer assignee pode (Opção A).
- **TasksCard** new task form: row de 3 avatares clicáveis (António/MJ/Ana) com ring violet quando activos + contador "1 responsável" / "2 responsáveis (partilhada)". Substitui o Select dropdown anterior.
- **TasksCard** per-row: 3 mini-avatares (h-5) em vez do Select de assignee — clicar adiciona/remove. `toggleAssignee` ajusta `seen_by` (remove emails que já não são assignees).

`tsc --noEmit` + `next build` + `eslint` limpos.

**Maria: passos manuais:**
1. Correr **migração 044** no Supabase SQL Editor → verificar: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('assignee_emails','seen_by');` → 2 linhas ARRAY
2. Push para Vercel
3. Smoke: abrir `/` → ver checklist pessoal com tarefas atribuídas (badge "Global"). Criar nova tarefa: clicar 2 avatares (ex. MJ + António) → criar → ver "2 responsáveis (partilhada)" e tarefa na checklist de ambos. Login como MJ → ver bolinha sky no Dashboard + toast "Tens 1 tarefa nova: 'X'". Voltar à página `/` → bolinha desaparece. Marcar tarefa como feita pela MJ → António deixa de a ver.
4. Login como **Ana** (viewer) → confirma que continua a editar tarefas (a Ana tem permissão Dashboard).

---

### Sessão 74 🛠️ Tabela Preservação — remover botão "Sem resposta" (drag-and-drop chega) + fix pill "100% por pagar" no workbench

Maria reparou dois problemas: (a) no workbench, o pill **Pagamento "100% por pagar"** estava a sair pela borda direita do card Finanças; (b) na tabela, os badges da célula de acções estavam sobrepostos. Tentativa inicial de realocar larguras das colunas + `flex-wrap` foi rejeitada pela Maria — "está terrível, preferia como estava dantes". Pediu também para remover o botão **Sem resposta**, que não é necessário (já consegue arrastar para o grupo "Sem resposta" via drag-and-drop).

**Fix table — [src/app/(admin)/preservacao/preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx)**:
- Larguras do colgroup [linhas 609-619](src/app/(admin)/preservacao/preservacao-client.tsx#L609-L619): **restauradas ao original** (Cliente 16%, Estado 16%, Pagamento 14%, Acções 6%, etc.).
- Célula de acções [linha 481](src/app/(admin)/preservacao/preservacao-client.tsx#L481): voltou a `flex items-center justify-end gap-2` (sem `flex-wrap`).
- **Botão "Sem resposta" removido** (e função `moveToSemResposta` órfã removida; import de `Clock` removido). Restam na célula: "Marcar contactada" (quando pré-reserva por contactar) + "Voltar para Pré-reservas" (quando manualmente marcada como sem-resposta) + ExternalLink. O grupo "Sem resposta" continua a existir — Maria move para lá por drag-and-drop.
- `PaymentSelect` mantém o `max-w-full` adicionado [linha 216](src/app/(admin)/preservacao/preservacao-client.tsx#L216) — rede de segurança caso a célula transborde.

**Fix workbench — [src/app/(admin)/preservacao/[id]/workbench-client.tsx:1661](src/app/(admin)/preservacao/[id]/workbench-client.tsx#L1661)**:
- `SelectTrigger` do Pagamento passa a `w-full max-w-full` — pill respeita a largura da coluna `3fr` do grid `2fr_3fr` em vez de transbordar; `line-clamp-1` já existente no trigger base trunca se necessário.

`tsc --noEmit` limpo. Sem migrações. **Maria: abrir /preservacao para confirmar que o layout está igual ao original (Cliente não quebra, colunas alinhadas) e que o botão "Sem resposta" desapareceu da célula de acções; abrir um workbench com pagamento "100% por pagar" e confirmar que o pill já não sai da borda direita do card Finanças.**

---

### Sessão 73 🎨 Tabela Preservação — "Em mãos" sky → emerald (contraste com violet)

Maria reparou que na coluna **Envio das flores** da tabela, os ícones de "Em mãos" (sky) e "Recolha no local" (violet) eram demasiado parecidos a olho — ambos pasteis cool de saturação média. Descobriu-se também que havia inconsistência: os badges no workbench e os gráficos de Métricas já usavam **emerald** para `maos` (via `FLOWER_DELIVERY_METHOD_COLORS`), só os ícones da tabela e do calendário usavam sky.

Alinhei tudo em **emerald** (verde) para `maos`, mantendo violet para `recolha_evento`:
- [src/app/(admin)/preservacao/preservacao-client.tsx:90](src/app/(admin)/preservacao/preservacao-client.tsx#L90) — `SHIPPING_METHOD_ICON_COLORS.maos`: `text-sky-600` → `text-emerald-600`; comentário em [linha 78](src/app/(admin)/preservacao/preservacao-client.tsx#L78) actualizado.
- [src/app/(admin)/preservacao/calendar-view.tsx:72](src/app/(admin)/preservacao/calendar-view.tsx#L72) — `deliveryBadge` case `maos`: `text-sky-600` → `text-emerald-600`.
- [src/app/(admin)/preservacao/calendar-view.tsx:225](src/app/(admin)/preservacao/calendar-view.tsx#L225) — legenda compacta da vista Semana: ícone Hand sky → emerald.

Convenção final em todo o app para método de envio das flores: **maos = emerald, ctt = amber/sky, recolha_evento = violet, nao_sei = stone**. `tsc --noEmit` limpo. **Maria: abrir /preservacao e confirmar que verde + violeta se distinguem bem na coluna Envio.**

---

### Sessão 72 📊 Métricas — 5 gráficos novos com cores alinhadas aos badges

Maria pediu mais gráficos e exigiu que as cores **estivessem uniformizadas** com o resto da app. Acrescentei 5 visualizações novas a [src/app/(admin)/metricas/metricas-client.tsx](src/app/(admin)/metricas/metricas-client.tsx), todas com paletas semânticas espelhadas dos badges em [types/database.ts](src/types/database.ts):

**Cálculos novos em [src/lib/metrics.ts](src/lib/metrics.ts)** (`computeMetrics` → `MetricsResult`):
- `flowerDeliveryDist` — distribuição de `FlowerDeliveryMethod`.
- `frameDeliveryDist` — distribuição de `FrameDeliveryMethod`.
- `contactPrefDist` — WhatsApp vs Email.
- `couponUsageDist` — só conta encomendas onde `coupon_status !== "na"` (cupão já emitido).
- `upsellsBreakdown` — para os 3 upsells (`extra_small_frames`, `christmas_ornaments`, `necklace_pendants`) conta `"sim"` e `"mais_info"` separadamente.

**UI**:
- Nova fila de 3 donuts "Logística & comunicação": Método de envio das flores (ícone Car violet) / Método de receção do quadro (Package sky) / Preferência de contacto (MessageCircle emerald).
- Nova fila de 2 cards: Utilização de cupões 5% (donut, Ticket amber) + Interesse em upsells (stacked bar horizontal "Sim" emerald + "Mais info" amber, Sparkle emerald).
- `PieDist` ganhou prop opcional `fills?: string[]` — array pré-mapeado por índice — para usar cor por chave em vez da paleta sequencial. As callers das 3 fileiras antigas (Tamanho/Fundo/Evento) continuam com `palette`.

**Paletas semânticas** (constantes no topo de `metricas-client.tsx`, alinhadas com Tailwind dos badges):
- `FLOWER_DELIVERY_HEX`: emerald/sky/violet/stone (idêntico a `FLOWER_DELIVERY_METHOD_COLORS`).
- `FRAME_DELIVERY_HEX`: emerald/sky/stone.
- `CONTACT_PREF_HEX`: emerald (WhatsApp — alinhado com `partners.ts` linha 167 e tab WhatsApp no workbench) / sky (email).
- `COUPON_STATUS_HEX`: emerald/amber/stone (idêntico a `COUPON_STATUS_COLORS`).
- `UPSELL_HEX`: sim=emerald, maisInfo=amber.

`tsc --noEmit` limpo. **Maria: abrir /metricas e verificar os 5 novos cards.**

---

### Sessão 71 🎨 Coerência visual — "Recolha no local" = 🚗 Car + violet em toda a app

Maria reparou que "recolha no local" aparecia incoerente: ora vermelho, ora verde, com `Truck` (carrinha) ou `Car`. Decisão: **sempre `Car` + violet**. Como `envio_ctt_quadro` já estava violet em Entregas e Recolhas, mudou para **rose** (alusivo ao vermelho CTT mas sem ar de urgência).

Ficheiros tocados:
- [src/lib/dashboard.ts:97-101](src/lib/dashboard.ts#L97-L101) — `PICKUP_KIND_COLORS`: recolha emerald → violet; CTT quadro violet → rose.
- [src/app/(admin)/entregas-recolhas/entregas-recolhas-client.tsx:84-91](src/app/(admin)/entregas-recolhas/entregas-recolhas-client.tsx#L84-L91) — `KIND_COLORS` idem; chips de filtro (linhas 327-350) alinhados.
- [src/app/(admin)/preservacao/calendar-view.tsx](src/app/(admin)/preservacao/calendar-view.tsx) — `deliveryBadge` agora devolve `Car` violet; legenda do calendário idem; `Truck` removido do import.
- [src/app/(admin)/preservacao/preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) — `SHIPPING_METHOD_ICONS.recolha_evento`: Truck → Car; cor rose → violet; `Truck` removido do import.

`types/database.ts` (`FLOWER_DELIVERY_METHOD_COLORS`) já estava violet — nada mudou aí. `lib/google/calendar.ts` usa emoji 🚗 (já carro) — nada a fazer. `logistics-map.tsx` colore marcadores por proximidade de data, não por tipo — nada a fazer.

Smoke: `tsc --noEmit` limpo. **Maria: verificar manualmente** a página Entregas e Recolhas, a vista Calendário da Preservação, a coluna "Envio" da tabela de Preservação e o card "Recolhas e entregas" do Dashboard.

---

## Próximo passo CONCRETO

**Sessão 75 — passos manuais para activar tarefas multi-assignee + notificações:**

1. **Correr migração 044** no Supabase SQL Editor:
   - Cola [supabase/migrations/044_tasks_multi_assignee_and_seen.sql](supabase/migrations/044_tasks_multi_assignee_and_seen.sql) → Run
   - Verifica: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('assignee_emails','seen_by');` → 2 linhas, ambas `ARRAY`
   - Verifica que `assignee_email` (singular) já não existe: `SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='assignee_email';` → 0 linhas
   - Confirma backfill: `SELECT count(*) FROM tasks WHERE cardinality(assignee_emails) > 0;` → mesmo nº que tinhas com responsável antes
2. **Push para Vercel** — afecta apenas o Dashboard (`/`) e a sidebar global.
3. **Testes em produção:**
   - Abrir `/` (Dashboard) → ver checklist pessoal com itens antigos. Se tiveres alguma tarefa atribuída a ti, deve aparecer também (badge violet "Global").
   - **Criar tarefa partilhada**: + → escrever título → clicar 2 avatares (ex: MJ + António) → ver "2 responsáveis (partilhada)" → Criar.
   - Confirmar que a nova tarefa aparece na checklist pessoal de quem criou (se for assignee) E nos "Afazeres globais" com 2 avatares com ring violet.
   - **Login como MJ** (outro browser/incognito) → no Dashboard ver toast "Tens 1 tarefa nova: 'X'" + bolinha sky no item Dashboard quando estiveres noutra página. Voltar a `/` → bolinha desaparece.
   - **Opção A — completação partilhada**: MJ marca tarefa como ✓ → recarregar como António → a tarefa desapareceu da sua checklist e dos Afazeres globais (filtrado por !done).
   - **Editar assignees** numa tarefa existente: clicar nos mini-avatares (h-5) por baixo do título → adicionar/remover. Tirar o último → "Sem responsável".
   - **Filtro "Minhas"** continua a funcionar (agora com `.includes()`).
4. **Smoke da Ana (viewer)**: login como Ana → / → ver as suas tarefas + checklist + criar/editar tarefas globais. Confirmar bolinha + toast quando lhe atribuírem tarefa.

---

**Sessão 65 — passos manuais para activar o registo manual de WhatsApp:**

1. **Correr migração 042** no Supabase SQL Editor:
   - Cola o ficheiro [supabase/migrations/042_whatsapp_log.sql](supabase/migrations/042_whatsapp_log.sql) → Run
   - Verifica: `SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='whatsapp_log';` → 1 linha
2. Push para Vercel (rota afectada: `/preservacao/[id]`)
3. **Testes a fazer em produção:**
   - Abrir uma encomenda → Card "Comunicações" → tab **WhatsApp** → ver "Sem registos. Adiciona manualmente abaixo, ou importa…".
   - **Adicionar entrada manual**: toggle "Enviámos" → escrever "Teste 1" → Adicionar → ver bolha verde à direita com hora actual.
   - Toggle "Recebemos" → escrever "Teste 2" → Adicionar → ver bolha cream à esquerda.
   - **Editar** uma bolha → mudar texto/direcção/data → Guardar → confirmar.
   - **Apagar** uma bolha → confirmar → desaparece.
   - **Importar**: clicar "Importar" → cola o conteúdo de qualquer ficheiro `.txt` da pasta [public/conversas whatsapp/](public/conversas%20whatsapp/) → manter "Acrescentar" → "Flores à Beira Rio" como nosso nome → Importar.
     - Toast deve dizer ex: "Importadas 65 mensagens (1 de sistema ignorada)."
     - Bolhas aparecem cronologicamente, separadores de dia entre datas diferentes, direcção correcta (a "Flores à Beira Rio" sempre à direita, cliente à esquerda).
   - Testar **screenshot**: clicar ícone "Screenshot" no composer → colar URL Drive → Adicionar → bolha mostra "📎 Anexo 1" clicável.
   - **Limpar tudo**: botão "Limpar" → confirmar → log vazio.
4. **Smoke da Ana (viewer)**: login como Ana → abrir encomenda → tab WhatsApp → confirma que **vê** as mensagens mas **não tem** botões de Adicionar / Importar / Editar / Apagar (canEdit=false).

**Sessão 64 — passos manuais para activar os templates de mensagens:**

1. **Correr migração 041** no Supabase SQL Editor:
   - Abre Supabase Dashboard → SQL Editor → New query → cola o ficheiro [supabase/migrations/041_message_templates.sql](supabase/migrations/041_message_templates.sql) inteiro → Run
   - Verifica: `SELECT count(*) FROM message_templates WHERE is_seed=true;` → deve dar **29**
   - Verifica: `SELECT key, value FROM system_settings ORDER BY key;` → deve mostrar 7 chaves (account_holder, iban, bic, bank_name, mbway, studio_address_url, studio_address_text)
2. Push para Vercel (rotas novas: `/settings/templates`)
3. **Testes a fazer em produção (smoke):**
   - Abrir **Sistema → Templates** → ver lista de 29 templates agrupados por categoria. Filtrar por idioma EN → só ver os EN. Pesquisar "pré-reserva" → só os 4 que têm o nome.
   - Abrir um template → editar uma palavra no corpo → Guardar → reabrir → ver alteração persistida.
   - **Sub-tab "Dados de pagamento e morada"** → confirmar que os 5 campos de pagamento estão preenchidos com os valores certos (MB Way 935 896 353, IBAN PT50…, BIC CGDIPTPL, etc.). Mudar uma morada → Guardar → recarregar a página → ver persistido.
   - Abrir **/preservacao/<encomenda-actual>** → no Card "Comunicações" há um botão "Inserir template". Clicar → ver lista com **Sugeridos para esta fase** no topo (conforme estado da encomenda).
   - Escolher um template sugerido → ver mensagem renderizada com `{nome}` substituído pelo nome do cliente, `{valor_sinal}` calculado a 30% do total, `{data_evento_extenso}` em português, `{dados_pagamento}` no bloco PT (MB Way+IBAN).
   - Confirmar saudação muda conforme hora: abrir antes das 12h → "Bom dia"; depois das 12h → "Boa tarde"; depois das 19h → "Boa noite".
   - Clicar **Copiar para clipboard** → ver toast "💐" → colar no WhatsApp → confirmar texto íntegro.
   - Editar **uma palavra antes de copiar** → confirmar que a edição vai para o clipboard.
   - Testar **um template EN** numa encomenda com `form_language=en` → confirmar bloco de pagamento internacional (Account Holder + IBAN + BIC + Banco) e que NÃO inclui convite para chamada.
   - Abrir **/vale-presente/<código>** → confirmar botão "Inserir template" na coluna esquerda; templates de vale aparecem (vale-presente category).
4. **Smoke da Ana (viewer)**: login com Ana → /settings/templates → confirma que **NÃO consegue** abrir esta página (admin-only via `redirect("/")`). Mas no workbench Preservação, o picker de templates deve estar **visível e funcional** (a Ana só lê os templates).

**Sessão 63 — passos manuais para activar os healthchecks automáticos:**

Sem migrações novas. Push do código actual para Vercel. Para o cron funcionar, **3 env vars novas** no Vercel (Settings → Environment Variables):

1. **`SUPABASE_SERVICE_ROLE_KEY`** (Production + Preview)
   - Onde ir buscar: Supabase Dashboard → Settings → API → "Project API keys" → secção `service_role` (não confundir com `anon`). **NUNCA expor isto no client** — só servidor.
2. **`CRON_SECRET`** (Production)
   - Gerar string aleatória: ex. `openssl rand -hex 32` ou usar 1Password. 64+ caracteres.
   - O Vercel Cron envia automaticamente este valor como `Authorization: Bearer ...` quando dispara o job em produção.
3. **`RESEND_API_KEY`** (Production) — opcional mas recomendado
   - Resend.com → API Keys → Create. Adicionar e verificar o domínio `floresabeirario.pt` para conseguir enviar do `healthcheck@floresabeirario.pt`.
   - Sem isto, o cron continua a correr e devolve JSON com os problemas, mas não envia email.
4. (Opcional) **`RESEND_FROM_EMAIL`** = `"FBR Healthcheck <healthcheck@floresabeirario.pt>"` e **`RESEND_ALERT_TO`** = `"info@floresabeirario.pt"` se quiseres customizar.

**Smoke tests:**
- Em produção: `curl -H "Authorization: Bearer $CRON_SECRET" https://admin.floresabeirario.pt/api/cron/healthcheck` → JSON com sumário.
- Em dev local: abrir `http://localhost:3000/api/cron/healthcheck` no browser (sem secret em dev) → mesma resposta.
- Abrir `/healthchecks` no admin → ver as novas linhas para `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` na secção "Config".
- Abrir `/preservacao/<encomenda-antiga>` → confirmar badge âmbar "parada há X dias" se passaram ≥14 dias desde a última edição.
- Voltar à listagem `/preservacao` → confirmar pequeno texto cinza/âmbar "parada há X dias" debaixo do tipo de evento nas encomendas estagnadas.

**Outras notas:**
- Smoke do laptop 13" / iPad confirmar que tabelas (Preservação, Finanças, Status, Parcerias, Vale-Presente) já não pedem scroll horizontal.
- No chat em mobile: tocar 😀 → escolher emoji → confirmar que aparece no input no cursor; teclado não tapa o composer.

**Sessões 58+59 — passos manuais da Maria (segurança):**
1. Correr **mig 038 + mig 039** no Supabase SQL Editor (por esta ordem)
2. Confirmar que ambas dizem "Success. No rows returned"
3. Verificações rápidas (queries no fim de cada migração):
   - **038**: `SELECT column_name FROM information_schema.column_privileges WHERE table_name='vouchers' AND grantee='anon' ORDER BY column_name;` → só 10 colunas: amount, code, created_at, deleted_at, expiry_date, id, message, payment_status, recipient_name, sender_name
   - **039**: `SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_name='audit_log' AND grantee='anon';` → nenhuma linha INSERT
   - **039**: `SELECT * FROM get_voucher_by_code('XXXXXX');` (substituir XXXXXX por um código real) → deve devolver o vale
4. Push para Vercel (`next.config.ts` + `supabase/migrations/038_*.sql` + `supabase/migrations/039_*.sql` + `PROGRESS.md`)
5. Smoke test pós-deploy:
   - Login como **Ana** (viewer): tentar abrir `/preservacao` → deve funcionar (read-only). Editar uma encomenda na UI → deve dar erro "Sem permissão" (ou o input deve estar disabled).
   - Login como **António/MJ** (admin): tudo deve continuar a funcionar normalmente; gravar uma encomenda deve gerar uma entrada nova no audit log (Settings → Audit).
   - Abrir `voucher.floresabeirario.pt` com um código válido → deve continuar a mostrar o vale (se partir, falta-me uma coluna no GRANT — diz-me qual e adiciono).
   - Abrir `status.floresabeirario.pt/?id=<order_id>` → deve continuar a mostrar o estado.
   - Form público de Reserva e Vale (no `fbr-website`): submeter um teste → deve aparecer no admin com audit log.
6. Verificar headers HTTP em produção: abrir DevTools → Network → ver Response Headers de qualquer request → deve mostrar `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Permissions-Policy`, `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'`

**Sessão 61 — passos manuais (continuação):**

1. **Supabase Dashboard → Auth → Policies** (quick wins, 2 min):
   - Password policy: mínimo 12 chars + requer letras maiúsculas + números + símbolos
   - Session timeout (JWT expiry): reduzir de 1 semana para 1 dia (86400 s)
   - "Prevent use of leaked passwords": **ON**
2. **Correr mig 040** no Supabase SQL Editor (depois de já ter corrido 038+039)
   - Verificar: `SELECT polname FROM pg_policy WHERE polrelid='vouchers'::regclass AND 'anon'::regrole=ANY(polroles)` → só deve mostrar `vouchers_public_insert` + `vouchers_public_select_recent`
3. **Substituir ficheiros no repo `fbr-website`** (no GitHub `floresabeirario/fbr-website`, branch `develop`):
   - **Novo**: `app/_components/TurnstileWidget.jsx`
   - **Modificado**: `app/reservar-preservacao/ReservarPreservacaoForm.jsx`
   - **Modificado**: `app/vale-presente/ValeApresenteForm.jsx`
   - Os 3 ficheiros estão em `c:\Users\maria\Documents\fbr-website\fbr-website\app\…`
4. **Vercel do `fbr-website`** — adicionar 2 env vars (Site Key + Secret Key do Turnstile que já criámos para o admin; podem ser as mesmas se adicionares o hostname `floresabeirario.pt` no widget Cloudflare):
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Site Key (público)
   - `TURNSTILE_SECRET` = Secret Key (privado)
   - Force redeploy
5. **Testar em incognito**: `floresabeirario.pt/reservar-preservacao` e `floresabeirario.pt/vale-presente` → widget Turnstile aparece antes do botão "Submeter", botão fica disabled até completar, e submissão chega ao admin.

**Sessão 60 — activar CAPTCHA Turnstile no admin (5 passos, ~10 min):**
1. **Cloudflare Dashboard** → Turnstile → "Add Site"
   - Site name: `FBR Admin`
   - Domain: `admin.floresabeirario.pt` (e `localhost` se quiseres testar local)
   - Widget Mode: **Managed** (recomendado — Cloudflare decide quando mostrar challenge)
   - Pre-clearance: No
   - Copiar **Site Key** (público) e **Secret Key** (privado)
2. **Supabase Dashboard** → Authentication → Settings → "Bot and Abuse Protection" → enable CAPTCHA → escolher **Turnstile** → colar Secret Key → Save
3. **Vercel** → Project Settings → Environment Variables → adicionar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Site Key (escope: Production + Preview + Development)
4. **Forçar redeploy** Vercel (Settings → Deployments → … → Redeploy) — env vars não auto-redeployam
5. Testar em browser **incognito** (cache fresca): abrir `admin.floresabeirario.pt` → escolher perfil → ver widget Turnstile aparecer → completar → entrar. Tentar com password errada → widget reseta sozinho.

**Para mais tarde:**
- **MFA/2FA** Supabase Auth (Maria pediu para deixar para depois)
- **CSP completa** (script-src, style-src, etc.) — precisa testes para não partir Google Maps/OAuth
- **Turnstile** aos forms públicos do `fbr-website` (outro repo) — pode partilhar o mesmo site key
- **Migrar voucher.floresabeirario.pt para usar a RPC** `get_voucher_by_code` (mig 039) e depois revogar `SELECT (code) ON vouchers FROM anon`

**Sessão 57 — passos manuais da Maria:**
1. Push para Vercel (build local passa)
2. No telemóvel, **desinstalar primeiro** o atalho actual do ecrã principal (caso contrário o Android pode continuar a mostrar o ícone antigo em cache)
3. Abrir `admin.floresabeirario.pt` no Chrome Android → menu → "Adicionar ao ecrã principal" → confirmar que aparece o ícone com as 3 flores em fundo cocoa (já não transparente)
4. Confirmar em iOS: Safari → Partilhar → "Adicionar ao Ecrã Principal" → ícone com fundo cocoa
5. Abrir várias páginas no telemóvel para verificar mobile:
   - **Nova encomenda** (sheet em Preservação): inputs Email/Telemóvel passam a estar empilhados em vez de espremidos lado-a-lado
   - **Workbench de uma encomenda**: campos como "Custo flores" e "Pago?" empilham em vez de ficarem com 165px cada
   - **Novo parceiro** (sheet em Parcerias): Categoria/Estado empilham
   - Tabelas continuam com scroll horizontal (esperado — desktop é prioridade)
6. **Crítico**: testar em desktop (≥1024px) que **nada mudou** — todos os forms 2-col continuam 2-col

**Sessões 52-55 — passos manuais da Maria** (cumulativo se ainda não correu nada desde 52):
1. Correr **migrações 034, 035, 036 e 037** no Supabase SQL Editor (por ordem)
2. Push para Vercel
3. Em Finanças → "Tabela de preços", definir o preço do suplemento `extra.pyramid_frame` (cliente paga a mais pela pirâmide)
4. (Opcional) Confirmar custo de impressão de fotografia para mini 20x25
5. Smoke test:
   - **Slide**: setas ◀ ▶ no header + setas teclado ← → + contador "12/47"
   - **Custos**: € visível, "Vidro"/"Cartão" nos cabeçalhos, 8 consumíveis aparecem com valores correctos
   - **Consumíveis**: lixeira remove; clicar label permite renomear; "Adicionar" cria com 0€ × 3 tamanhos
   - **Pirâmide**: workbench → Sim sobe orçamento; badge de custo no card Finanças mostra margem
   - **Encomenda antiga**: botão "Capturar custos de produção" → passa a mostrar custo+margem
   - **Hotfix 54**: abrir `/preservacao/<qualquer-encomenda>` → carrega normalmente (sem React #185)
   - **Sessão 55**: numa encomenda com método "Recolha no local" preencher contacto (Nome + Telemóvel) no workbench; criar/forçar evento Calendar → confirmar 🚗 + 💐 no título, data por extenso, link no ID que abre workbench, caixa verde na página Entregas e Recolhas. Fazer refresh da página → botão "No Calendar" deve abrir directamente o evento (mesmo em encomendas antigas, via `computeEventHtmlLink`).
6. (Opcional) Activar smoke test local: `npm i -D playwright && npx playwright install chromium` + `SMOKE_EMAIL`/`SMOKE_PASSWORD` em `.env.local`

---

## Histórico condensado (sessões 1-66)

### Fase 6 — Integrações + PWA + RGPD (sessões 35-70)
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
