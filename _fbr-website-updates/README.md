# fbr-website — Migração de Monday → Supabase

Este pacote contém os ficheiros prontos a copiar para o repo
[floresabeirario/fbr-website](https://github.com/floresabeirario/fbr-website)
para que os formulários de **Reserva de Preservação** e **Vale-Presente**
deixem de gravar no Monday.com e passem a gravar directamente na base de
dados Supabase do admin (`admin.floresabeirario.pt`).

> **Sessão 25 — Fase 5 (parte 2/2).**
> Mesma estratégia que a sessão 21 usou para o site `voucher.floresabeirario.pt`.
>
> **Sessão 26 — Campos em falta no form de Reserva.** O form do site não
> recolhia 4 campos que o PDF spec inclui: **Tipo de evento**, **Nome dos
> noivos** (cond. casamento), **Localização do evento** e **Código do
> Vale-Presente** (cond. comoConheceu = "Vale-Presente"). Adicionados ao
> `ReservarPreservacaoForm.jsx`, aos `messages/{pt,en}.json` e ao mapping
> servidor. A migração 016 já permite estes 4 campos sem alterações
> (não estão na lista de bloqueios da policy).

---

## ✅ Resumo do que muda

| Antes (Monday) | Depois (Supabase) |
| --- | --- |
| Form submete → API GraphQL do Monday → board do Monday | Form submete → API → tabela `orders`/`vouchers` no Supabase |
| Tinhas de abrir o Monday para ver pré-reservas | Aparecem directamente na aba Preservação/Vale-Presente do admin |
| Sem cumprimento RGPD da retenção/consentimento | Cada submissão guarda `consent_at`, `consent_version`, `consent_ip` |
| Anti-spam: honeypot + rate limit | Mesmo + estrutura para Cloudflare Turnstile (desactivado por defeito) |

**Não muda nada visualmente para o cliente.** Os formulários ficam
exactamente iguais. A única coisa que vês como utilizadora é que as
reservas começam a aparecer no admin da plataforma.

---

## 📋 Checklist de aplicação (por ordem)

### 1. Correr as migrações no Supabase

São **2 migrações** a correr por ordem. Para cada uma:

1. SQL Editor → **New query**
2. Cola o conteúdo do ficheiro
3. **Run** → confere "Success. No rows returned"

**Migração 016** — [`supabase-migration-016.sql`](./supabase-migration-016.sql):
Adiciona consentimento RGPD + permite INSERT pelo role anon.

**Migração 017** — [`supabase-migration-017.sql`](./supabase-migration-017.sql):
Permite ao role anon ler `id`/`order_id` durante 5 segundos depois do INSERT,
necessário para o `INSERT...RETURNING` que o cliente supabase-js usa por baixo.
Sem isto dá `42501 — permission denied for table orders`.

Confere no Dashboard → Database → Tables que `orders` e `vouchers`
agora têm as colunas `consent_at`, `consent_version`, `consent_ip`.

> Estas migrações também existem em
> `supabase/migrations/016_public_form_inserts.sql` e
> `supabase/migrations/017_orders_anon_returning.sql` no repo do admin
> (iguais byte-a-byte). As cópias aqui são só para conveniência — não
> as corras duas vezes.

### 2. Adicionar env vars no Vercel do `fbr-website`

Painel Vercel → Project `fbr-website` → Settings → Environment Variables.

Adiciona estas duas (em **Production, Preview, Development**):

```
SUPABASE_URL        = https://<o-teu-projecto>.supabase.co
SUPABASE_ANON_KEY   = eyJhbGc...   (anon public key, mesma do admin)
```

> Vais buscar estes valores ao Supabase Dashboard → Project Settings → API.
> São os mesmos que já estão no Vercel do admin (`fbr-admin2`) — podes
> copiar de lá.

> **Importante**: usa a `anon key`, **não** a `service_role`. A `service_role`
> tem poderes administrativos e não pode ir para o site público.

> **Não precisas de prefixo `NEXT_PUBLIC_`**. Estas vars são lidas só do
> servidor (rotas API), portanto ficam privadas.

### 3. Copiar os ficheiros para o repo `fbr-website`

A árvore deste pacote espelha a estrutura do repo. Copia:

| Origem (este pacote) | Destino (`fbr-website`) |
| --- | --- |
| `app/reservar-preservacao/ReservarPreservacaoForm.jsx` | `app/reservar-preservacao/ReservarPreservacaoForm.jsx` (substitui) |
| `app/api/reservar-preservacao/route.js` | `app/api/reservar-preservacao/route.js` (substitui) |
| `app/api/vale-presente/route.js`        | `app/api/vale-presente/route.js`        (substitui) |
| `app/_lib/supabase-mappings.js`         | `app/_lib/supabase-mappings.js`         (substitui) |
| `app/_lib/turnstile.js`                 | `app/_lib/turnstile.js`                 (novo, se ainda não existir) |

Depois, abre `messages/additions.md` e segue as instruções para colar os
**snippets PT/EN** dentro do bloco `"formReserva"` em cada um dos ficheiros
`messages/pt.json` e `messages/en.json` do `fbr-website`. São 5 chaves
novas em cada idioma:
- `tipoEventoLabel` + `tipoEventoHint` + `tipoEventoOpcoes`
- `nomeNoivosLabel` + `nomeNoivosHint` + `nomeNoivosPlaceholder`
- `localEventoLabel` + `localEventoHint` + `localEventoPlaceholder`
- `codigoValeLabel` + `codigoValeHint` + `codigoValePlaceholder`

### 4. Adicionar a dependência `@supabase/supabase-js`

No repo `fbr-website`:

```bash
npm install @supabase/supabase-js
```

Isto vai actualizar o `package.json` e o `package-lock.json`. Faz commit
dos dois.

### 5. Deploy

```bash
git add -A
git commit -m "Migra forms públicos de Monday → Supabase"
git push
```

O Vercel faz deploy automático. Espera o build acabar (≈1-2 min).

### 6. Smoke test

1. Vai a `https://floresabeirario.pt/reservar-preservacao`
2. Preenche **com o teu próprio email** e submete (estado: campos válidos, termos marcados)
3. **Confirma os 4 campos novos:**
   - Selecciona "Casamento" em **Tipo de evento** → deve aparecer o campo **Nome dos noivos**
   - Preenche **Localização do evento**
   - Em **Como conheceu**, escolhe "Ofereceram-me um Vale-Presente" → deve aparecer o campo **Código do Vale-Presente**
4. Devias ver o ecrã verde "Pré-reserva registada com sucesso!"
5. Vai ao admin `https://admin.floresabeirario.pt/preservacao` — a nova reserva deve aparecer no grupo "Pré-reservas". Abre o workbench e confere que `event_type`, `couple_names`, `event_location` e `gift_voucher_code` estão preenchidos.
6. Apaga depois (soft delete) ou mantém para teste.
7. Repete para `https://floresabeirario.pt/vale-presente`.

Se algo correr mal: **Vercel → Deployments → Logs** mostra a stack
trace do servidor.

### 7. Limpar (opcional, mas recomendado)

Quando o smoke test passar e a Maria estiver confortável, podes
**remover as env vars do Monday** no Vercel:

- `MONDAY_API_TOKEN`
- `MONDAY_BOARD_ID_PRESERVACAO`
- `MONDAY_BOARD_ID_VALE`

Não as remove desde o início — durante a transição é seguro deixá-las.
Se um deploy antigo cachear, ainda pode usá-las.

> A `RESEND_API_KEY` deve **ficar**. Continua a notificar
> `info@floresabeirario.pt` quando entra uma reserva — é a notificação
> interna que o programador anterior já tinha configurada.

---

## 🔒 Segurança e RGPD — o que ficou garantido

A migração 016 cria policies muito apertadas no Supabase:

- O role `anon` (chave pública usada no site) **só pode INSERT** em
  `orders` e `vouchers`. Não pode ler, alterar, nem apagar nada.
- Cada INSERT é forçado a ter `consent_at` preenchido — sem
  consentimento, a BD recusa.
- Os campos administrativos (status, payment_status, partner_id,
  budget, etc.) **têm de estar nos seus valores iniciais**. Mesmo que
  alguém modifique o código JavaScript do site para tentar criar uma
  encomenda já paga, a BD rejeita.

Por isso, **não há risco** em pôr a `SUPABASE_ANON_KEY` no site público.

---

## 🛡️ Cloudflare Turnstile — passos quando quiseres activar

Hoje o site só tem honeypot + rate limit. O Turnstile (caixa moderna
de "não sou um robô", grátis) está **preparado mas inactivo**. Para o
ligar:

### a) Cria conta Cloudflare

1. Vai a [cloudflare.com](https://cloudflare.com) → Sign up (5 min)
2. No dashboard → **Turnstile** (sidebar) → **Add site**
3. Nome: `Flores à Beira-Rio`. Domínio: `floresabeirario.pt`. Modo: **Managed**
4. Cloudflare dá-te:
   - **Site key** (pública, pode ir no JavaScript do browser)
   - **Secret key** (privada, só no servidor)

### b) Adiciona env vars no Vercel do `fbr-website`

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY = <site key>
TURNSTILE_SECRET               = <secret key>
```

### c) Adiciona o widget aos formulários

No topo de `ReservarPreservacaoForm.jsx` e `ValeApresenteForm.jsx`:

```jsx
<script
  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
  async
  defer
/>
```

Antes do botão de submit, adiciona:

```jsx
{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
  <div
    className="cf-turnstile"
    data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
    data-callback={(token) => set("turnstileToken", token)}
  />
)}
```

E adiciona `turnstileToken: ""` ao `INIT` do form.

O servidor (`route.js`) já está preparado: lê `data.turnstileToken`,
valida com Cloudflare se `TURNSTILE_SECRET` existir; caso não exista,
deixa passar.

### d) Deploy e testar

Depois do deploy, deves ver uma caixa pequena de verificação no fundo
do form. 99% dos visitantes nunca clicam em nada — passam
automaticamente.

---

## 🐛 Troubleshooting

### "Configuração em falta no servidor."
Falta uma env var. Verifica `SUPABASE_URL` e `SUPABASE_ANON_KEY` no
Vercel. Após adicionar, **redeploy** (Settings → Deployments → ⋯ →
Redeploy) — env vars novas só vinculam num build novo.

### "Erro ao registar a reserva."
Vê os logs do Vercel (Deployments → ⋯ → Logs). Causas comuns:
- Schema do Supabase não corresponde (correr migração 016)
- A `anon key` está errada (usar a `anon public`, não a `service_role`)
- A policy `orders_public_insert` rejeitou (ex.: tentar inserir um
  `status` diferente de `entrega_flores_agendar`)

### Reservas a aparecer 2x (uma no Monday, outra no Supabase)
Significa que o deploy ainda está com a versão antiga em alguma route.
Volta a correr `git push` e confirma que a build mais recente é a
activa no Vercel.

### "Verificação anti-spam falhou."
Só aparece se Turnstile estiver activo (`TURNSTILE_SECRET` existe). Se
ainda não configuraste o widget no form, remove a env var.

---

## 📦 Estrutura deste pacote

```
_fbr-website-updates/
├── README.md                  ← este ficheiro
├── supabase-migration-016.sql ← cópia da migração 016 (consent + RLS anon)
├── supabase-migration-017.sql ← cópia da migração 017 (GRANT SELECT colunar)
├── messages/
│   └── additions.md           ← snippets PT/EN a colar em messages/{pt,en}.json
└── app/
    ├── _lib/
    │   ├── supabase-mappings.js
    │   └── turnstile.js
    ├── reservar-preservacao/
    │   └── ReservarPreservacaoForm.jsx   ← form actualizado (sessão 26)
    └── api/
        ├── reservar-preservacao/
        │   └── route.js
        └── vale-presente/
            └── route.js
```

## TODOs para uma futura sessão

- [ ] **Vale-Presente sem checkbox de Termos.** O form de reserva tem
  `termosCondicoes` mas o de vale não. Adicionar a checkbox e mudar
  o `consent_version` para `"1.0-explicit"` na rota de vale.
- [ ] **Histórico de emails no workbench** (Gmail API) — Fase 6.
- [ ] **Auto-criação de pasta Drive** ao primeiro pagamento — Fase 6.
