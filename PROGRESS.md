# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 2 — Preservação de Flores

### Fases do projecto
- [x] **Fase 1** — Fundação: Supabase ligado, autenticação, layout/navegação ✅
- [ ] **Fase 2** — Preservação de Flores: tabela, workbench, estados, orçamento ← **A SEGUIR**
- [ ] **Fase 3** — Vale-Presente + Status + Voucher sites
- [ ] **Fase 4** — Dashboard + Tarefas + Métricas
- [ ] **Fase 5** — Formulários públicos + Parcerias
- [ ] **Fase 6** — Integrações (Gmail, Drive, Calendar, AI) + PWA + RGPD completo

---

## O que está feito
- [x] Projecto Next.js com shadcn/ui
- [x] Fontes da marca: Tan Memories + Google Sans
- [x] CLAUDE.md com spec completa da plataforma
- [x] Supabase ligado (`src/lib/supabase/client.ts` + `src/lib/supabase/server.ts`)
- [x] `.env.local` + variáveis no Vercel
- [x] `src/proxy.ts` — protecção de rotas
- [x] Login estilo Netflix com fotos (António, MJ, Ana) — `src/app/login/page.tsx`
  - Fotos em `public/userphotos/`
  - Emails: info+antonio / info+mj / info+ana @floresabeirario.pt
  - António e MJ = admin | Ana = viewer (permissões a implementar na Fase 2)
- [x] 3 utilizadores criados no Supabase (email + password)
- [x] `src/app/(admin)/layout.tsx` — sidebar colapsável com 10 abas
- [x] Dashboard + páginas placeholder para todas as abas
- [x] Deploy no Vercel a funcionar em fbr-admin2.vercel.app

## O que está a fazer (em curso)
- Fase 2 em curso. Tabela com edição inline + workbench redesenhado + diálogo de pagamento a funcionar.

## Próximo passo CONCRETO
**Fase 2 — A finalizar**

1. Visualizações alternativas: Calendário (mostra Data do evento) e Timeline
2. Estados públicos mapeados (11 estados externos para o site status.floresabeirario.pt)
3. Geração automática da pasta Drive ao criar encomenda (Google Drive API — Fase 6)
4. Permissões: Ana (viewer) só pode editar tarefas e Parcerias

**Decisão arquitetural confirmada (2026-05-03):** todos os ficheiros relacionados com encomendas (fotos, comprovativos, faturas, inspirações) são guardados no Google Drive, na pasta do cliente. A plataforma só guarda o URL/link. Não usar Supabase Storage para isto.

## Notas de sessão
- **2026-05-02 (sessão 1):** Leitura do PDF spec. Plano por fases definido.
- **2026-05-02 (sessão 2):** Fase 1 completa. Login Netflix com fotos a funcionar no Vercel. Mudámos de Google OAuth para email+password com subendereços Gmail. Deploy Vercel configurado com env vars.
- **2026-05-02 (sessão 3):** Fase 2 iniciada. Schema BD criado e migrado no Supabase. Tabela de encomendas com grupos colapsáveis a funcionar. Formulário "Nova Encomenda" funcional. Corrigido 403 (mudança para Server Component + Server Actions). Deploy OK.
- **2026-05-03 (sessão 4):** Corrigido erro 500 no formulário "Nova Encomenda". Causa: role `authenticated` sem EXECUTE em `generate_order_id()` e sem INSERT em `audit_log`. Fix em `003_fix_permissions.sql` (executado no Supabase SQL Editor). Criação de encomendas a funcionar no Vercel.
- **2026-05-03 (sessão 5):** Workbench redesenhado para cobrir toda a spec. Adicionados: hero com foto da encomenda (placeholder elegante quando vazia), atalhos rápidos (Drive, página pública de status, copiar ID), bloco Extras no quadro (opções + texto livre), Peças extra (mini-quadros, ornamentos, pendentes com qty condicional), Galeria de inspiração (add/remove de URLs com preview), placeholders para Comunicações Gmail/WhatsApp e Assistente IA, NIF + anexo de fatura condicional, parceiro recomendador (select desactivado a aguardar aba Parcerias), alerta visual de fatura em falta, contagem decrescente até evento.
- **2026-05-03 (sessão 6):** Tabela de encomendas com edição inline. (1) Coluna Estado é agora um dropdown clicável que muda o estado sem abrir o workbench. (2) Pré-reservas mostram botão "Marcar contactada" rápido na linha; quando contactadas mostram badge verde. (3) Workbench com diálogo de confirmação ao mudar pagamento para qualquer estado pago — lembra anexar comprovativo à Drive e pergunta se cliente pediu NIF (com input do NIF inline). Confirmado que todos os ficheiros vão para a Drive e não para Supabase Storage.
- **2026-05-03 (sessão 7):** Workbench reorganizado para 3 colunas. **Esquerda (sticky)**: Comunicações (tabs Email/WhatsApp coloridos) + Assistente IA — visíveis logo ao abrir a encomenda. **Meio**: hero com foto vertical 3:4 + sumário + atalhos (Drive, status público, copiar ID), seguido de Cliente, Evento, Flores, Extras, Peças extra, Galeria, Origem. **Direita**: Finanças, Parceria, Entrega, Cupão, Metadata. Removida a caixa "Pasta Google Drive" duplicada — edição via popover no atalho do hero. Adicionada paleta de cores discretas (borda esquerda + ícone) por secção: rose/amber/emerald/orange/indigo/pink/slate/green/sky/purple/yellow/violet/blue. Guardada na memória a decisão de auto-criar pasta Drive ao 1º pagamento (Fase 6).
- **2026-05-03 (sessão 8):** Vista "Workbench" da listagem trocada por **Cards** (foto + nome + data); workbench dedicado fica só ao clicar numa encomenda. URL do workbench passa a usar `order_id` (curto) em vez do UUID — `/preservacao/<order_id>`; UUID antigo continua a resolver, por compatibilidade. Lembrete (diálogo) ao mudar estado para *Quadro recebido* a pedir data de entrega. Campo "Código vale-presente" só aparece quando `how_found_fbr = vale_presente`. Card "Cupão 5%" passa a estar sempre visível (com mensagem quando o código ainda não foi gerado). "Cliente pediu fatura com NIF" trocado de checkbox para Select **Sim/Não** (workbench + diálogo de pagamento). Botão "Copiar ID" redundante removido do hero (mantido o do header, ao clicar no `#…`). Layout admin passa de `min-h-screen` para `h-screen overflow-hidden` para a parte de baixo da sidebar (perfil, sair, theme, colapsar) ficar sempre visível mesmo em páginas longas como o workbench.
- **2026-05-03 (sessão 9):** Bug visual: o `SelectValue` (base-ui, não Radix) mostrava o valor cru do enum (`quadro_recebido`, `nao_disse_nada`…) em vez do texto do `SelectItem`. Corrigido com prop `labels` no `SelectValue` que mapeia valor → label legível. Adicionados mapas de labels em `database.ts` para todos os enums (contacto, eventos, envio, fundo, tamanho, sim/não, origem, comissão, cupão, feedback, idioma) e aplicados em todos os `<Select>` da Preservação (tabela, workbench, diálogos, formulário Nova encomenda).
- **2026-05-03 (sessão 10):** Tabela de encomendas redesenhada com colunas adaptadas ao ciclo de vida. Colunas fixas: Cliente · Data evento · Localização · Estado · Orçamento · Pagamento. Coluna de logística condicional: **Envio das flores** nos grupos Pré-reservas/Sem resposta/Reservas/Cancelamentos (como as flores chegam à FBR), **Receção do quadro** nos grupos Preservação e design/Finalização/Concluídos (como o quadro chega ao cliente). Removida a coluna ID e o tipo de evento simplificado para subtítulo cinzento da célula Cliente.
