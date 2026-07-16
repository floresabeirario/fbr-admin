# FBR Admin — Estado do Projecto

> Lido no início de cada sessão; actualizado em tempo real durante a sessão.
> **Regras deste ficheiro:** máximo ~30 KB. Só as últimas 5 sessões ficam aqui, em formato compacto
> (template: O quê / Ficheiros / Migrações + passos manuais / Smoke / Pendente, máx ~15 linhas).
> Ao entrar a 6ª sessão, a mais antiga move-se **na íntegra** para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md)
> (que NÃO é lido por defeito — todo o histórico das sessões 1-132 está lá). O detalhe fino vive nos commits do git.
> ⚠️ Hashes de commits do fbr-admin anteriores a 11/07/2026 foram reescritos no expurgo RGPD (sessão 139) — já não existem.

---

## Onde estamos

**Fase 6 — Integrações + PWA + RGPD (em curso).** Última sessão: **144** (2026-07-16, fbr-voucher: página ficava presa com zoom no browser do WhatsApp — corrigido, EM PRODUÇÃO `ab0d11a`).

### ⚠️ Pendentes de confirmação da Maria (verificar antes de assumir)
- [ ] **Sessão 144 (fbr-voucher, EM PRODUÇÃO 16/07):** smoke no telemóvel via WhatsApp: reabrir o link de um vale real → envelope com selo e nome centrados; tentar pinch na página → já não faz zoom do browser (com o cartão aberto, o pinch próprio do cartão continua a funcionar); avisar a Diana/Teresa que podem reabrir o link (o problema era zoom acidental, não os dados)
- [ ] **Sessão 143 (fbr-website, EM PRODUÇÃO desde 14/07 — merge `0c12950`, deploy READY, verificado por script):** smoke visual da Maria em produção: campo do telemóvel formata sozinho ("912 345 678") e avisa algarismos a mais/menos ao sair; +351 a começar por 8 → erro do 1º dígito; email "teste@gmail.con" → sugestão clicável; "maria@gmail.com." → ponto some ao sair; form de reserva com `?vale=UMCODIGO` → código e "como conheceu" preenchidos; código inventado (XXXXXX) → aviso "não encontrámos" (já verificado por script, mas vale ver o aspecto); dropdown com países novos (procurar "Macau"); ecrã de sucesso mostra o contacto escolhido (ao submeter a próxima reserva real, ou uma de teste); dos 2 forms (reserva + vale, PT e EN): nº de telemóvel errado (algarismos a mais/menos) → mensagem clara ao sair do campo e no submit; nº certo → submete normalmente; o campo formata sozinho enquanto se escreve ("912 345 678") e colar "+351 912…" limpa o indicativo; email com gralha (ex.: "teste@gmail.con") → sugestão clicável "Quis dizer…?"; submeter a sério 1 reserva de teste → ecrã de sucesso mostra o contacto escolhido e a encomenda entra no admin com o nº limpo; dropdown de indicativos com os países novos (procurar "Macau"). Depois do OK → commit + push (develop→main como habitual no site).
- [ ] **Sessão 141 (fbr-website, EM PRODUÇÃO):** (a) smoke: página do bouquet (FAQ nova "eternizar" no topo + link do guia em Investimento), Opções (link "Quanto custa..." no bloco verde do CTA), titles dos separadores; (b) **GSC → Inspeção de URLs → pedir reindexação** das 6 páginas alteradas (bouquet PT/EN, opções PT/EN, artigo quanto-tempo-duram PT/EN)
- [x] **Mig 093** corrida no Supabase ✅ (confirmado pela Maria, 12/07 — deploy da sessão 140 desbloqueado)
- [ ] **Smoke sessão 140 (o que sobrou depois dos cortes da 142):** cards colapsados certos nas várias fases (com resumo, clique abre); estado → "Quadro enviado" com CTT → diálogo de tracking e link "Seguir" a abrir a página dos CTT com o objecto; página de um parceiro → bloco Comissões; Dashboard → alerta de comissões por pagar. (Banner "Próxima acção" e checklist já NÃO existem — removidos na 142.)
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

### Sessão 144 (2026-07-16) — fbr-voucher: página ficava presa com zoom no browser do WhatsApp
- **O quê (screenshots de um vale real no telemóvel: selo do envelope descentrado, cartão cortado, scroll horizontal):** diagnóstico = **pinch-zoom do browser** activo no browser interno do WhatsApp. Com a página zoomada, os elementos `position: fixed` (selo, marca, PT/EN, bottom-ui) ficam colados ao layout original e aparecem descentrados — parecia tudo partido, mas era só zoom preso, sem gesto óbvio de recuperação num in-app browser. Porta de entrada: o overlay do envelope tinha `touch-action: manipulation` (permite pinch) e o viewport permitia zoom da página (item 9 da sessão 138, acessibilidade — **revertido**: na prática só servia para deixar a página presa).
- **Fix:** viewport passa a `maximum-scale=1.0, user-scalable=no`; `#env-overlay` passa a `touch-action: pan-y`. O pinch-zoom custom do cartão (JS) mantém-se. Comentários desactualizados corrigidos.
- **Ficheiros (fbr-voucher):** `index.html` apenas. **Migrações:** nenhuma.
- **Smoke:** suite completa 44/44 ✅ (Playwright+Edge, mock local) + verificação extra com toque simulado (contexto Android mobile: viewport meta, touch-action efectivo, selo centrado, toque abre envelope e cartão, sem erros JS). **EM PRODUÇÃO:** `ab0d11a` pushed, deploy Vercel confirmado live por script. (CI do GitHub corre a mesma suite; `gh` sem auth local para ver o run.)
- **Parte 2 (mesma sessão) — preview de partilha:** a Maria não quer a capa do cartão no preview do WhatsApp, quer **o presente azul do favicon**. `og-voucher.jpg` regenerado (presente 560px sobre creme da marca, 23 KB) via [render-og.mjs](../fbr-voucher/fbr-voucher/scripts/render-og.mjs) reescrito; `api/share.js` passa a apontar `og:image` para `?v=2` (a Meta guarda cache da imagem por URL exacto — **incrementar o `?v=` a cada redesign da imagem**). Commits `bd64585`+`05641e6`, live verificado por script (og:image com v=2 servido ao UA do WhatsApp).
- **Pendente:** smoke visual da Maria no telemóvel (topo deste ficheiro); mensagens JÁ enviadas guardam o preview antigo para sempre (é embutido na mensagem) — reenviar o link; se o reenvio ainda mostrar o cartão (cache da Meta por URL da página), acrescentar `?v=2` ao link ou usar o Sharing Debugger.

### Sessão 143 (2026-07-14) — fbr-website: validação do telemóvel por indicativo + lista de indicativos completa
- **O quê (pedido da Maria: clientes enganam-se no nº e dá trabalho corrigir por email):** **(1)** Novo [app/_lib/phone-validation.js](../fbr-website/fbr-website/app/_lib/phone-validation.js) — nº de algarismos esperado por indicativo (~100 países mapeados; desconhecidos caem num intervalo genérico 6-14, **nunca bloqueia ninguém**); tolera espaços/hífenes/parêntesis (só conta algarismos); ignora o 0 inicial (trunk) nos países onde se escreve (UK "07912…", FR "06…"); trunks especiais (+7→"8", +36→"06"); detecta o **indicativo repetido no número** ("+351 912…" / "00351 912…") sem o contar 2×. **(2)** Ligado aos **3 campos de telefone** dos forms públicos (reserva + vale remetente + vale destinatário-WhatsApp): mensagem específica ("Um número com o indicativo +351 tem 9 algarismos e este tem 8…") no submit, ao sair do campo (blur) e ao trocar de indicativo. **(3)** [PhonePrefix.jsx](../fbr-website/fbr-website/app/_components/PhonePrefix.jsx): lista completada com **~110 países/territórios novos** (antes faltavam Macau, Timor-Leste, Andorra, Rússia, Filipinas, quase toda a África não-lusófona, Caraíbas, Oceânia…) + fix: em códigos partilhados (+1, +7) o botão mostrava sempre o 1º país da lista, agora mostra o escolhido. **(4)** 2 chaves de erro novas ×2 namespaces em `messages/pt.json`+`en.json`.
- **Leva 2 (aprovada pela Maria na mesma sessão; checkbox "confirmo o nº" rejeitada por ambos; validação server-side rejeitada por ela):** **(5) Ecrã de sucesso repete o contacto escolhido** — WhatsApp: "Entraremos em contacto por WhatsApp para o número **+351 912 345 678**. Se este número não estiver correcto, escreva-nos para info@…"; E-mail: idem + "Espreite também a pasta de spam". Nos 2 forms, texto neutro no género. **(6)** successP1/P2 da reserva afinados: já não prometem "e-mail" (a Maria contacta pelo canal preferido, 90% WhatsApp) → "a nossa mensagem". **⚠️ Esclarecido: o cliente NÃO recebe email de confirmação nenhum** — o Resend do site é só a notificação interna para info@ (a spec original previa email ao cliente mas nunca foi implementado). **(7) Auto-formatação do campo de telefone** enquanto escreve (912345678 → "912 345 678"; colar "+351 912…" limpa o indicativo repetido logo no campo; cursor não salta ao editar a meio; backspace num espaço apaga o algarismo anterior) — substituiu a linha "Vamos usar: …" da 1ª versão, que a Maria achou redundante ao ver no preview. **(8)** A submissão passa a guardar o número **normalizado** (`normalizePhone().full`: sem espaços, sem trunk 0, sem indicativo duplicado — antes "+351"+"+351912…" ia parar à BD tal e qual). **(9) Sugestão de typo no email** ("Quis dizer maria@gmail.com?", clicável, nunca bloqueia) nos 3 campos de email dos 2 forms — novo `app/_lib/email-suggest.js` (Damerau-Levenshtein ≤1, ou ≤2 em domínios ≥8 chars; ~45 domínios conhecidos incl. sapo/meo/netcabo/iol).
- **Leva 3 (aprovada: "1 go, 2 go com ou contacte-nos, 3 ok, 4 não, 5 ok"):** **(10) `?vale=CODIGO` finalmente lido** pelo form de reserva (pendente da sessão 138): pré-preenche o código + "como conheceu"=Vale-Presente, sem pisar nada já preenchido. **(11) Verificação do código do vale ao sair do campo** — nova rota `/api/verificar-vale` (origem+rate-limit; usa a RPC `get_voucher_by_code` com anon key, mesma via do site do voucher; devolve SÓ `{existe}`, zero PII); aviso "Não encontrámos nenhum vale com este código. Confirme… ou contacte-nos." — só com a certeza "não existe"; erro de rede/limite = silêncio; nunca bloqueia. Campo também se limpa (maiúsculas, sem espaços) ao sair. **(12) 1º dígito PT:** com +351, número que não comece por 9/2/3 (plano ANACOM; a mensagem só fala de 9 e 2) → erro "Os números portugueses começam por 9 (telemóvel) ou 2 (fixo)". **(13) `cleanEmail`** ao sair dos 3 campos de email: remove espaços e pontuação final ("maria@gmail.com." → limpo sozinho). **Rejeitado pela Maria:** aviso na data do evento (item 4).
- **Leva 4 (aprovada: "2 - go" das sugestões gerais = medir abandono):** **(14) Funil de abandono no Umami** — evento na 1ª interacção com cada secção (`reserva-seccao-pessoais/evento/logistica/quadro/extras/outros` e `vale-seccao-remetente/vale/entrega/outros`), evento `reserva-submit-erros`/`vale-submit-erros` com a lista de NOMES dos campos em erro (zero dados pessoais) e novo `vale-enviado` no sucesso (a reserva já tinha `reserva-enviada`). Comparar contagens secção→secção→enviada no painel do Umami mostra onde as pessoas desistem — decidir melhorias de UX do form (rascunho automático? passos?) só depois de haver dados.
- **Ficheiros (fbr-website):** `app/_lib/phone-validation.js` NOVO, `app/_lib/email-suggest.js` NOVO, `app/api/verificar-vale/route.js` NOVO, `app/_components/PhonePrefix.jsx`, `app/reservar-preservacao/ReservarPreservacaoForm.jsx`+`.css`, `app/vale-presente/ValeApresenteForm.jsx`+`.css`, `messages/pt.json`+`en.json`.
- **Migrações:** nenhuma. **Smoke:** 89 testes unitários dos módulos reais (Node) todos verdes (espaços, indicativo repetido, trunk 0/8/06, códigos partilhados, normalização, auto-formatação com cursor, typos de email, domínios legítimos intocados) + JSON validado + `next build` ✅. Develop `0110ca0`→`337b6a2` (4 levas) e **merge→main `0c12950` EM PRODUÇÃO** (OK da Maria, 14/07). Verificação pós-deploy por script: deploy READY na Vercel (SHA confere), páginas reservar PT/EN + vale + home a 200, `/api/verificar-vale` a devolver 403 sem Origin e `{existe:false}` com código inventado (RPC viva em produção).

### Sessão 142 (2026-07-14) — Workbench: removidos "Próxima acção" e "Checklist da fase"
- **O quê:** a Maria viu a sessão 140 em produção e não gostou do banner "Próxima acção" nem do card "Checklist da fase" → **removidos por completo** (apagados [next-action.tsx], [checklist-card.tsx] e [lib/phase-checklist.ts]; limpo o workbench-client e o tipo `Order`). O resto da 140 fica: cards colapsados, diálogo de tracking CTT, comissões no parceiro e no Dashboard.
- **Coluna órfã:** `orders.phase_checklist` (mig 093, já aplicada) fica na BD **sem uso no código** — inofensiva (default `'{}'`); nota deixada em [types/database.ts](src/types/database.ts). Dropar numa migração futura se incomodar. As outras 2 colunas da 093 (`frame_tracking_code`/`frame_shipped_date`) continuam em uso.
- **Ficheiros:** workbench-client.tsx, types/database.ts, 3 ficheiros apagados.
- **Migrações:** nenhuma (nada a correr). **Smoke:** preflight ✅; visual = confirmar que o banner e o card desapareceram do workbench.
- **Pendente:** nada.

### Sessão 141 (2026-07-12) — fbr-website: análise do CSV do Search Console + pacote SEO (CTR/eternizar/preços)
- **O quê:** Maria descarregou o export do GSC (últimos 3 meses: ~470 cliques, ~4.800 impressões, tendência ascendente; metade dos cliques vem do rich snippet de avaliações; 77% mobile). 4 oportunidades identificadas e aplicadas com OK explícito: **(1)** artigo "quanto tempo duram flores preservadas" (PT+EN) estava em posição 3,6 com **0% CTR** porque o title/description davam a resposta toda no snippet → reescritos ("De 5 anos a 3 séculos", description que deixa o porquê para dentro da página); **(2)** query "eternizar buquê de noiva portugal" (posição 8,6) sem a palavra no title → title do bouquet agora "Preservar Bouquet de Noiva em Portugal: Eternize o Seu Ramo" (frase exacta que ganha em 1,6 ficou intacta) + pergunta nova no topo da FAQ ("O que significa eternizar o bouquet de noiva?") na FAQ visível E no schema JSON-LD (page.js tem os dois em separado); **(3)** preços: title de Opções passa a "Preços da Preservação de Flores: 300€ a 500€" (EN análogo) + links internos bidireccionais bouquet/preços ↔ artigo "quanto custa" (chaves novas `pricingBlogLink`/`ctaBlogLink`); **(4)** Momentos Especiais ganha o verbo "Preservar" no title PT. /contactos deixado em paz (posição 27 é tráfego de quem procura floristas, nunca foi nosso).
- **Ficheiros (fbr-website):** `messages/pt.json`+`en.json`, `[locale]/preservar-bouquet-noiva/page.js` (schema), `BouquetNoivaClient.jsx`, `OpcoesClient.jsx`, 2 MDX do blog (PT+EN).
- **Migrações:** nenhuma. **EM PRODUÇÃO:** `d088de9` (develop) + merge `4711ba1` (main, --no-ff) pushed 12/07 com OK da Maria. Build ✅ antes do push; JSON validado.
- **Smoke (Maria, em produção):** página do bouquet (FAQ nova no topo + link do guia na secção Investimento), Opções (link "Quanto custa..." no bloco verde), titles dos separadores nas 2 páginas + artigo.
- **Passos manuais (Maria):** GSC → Inspeção de URLs → pedir reindexação das 6 páginas alteradas (bouquet PT/EN, opções PT/EN, artigo quanto-tempo-duram PT/EN).
- **Pendente/estratégico (da análise):** pedir avaliações Google a cada quadro entregue (só 7; metade dos cliques vem das estrelas — ideia: lembrete no admin em "Quadro recebido"); backlinks dos parceiros aceites; artigos da análise de mercado de 06/07 por implementar; pesquisas em espanhol ("conservar ramo de novia") a aparecer sem versão ES.

### Sessão 140 (2026-07-12) — Workflow do workbench: colapso por fase, próxima acção, checklist, comissões
- **O quê (pedido da Maria: sugestões de melhoria de fluxo, aprovadas com cortes):** **(1) Cards auto-colapsados por estado** — o [Card](src/app/(admin)/preservacao/[id]/_components/layout.tsx) ganhou `autoCollapsed`+`summary` (resumo de 1 linha; € num slot `text-right` via `CardSummary`; clique no cabeçalho abre/fecha, override manual reseta quando o estado muda). Regras: Envio colapsa de "Flores recebidas" até reabrir em "Quadro pronto/enviado"; Flores/quadro/extras a partir de "Quadro pronto"; Origem a partir de "Flores recebidas"; Inventário fora da janela [Flores recebidas, A ser emoldurado); Galeria a partir de "A ser emoldurado"; Finanças quando 100% pago sem fatura em falta nem acerto; Cupão antes de "A ser emoldurado" ou depois de utilizado; Entrega/feedback quando tudo tratado; cancelado colapsa tudo. **Parceria ficou de fora (decisão da Maria).** **(2) Banner "Próxima acção"** ([next-action.tsx](src/app/(admin)/preservacao/[id]/_components/next-action.tsx)) — 1 linha sob o header, só quando há acção concreta; não duplica os alertas de fatura/aprovação nem os chips 40/30%. **(3) Checklist da fase** ([checklist-card.tsx](src/app/(admin)/preservacao/[id]/_components/checklist-card.tsx) + [lib/phase-checklist.ts](src/lib/phase-checklist.ts)) — itens standard por grupo de estados (labels afináveis no código) + itens custom por encomenda; estado em `orders.phase_checklist` (mig 093); badge N/M; colapsa quando completa. **(4) Prompts de transição:** "Quadro enviado" por CTT sem tracking → diálogo pede registo CTT + data de envio (novos `frame_tracking_code`/`frame_shipped_date`, mig 093; campos+link "Seguir" no cartão de envios; "Mais tarde" nunca bloqueia); "Flores recebidas" sem foto → lembrete para fotografar (encadeia depois do diálogo dos 40%). **(5) Comissões:** página do parceiro ganhou bloco Comissões (pagas vs por pagar + lista das pendentes com link, € à direita; select do page.tsx agora traz `partner_commission*`); Dashboard ganhou alerta agregado "Comissões de parceria por pagar (N)" com total num slot € (novo campo `amount` no `DashboardAlert`). **(6)** Navegação ◀▶ entre encomendas **já existia** (WorkbenchNavigator + setas do teclado) — nada feito.
- **Ficheiros:** mig [093](supabase/migrations/093_checklist_fase_e_tracking_quadro.sql), [types/database.ts](src/types/database.ts), workbench `_components/` (layout, shipping, flowers, origin, gallery×2, finance, closing×2, dialogs, next-action NOVO, checklist-card NOVO), [workbench-client.tsx](src/app/(admin)/preservacao/[id]/workbench-client.tsx), [lib/phase-checklist.ts](src/lib/phase-checklist.ts) NOVO, [lib/dashboard.ts](src/lib/dashboard.ts), dashboard [alerts-card.tsx](src/app/(admin)/_components/dashboard/alerts-card.tsx), parcerias `[id]/page.tsx`+`workbench-client.tsx`.
- **Migrações + passos manuais:** mig 093 ✅ **aplicada** (12/07, antes do deploy — ordem certa).
- **Smoke:** preflight ✅ (tsc + testes + build). **Visual pendente (Maria):** abrir 1 encomenda em cada fase (pré-reserva / preservação / finalização / concluída) → cards certos colapsados com resumo e a abrir ao clique; banner "Próxima acção"; checklist a marcar e a persistir; mudar um estado para "Quadro enviado" (CTT) → diálogo de tracking e link "Seguir" a abrir a página certa dos CTT; página de um parceiro com comissões; alerta de comissões no Dashboard.
- **Pendente:** labels da checklist são uma primeira proposta — afinar com a Maria depois de usar. Link CTT usa o formato `appserver.ctt.pt/...ObjectCodeInput=` — se não abrir directo no objecto, trocar o URL em `cttTrackingUrl` (shipping-card.tsx).

> Sessões 127-139 movidas para o [PROGRESS-ARQUIVO.md](PROGRESS-ARQUIVO.md).

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
