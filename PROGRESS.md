# FBR Admin — Estado do Projecto

> Este ficheiro é actualizado no fim de cada sessão de trabalho.
> No início de cada sessão, lê este ficheiro primeiro para retomar exactamente onde ficámos.

---

## Fase actual: FASE 1 — Fundação (em curso)

### Fases do projecto
- [ ] **Fase 1** — Fundação: Supabase ligado, Google OAuth, layout/navegação ← **EM CURSO**
- [ ] **Fase 2** — Preservação de Flores: tabela, workbench, estados, orçamento
- [ ] **Fase 3** — Vale-Presente + Status + Voucher sites
- [ ] **Fase 4** — Dashboard + Tarefas + Métricas
- [ ] **Fase 5** — Formulários públicos + Parcerias
- [ ] **Fase 6** — Integrações (Gmail, Drive, Calendar, AI) + PWA + RGPD completo

---

## O que está feito
- [x] Projecto Next.js criado com shadcn/ui
- [x] Fontes da marca: Tan Memories em `public/fonts/`, Google Sans via next/font
- [x] CLAUDE.md com spec completa da plataforma
- [x] Plano por fases definido
- [x] Supabase ligado ao projecto (`src/lib/supabase/client.ts` + `src/lib/supabase/server.ts`)
- [x] `.env.local` com credenciais Supabase (URL + anon key)
- [x] `src/proxy.ts` — protecção de rotas (redireciona para /login se não autenticado)
- [x] `src/app/login/page.tsx` — página de login com botão Google OAuth (design FBR)
- [x] `src/app/auth/callback/route.ts` — callback OAuth
- [x] `src/app/(admin)/layout.tsx` — layout com sidebar colapsável (todas as 10 abas)
- [x] `src/app/(admin)/page.tsx` — dashboard (mostra nome do utilizador)
- [x] Páginas placeholder para todas as abas (preservacao, vale-presente, status, parcerias, financas, entregas-recolhas, ecossistema, healthchecks, ideias)
- [x] Build limpo sem erros

## O que está a fazer (em curso)
- A aguardar que a Maria configure o Google OAuth no Supabase (instruções abaixo)

## Próximo passo CONCRETO
**Fase 1 — Passo 2:** Configurar Google OAuth no Supabase.

### Instruções para a Maria:

**Parte A — Google Cloud Console**
1. Vai a console.cloud.google.com e cria um projecto novo chamado "fbr-admin"
2. No menu lateral: APIs & Services → OAuth consent screen
   - User Type: External → Create
   - App name: "FBR Admin", User support email: info@floresabeirario.pt
   - Developer contact: info@floresabeirario.pt → Save and Continue (nas outras secções clica só "Save and Continue")
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: "FBR Admin"
   - Authorized redirect URIs: adicionar `https://jfwxntcyhylmjahxoeyr.supabase.co/auth/v1/callback`
   - Create → copiar o **Client ID** e **Client Secret**

**Parte B — Supabase**
4. No painel Supabase → Authentication → Providers → Google → Enable
5. Colar o Client ID e Client Secret
6. Save

**Parte C — Testar**
7. Correr `npm run dev` no terminal do VS Code
8. Abrir http://localhost:3000 — deve redirigir para /login
9. Clicar "Continuar com Google" e fazer login com info@floresabeirario.pt

Depois de funcionar, o próximo passo é começar a **Fase 2 — Preservação de Flores**.

## Decisões pendentes / perguntas em aberto
- Nenhuma de momento.

## Notas de sessão
- **2026-05-02 (sessão 1):** Leitura do PDF da spec completa. Plano por fases definido. CLAUDE.md actualizado com spec.
- **2026-05-02 (sessão 2):** Supabase criado. Fase 1 quase completa — falta apenas configurar Google OAuth no Supabase/Google Cloud Console (instruções acima). Build limpo e funcional.
