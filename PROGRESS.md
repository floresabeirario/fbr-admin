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
- Fase 2 em curso. Tabela de encomendas a funcionar no Vercel.

## Próximo passo CONCRETO
**Fase 2 — Construir o Workbench**

1. Construir o **Workbench** (painel lateral/página de detalhe de cada encomenda)
   - Abrir ao clicar numa linha da tabela
   - Todos os campos da encomenda editáveis inline (com auto-save)
   - Upload de foto das flores
   - Link para pasta Drive (manual por agora)
2. Mudança de estado inline na tabela (dropdown directo na coluna Estado)
3. Marcar encomenda como "contactada" (botão rápido nas pré-reservas)

## Notas de sessão
- **2026-05-02 (sessão 1):** Leitura do PDF spec. Plano por fases definido.
- **2026-05-02 (sessão 2):** Fase 1 completa. Login Netflix com fotos a funcionar no Vercel. Mudámos de Google OAuth para email+password com subendereços Gmail. Deploy Vercel configurado com env vars.
- **2026-05-02 (sessão 3):** Fase 2 iniciada. Schema BD criado e migrado no Supabase. Tabela de encomendas com grupos colapsáveis a funcionar. Formulário "Nova Encomenda" funcional. Corrigido 403 (mudança para Server Component + Server Actions). Deploy OK.
