# FBR Admin

Plataforma admin da **Flores à Beira Rio** — [admin.floresabeirario.pt](https://admin.floresabeirario.pt)

## Documentação

- **[CLAUDE.md](CLAUDE.md)** — spec completa da plataforma (abas, campos, integrações, RGPD)
- **[PROGRESS.md](PROGRESS.md)** — estado actual do projecto e próximos passos
- **[AGENTS.md](AGENTS.md)** — notas para a Claude Code

## Stack

- Next.js 16 + TypeScript
- Supabase (auth + BD + storage)
- shadcn/ui + Tailwind v4
- Deploy: Vercel

## Comandos

```bash
npm run dev         # arrancar dev server
npm run build       # build produção
npm run lint        # ESLint
npm run preflight   # tsc --noEmit && next build (checks antes de push)
npm run smoke       # smoke test em Playwright (precisa de SMOKE_EMAIL/PASSWORD em .env.local)
```

## Repos relacionados

- [`fbr-website`](https://github.com/floresabeirario/fbr-website) — site público (forms de reserva + vale-presente)
- [`fbr-voucher`](https://github.com/floresabeirario/fbr-voucher) — voucher.floresabeirario.pt
- [`fbr-tracking`](https://github.com/floresabeirario/fbr-tracking) — status.floresabeirario.pt
