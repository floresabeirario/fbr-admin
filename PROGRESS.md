# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 7) — Tabela de preços + 3 abas placeholder + audit log UI + refactor

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
- 35 migrações aplicadas; smoke test em Playwright (`npm run smoke`)

---

## Sessões recentes (detalhe)

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

**Sessões 52-54 — passos manuais da Maria** (cumulativo se ainda não correu nada desde 52):
1. Correr **migrações 034 e 035** no Supabase SQL Editor (por ordem)
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

- **Calculadora de transporte** em Entregas e Recolhas (placeholder na sessão 42)
- **Aba "Healthchecks"** — versão útil entregue na sessão 43, mas pode crescer (form checks, SEO, etc.)
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
