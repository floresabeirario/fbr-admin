# FBR Admin — Estado do Projecto

> Lido no início de cada sessão; actualizado em tempo real durante a sessão.
> **Regras deste ficheiro:** máximo ~30 KB. Só as últimas 5 sessões ficam aqui, em formato compacto
> (template: O quê / Ficheiros / Migrações + passos manuais / Smoke / Pendente, máx ~15 linhas).
> Ao entrar a 6ª sessão, a mais antiga move-se **na íntegra** para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)
> (que NÃO é lido por defeito — todo o histórico das sessões 1-132 está lá). O detalhe fino vive nos commits do git.
> ⚠️ Hashes de commits do fbr-admin anteriores a 11/07/2026 foram reescritos no expurgo RGPD (sessão 139) — já não existem.

---

## Onde estamos

**Fase 6 — Integrações + PWA + RGPD (em curso).** Última sessão: **139** (2026-07-11, expurgo RGPD do histórico git — item 2c do roadmap FEITO; histórico reescrito + force push).

### ⚠️ Pendentes de confirmação da Maria (verificar antes de assumir)
- [ ] **Smoke sessão 138 (fbr-voucher, 08/07):** abrir um vale real no telemóvel → envelope diz "Para {nome do destinatário}" e caem pétalas douradas ao abrir; no resumo, tocar no código → "Copiado ✓"; botão "Partilhar este vale" abre a partilha do telemóvel; enviar o link a si própria no WhatsApp → o preview mostra a capa do cartão (a Meta pode demorar a renovar previews antigos em cache)
- [ ] **Smoke fbr-voucher (07/07, TUDO já em produção):** abrir voucher.floresabeirario.pt com um código real → cartão carrega (muito mais rápido) e dados certos; código errado (ex.: XXXXXX) → volta à pesquisa com erro simpático (já não mostra "Joana"); botão **PT/EN** no canto superior direito troca a página toda; verificar a nova secção **Integrações** em /healthchecks (2 sites + RPC do voucher a verde)
- [ ] **Smoke sessão 135 (07/07):** no telemóvel, título "FBR Admin" do header de topo agora centrado (estava puxado à esquerda — lados assimétricos com justify-between; passou a centragem absoluta em [layout.tsx](src/app/(admin)/layout.tsx), só mobile, desktop intocado)
- [ ] **Smoke sessão 133 (correcções de segurança já em produção):** login dos 3 perfis OK; aba WhatsApp abre e as imagens carregam (proxy passou a gated para /media|/suggest|/retry — só o /webhook é isento); confirmar que a Ana já NÃO edita Ideias nem Livro de Receitas (só Tarefas/Parcerias/Chat)
- [x] **fbr-website:** correcções M1/M2 EM PRODUÇÃO ✅ (verificado na sessão 139: `1cdc431` é antepassado de `main` — entrou no merge `711ca4b` da 133; este pendente estava obsoleto)
- [ ] **Backup pré-expurgo (sessão 139):** `_privado/backup-pre-expurgo/fbr-admin-completo-2026-07-11.bundle` CONTÉM o histórico antigo com PII — guardar até teres confiança total (umas semanas) e depois **apagar**
- [x] **Mig 091** corrida no Supabase ✅ (confirmado pela Maria, 04/07 — deploy das etiquetas WhatsApp desbloqueado)
- [x] **Mig 089** (lembretes de tarefas) corrida + secret **`CRON_SECRET`** criado no GitHub ✅ (confirmado pela Maria, 05/07)
- [ ] **Smoke sessão 131:** botão "Etiquetas" na aba WhatsApp (mudar cor/nome, criar nova, atribuir a conversa); ✓ cinza em vez de 📱 nas mensagens enviadas
- [ ] **Smoke sessão 130:** sino na sidebar da PWA no telemóvel → "Notificações ligadas" (só funciona em produção)
- [x] **fbr-website:** merge develop→main FEITO na sessão 133 (`711ca4b`) — segurança + sessão 126 (cookies/keywords/UltraVue) + perf em produção

### Próximo passo concreto
Roadmap aprovado (sessão 124, prioridades da Maria — [[project_prioridades_roadmap_124]]):
1. ~~Varrimento `formatDateTimeLisbon`~~ ✅ FEITO na 133 (todos os HH:mm sobre timestamptz; export-csv.ts fica, é server-only)
2. **Item 4 restante:** tipos gerados do Supabase no preflight (precisa do access token da Maria — por isso a 124 usou o schema-drift offline)
3. **Item 8:** vista "Hoje" no Dashboard (experimental, fácil de remover) + relatório mensal interno
4. ~~**2c:** expurgar histórico git~~ ✅ FEITO na 139 (filter-repo + force push; 14 paths, incl. conteúdo das migs 006/014)
5. ~~Motor de cadência de comunicação (104)~~ e ~~absorver fbr-tracking no fbr-website~~ — a Maria disse **NÃO por agora** (11/07/2026); fora do roadmap activo

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

### Sessão 139 (2026-07-11) — Expurgo RGPD do histórico git (item 2c) + verificações
- **O quê:** histórico do fbr-admin reescrito com **git-filter-repo** (clone-espelho + force push; Python 3.12 + filter-repo instalados via winget/pip). Removidos de **TODO o histórico** 14 paths: `public/conversas whatsapp/` (16 clientes + 1 .vcf), `mondayexport.xlsx`, 4 xlsx de parcerias, `scripts/_monday-parceiros-parsed.json` (PII de parceiros — apanhado na verificação, não estava no inventário da 132), spec interna (pdf + 2 txt), export GSC, `.claude/settings.local.json`, e o **conteúdo das migs 006/014** (17 clientes + 171 parceiros com emails/telemóveis inline — decisão da Maria) → substituídas por **stubs no-op** que preservam a numeração. 267→265 commits.
- **Verificação:** diff de árvore (com hashes de blobs) HEAD antigo vs novo = **exactamente** as 2 migrações; grep ao histórico inteiro limpo; preflight completo ✅ (tsc + 100 testes + build) — schema-drift e contrato do website não dependiam do conteúdo expurgado.
- **⚠️ Hashes antigos do fbr-admin citados neste ficheiro/ARQUIVO já não existem** (histórico reescrito); branches do dependabot também foram reescritos (PRs continuam válidos). Objectos antigos podem persistir em caches do GitHub até ao gc deles — repo privado, risco baixo; remoção imediata só via GitHub Support.
- **Backup:** bundle completo PRÉ-expurgo em `_privado/backup-pre-expurgo/` (gitignored) — **contém o PII**, apagar quando houver confiança (pendente no topo).
- **Também:** confirmado que M1/M2 do fbr-website já estavam em produção (pendente obsoleto fechado); PROGRESS da 137/138 estava por commitar — committado antes da reescrita. **Migrações:** nenhuma nova (só stubs). **Smoke:** nada visual a testar (zero mudanças de comportamento; preflight cobre).

### Sessão 138 (2026-07-08) — fbr-voucher: melhorias de design/UX do vale (9 aprovadas pela Maria)
- **O quê:** sugestões de melhoria pedidas pela Maria, aprovadas em bloco ("faz tudo, sem estragar nada"). **(1) Envelope personalizado:** "Um presente para si" → **"Para {destinatário}"** quando os dados da API chegam (classe `env-brand--nome` com quebra para nomes longos; testado com 37 chars em 390px). **(2) Pétalas a cair** ao abrir o envelope (7 SVGs assimétricos estilo botânico, família ouro, animação única ~3s). **(3) Nomes-exemplo fora do HTML** — overlays começam vazios até a API responder (ligações lentas já não mostram "Joana"). **(4) Copiar código:** célula do código no resumo é botão (clique/Enter → clipboard, label "Copiado ✓" 1,6s, ícone; fallback execCommand) e o CTA "Reservar agora" passa a levar **`?vale=CODIGO`**. **(5) Aviso de vale expirado** (validade MM/YYYY → fim do mês; caixa terracota discreta + validade a terracota; o vale continua a abrir — fecha o pendente "decisão de produto" da leva 2). **(6) Botão "Partilhar este vale"** (navigator.share; fallback copia o link + "Link copiado ✓"). **(7) Imagem OG dedicada** `img/og-voucher.jpg` 1200×630 (capa fechada do cartão sobre creme; novo [render-og.mjs](../fbr-voucher/fbr-voucher/scripts/render-og.mjs), Edge headless; `api/share.js` aponta para ela + og:image:width/height/alt — antes era o favicon 512px). **(8) prefers-reduced-motion:** CSS desliga os loops decorativos; JS abre o cartão sem mola (com troca manual dos canvases da capa) e sem pétalas. **(9) Zoom do browser permitido** (acessibilidade): viewport sem `user-scalable=no`; o pinch custom do cartão fica protegido por `touch-action: pan-y` no `.hero-section` + handler limitado a alvos dentro do hero — fora do hero o pinch volta a ser do browser.
- **Ficheiros (fbr-voucher):** `index.html` (CSS+HTML+i18n+JS), `api/share.js`, `img/og-voucher.jpg` (novo), `scripts/render-og.mjs` (novo), `scripts/smoke.mjs` (+14 verificações: personalização, pétalas, copiar+clipboard, partilhar, `?vale=`, expirado PT/EN re-traduzido, reduced-motion).
- **Migrações:** nenhuma. **Smoke:** ✅ 43/43 verdes (Playwright+Edge com mock local) + screenshots inspeccionados (desktop, mobile 390px, envelope com nome longo, cartão aberto mobile com auto-zoom, expirado EN, OG image).
- **Afinações pós-deploy (feedback da Maria):** (1) "a pill é estranha" → a marca "Flores à Beira-Rio" perdeu a cápsula com blur, wordmark solto em TAN Memories (`f8a17df`); (2) "quero o título visível no scroll" → `.brand` fica `fixed` mas a legibilidade sobre o cartão vem de um véu de gradiente creme no topo (`.brand-scrim`), não de caixa; (3) "o envelope diz 'Um presente para si' e muda para o nome 1s depois" → o título do envelope começa invisível e revela-se com fade já com o texto final (fallback 2s para o genérico se a API demorar). (4) "quero que o refresh volte sempre ao topo" → `history.scrollRestoration = 'manual'` + `scrollTo(0,0)` no load e no `pageshow` (a experiência recomeça no envelope). Commits `b41489d` + `1d24981` pushed, smoke re-corrido ✅ (44 verificações). Memória nova: [[wordmark-sem-pill]].
- **Pendente:** **fbr-website** ainda não lê `?vale=` no form de reserva — pré-preencher código + "como conheceu" em [ReservarPreservacaoForm.jsx](../fbr-website/fbr-website/app/reservar-preservacao/ReservarPreservacaoForm.jsx) numa próxima sessão (mudança pequena; o voucher já envia o parâmetro, é inofensivo até lá). Smoke da Maria em produção no topo deste ficheiro.

### Sessão 137 (2026-07-08) — fbr-website: análise visitante + correcções factuais + páginas de momentos
- **O quê:** análise design/conteúdos do site na ótica do visitante, seguida de 3 pacotes aplicados. **Quick wins factuais (PT+EN):** Sustentabilidade dizia "4 a 6 semanas" de entrega (é até 6 meses!) e "Preenche" (tu); FAQ do Bouquet dizia 40% "na aprovação da composição" (é na receção das flores); "Almaláques"→"Almalaguês"; prazo máximo de entrega uniformizado para 6 dias (Como Funciona dizia 5; hint do form dizia "2 a 3"→"1 a 3"); "guardamos o seu lugar sem compromisso" removido (a vaga só fica garantida com o sinal). **Limpeza + selo:** chaves mortas apagadas dos json (galeria do bouquet nunca renderizada + CSS, home.momentoTitle/momentoDesc/prontoTitle, weekendNote); selo "Recebemos ao fim de semana" implementado no hero do Bouquet (CSS já existia). **Páginas de momentos ×4** (aniversário/batizado/luto/pedido): prova social "★★★★★ 5,0" com links Google+casamentos.pt no hero (novo `MomentoProofBar`, chave `common.provaSocial`), foto de trabalho real no corpo (novo `MomentoFoto`; LaurenJcloseup/detalhe/sandra1/fotoquadrocloseup3), barra fixa mobile de CTAs (classe `momento-page--sticky`; hero CTAs escondidos em mobile como no bouquet; desktop intocado).
- **Google Images (3 frentes aplicadas):** (1) `max-image-preview:large` + `max-snippet/-video:-1` no robots do [layout.js](../fbr-website/fbr-website/app/[locale]/layout.js) (sem isto o Google mostra as fotos em miniatura reduzida); (2) **29 fotos de trabalhos renomeadas** para nomes ricos em palavras-chave PT (ex.: `fotoquadro1.webp`→`quadro-flores-prensadas-preservadas.webp`, `sandra1`→`flores-homenagem-preservadas-quadro`, `moldurapreta`→`moldura-preta-flores-preservadas`) — script Node fez 80 substituições em 38 ficheiros (jsx/js/json/**mdx frontmatter**/blog.js+metadata defaults), ficheiros movidos com `git mv` (histórico preservado); NÃO renomeadas: equipa (mj/antonio/ana), voucher (vale1/2), APCC, og-homepage, ritaherophoto, passos de envio/recriação (já descritivos); (3) **imagens no [sitemap.js](../fbr-website/fbr-website/app/sitemap.js)** via campo `images` por rota (mesma foto PT+EN) → 42 `image:loc` no sitemap.xml gerado.
- **Ficheiros (fbr-website):** `messages/pt.json`+`en.json`, `app/globals.css`, `app/_components/MomentoProofBar.jsx`+`MomentoFoto.jsx` (novos), 4 clientes de momentos, `BouquetNoivaClient.jsx`, `[locale]/layout.js`, `app/sitemap.js`, +38 ficheiros com refs de imagem renomeadas, +29 webp em `public/` movidos.
- **Migrações:** nenhuma. **Build:** ✅ OK (2×, depois dos renames + sitemap). **Smoke (Maria, antes de push):** abrir as 4 páginas de momentos (desktop + telemóvel — barra fixa, foto no corpo, linha 5,0) + hero do Bouquet (selo fim de semana) + CTA Sustentabilidade (6 meses) + **verificar que as imagens carregam** em opções-e-preços, bouquet-noiva, blog, contactos (foram as mais afectadas pelos renames).
- **Bug de scroll em Opções e Preços (corrigido):** o hero "colava" ao 1.º scroll e saltava tudo ao 2.º (relatado pela Maria). Causa: o wrapper raiz de [OpcoesClient.jsx](../fbr-website/fbr-website/app/opcoes-e-precos/OpcoesClient.jsx) usava `overflow-x: hidden` inline, que por spec força `overflow-y: auto` → cria contentor de scroll que o Safari mobile "prende" no 1.º gesto. Contactos tem hero idêntico (useScroll fade + 100svh) mas usa `clip` e não tinha o bug → isolou a causa. Corrigido `hidden`→`clip` (raiz + wrapper do carrossel de fundos), alinhado com a convenção do resto do site. Sem mudança visual; build ✅.
- **EM PRODUÇÃO:** commit `f4f9b8e` (develop) + merge `4c2c0bd` (main, `git merge --no-ff` = convenção do repo, NÃO fast-forward) pushed a 08/07. Deploy Vercel automático do main. Verificação pré-push: build ✅, script confirmou 137 refs de imagem todas resolvem + 6 chaves i18n novas em PT+EN + 0 refs a chaves apagadas.
- **Pendente:** galeria "Trabalhos reais" do Bouquet ficou POR FAZER (recuperável: copy+CSS no histórico git desta sessão). **Passos manuais Google (Maria):** no Search Console pedir re-indexação + submeter sitemap; medir em Desempenho › tipo "Imagem" nas próximas semanas. **Smoke visual (Maria):** as 4 páginas de momentos no telemóvel + scroll de Opções + imagens a carregar em opções/bouquet/blog/contactos.

### Sessão 136 (2026-07-08) — Fonte única das fases públicas + docs cross-repo do ecossistema
- **O quê:** eliminada a duplicação estado→fase pública (o footgun cross-repo: dois repos, dois mapas para manter em sincronia). Nova RPC **`get_public_order_status`** (mig 092, `SECURITY INVOKER`) é a fonte única em runtime; o **fbr-tracking** deixou de ter mapas (−142 linhas, só chama a RPC e formata). `public-status.ts` fica só para a UI síncrona do admin, com teste `public-status-sync.test.ts` a garantir que não diverge da SQL. Docs cross-repo novos em `docs/`: **ECOSYSTEM** (contrato + teste `ecosystem-contract.test.ts`), **SECRETS** (registo + rotação — inclui webhook WhatsApp 1×/ano), **MIGRATIONS-STATUS**, **REPOS** (build dos 4 repos). Contexto: pergunta da Maria sobre como melhorar a comunicação entre os 4 repos.
- **Ficheiros:** [mig 092](supabase/migrations/092_public_phase_defs.sql), [public-status.ts](src/lib/public-status.ts), 2 testes novos, `docs/`×4; fbr-tracking [utils/supabase.js](../fbr-tracking/fbr-tracking/fbr-tracking/utils/supabase.js).
- **Migrações + passos manuais:** mig 092 ✅ **aplicada** (08/07). Nenhum passo manual pendente.
- **Deploys:** admin→`master` (`e532463`+`651cd88`); fbr-tracking merge `develop→main`, **em produção**. Também committado o [layout.tsx](src/app/(admin)/layout.tsx) (fix mobile do título centrado, sessão 135, estava por commitar).
- **Smoke:** ✅ FEITO por script contra dados reais (RPC + `getEncomendaById`): fases 0-12/cancelada, PT/EN, datas — tudo certo; status.floresabeirario.pt 200. **Nada por smokar.** (Fica só o smoke visual mobile da sessão 135, no pendente.)
- **Parte 2 (mesma sessão):** **CI nos 4 repos** (website: build env dummy — `npm install` porque o lock de Windows não tem binários linux; tracking: build env dummy, `.github` na RAIZ do git — armadilha do aninhamento; voucher: `scripts/smoke.mjs` com `SMOKE_CHANNEL=bundled`); **Dependabot** nos 4 (mensal agrupado; já abriu PRs verdes em tracking/voucher); **estratégia de branches por repo** documentada no [REPOS.md](docs/REPOS.md); **teste de contrato de colunas** website↔orders/vouchers ([website-form-contract.test.ts](src/lib/__tests__/website-form-contract.test.ts) — extrai as chaves dos payloads do site e valida contra o schema das migrações; skip na CI sem sibling). 100 testes ✅.
- **Pendente:** nada desta sessão. Frente futura registada: absorver o fbr-tracking no fbr-website (agora que o tracking é apresentação pura, ~46 linhas de lógica).

### Sessão 133 (2026-07-04) — Auditoria de segurança + ecossistema + correcções aplicadas
- **Auditoria (Fable):** 4 repos + RLS/GRANTs das 91 migrações + lógica financeira. **0 críticos, 3 moderados, 5 menores.** Relatório: https://claude.ai/code/artifact/eca9f339-da8e-4fa5-944d-e9a3fbc27403
- **Correcções aplicadas e EM PRODUÇÃO (admin `1114903` + voucher `37488f8` pushed):** m4 helper `isAuthorizedCron` timing-safe ([lib/auth/cron.ts](src/lib/auth/cron.ts)) nas 3 rotas de cron; m1 proxy só isenta `/api/whatsapp/webhook/` (media/suggest/retry voltam ao gate, têm auth própria); m3 callback Google não põe `detail` do erro no URL; **C1** Ideias + Livro de Receitas passam a `requireAdmin` (Maria confirmou: Ana edita só Tarefas/Parcerias/Chat — reverter = requireUser); m2 rate limit 30/min/IP no lookup de vales (fbr-voucher).
- **fbr-website (develop `1cdc431`, NÃO em produção — entra no merge pendente):** M1 `isVercelPreview` só aceita `fbr-website-*.vercel.app`; M2 `verifyTurnstile` fail-closed em produção + alarme no `monitor-forms` se `TURNSTILE_SECRET` sumir. **C2 confirmado:** `TURNSTILE_SECRET` existe em Production na Vercel do site (screenshot da Maria).
- **Não corrigido de propósito:** M3 webhook WhatsApp sem HMAC (limitação Dualhook, risco aceite — rodar path token 1x/ano); m5 CLAUDE.md diz "11 estados públicos" (são 13). Ver [[project_auditoria_133_pendentes]].
- **Ecossistema:** plataformas todas adequadas; Monday/Sheets/Excel eliminados. Recomendação a prazo: absorver fbr-tracking no fbr-website (lógica de fases duplicada, hoje em sincronia).
- **Ganhos pequenos (mesma sessão, admin `8c566bd`):** varrimento `formatDateTimeLisbon` completo (metricas/healthchecks/chat/audit/parcerias×2/receitas/painel; novos helpers `formatTimeLisbon` e `...WithSeconds`); CLAUDE.md 11→13 fases.
- **fbr-website merge→main `711ca4b` + perf `074b08a` (EM PRODUÇÃO):** correcções de segurança + sessão 126 foram live; **performance:** imagens de origem sobredimensionadas reduzidas 60MB→8MB (sharp, 1920px/q82 — [scripts/downsize-images.mjs](../fbr-website/fbr-website/scripts/downsize-images.mjs)) + removidos 5 vídeos mortos sem referências (~60MB). Causa da lentidão: fotos da equipa a 12MP/10MB e vídeos gigantes no deploy. **Preflight admin OK + build website OK.**

> Sessões 127-132 movidas para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md).

---

## Pendências externas (outros repos)

- **fbr-website** — sessão 126 (cookies/keywords/UltraVue) já foi live no merge da 133; develop e main sincronizados desde a 137. Continuam em aberto as decisões da auditoria 122: aggregateRating? subtítulo no hero? data nas páginas legais? + vídeo `tracking.mp4` (Maria ainda não tem) + ler `?vale=` no form de reserva (pendente da 138).
- **Relatório mensal de analytics (Clarity)** — ✅ FEITO (sessão 134): compilação mensal + email via Resend ligados ao cron `clarity-snapshot` (fbr-website `82d0f60`, main+develop sincronizados, EM PRODUÇÃO). 1.º email (Julho) chega no início de Agosto. Umami continua manual (API paga) — [[project_website_analytics]].
- **fbr-voucher — análise completa + 2 levas de melhorias, TUDO em produção (07/07/2026):**
  - **Leva 1 (`6a0d4b4`):** **(a)** código errado/expirado mostrava o cartão com os nomes-exemplo "Joana/Guilherme e Alexandra" — agora reencaminha para a pesquisa com erro e código pré-preenchido; **(b)** cartão 3D passou de `voucher_azul.pdf` 12,4 MB + pdf.js do cdnjs para 2 WebP pré-renderizados (`img/`, 0,8 MB, −94%; PDF fica como fonte de design, fora do deploy via `.vercelignore`; regenerar com `scripts/render-pdf.mjs`); **(c)** rate limit também no `/api/share` (helper partilhado `api/_ratelimit.js`); **(d)** menores: 500 sem `err.message`, favicon.svg 393 KB removido, `settings.local.json` destracked, OG tags por regex, README.
  - **Leva 2 (`f57d98a`):** **fontes Jost+Homemade Apple servidas localmente** (woff2 em `fonts/`, RGPD: sem pedidos à Google; CSP sem hosts externos); **Cache-Control** no vercel.json (fonts/favicon imutáveis 1 ano, img/ 7 dias SWR); **versão EN completa** com selector PT/EN no canto (motor i18n mínimo `data-i18n`/`-html`/`-ph`, persiste em localStorage, `?lang=` prioritário, default por navigator.language); **smoke movido para o repo** (`scripts/smoke.mjs` auto-contido com mock, 29 verificações).
  - **Admin (`936001e`):** healthcheck novo — categoria Integrações passa a testar voucher.* + status.* alcançáveis e a RPC `get_voucher_by_code` (o caminho de que o site depende). Corre na página e no cron 7h. Preflight OK; sites live a 200.
  - **Arquitectura (sã):** estático + 2 fns serverless, RPC só devolve vales pagos/não-arquivados, XSS ok, headers fortes. **Smoke:** 29/29 verdes (Playwright+Edge), cartão e páginas PT+EN inspeccionados por screenshot; deploy live confirmado (0 refs cdnjs/googleapis, cache imutável nas fontes).
  - **Leva 3 (sessão 138, 08/07):** 9 melhorias de design/UX (envelope personalizado, pétalas, copiar código, `?vale=` no CTA, aviso de expirado, partilhar, OG image 1200×630, reduced-motion, zoom permitido) — detalhe na secção "Últimas sessões".
  - **Não feito de propósito (espera palavra da Maria):** **Umami no voucher** (analytics anónimos, opcional). O vale expirado passou a mostrar aviso discreto na sessão 138 (continua a abrir — o resto é conversa com a cliente).

---

## Próximas frentes (por ordem — ver "Próximo passo concreto" no topo)

- Varrimento `formatDateTimeLisbon` (129) → tipos gerados Supabase no preflight → vista "Hoje" + relatório mensal → expurgo WhatsApp do git (sessão dedicada) → cadência de comunicação (104)
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
- **Smoke test obrigatório** antes de fechar sessões que mexem em páginas críticas ([[feedback_smoke_test_obrigatorio]])
