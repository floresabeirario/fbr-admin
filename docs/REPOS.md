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

## Branches e deploy (⚠️ NÃO é igual nos 4!)

| Repo | Fluxo | Produção deploya de |
|------|-------|---------------------|
| **admin** | push directo a `master` | `master` |
| **website** | `develop` → preview; merge `develop→main` (Maria aprova o preview primeiro) | `main` |
| **tracking** | `develop` → merge `develop→main` | `main` |
| **voucher** | push directo a `main` | `main` |

**Armadilha real (sessão 136):** fazer push do tracking e assumir que foi para produção —
foi para `develop`, e o site só muda no merge para `main`. Verificar sempre `git branch --show-current`
antes de dar um deploy como feito. No website, o merge `develop→main` é decisão da Maria.

## CI (GitHub Actions)

| Repo | CI |
|------|-----|
| **admin** | ✅ `ci.yml` — `npm run preflight` (tsc + testes + build) |
| **website** | ✅ `ci.yml` — `npm run build` (env dummy) + `test-forms.yml` (health 2×/mês) |
| **tracking** | ✅ `ci.yml` — build com env dummy |
| **voucher** | ✅ `ci.yml` — `scripts/smoke.mjs` (29 checks; `SMOKE_CHANNEL=bundled` na CI, Edge local) |

Todos os repos têm também **Dependabot** (PR mensal agrupado de npm + actions).
Nota: um workflow só corre nas branches onde o ficheiro existe — nos repos develop/main,
entra em produção de CI quando chega a `main`.

## Regras transversais (valem para os 4)
- **Migrações** aplica a Maria à mão — ver [MIGRATIONS-STATUS.md](MIGRATIONS-STATUS.md).
- **Segredos** — ver [SECRETS.md](SECRETS.md); `NEXT_PUBLIC_*` só no build seguinte.
- **Sessões Claude paralelas** no mesmo working tree → `git status` antes de commitar; committar só os ficheiros da sessão.
- **Nada em `public/`** que não seja para servir (fica tudo público no deploy).
- **Datas** dd/MM/yyyy; **€** com vírgula, alinhado à direita.
