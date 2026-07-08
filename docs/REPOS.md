# Os 4 Repos FBR — caminhos, build e CI

> As pastas locais têm aninhamentos que enganam (`fbr-website/fbr-website`,
> `fbr-tracking/fbr-tracking/fbr-tracking`). Esta é a folha de consulta para não
> reaprender de cada vez qual é a pasta certa e o comando de build.

## Caminhos locais + build

| Repo | Pasta local (Windows) | Verificar / build |
|------|-----------------------|-------------------|
| **admin** | `C:\Users\maria\Documents\fbr-admin2` | `npm run preflight` (tsc + vitest + build) |
| **website** | `C:\Users\maria\Documents\fbr-website\fbr-website` | `npm run build` |
| **tracking** | `C:\Users\maria\Documents\fbr-tracking\fbr-tracking\fbr-tracking` | Next 13 pages, JS puro. Build precisa de env dummy:<br>`$env:SUPABASE_URL='https://example.supabase.co'; $env:SUPABASE_ANON_KEY='dummy'; npm run build` |
| **voucher** | `C:\Users\maria\Documents\fbr-voucher\fbr-voucher` | Não é Next: estático + 2 fns serverless. Verificar = `node scripts/smoke.mjs` (29 checks) ou abrir `index.html` |

> Nota PowerShell: caminhos com `[locale]` precisam de `-LiteralPath` (os `[]` são wildcards).

## CI (GitHub Actions)

| Repo | CI actual | Sugestão |
|------|-----------|----------|
| **admin** | ✅ `ci.yml` corre `npm run preflight` | — (referência) |
| **website** | build no deploy da Vercel | Adicionar workflow que corra `npm run build` no PR |
| **tracking** | nenhum | Adicionar build com env dummy (ver acima) |
| **voucher** | nenhum | Adicionar `node scripts/smoke.mjs` (o smoke já vive no repo) |

**Meta:** que nenhum repo possa regredir sem um check verde. O admin já lá está; os outros três
ganham um workflow mínimo de ~15 linhas cada. Padrão a copiar: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Regras transversais (valem para os 4)
- **Migrações** aplica a Maria à mão — ver [MIGRATIONS-STATUS.md](MIGRATIONS-STATUS.md).
- **Segredos** — ver [SECRETS.md](SECRETS.md); `NEXT_PUBLIC_*` só no build seguinte.
- **Sessões Claude paralelas** no mesmo working tree → `git status` antes de commitar; committar só os ficheiros da sessão.
- **Nada em `public/`** que não seja para servir (fica tudo público no deploy).
- **Datas** dd/MM/yyyy; **€** com vírgula, alinhado à direita.
