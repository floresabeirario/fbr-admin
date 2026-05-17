# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 14) — Healthchecks sem email + bolinha colorida na sidebar

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
- 42 migrações aplicadas; smoke test em Playwright (`npm run smoke`)

---

## Sessões recentes (detalhe)

### Sessão 67 💬 Comunicações — tab default por preferência + scroll WhatsApp ao fundo

Dois ajustes UX no card "Comunicações" do workbench Preservação:

**1. Tab default segue `contact_preference`** ([src/app/(admin)/preservacao/[id]/workbench-client.tsx:926](src/app/(admin)/preservacao/[id]/workbench-client.tsx#L926)) — `<Tabs defaultValue={local.contact_preference === "whatsapp" ? "whatsapp" : "email"}>`. Se o cliente escolheu WhatsApp como contacto preferido no formulário, abre direto na tab WhatsApp; caso contrário (email ou null) abre em Email.

**2. WhatsApp log abre no fim** ([src/components/whatsapp-log.tsx](src/components/whatsapp-log.tsx)) — adicionado `scrollRef` no container `max-h-[420px] overflow-y-auto` e `useEffect` que faz `el.scrollTop = el.scrollHeight` quando `sorted.length` muda. As mensagens continuam ordenadas asc (antigas em cima, novas em baixo, como WhatsApp), mas agora o scroll começa no fundo a mostrar as mais recentes; scroll para cima revela as antigas. Antes começava no topo.

Preflight OK. Sem migrações.

---

### Sessão 66 🚦 Healthchecks deixam de enviar email — bolinha colorida na sidebar

Maria recebeu o email diário do cron `🚨 FBR Admin — 14 erro(s) no healthcheck diário` (com 14 tabelas a reportar "Erro:" vazio) e pediu para parar os emails e em vez disso ter um indicador visual na aba Sistema: 🟢 OK / 🟡 avisos / 🔴 erros.

**1. Cron deixa de enviar emails** ([src/app/api/cron/healthcheck/route.ts](src/app/api/cron/healthcheck/route.ts)) — removida toda a função `sendAlertEmail` e dependência implícita do Resend. O cron continua a correr 1×/dia às 07:00 (Vercel Cron, `vercel.json`) mas agora **escreve o resumo em `system_settings`** (chave `healthcheck_status`) em vez de enviar email. Resposta JSON inclui `{ ran_at, total, ok, warnings, errors, info, problems[], persisted }`.

**2. Helper partilhado** ([src/lib/healthcheck-cache.ts](src/lib/healthcheck-cache.ts)):
- `HEALTHCHECK_STATUS_KEY = "healthcheck_status"` — chave em `system_settings`.
- `summariseHealthchecks(checks)` — produz `{ ran_at, total, ok, warnings, errors, info, problems: [{id, label, status, details}] }`.
- `overallStatus(summary)` — devolve `"ok"|"warning"|"error"` (erro > aviso > ok).
- Tipo `HealthcheckSummary` reutilizado pelo endpoint de leitura.

**3. Novo endpoint de leitura** ([src/app/api/healthcheck-status/route.ts](src/app/api/healthcheck-status/route.ts)) — `GET /api/healthcheck-status`, admin-only (403 para viewer). Lê `system_settings` via cliente authenticated (não admin client), parseia o JSON guardado, devolve `{ summary }` ou `{ summary: null }` se ainda não correu.

**4. Bolinha na sidebar** ([src/app/(admin)/layout.tsx](src/app/(admin)/layout.tsx)):
- `useEffect` fetcha `/api/healthcheck-status` quando o profile é admin (re-fetch ao mudar de path para apanhar updates).
- Quando o item da nav é "Sistema" e há summary, mostra:
  - **Expandido**: bolinha 2×2 px à direita do label (`ml-auto`).
  - **Colapsado**: bolinha sobre o ícone (`absolute -top-0.5 -right-0.5`) com `ring-2 ring-surface` para destacar.
- Cor: `bg-emerald-500` (ok) / `bg-amber-500` (warning) / `bg-rose-500` (error).
- Tooltip via `title`: `"X erros · Y avisos · verificado dd/MM HH:mm"`.

**5. Melhor reporting de erros** ([src/lib/healthchecks.ts](src/lib/healthchecks.ts)):
- Loop das tabelas agora apanha excepções com `try/catch` e devolve mensagem stringificada.
- Quando `error.message` está vazia (que era o caso no email das 14 tabelas), mostra `"Erro sem mensagem (code=X) — provável problema de rede ou env vars"` em vez de só `"Erro:"`.
- Isto não _resolve_ a causa do email (cron a falhar a ler todas as tabelas) — mas dá visibilidade na próxima vez. **Pendência**: investigar porque é que o cron com `createAdminClient()` está a falhar em prod (suspeito de NEXT_PUBLIC_SUPABASE_URL malformado ou timeout no edge runtime).

**Validação:** `npm run preflight` (tsc + next build) passa. `/api/healthcheck-status` aparece no manifest das rotas.

### Sessão 65 💬 Fase B — Registo manual de WhatsApp no workbench

Maria disse "avança" depois da Fase A (templates). Continuação directa da sessão 64. Fase B do plano de comunicações: UI no workbench para registar conversas WhatsApp manualmente (sem API oficial). Suporta: adicionar mensagens uma a uma, importar conversa inteira exportada do WhatsApp Web, editar/apagar entradas, anexar screenshots (URLs Drive).

**1. Migração 042** ([supabase/migrations/042_whatsapp_log.sql](supabase/migrations/042_whatsapp_log.sql)):
- `ALTER TABLE orders ADD COLUMN whatsapp_log JSONB NOT NULL DEFAULT '[]'`
- Cada entrada: `{ id, timestamp, direction: 'sent'|'received', content, screenshot_urls[] }`
- Sem nova tabela — herda RLS de `orders` (admins escrevem; Ana lê). Sem audit trigger novo (a auditoria de `orders` já apanha alterações da coluna toda — vai ficar verboso mas é coerente; aceitável para v1).

**2. Tipos** ([src/types/whatsapp.ts](src/types/whatsapp.ts)): `WhatsAppEntry`, `WhatsAppDirection`. Adicionado `whatsapp_log: WhatsAppEntry[]` ao tipo `Order` em [database.ts](src/types/database.ts).

**3. Parser do export WhatsApp** ([src/lib/whatsapp-import.ts](src/lib/whatsapp-import.ts)):
- `parseWhatsAppExport(rawText, ourName="Flores à Beira Rio") → { entries, systemFiltered, unparsedLines }`
- Regex: `^(\d{2}/\d{2}/\d{2,4}),\s+(\d{2}:\d{2})\s+-\s+(.*)$` — formato PT do WhatsApp Web (ex: `27/04/26, 11:31 - Carla Santos: Olá`).
- Multi-linha: linhas sem timestamp são appended à mensagem anterior.
- Filtra mensagens de sistema ("As mensagens são encriptadas", "Afixou uma mensagem", "criou o grupo", etc.) via lista de regex.
- Limpa marcadores inertes: `<Esta mensagem foi editada>`, `<Ficheiro não revelado>`.
- Distingue direcção pelo nome: `author === ourName` → `sent`; outro → `received`.
- IDs UUIDv4 gerados localmente (não precisa de FK; chave única dentro do array).

**4. Server actions** ([src/app/(admin)/preservacao/whatsapp-actions.ts](src/app/(admin)/preservacao/whatsapp-actions.ts)) — todas com `requireAdmin()`:
- `addWhatsAppEntryAction(orderId, entry)`, `updateWhatsAppEntryAction(orderId, entryId, patch)`, `deleteWhatsAppEntryAction(orderId, entryId)`, `clearWhatsAppLogAction(orderId)`.
- `importWhatsAppExportAction(orderId, rawText, mode="append"|"replace", ourName?)` — parseia + append/replace + retorna `{ entries, imported, systemFiltered, unparsedLines }` para feedback.
- Helper `saveLog` ordena cronologicamente antes de gravar; `revalidatePath` na route da encomenda.

**5. Componente UI** ([src/components/whatsapp-log.tsx](src/components/whatsapp-log.tsx)):
- **Lista**: scroll vertical (max-h 420px), bolhas estilo WhatsApp — enviadas à direita (verde-claro), recebidas à esquerda (cream). Separadores de dia ("Quarta-feira, 27 de Abril de 2026") quando muda o dia. Hora ao fundo de cada bolha. Hover (desktop) ou sempre visível (mobile) com 2 botões: Editar e Apagar.
- **Composer** (em baixo): toggle "Enviámos / Recebemos", textarea 2 linhas, botão para mostrar campo de URL de screenshot, atalho Ctrl/Cmd+Enter envia, botão "Adicionar".
- **Importar**: dialog grande com info ("WhatsApp Web → menu ⋮ → Mais → Exportar conversa → Sem multimédia"), toggle Acrescentar/Substituir, campo "Nosso nome no WhatsApp" (default "Flores à Beira Rio"), textarea para o texto integral. Toast com sumário de quantas foram importadas + system filtradas + linhas não reconhecidas.
- **Limpar tudo**: AlertDialog com confirmação dupla.
- **Editar**: dialog com direcção (toggle), datetime-local, conteúdo (textarea), URL screenshot.

**6. Integração no workbench Preservação** ([preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/%5Bid%5D/workbench-client.tsx)):
- Substituído o `PlaceholderBox` no tab "WhatsApp" do Card "Comunicações" pelo componente `<WhatsAppLog orderId={local.id} initialEntries={local.whatsapp_log ?? []} canEdit={canEdit} />`.
- Continua a coexistir com o tab "Email" (que mantém placeholder até implementarmos Gmail API — Fase C+).

**Decisões / limites assumidos:**
- 🟡 Por ora **só Preservação**; Vale-Presente fica para depois (volumes pequenos; pode esperar).
- 🟡 Screenshots são URLs externos (Drive) — não upload directo, conforme [[feedback_drive_para_ficheiros]]. Maria cola o partilha-link.
- 🟡 Sem busca dentro do log (volume pequeno por encomenda; podemos adicionar depois se precisar).
- 🟡 Audit log fica verboso (UPDATE da encomenda inteira em vez de granular por mensagem); aceitável para v1.

**Validação:** `npx tsc --noEmit` limpo. `npx next build` passa em 17s (compilação incremental). `npx eslint` limpo nos 4 ficheiros novos.

### Sessão 64 📝 Fase A — Biblioteca de templates de mensagens (sem IA, zero tokens)

Maria pediu para começar a "fase que falta" (Fase 6 — comunicações). Antes de pôr IA por cima, propus o plano híbrido em 4 níveis ([[feedback_aplicar_padroes_em_areas_analogas]]): **Nível 1 (templates puros, zero tokens) cobre 70-80% das mensagens**; só os restantes 20-30% precisam de IA. Esta sessão fechou **só a Fase A** ([[feedback_decidir_quando_overwhelm]] — fechar uma frente bem, antes de empilhar a próxima).

**Base aprendida.** Li 16 conversas WhatsApp exportadas em [public/conversas whatsapp/](public/conversas%20whatsapp/) (Carla, Diana, Khadija, Joana Pinto, Kelly, Inês, Joana Matos, Joana David, Rita, Susana, Marta, Lauren, MJoao, Sandra, Joana, +353). Extracted:
- Voz da marca: plural majestático, vocabulário ("preservar", "será um gosto", "vai valer a pena"), emojis florais 🌷🌸🌼🪻💐🤍, várias bolhas em vez de bloco único, soluções primeiro, empatia explícita antes da informação.
- Estrutura recorrente das mensagens-chave (pré-reserva, recepção, aprovação design, pronto para entrega, pós-venda).
- **Regra PT vs EN** ([[project_chamadas_idioma]]): EN não convida para chamada (Ana não fala EN); EN inclui Account Holder + IBAN + BIC + Banco; PT só MB Way + IBAN.

**1. Migração 041** ([supabase/migrations/041_message_templates.sql](supabase/migrations/041_message_templates.sql)):
- `system_settings (key, value)` — pares chave/valor para configuração global. Seed com `payment_account_holder`, `payment_iban`, `payment_bic`, `payment_bank_name`, `payment_mbway`, `studio_address_url`, `studio_address_text`. Maria edita via UI.
- `message_templates (id, slug, name, language, category, body, suggested_statuses jsonb, scope, position, is_seed, deleted_at)` com unique index parcial em `slug` (where deleted_at IS NULL), índices por categoria e idioma.
- RLS: `admins_all` (FOR ALL TO authenticated, restrito a António+MJ) + `authenticated_select` (Ana lê). Audit trigger `log_message_template_changes`. GRANT SELECT/INSERT/UPDATE/DELETE TO authenticated.
- **Seed: 29 templates** pré-populados (`is_seed=true`) — extraídos verbatim das conversas reais, com variáveis `{nome}`, `{valor_sinal}`, `{dados_pagamento}`, `{saudacao}`, `{data_evento_extenso}`, `{link_status}`, etc.

**2. Tipos** ([src/types/message-template.ts](src/types/message-template.ts)):
- `MessageTemplate`, `MessageTemplateInsert`, `MessageTemplateUpdate`, `TemplateCategory` (12 categorias com labels e ordem canónica), `TemplateLanguage` ('pt'|'en'), `TemplateScope` ('order'|'voucher'|'both').
- `SystemSettingKey`, `SYSTEM_SETTING_LABELS`, `SYSTEM_SETTING_KEYS`, `SystemSettingsMap`.

**3. Motor de templates** ([src/lib/templates.ts](src/lib/templates.ts)):
- `saudacaoPorHora(language)` — devolve "Bom dia/Boa tarde/Boa noite" (PT) ou "Good morning/Good afternoon/Good evening" (EN) consoante a hora.
- `dadosPagamento(language, settings)` — **bloco PT vs EN diferente**. PT: MB Way+IBAN. EN: Account Holder+IBAN+BIC+Banco. Tira o MB Way em EN porque não funciona fora de PT.
- `renderOrderTemplate(template, { order, settings })` — substitui as variáveis com dados da encomenda. Calcula `valor_sinal`/`valor_2a_parcela`/`valor_3a_parcela` (30/40/30) a partir do `pricing_snapshot.total` (com fallback ao `budget` manual). Datas por extenso via date-fns locale `pt` ou `enUS`. Formato monetário "300€" para inteiros, "100,50€" para fracções (`fmtEurMsg`) — bate certo com as conversas reais.
- `renderVoucherTemplate(template, { voucher, settings })` — análogo para Vale-Presente, com `{nome_remetente}`, `{nome_destinatario}`, `{codigo_vale}`, `{link_vale}`, `{valor_vale}`.
- `rankTemplatesForStatus(templates, { scope, currentStatus, preferredLanguage })` — devolve `{ suggested, others }`. Suggested = templates cujo `suggested_statuses` inclui o estado actual; outros = restantes. Dentro de cada bucket, ordena por idioma preferido (form_language do cliente) → categoria → posição.
- `AVAILABLE_VARIABLES` — lista de variáveis com descrição + scope, usada pelo painel lateral no editor.

**4. Server actions** ([src/app/(admin)/settings/templates/actions.ts](src/app/(admin)/settings/templates/actions.ts)) — todas com `requireAdmin()`:
- `createTemplateAction(input)`, `updateTemplateAction(id, patch)` (limpa `is_seed` do patch para não corromper seeds), `archiveTemplateAction(id)` (soft delete), `restoreTemplateAction(id)`, `duplicateTemplateAction(id)` (gera slug `<name>_copia`, incrementa se colide).
- `updateSystemSettingAction(key, value)` — upsert em `system_settings` por chave única.

**5. UI Sistema → Templates** ([src/app/(admin)/settings/templates/page.tsx](src/app/(admin)/settings/templates/page.tsx) + [templates-client.tsx](src/app/(admin)/settings/templates/templates-client.tsx)):
- Server component carrega templates + system_settings em paralelo.
- Client: 2 tabs — **"Templates"** (com filtros: pesquisa por nome/corpo, idioma, categoria, arquivados) agrupados por categoria, e **"Dados de pagamento e morada"** (campos individualmente editáveis com botão Guardar por linha).
- Lista mostra: nome + idioma + scope + selo "Pré-populado" (is_seed) + nº de estados sugeridos. Acções por linha: Editar / Duplicar / Arquivar (ou Restaurar se arquivado).
- **Editor (dialog full-screen)**: nome+slug (slug auto-gerado para novos, desabilitado em edição), idioma+categoria+scope, **toggle de estados sugeridos** (botões redondos com label dos 16 OrderStatus), corpo do template (textarea com `font-mono text-xs` 18 linhas), painel lateral com variáveis disponíveis filtradas pelo scope (clica para inserir no fim do corpo).
- Sub-tab Sistema actualizada ([src/components/sistema-topbar.tsx](src/components/sistema-topbar.tsx)) com novo chip "Templates" e ícone `MessageSquareText`.

**6. Template picker no workbench** ([src/components/template-picker.tsx](src/components/template-picker.tsx)):
- Componente reutilizável para Preservação e Vale-Presente (props discriminadas por scope).
- Botão "Inserir template" → Popover que carrega templates do Supabase **só na primeira abertura** (handler `handleOpenChange`, não `useEffect` — [[feedback_react_set_state_in_effect]]). Estados: loading / lista.
- Lista organizada com **header "⭐ Sugeridos para esta fase"** + lista normal. Cada item mostra nome + bandeira de idioma.
- Ao escolher: dialog com mensagem renderizada (variáveis preenchidas), 3 botões: **Copiar para clipboard** (via `navigator.clipboard.writeText`, toast "💐"), **Editar antes de copiar** (textarea editável), **Fechar**.
- Integrado em [preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/%5Bid%5D/workbench-client.tsx) (dentro do Card "Comunicações", `preferredLanguage={local.form_language}`) e em [vale-presente/[code]/workbench-client.tsx](src/app/(admin)/vale-presente/%5Bcode%5D/workbench-client.tsx) (na coluna esquerda, scope=voucher).

**Limites assumidos (Fase A propositadamente termina aqui):**
- 🚫 Não há UI de WhatsApp para colar histórico de conversas (Fase B).
- 🚫 Não há IA a adaptar/gerar/polir mensagens (Fase C).
- 🚫 Não há detecção de cliente perdido / reminder pré-data / check-in pós-entrega (Fase C).

**Validação:** `npx tsc --noEmit` limpo. `npx next build` passa (20 páginas, `/settings/templates` listada). `npx eslint` limpo nos ficheiros tocados.

### Sessão 63 🧹 Limpeza estrutural (revisão completa pedida pela Maria)

Maria pediu revisão da plataforma toda (admin: "podes rever a plataforma toda… estou completamente aberta a sugestões"). Apresentei 12 propostas; ela aprovou 6 + 1 para guardar como ideia futura. **Itens executados nesta sessão:**

**1. `formatEUR()` centralizado** ([src/lib/format.ts](src/lib/format.ts), novo)
- Encontrei 3 formas em uso: `toLocaleString("pt-PT", {currency})`, `toFixed(2).replace(".", ",") + "€"`, `Intl.NumberFormat`. Inconsistente entre páginas.
- Nova função `formatEUR(value, { rounded?, compact?, placeholder? })`:
  - Default: `"1 234,50 €"` (Intl pt-PT)
  - `compact: true`: `"1234,50€"` (sem espaço, sem milhares — tabelas apertadas)
  - `rounded: true`: arredonda cêntimos (métricas)
  - `null/undefined/NaN` → `"—"` (configurável)
- Substituídos 9 ficheiros: [vale-presente-client.tsx](src/app/(admin)/vale-presente/vale-presente-client.tsx), [vale-presente/[code]/workbench-client.tsx](src/app/(admin)/vale-presente/%5Bcode%5D/workbench-client.tsx), [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx), [preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/%5Bid%5D/workbench-client.tsx), [parcerias/[id]/workbench-client.tsx](src/app/(admin)/parcerias/%5Bid%5D/workbench-client.tsx), [financas-client.tsx](src/app/(admin)/financas/financas-client.tsx), [metricas-client.tsx](src/app/(admin)/metricas/metricas-client.tsx), [settings/rgpd/rgpd-client.tsx](src/app/(admin)/settings/rgpd/rgpd-client.tsx), [rgpd-print/page.tsx](src/app/rgpd-print/page.tsx).
- Mantido `fmtEuro` em [export-csv.ts](src/lib/export-csv.ts) (formato CSV sem €, vírgula decimal — diferente por design).

**2. Scroll horizontal em tabelas grandes** — esconder coluna verbosa em `<xl` (1280px), mantendo `xl+` intocado ([[feedback_desktop_prioridade]])
| Tabela | Coluna escondida | min-w novo |
|---|---|---|
| Preservação | Localização | 760 (era 920) |
| Vale-Presente | Validade | 720 (era 820) |
| Status | Mensagem EN | 720 (era 860) |
| Parcerias | Local | 660 (era 780) |
| Finanças despesas | Descrição | 760 (era 920) |
| Finanças subscrições | Início → Fim | 780 (era 960) |
- Laptops 13" (≥1280px com sidebar) deixam de ter scroll horizontal forçado.

**3. Split do workbench Preservação** — 2988 → 2111 linhas (-29%)
- 3 ficheiros novos em [src/app/(admin)/preservacao/[id]/_components/](src/app/(admin)/preservacao/%5Bid%5D/_components/):
  - `layout.tsx` (118 linhas) — `Card`, `Grid2`, `Field`, `HeroField`, `CheckRow`, `PlaceholderBox`, constantes `inp`/`sel`/`*Subtle`, paleta `ACCENTS`
  - `fields.tsx` (573 linhas) — `InventorySection`, `StatusSelect`, `ShippingRow`, `CouponCodeField`, `ExtraPieceRow`, `DriveUrlEditor`, `CalendarEventShortcut`, `safeHostname`; movido `STATUS_COLORS`/`STATUS_ICONS`/`STATUS_GROUPS` (continua sincronizado com `preservacao-client.tsx`)
  - `budget-badges.tsx` (269 linhas) — `BudgetSnapshotBadge`, `ProductionCostBadge`
- Abordagem **conservadora**: só extraí helpers/subcomponentes já isolados (não os 8 Cards principais, que partilham state com o componente pai). Reduz risco a zero. Os Cards principais ficam para futura iteração.
- Removidos imports não usados após a extracção (16 ícones, `Checkbox`, `SelectSeparator`, `LucideIcon`, `recompute*Action`, `capture*Action`, `PricingSnapshot`, `ProductionCostSnapshot`, `computeProductionCost`, `STATUS_LABELS`, `YES_NO_INFO_LABELS`).
- **Incidente** durante a sessão: PowerShell corrompeu o ficheiro com encoding errado (`Get-Content -Raw` lê com Windows-1252 e re-escreve UTF-8 mojibake). Reverti com `git checkout`. Truncei com Node em vez (`node -e "fs.readFileSync(p,'utf8')..."`) — UTF-8 limpo.

**4. Chat optimizado para mobile + emoji picker** ([src/app/(admin)/chat/chat-client.tsx](src/app/(admin)/chat/chat-client.tsx))
- Novo componente `EmojiPicker` interno (zero deps): popover com 6 categorias × 12-20 emojis (Sorrisos, Gestos, Corações, Flores, Festa, Trabalho). Botão 😀 no composer abre o picker.
- `insertEmojiAtCursor()` insere no `selectionStart`/`selectionEnd` do textarea via ref e repõe o cursor depois do emoji.
- Mobile (`<sm`):
  - Botão de enviar `h-11 w-11` (44×44 tap target iOS); desktop continua `h-10 px-3`.
  - Textarea `text-base` em mobile (iOS não dá zoom em focus se ≥16px), `text-sm` em desktop.
  - Composer com `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))` para iPhone home indicator.
  - Acções "Responder/Apagar" sempre visíveis em mobile (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`) — em mobile não há hover.
  - Bolha de mensagem `max-w-[85%] sm:max-w-[70%]` — ganha espaço em ecrã estreito.
- Desktop continua exactamente igual ([[feedback_desktop_prioridade]]).

**Continuação da sessão (depois de quebra de wifi):**

**5. Healthchecks automáticos diários** (Vercel Cron + Resend)
- Extracted [src/lib/healthchecks.ts](src/lib/healthchecks.ts) — função `runHealthchecks(supabase)` reusável (env vars, tabelas, dados, integrações Google). Refactor de [healthchecks/page.tsx](src/app/(admin)/healthchecks/page.tsx) para usar a lib. `HealthCheck` re-exportado para o client component que importa de `./page`.
- Novo [src/lib/supabase/admin.ts](src/lib/supabase/admin.ts) — `createAdminClient()` com `SUPABASE_SERVICE_ROLE_KEY`, bypassa RLS. Documentado: só pode ser usado em route handlers protegidos por `CRON_SECRET`.
- Novo [src/app/api/cron/healthcheck/route.ts](src/app/api/cron/healthcheck/route.ts):
  - Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron envia automaticamente em produção); em dev passa sem secret para teste manual.
  - Corre `runHealthchecks(adminClient)`, filtra `error`/`warning`, e se houver problemas envia email via **Resend HTTP API directamente** (sem `npm install resend` — `fetch` ao `https://api.resend.com/emails`).
  - Email com tabela HTML estilizada (FBR cream/cocoa), link de volta para `/healthchecks`. Subject `🚨 X erro(s)` ou `⚠️ X aviso(s)`. From/To configuráveis via `RESEND_FROM_EMAIL`/`RESEND_ALERT_TO` (defaults sensatos).
  - Returns JSON `{ ran_at, total_checks, errors, warnings, email: { sent, reason? } }`.
- Novo [vercel.json](vercel.json) com cron `0 7 * * *` (7h UTC = 8h Lisboa, primeira coisa da manhã).
- `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` adicionados ao envCheck da página `/healthchecks` (como opcionais, para a Maria ver se estão configurados).

**6. Última actividade por encomenda** (sem migrations — usa `orders.updated_at` que já existe desde a mig 001)
- Helper visual subtil: badge "parada há X dias" debaixo do tipo de evento na linha da tabela, e no header do workbench. **Só aparece a partir de 7 dias**. **Âmbar com ⏰ a partir de 14 dias**. Esconde em estados terminais (`quadro_recebido`, `cancelado`).
- Tooltip mostra a data/hora exacta da última edição.
- Ficheiros tocados: [preservacao-client.tsx](src/app/(admin)/preservacao/preservacao-client.tsx) (OrderRow) e [preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/%5Bid%5D/workbench-client.tsx) (header).
- Limitação conhecida: `updated_at` é actualizado em **qualquer** UPDATE (incluindo automações como `captureOrderProductionCostAction` ou re-sincronização de Calendar). Para o caso de uso "saber se está parada", isto serve bem — se houve mudança, foi mudança. Tracking "user-only" requereria capturar no audit_log.

**Outras decisões da sessão:**
- ❌ Item 5 (substituir `<div className="rounded-2xl ...">` por `<Card>` shadcn) — **rejeitado**: o `<Card>` do shadcn usa `rounded-xl`/`ring-1`/`bg-card` diferente do padrão actual (13 ficheiros). Substituir mudaria visual em todo o lado. Maria foi informada e não autorizou alternativa.
- 📌 Item 12 (filtros guardáveis em Preservação) — Maria adiou. Guardado em "Ideias futuras" do PROGRESS.md.
- 🚫 Item 1 (calculadora de transporte placeholder) — NÃO foi tocado (Maria não deu OK explícito; aprendi a regra em [[feedback_ok_explicito]]).

**Validação:** `npm run preflight` passa (tsc 19s + build 22s). `npx eslint` limpo nos ficheiros tocados.

### Sessão 62 🎨 Favicon PWA continua a falhar — round 2 (CORP + simplificar icons)

Depois da sessão 57 a Maria reportou que o ícone continuava a aparecer como **quadrado cinzento com "F" branco** ao adicionar ao ecrã principal. O "F" é o fallback do Chrome quando o manifest é parsed (lê o `short_name="FBR Admin"`) mas nenhum ícone passa pela validação. Hipótese principal: `Cross-Origin-Resource-Policy: same-site` (adicionada na sessão 59) bloqueava o launcher Android quando ia buscar o PNG fora do contexto do tab.

**Mudanças:**
1. **[next.config.ts](next.config.ts)** — overrides específicos:
   - `/manifest.webmanifest`: `Content-Type: application/manifest+json` + `Cross-Origin-Resource-Policy: cross-origin`
   - `/favicon/:path*`: `Cross-Origin-Resource-Policy: cross-origin` + `Cache-Control: public, max-age=86400`
   - Os 7 outros security headers (HSTS, CSP, COOP, etc.) continuam aplicados a todas as rotas porque o spread vem primeiro.

2. **[src/app/manifest.ts](src/app/manifest.ts)** — simplificação:
   - Removidos os entries `android-chrome-192x192.png` e `android-chrome-512x512.png` (PNGs com fundo transparente que o Chrome rejeitava como inválidos para install)
   - Removido `apple-touch-icon` do manifest (continua linkado via `<link rel="apple-touch-icon">` no [layout.tsx](src/app/layout.tsx), que é o que iOS lê)
   - Manifest passa a ter apenas: 1× favicon-32 + 2× maskable PNG (192/512) declarados duas vezes cada — uma com `purpose: "any"` e outra com `purpose: "maskable"`. Resultado prático: o launcher Android pega o maskable PNG para qualquer propósito (eles têm fundo opaco + safe zone, logo funcionam como "any").

3. **[public/sw.js](public/sw.js)** — bumped `CACHE_VERSION` v2→v3 + remoção do `/favicon/` da lista cacheable. PNGs pequenos não precisam de SW cache e estavam a arriscar serves obsoletos.

**Build:** `npx tsc --noEmit` limpo, `npx next build` passa.

**Passos manuais para a Maria — IMPORTANTE para apanhar o fix:**
1. Push para Vercel
2. **No telemóvel**, remover qualquer atalho antigo do ecrã principal
3. Chrome no telemóvel → menu ⋮ → Settings → Privacy → "Clear browsing data" → seleccionar **"Cached images and files" + "Site settings"** para `admin.floresabeirario.pt` (sem isto, o Android pode reutilizar o ícone do PWA antigo do próprio LRU do sistema)
4. Abrir `admin.floresabeirario.pt`, esperar 5s para o service worker v3 activar
5. Menu ⋮ → "Add to Home Screen" → confirmar que o preview mostra as 3 flores em fundo cocoa
6. Após criado, verificar no home launcher

Se ainda assim falhar: abrir `admin.floresabeirario.pt/manifest.webmanifest` directamente no browser do telemóvel e confirmar que devolve JSON (não erro). Também abrir directamente `admin.floresabeirario.pt/favicon/maskable-512x512.png` — deve mostrar a imagem.

### Sessão 61 🔒 Turnstile nos forms públicos do fbr-website + mig 040 (anti-enumeration)

Continuação. Foco: fechar o vector de enumeration de vouchers + estender Turnstile ao site público.

**Descoberta inesperada:** o `fbr-voucher` (site `voucher.floresabeirario.pt`) ainda usa **Google Sheets**, não o Supabase ([fbr-voucher/api/voucher.js](../fbr-voucher/fbr-voucher/api/voucher.js) lê de `spreadsheets.values.get`). Logo o role `anon` no Supabase NÃO precisa de ler `vouchers` para alimentar esse site. Posso fechar o vector sem partir nada.

**[supabase/migrations/040_vouchers_anon_select_lockdown.sql](supabase/migrations/040_vouchers_anon_select_lockdown.sql):**
- `DROP POLICY "vouchers_public_read"` (mig 010 — deixava listar todos os vales pagos)
- Mantém `vouchers_public_select_recent` (mig 017) — filtro temporal de 5s, único caminho legítimo (cobre RETURNING do INSERT do form público)
- Enumeration via `GET /rest/v1/vouchers?...` deixa de funcionar para anon

**Turnstile no `fbr-website`** (server-side já estava pronto — `verifyTurnstile` em `_lib/turnstile.js` — faltava o cliente):
- Novo componente reusable [app/_components/TurnstileWidget.jsx](../fbr-website/fbr-website/app/_components/TurnstileWidget.jsx) com `next/script` para o api.js, render lifecycle e cleanup
- [app/reservar-preservacao/ReservarPreservacaoForm.jsx](../fbr-website/fbr-website/app/reservar-preservacao/ReservarPreservacaoForm.jsx): widget antes do botão, `turnstileToken` no body, `resetTurnstile()` no erro, botão disabled enquanto não houver token
- [app/vale-presente/ValeApresenteForm.jsx](../fbr-website/fbr-website/app/vale-presente/ValeApresenteForm.jsx): mesmo padrão
- Graceful: sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na env, o widget não renderiza e o submit funciona como antes (o servidor já era no-op sem `TURNSTILE_SECRET`)

**Builds:** `next build` no fbr-website passa; `npm run preflight` no admin passa.

### Sessão 60 🔒 CAPTCHA Turnstile no login (graceful)

Continuação da auditoria de segurança. Sem 2FA (decisão da Maria), o login é a defesa principal — e os 3 emails são previsíveis (`info+antonio@`, `info+mj@`, `info+ana@floresabeirario.pt`). Sem CAPTCHA, brute force/password spraying é trivial. Implementação:

**[src/app/login/page.tsx](src/app/login/page.tsx):**
- Carrega `https://challenges.cloudflare.com/turnstile/v0/api.js` via `next/script` (só na página de login)
- Renderiza widget Turnstile assim que utilizador escolhe um perfil (entra no ecrã de password)
- Estado `captchaToken` capturado via callback; passa `options.captchaToken` no `supabase.auth.signInWithPassword`
- Botão "Entrar" disabled enquanto não houver token; widget reseta automaticamente após erro
- Re-renderiza widget ao mudar de perfil + cleanup no unmount
- Suporte a tema "auto" (acompanha dark mode)

**Graceful degradation:**
- Sem `NEXT_PUBLIC_TURNSTILE_SITE_KEY` na env, o script não é carregado, o widget não aparece, e o `captchaToken` não é passado ao Supabase. Login funciona exactamente como antes. Permite deploy desta sessão sem partir nada — a Maria activa quando configurar Cloudflare + Supabase.

**[src/app/(admin)/healthchecks/page.tsx](src/app/(admin)/healthchecks/page.tsx):** adicionada `NEXT_PUBLIC_TURNSTILE_SITE_KEY` à lista de env vars verificadas (opcional, fica como "warning" se não estiver definida).

**Preflight**: passa limpo.

### Sessão 59 🔒 Hardening parte 2 (mig 039 + CSP minimal)

Continuação imediata da 58 ("faz agora o que for mais rápido"). Três quick wins:

**1. audit_log: bloquear INSERT directo do anon** ([supabase/migrations/039_security_hardening_extra.sql](supabase/migrations/039_security_hardening_extra.sql))
- A mig 016 deu `GRANT INSERT ON audit_log TO anon` assumindo que o trigger `log_order_changes` precisava. Não precisa — todos os triggers de log_*_changes são `SECURITY DEFINER` (correm como `postgres`, que tem BYPASSRLS).
- Risco anterior: qualquer pessoa anónima podia fazer `POST /rest/v1/audit_log` com payload arbitrário (spam, poluição forense).
- Fix: `REVOKE INSERT ON audit_log FROM anon` + nova policy `audit_log_insert` restrita a `authenticated`.

**2. RPC `get_voucher_by_code(p_code TEXT)`** (mesma migração)
- Preparação para mitigar voucher code enumeration (atacante pode listar todos os códigos pagos via SELECT directo). A RPC devolve no máximo 1 linha (filtra por code + 100_pago + não-arquivado) e expõe só 7 colunas.
- `STABLE SECURITY DEFINER SET search_path = public` + `GRANT EXECUTE TO anon, authenticated`.
- Não revoga ainda o SELECT directo (vouchers anon column-level GRANT da mig 038 fica intacto) — o site `voucher.floresabeirario.pt` (outro repo) tem de migrar primeiro para `supabase.rpc('get_voucher_by_code', { p_code })`. Quando isso estiver pronto, basta `REVOKE SELECT (code) ON vouchers FROM anon` para fechar o vector.

**3. CSP minimal** ([next.config.ts](next.config.ts))
- 3 directives "seguras" (não tocam scripts/styles/imagens, logo não partem nada com Google Maps/OAuth/Supabase):
  - `frame-ancestors 'none'` — duplica X-Frame-Options DENY (defesa em profundidade)
  - `base-uri 'self'` — impede `<base href="evil.com">` injection que pivota XSS para outro domínio
  - `form-action 'self'` — impede `<form action="evil.com">` injection
- CSP completa (script-src, style-src, etc.) fica para outra sessão dedicada.

**Preflight**: passa limpo.

### Sessão 58 🔒 Auditoria de segurança + hardening (mig 038)

Maria pediu uma auditoria de segurança ("preciso de segurança máxima, não 2FA por agora"). Auditei: service role key, RLS, NEXT_PUBLIC_*, .gitignore, server actions, headers HTTP, forms públicos.

**Encontrado (3 vulnerabilidades):**

1. **[CRÍTICO] `orders.authenticated_all`** — a mig 002 substituiu o split admin/viewer por uma policy aberta a qualquer autenticado. Resultado: a Ana (viewer) podia INSERT/UPDATE/DELETE encomendas via API directa (PostgREST), ignorando os `requireAdmin()` server-side.

2. **[CRÍTICO] vouchers anon SELECT** — `GRANT SELECT ON vouchers TO anon` (mig 010) sem column-level restriction. Combinado com policy `vouchers_public_read` (filtra só por `payment_status=100_pago`), qualquer pessoa anónima podia fazer scraping da tabela inteira de vales pagos e ler `sender_email`, `sender_phone`, `consent_ip` (PII RGPD), NIF, código, etc.

3. **[MÉDIO] `audit_log.authenticated_read_audit`** — a mig 002 abriu o audit log a qualquer autenticado. A Ana lia o histórico financeiro inteiro, incluindo NIFs, orçamentos, comissões, mensagens privadas.

**[supabase/migrations/038_security_hardening.sql](supabase/migrations/038_security_hardening.sql):**
- `orders`: drop `authenticated_all`, recriado split `admins_all` (FOR ALL, António+MJ) + `viewer_select` (FOR SELECT, Ana)
- `audit_log`: drop `authenticated_read_audit`, recriado `admins_read_audit` (SELECT só António+MJ)
- `vouchers`: `REVOKE SELECT ON vouchers FROM anon` seguido de column-level GRANT só nas colunas necessárias para `voucher.floresabeirario.pt` (id, code, sender_name, recipient_name, amount, message, expiry_date, payment_status, deleted_at, created_at)

**Headers HTTP** ([next.config.ts](next.config.ts)) — adicionados:
- `X-Frame-Options: DENY` (anti-clickjacking)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (força HTTPS 2 anos)
- `Permissions-Policy` (desactiva camera, microphone, geolocation, payment, USB, sensors, interest-cohort)
- `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-site`
- `poweredByHeader: false` (esconde "X-Powered-By: Next.js")

**Verificado OK** (sem alteração):
- ✅ Service role key não é usada em lado nenhum — só anon key (RLS é a única protecção da BD, daí o rigor nas policies)
- ✅ `.gitignore` exclui `.env*` correctamente
- ✅ `NEXT_PUBLIC_*` só tem coisas que são públicas por design (URL Supabase, anon key, Maps key, site URL)
- ✅ RLS activa em **todas as 15 tabelas**
- ✅ `requireAdmin()` em todas as server actions de escrita críticas (preservação, finanças, status, google settings, vale-presente, parcerias delete)
- ✅ Cookies de sessão geridos por `@supabase/ssr` (HttpOnly+Secure+SameSite=Lax por default)
- ✅ Form público RGPD: `consent_at IS NOT NULL` é forçado na policy de INSERT anon (mig 016)
- ✅ Form público bloqueia campos administrativos (status, payment_status, partner_id, etc.) na policy de INSERT anon

**Pendente (NÃO incluído nesta sessão):**
- ⏳ MFA/2FA Supabase Auth (Maria pediu para deixar para depois)
- ⏳ CAPTCHA no login (Cloudflare Turnstile no admin) — precisa configuração Supabase Auth
- ⏳ CSP (Content-Security-Policy) — precisa testes; ficou para sessão dedicada
- ⏳ Turnstile nos forms públicos do `fbr-website` (outro repo)
- ⏳ Voucher code enumeration — anon pode fazer `SELECT code FROM vouchers WHERE payment_status=100_pago`; fix definitivo requer mudar `voucher.floresabeirario.pt` para usar RPC `get_voucher_by_code(code)` em vez de SELECT directo

**Preflight**: `npm run preflight` passa limpo (tsc 19s + build 22s, 18 páginas geradas).

### Sessão 57 ✅ Compatibilidade mobile + favicon PWA

Maria reportou que (1) o ícone não aparecia quando se adicionava a plataforma ao ecrã principal e (2) "o site no mobile fica muito destruído". Regra fundadora: **desktop é prioridade — nunca alterar layout desktop por causa do mobile** ([[feedback_desktop_prioridade]]).

**Favicon "Adicionar ao ecrã principal":**
- Problema raiz: ícones com fundo transparente + manifest sem variante `maskable` → Android colocava-os num círculo branco e o cream das flores ficava invisível
- Novo script [scripts/generate-maskable-icons.mjs](scripts/generate-maskable-icons.mjs) (Sharp, já vem com Next.js) gera variantes maskable 192/512 com fundo cocoa-900 sólido + safe zone 60%; refaz também o apple-touch-icon com fundo opaco (iOS auto-aplica máscara arredondada)
- [src/app/manifest.ts](src/app/manifest.ts): adicionado par `purpose: "maskable"` para 192 e 512; `background_color`/`theme_color` passam para cocoa para igualar o splash do ícone
- [src/app/layout.tsx](src/app/layout.tsx): `themeColor` agora respeita prefers-color-scheme (cream em light, cocoa em dark)
- [public/sw.js](public/sw.js): `CACHE_VERSION` `v1`→`v2` para invalidar o cache do favicon antigo

**Compatibilidade mobile (apenas overrides em <sm:, desktop intocado):**
- [src/components/ui/sheet.tsx](src/components/ui/sheet.tsx): SheetContent muda de `w-3/4` para `w-full sm:w-3/4` em side=left/right — mobile cobre 100% do viewport (antes ficava 75% espremido com formulários ilegíveis); desktop continua exactamente igual (sm:max-w-sm sobrepõe-se)
- Forms com pares de inputs lado-a-lado em sheets/workbenches passam de `grid grid-cols-2` → `grid grid-cols-1 sm:grid-cols-2`:
  - [src/app/(admin)/preservacao/nova-encomenda-sheet.tsx](src/app/(admin)/preservacao/nova-encomenda-sheet.tsx) (4 grids)
  - [src/app/(admin)/parcerias/novo-parceiro-sheet.tsx](src/app/(admin)/parcerias/novo-parceiro-sheet.tsx) (2 grids)
  - [src/app/(admin)/parcerias/[id]/workbench-client.tsx](src/app/(admin)/parcerias/%5Bid%5D/workbench-client.tsx) (3 cards: identificação, contacto, coordenadas avançadas)
  - [src/app/(admin)/preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/%5Bid%5D/workbench-client.tsx): helper `Grid2` (usado em todo o workbench) + `MethodCostPaidGroup` dinâmico
- Choice buttons curtos (WhatsApp/Email, Sim/Não) ficam `grid-cols-2` em todos os tamanhos — cabem mesmo em 375px
- Tabelas com `min-w-[920px]` mantêm-se intactas — já estão dentro de wrappers `overflow-x-auto`, mobile usa scroll horizontal

**Smoke**: `npx tsc --noEmit` limpo; `npx next build` passa (`/manifest.webmanifest` agora aparece nas rotas estáticas).

### Sessão 56 ✅ Aba Ecossistema — ferramentas externas + texto actualizado

Maria forneceu os links das plataformas que usam no dia-a-dia (WhatsApp Web, CTT Empresa, Gmail, Instagram, Facebook, Facebook Ads Manager, domínio Site.pt, Google Search Console, site público FBR) e pediu para avaliar o texto do fluxo que "parecia desactualizado".

**Adicionado** ([src/app/(admin)/ecossistema/page.tsx](src/app/(admin)/ecossistema/page.tsx)): nova secção **"Ferramentas externas"** entre "Fluxo principal" e "Integrações", agrupada por categoria:
- **Comunicação** — Gmail, WhatsApp Web
- **Marketing & redes sociais** — Instagram, Facebook, Facebook Ads Manager
- **Operações** — Portal CTT Empresa, Site FBR (público)
- **Infraestrutura web** — Domínio (Site.pt), Google Search Console

Cada cartão é um link externo (`target="_blank"`) com ícone Lucide + nome + nota opcional. Layout responsivo (1/2/3 colunas).

**Limpeza de texto desactualizado:**
- Removido `(Fase 5)` do input público (jargão de dev)
- Drive/Calendar `"Ligado via OAuth"` → `"Ligado"` (uniformidade)
- Gmail `"Foundation OAuth pronta — UI por implementar"` → `"Por integrar no workbench"`
- WhatsApp clarificado como registo manual (sem API pública)
- Anthropic Claude `"Por implementar"` → `"Por integrar"`
- Cloudflare Turnstile `"Hook pronto, secret opcional"` → `"Por configurar"` (verificado: não há código a usá-lo ainda)
- Subtítulos descritivos nas duas secções para distinguir "ferramentas externas" (manuais) de "integrações" (trocam dados directamente)

`tsc --noEmit` passa limpo. Página é puro JSX estático — sem migrações nem novos endpoints.

### Sessão 55 ✅ Afinações Google Calendar + contacto da recolha + botão "No Calendar" (migs 036+037)

Pedidos da Maria nos eventos Calendar:

1. **Emoji 🚐 → 🚗** nas recolhas (carro em vez de carrinha)
2. **Descrição mais leve**: removido o email e a "preferência de contacto" do bloco CLIENTE; só fica nome + telemóvel
3. **Data da recolha por extenso** na descrição: "15 de Maio de 2026" (em vez de "2026-05-15") — `formatDateLongPt` em [src/lib/google/calendar.ts](src/lib/google/calendar.ts)
4. **ID da encomenda clicável**: descrição agora contém `<a href="…">Encomenda #ID</a>` em HTML (Google Calendar aceita) → clica e abre o workbench
5. **Título "em mãos" mais curto**: prefixo `🤲 ENTREGA EM MÃOS` → `🤲 EM MÃOS` (e a linha da descrição idem)
6. **💐 no fim de todos os títulos** — `Sara | Casamento 💐`, `🚗 RECOLHA | … 💐`, etc.
7. **Contacto de quem estará na recolha** (amigo/familiar — não o cliente): novos campos `pickup_contact_name` + `pickup_contact_phone` em `orders` (mig 036). Inputs no workbench, debaixo da janela horária. Aparece na descrição do Calendar como `👥 Contacto no local: Nome — telemóvel` e na agenda de Entregas e Recolhas como caixa verde clicável (tel: link).
8. **Botão "No Calendar" volta a abrir o evento após refresh** (mig 037): persistimos `htmlLink` em `orders.calendar_event_html_link` no momento do insert/update. Para encomendas antigas, o page server-side reconstrói o URL a partir do `calendar_id` da integração (`computeEventHtmlLink`).

**Ficheiros tocados:**
- [supabase/migrations/036_pickup_contact.sql](supabase/migrations/036_pickup_contact.sql) + [supabase/migrations/037_calendar_event_link.sql](supabase/migrations/037_calendar_event_link.sql)
- [src/types/database.ts](src/types/database.ts) — tipos
- [src/lib/google/calendar.ts](src/lib/google/calendar.ts) — emojis, descrição, link HTML, formatador PT, `computeEventHtmlLink`
- [src/lib/google/order-calendar-trigger.ts](src/lib/google/order-calendar-trigger.ts) — propaga campos + persiste htmlLink
- [src/app/(admin)/preservacao/actions.ts](src/app/(admin)/preservacao/actions.ts) — selects + reads incluem novos campos
- [src/app/(admin)/preservacao/[id]/page.tsx](src/app/(admin)/preservacao/%5Bid%5D/page.tsx) — backfill do htmlLink para encomendas antigas
- [src/app/(admin)/preservacao/[id]/workbench-client.tsx](src/app/(admin)/preservacao/%5Bid%5D/workbench-client.tsx) — inputs Nome + Telemóvel; estado inicial do link vem da BD
- [src/app/(admin)/entregas-recolhas/entregas-recolhas-client.tsx](src/app/(admin)/entregas-recolhas/entregas-recolhas-client.tsx) — caixa verde com contacto na agenda

`tsc --noEmit` passa limpo. Lint sem novos avisos nos ficheiros tocados (warnings pré-existentes não relacionados).

### Sessão 54 🚨 HOTFIX: workbench Preservação não carregava em produção (React #185)

Maria abriu `admin.floresabeirario.pt/preservacao/H4V9S6Z2U7G1E5D8` → "This page couldn't load" com `Minified React error #185` = **Maximum update depth exceeded**. Causa: na Sessão 52, o `WorkbenchNavigator` usa `useSyncExternalStore` e o `getSnapshot` chamava `getNavContext(...)` que constrói um objecto fresco `{ index, total, prev, next }` em cada chamada. `useSyncExternalStore` compara com `Object.is` → "snapshot novo" todo o render → loop. **Tudo passou nos checks** (`tsc`, `eslint`, `next build`) porque só falha em runtime no browser.

**Fix.** [src/components/workbench-navigator.tsx](src/components/workbench-navigator.tsx): novo `getCachedSnapshot(navKey, currentId)` com cache modular de um slot (só há um workbench montado de cada vez). Cache key = `"orders:abc"`; quando o key muda, recompõe; senão devolve a mesma referência.

**Mecanismos de prevenção:**
1. Novo [scripts/smoke.mjs](scripts/smoke.mjs) — Playwright headless, faz login, visita páginas críticas, falha se houver `pageerror`, `console.error`, ou "couldn't load"
2. `npm run preflight` (`tsc --noEmit && next build`)
3. `npm run smoke` (precisa de Playwright: `npm i -D playwright && npx playwright install chromium`)
4. Memórias: [[feedback_useSyncExternalStore_pitfall]] + [[feedback_smoke_test_obrigatorio]]

### Sessão 53 ✅ Custos de produção — UX + consumíveis recorrentes

(1) Sinal € visível nos inputs da tabela de custos; (2) "V/V"/"V/C" → "Vidro"/"Cartão"; (3) nova secção para consumíveis recorrentes (caixa de cartão, autocolante frágil, saco pano, lavanda, cartão informativo, padding insuflável, sílica) — adicionar/remover/renomear linhas com custos variáveis por tamanho.

**Migração 035** ([supabase/migrations/035_production_consumables.sql](supabase/migrations/035_production_consumables.sql)): `production_cost_items.cost` upgrade `NUMERIC(10,2)` → `NUMERIC(12,4)` (4 decimais); `kind` ganha `'consumable'`; nova coluna `label TEXT`; constraints + índice único parcial; seed **8 consumíveis × 3 tamanhos = 24 linhas**.

**Tipos + cálculo.** [src/types/production-cost.ts](src/types/production-cost.ts): `ProductionCostKind` inclui `'consumable'`. [src/lib/production-cost.ts](src/lib/production-cost.ts) `computeProductionCost` itera linhas com `kind='consumable'` e empurra para o breakdown. Badge de custo no workbench mostra consumíveis debaixo do custo da moldura.

**Server actions** ([src/app/(admin)/financas/actions.ts](src/app/(admin)/financas/actions.ts)). `createConsumableAction(label)`, `archiveConsumableAction(label)`, `renameConsumableAction(oldLabel, newLabel)` — operações por label (não por id).

**UI Finanças**. Novo card "Outros custos recorrentes" com tabela editável (8 linhas × 3 tamanhos). Label inline editável, lixeira com confirm. Aplicado [[feedback_aplicar_padroes_em_areas_analogas]].

### Sessão 52 ✅ Slide entre workbenches + Custos de produção (COGS) + moldura pirâmide

**Slide entre workbenches.** Novo [src/lib/workbench-nav.ts](src/lib/workbench-nav.ts) (sessionStorage por área: "orders" | "vouchers" | "partners"). Componente [src/components/workbench-navigator.tsx](src/components/workbench-navigator.tsx) renderiza setas ◀ ▶ + "12 / 47"; atalhos teclado ← →. As 3 listagens gravam a ordem visual antes do `router.push`.

**Custos de produção (COGS).** Migração [034_production_costs.sql](supabase/migrations/034_production_costs.sql): tabela `production_cost_items` (24 frame + 4 photo_print seed); em `orders`: `pyramid_frame BOOLEAN`, `frame_internal_type` ('baixa'|'caixa'), `production_cost_snapshot JSONB`.

**Lógica.** [src/lib/production-cost.ts](src/lib/production-cost.ts) com `buildProductionCostSnapshot` (copia integral) e `computeProductionCost` (quadro + foto + mini-quadros × qty). [src/lib/pricing.ts](src/lib/pricing.ts): `pyramid_frame=true` adiciona suplemento `extra.pyramid_frame`.

**Actions.** `createOrderAction` captura sempre o snapshot na criação; `captureOrderProductionCostAction` permite encomendas antigas.

**UI Finanças.** Nova tab "Custos de produção" entre "Tabela de preços" e "Faturação". 4 cards (tamanhos) × mini-tabela 3×2 editável. Card separado para impressão de fotografia.

**UI Workbench.** No card "Flores, quadro e extras": campos "Moldura pirâmide" (Sim/Não) e "Tipo de moldura (interno)" (Baixa/Caixa). No card "Finanças": `ProductionCostBadge` mostra "Custo X€ · margem Y€ · Z%" (verde ≥50%, âmbar ≥25%, rosa <25%).

---

## Próximo passo CONCRETO

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

## Histórico condensado (sessões 1-51)

### Fase 6 — Integrações + PWA + RGPD (sessões 35-51)
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
