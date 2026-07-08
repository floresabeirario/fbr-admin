# Registo de Segredos — Ecossistema FBR

> ⚠️ **Este ficheiro NÃO contém valores.** Só nomes, onde vivem, e quando rodar.
> Os valores reais estão na Vercel (Environment Variables) e no GitHub (Actions Secrets).
> Nunca colar chaves aqui — é um repo, não um cofre.

## Porquê

Os segredos estão espalhados por 4 repos × 2 ambientes (Vercel + GitHub). Sem uma lista
única, uma rotação é esquecida ou um segredo partilhado muda num sítio e não no outro.
Esta é a lista canónica.

## Segredos partilhados entre repos (os perigosos)

| Segredo | Onde vive | Repos que precisam | Notas |
|---------|-----------|--------------------|-------|
| `INTERNAL_NOTIFY_SECRET` | Vercel (admin) + Vercel (website) | admin, website | Se mudar num, muda no outro senão o push do form silencia |
| `NEXT_PUBLIC_SUPABASE_URL` / anon key | Vercel (admin, website) + tracking + voucher | os 4 | Anon key é pública por design (RLS protege); URL idem |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (admin) + Vercel (website) | admin, website | **Bypassa RLS** — só server-side; nunca `NEXT_PUBLIC_*` |
| `CRON_SECRET` | GitHub Actions + Vercel (admin) | admin | Autentica GitHub Actions → `/api/cron/*` |
| `VAPID_*` (4 chaves) | Vercel (admin) | admin | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tem de estar antes do build |

## Segredos só do admin

`ANTHROPIC_API_KEY` · `WHATSAPP_ACCESS_TOKEN` · `WHATSAPP_VERIFY_TOKEN` · `META_APP_SECRET` ·
`GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI` ·
`NEXT_PUBLIC_GOOGLE_MAPS_KEY` · `NEXT_PUBLIC_TURNSTILE_SITE_KEY` · `NEXT_PUBLIC_SITE_URL` ·
`VOUCHER_SITE_URL` · `STATUS_SITE_URL` · (webhook path token — ver rotação abaixo)

## Segredos só do website

`TURNSTILE_SECRET` (fail-closed em produção — se sumir, o `monitor-forms` alarma) ·
chave do Resend (emails de confirmação + relatório mensal Clarity) · segredos de analytics.
> ⚠️ Confirmado em Production na Vercel do site (auditoria 133). Fonte única para os forms.

## Segredos do tracking / voucher

`SUPABASE_URL` + `SUPABASE_ANON_KEY` (ambos). O voucher só toca a RPC `get_voucher_by_code`.

## Calendário de rotação

| Segredo | Frequência | Última vez | Como |
|---------|-----------|-----------|------|
| Webhook WhatsApp (path token) | **1×/ano** (risco aceite: sem HMAC, limitação Dualhook) | _(preencher)_ | Mudar o token no path + na config Meta |
| `INTERNAL_NOTIFY_SECRET` | Se houver suspeita de fuga | — | Rodar nos 2 repos ao mesmo tempo |
| `SUPABASE_SERVICE_ROLE_KEY` | Se houver suspeita de fuga | — | Supabase → rodar → actualizar admin + website |
| `ANTHROPIC_API_KEY` | Se houver suspeita de fuga | — | Console Anthropic |

> A rotação anual do webhook é o item mais fácil de esquecer. **Marcar no calendário.**

## Regras
- `NEXT_PUBLIC_*` entram no bundle → são **públicos**. Nunca meter aí nada sensível.
- A Vercel **não** redeploya sozinha ao mudar env vars — forçar redeploy.
- `NEXT_PUBLIC_*` só entram no **build seguinte**.
