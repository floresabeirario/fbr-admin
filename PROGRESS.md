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
- Fase 2 em curso. Tabela + formulário "Nova Encomenda" + Workbench redesenhado a funcionar.

## Próximo passo CONCRETO
**Fase 2 — Continuar o Workbench**

1. Mudança de estado inline na tabela (dropdown directo na coluna Estado)
2. Marcar encomenda como "contactada" (botão rápido nas pré-reservas)
3. Upload real da foto da encomenda (Supabase Storage) — actualmente só URL
4. Diálogo ao mudar pagamento ("anexar comprovativo? cliente pediu NIF?")

## Notas de sessão
- **2026-05-02 (sessão 1):** Leitura do PDF spec. Plano por fases definido.
- **2026-05-02 (sessão 2):** Fase 1 completa. Login Netflix com fotos a funcionar no Vercel. Mudámos de Google OAuth para email+password com subendereços Gmail. Deploy Vercel configurado com env vars.
- **2026-05-02 (sessão 3):** Fase 2 iniciada. Schema BD criado e migrado no Supabase. Tabela de encomendas com grupos colapsáveis a funcionar. Formulário "Nova Encomenda" funcional. Corrigido 403 (mudança para Server Component + Server Actions). Deploy OK.
- **2026-05-03 (sessão 4):** Corrigido erro 500 no formulário "Nova Encomenda". Causa: role `authenticated` sem EXECUTE em `generate_order_id()` e sem INSERT em `audit_log`. Fix em `003_fix_permissions.sql` (executado no Supabase SQL Editor). Criação de encomendas a funcionar no Vercel.
- **2026-05-03 (sessão 5):** Workbench redesenhado para cobrir toda a spec. Adicionados: hero com foto da encomenda (placeholder elegante quando vazia), atalhos rápidos (Drive, página pública de status, copiar ID), bloco Extras no quadro (opções + texto livre), Peças extra (mini-quadros, ornamentos, pendentes com qty condicional), Galeria de inspiração (add/remove de URLs com preview), placeholders para Comunicações Gmail/WhatsApp e Assistente IA, NIF + anexo de fatura condicional, parceiro recomendador (select desactivado a aguardar aba Parcerias), alerta visual de fatura em falta, contagem decrescente até evento.
