# fbr-tracking — migração de Google Sheets para Supabase

Este pacote troca a fonte de dados do site público
**status.floresabeirario.pt** (repo
[`floresabeirario/fbr-tracking`](https://github.com/floresabeirario/fbr-tracking))
do Excel/Google Sheets manual para a base de dados Supabase usada
pela plataforma admin.

A partir do momento em que isto for aplicado, todas as encomendas
que estiverem na plataforma `admin.floresabeirario.pt` aparecem
automaticamente no site público, sem ter de editar o Excel.

> **Pré-requisito:** todas as encomendas activas que hoje estão só
> no Excel têm de ser migradas para a plataforma admin **antes** do
> switch — caso contrário os clientes desses links deixam de ver o
> status. Os links do tipo `status.floresabeirario.pt/<order_id>`
> continuam a funcionar porque mantemos o mesmo formato de ID.

---

## O que muda

| Antes (Google Sheets) | Depois (Supabase) |
|---|---|
| Maria edita Excel manualmente | Maria edita aba **Status** em `admin.floresabeirario.pt` |
| `utils/googleSheets.js` | `utils/supabase.js` |
| Vars: `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` | Vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Dependências: `googleapis`, `google-spreadsheet` | Dependência: `@supabase/supabase-js` |

O **contrato de saída** da API (`/api/tracking?id=…`) mantém-se
exactamente igual: `{ id, nome_encomenda, fase, fase_en, fase_numero,
mensagem, mensagem_en, ultima_atualizacao, data_entrega }`. Por isso
**`pages/[id].js` quase não muda** — basta corrigir o caminho do
import.

---

## Passo-a-passo

### 1) Correr a migração `020` no Supabase

Já está no repo admin em
[`supabase/migrations/020_orders_public_status_read.sql`](../supabase/migrations/020_orders_public_status_read.sql).

No Supabase Dashboard → **SQL Editor → New query**, copiar o conteúdo
do ficheiro, executar e confirmar que não houve erro. A migração:

- Dá `GRANT SELECT` column-level ao role `anon` apenas para os
  campos públicos (sem email, telemóvel, NIF, orçamento, etc.).
- Cria a policy `orders_public_status_read` (encomendas pagas,
  não-arquivadas).
- Dá acesso de leitura à tabela `public_status_settings` (mensagens
  default globais).

### 2) No repo `fbr-tracking`, copiar/criar ficheiros

A partir da raiz do clone local de `fbr-tracking`:

```bash
# 1. Substituir o utils
git rm utils/googleSheets.js
cp <path-deste-pacote>/utils/supabase.js utils/supabase.js

# 2. Substituir a API route
cp <path-deste-pacote>/pages/api/tracking.js pages/api/tracking.js

# 3. Substituir o package.json
cp <path-deste-pacote>/package.json package.json
```

### 3) Corrigir o import em `pages/[id].js`

O ficheiro `pages/[id].js` tem **uma única linha** a mudar — o import
no topo. Procurar:

```js
import { getEncomendaById } from '../utils/googleSheets';
```

E substituir por:

```js
import { getEncomendaById } from '../utils/supabase';
```

Mais nada precisa de mexer no `[id].js` — o resto da página usa
exactamente os mesmos campos do objecto `encomenda`.

### 4) Instalar dependências

```bash
npm install
```

(Vai remover `googleapis` e `google-spreadsheet`, e instalar
`@supabase/supabase-js`.)

### 5) Configurar variáveis no Vercel

No Vercel → Project `fbr-tracking` → **Settings → Environment
Variables**:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://<id-do-projecto>.supabase.co` (SEM `/rest/v1`) |
| `SUPABASE_ANON_KEY` | A chave **anon public** (Dashboard → Settings → API) |

E **remover** as antigas se já não houver outro serviço a usá-las:

- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

> ⚠ Adicionar/editar env vars no Vercel **não** dispara redeploy
> automático. Forçar um redeploy do branch principal depois de
> guardar as variáveis (lição da sessão 25).

### 6) Push + smoke test

```bash
git add .
git commit -m "Migrar fonte de dados do Google Sheets para Supabase"
git push
```

Após o deploy:

1. Abrir `https://status.floresabeirario.pt/` — a página inicial
   ainda funciona (não depende da BD).
2. Abrir `https://status.floresabeirario.pt/<order_id>` para uma
   encomenda **paga** que esteja na plataforma admin. Verificar:
   - Nome do cliente correcto
   - Fase actual coincide com o que se vê em `/status` no admin
   - Mensagem (com override do admin, se houver)
   - Data prevista de entrega
   - Idioma respeita o `public_status_language` (PT / EN / ambos)
3. Abrir um link com ID inválido → deve mostrar "Encomenda não
   encontrada".
4. Tentar abrir o link de uma encomenda em **pré-reserva** (sem
   pagamento ainda) — deve dar **404** (a policy filtra
   `payment_status = '100_por_pagar'`).

---

## Coexistência com o Excel durante a transição

Enquanto houver encomendas activas só no Excel:

1. **Não** desligar o Google Sheets imediatamente — o admin
   `status.floresabeirario.pt` agora aponta para o Supabase, mas o
   próprio Sheets continua na cloud para consulta.
2. À medida que cada encomenda antiga for migrada para a plataforma
   admin, marcar a linha do Excel como "migrada" (ex.: pintar de
   verde) para evitar duplicar edições.
3. Quando todas as encomendas activas tiverem sido migradas, o
   Excel pode ser arquivado.

---

## Estrutura de campos no admin → site público

| Site (`encomenda.X`) | BD (`orders.X`) ou cálculo |
|---|---|
| `id` | `order_id` |
| `nome_encomenda` | `client_name` |
| `fase` | `PUBLIC_PHASE_LABEL_PT[fase]` (preenchido se `public_status_language` ∈ `pt`, `ambos`) |
| `fase_en` | `PUBLIC_PHASE_LABEL_EN[fase]` (preenchido se `public_status_language` ∈ `en`, `ambos`) |
| `fase_numero` | número 1-11 a partir de `STATUS_TO_PUBLIC_PHASE[status]`; `null` para fase 0 e `cancelada` |
| `mensagem` | `public_status_message_pt` se existir, senão default global (`public_status_settings`), senão hardcoded |
| `mensagem_en` | idem em EN |
| `ultima_atualizacao` | `public_status_updated_at` formatado `dd/MM/yyyy, HH:mm` (pt-PT) |
| `data_entrega` | `estimated_delivery_date` formatado "maio de 2026" (mês + ano apenas; auto-gerado +6m quando o estado passa a `flores_na_prensa`) |

A lógica de mapeamento está em
[`utils/supabase.js`](utils/supabase.js); a fonte canónica no repo
admin é
[`src/lib/public-status.ts`](../src/lib/public-status.ts). Se uma
das duas mudar, actualizar a outra.

---

## Troubleshooting

**404 em todas as encomendas:**
- Confirmar `SUPABASE_URL` SEM `/rest/v1` no fim (lição sessão 25).
- Confirmar `SUPABASE_ANON_KEY` é a `anon public` (começa por `eyJ`,
  não a `service_role`).
- Confirmar que a migração 020 correu (querystring no SQL Editor:
  `SELECT * FROM pg_policy WHERE polname = 'orders_public_status_read';`).

**404 numa encomenda específica:**
- Verificar `payment_status` no admin — se for `100_por_pagar`, a
  policy esconde-a (é intencional: cliente nunca recebeu o link
  antes do 1º pagamento).
- Verificar `deleted_at` no admin — encomendas arquivadas são
  invisíveis ao público.

**`Permission denied for table orders` (código 42501):**
- Falta `GRANT SELECT` nas colunas que o `select(...)` pede. Re-correr
  a migração 020 e validar com:
  ```sql
  SELECT column_name FROM information_schema.column_privileges
  WHERE table_name='orders' AND grantee='anon' ORDER BY column_name;
  ```

**Mensagens default desactualizadas:**
- Editar globalmente em `admin.floresabeirario.pt/status/mensagens-default`.
- Editar por encomenda na linha respectiva em `/status`.
- Os defaults hardcoded em `utils/supabase.js` só são usados quando
  nem o override por encomenda nem o default global existem.
