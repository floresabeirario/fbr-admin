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
- Fase 2 iniciada. Schema BD criado, página de tabela funcional.

## Próximo passo CONCRETO
**Fase 2 — Passo crítico: executar a migração SQL no Supabase**

1. **OBRIGATÓRIO:** Abrir o Supabase Dashboard → SQL Editor → New query
   → Copiar e executar o ficheiro `supabase/migrations/001_create_orders.sql`
2. Após migração: testar criar uma encomenda pela página
3. Construir o **Workbench** (painel lateral de detalhe de cada encomenda)
   - Todos os campos da encomenda editáveis inline
   - Upload de foto das flores
   - Link para pasta Drive (manual por agora)
4. Implementar mudança de estado (dropdown inline na tabela)
5. Orçamento automático (ligado à tabela de preços em Finanças — Fase 6, por agora campo manual)

## Notas de sessão
- **2026-05-02 (sessão 1):** Leitura do PDF spec. Plano por fases definido.
- **2026-05-02 (sessão 2):** Fase 1 completa. Login Netflix com fotos a funcionar no Vercel. Mudámos de Google OAuth para email+password com subendereços Gmail. Deploy Vercel configurado com env vars.
- **2026-05-02 (sessão 3):** Fase 2 iniciada. Criados: `supabase/migrations/001_create_orders.sql`, `src/types/database.ts`, `src/lib/supabase/orders.ts`, `src/app/(admin)/preservacao/page.tsx` (tabela com grupos), `nova-encomenda-sheet.tsx` (formulário inicial). Build OK.
