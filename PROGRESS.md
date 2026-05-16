# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 6 (parte 9) — Auditoria de segurança + hardening (migs 038+039 + CAPTCHA)

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

**Sessão 60 — activar CAPTCHA Turnstile (5 passos, ~10 min):**
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
