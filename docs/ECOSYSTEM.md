# Contrato do Ecossistema FBR

> **O que é isto:** o mapa *máquina-legível* de como os 4 repos comunicam entre si.
> A aba `/ecossistema` na plataforma é a versão visual para humanos; este ficheiro é o
> contrato técnico — que tabelas/RPCs/endpoints cada repo lê e escreve. Se mudares algo
> aqui listado, é uma **mudança de contrato**: pode partir outro repo.
>
> Um teste (`src/lib/__tests__/ecosystem-contract.test.ts`) verifica que os endpoints e
> RPCs aqui declarados ainda existem no código do admin — se renomeares um sem actualizar
> este ficheiro, o `preflight` apita.

## Os 4 repos

| Repo | Papel | Stack | Deploy |
|------|-------|-------|--------|
| **fbr-admin** (este) | Plataforma interna (hub) | Next 16 + Supabase | admin.floresabeirario.pt |
| **fbr-website** | Site público + formulários | Next (mobile-first) | floresabeirario.pt |
| **fbr-tracking** | Acompanhamento público de encomendas | Next 13 (pages, JS) | status.floresabeirario.pt |
| **fbr-voucher** | Consulta pública de vales | Estático + 2 fns serverless | voucher.floresabeirario.pt |

## A message bus é o Supabase

Não há chamadas directas repo↔repo (salvo o notify HTTP abaixo). **Toda a comunicação passa
pela base de dados partilhada.** É por isso que o contrato de tabelas/RPCs é sagrado.

### Quem lê/escreve o quê

| Recurso na BD | admin | website | tracking | voucher |
|---------------|:-----:|:-------:|:--------:|:-------:|
| `orders` (escrita completa) | ✅ RW | ➕ INSERT (form, service role) | — | — |
| `orders` (colunas públicas) | — | — | 👁 SELECT (anon, policy `orders_public_status_read`) | — |
| `public_status_settings` | ✅ RW | — | 👁 SELECT (anon) | — |
| `vouchers` | ✅ RW | ➕ INSERT (form) | — | — |
| RPC `get_voucher_by_code` | — | — | — | ✅ (anon) |
| RPC `get_public_order_status` *(ver #1)* | fonte | — | ✅ (anon) | — |
| `push_subscriptions` | ✅ RW | — | — | — |

> **Regra de ouro:** ao adicionar/renomear um `OrderStatus` ou uma fase pública, isto toca
> a BD **e** os consumidores públicos. Ver o mecanismo de fonte única em [#1] (migração
> `092_public_phase_defs`). Antes desse trabalho, a lógica estava duplicada em
> `src/lib/public-status.ts` (admin) e `utils/supabase.js` (tracking).

## Endpoints HTTP cross-repo (o único acoplamento directo)

| De → Para | Endpoint | Auth | Payload |
|-----------|----------|------|---------|
| website → admin | `POST /api/internal/notify-order` | `Bearer INTERNAL_NOTIFY_SECRET` | `{ order_id, client_name, event_type }` |
| website → admin | `POST /api/internal/notify-voucher` | `Bearer INTERNAL_NOTIFY_SECRET` | `{ voucher_code?, sender_name? }` |
| Meta → admin | `GET/POST /api/whatsapp/webhook/[token]` | path token + `META_APP_SECRET` (POST) | Meta webhook |
| GitHub Actions → admin | `/api/cron/*` | `Bearer CRON_SECRET` (timing-safe) | — |

**Contrato:** estes endpoints não podem mudar de path nem de forma sem actualizar o repo
que os chama. `notify-*` são *best-effort* (o site nunca espera nem falha por causa deles).

## Como verificar que o ecossistema está são

1. **Automático (na plataforma + cron 7h):** aba `/healthchecks` → categoria **Integrações**
   testa voucher.* e status.* alcançáveis + a RPC `get_voucher_by_code`.
2. **Preflight (offline):** `ecosystem-contract.test.ts` confirma que os endpoints/RPCs deste
   ficheiro ainda existem no código.
3. **Smoke manual:** submeter o form no site → chega push no telemóvel (notify-order);
   abrir voucher.* com código real; abrir status.* com ID real em PT e EN.

## Ver também
- [SECRETS.md](SECRETS.md) — todos os segredos e onde vivem
- [MIGRATIONS-STATUS.md](MIGRATIONS-STATUS.md) — o que já foi aplicado em produção
- [REPOS.md](REPOS.md) — caminhos locais e comandos de build de cada repo
