# Estado das Migrações (repo ≠ produção)

> **A armadilha:** escrever um ficheiro em `supabase/migrations/` **NÃO** o aplica. É a Maria
> que corre cada migração à mão no SQL Editor do Supabase. Logo o repo pode estar à frente da
> produção. Esta é a lista de o que já foi **mesmo** aplicado.
>
> **Fonte da verdade real** = o schema no Supabase. Este ficheiro é a nossa melhor memória dele.
> Quando correres uma migração, marca-a aqui (`⏳ → ✅ dd/MM`). Usa a skill `/nova-migracao`.

## Fronteira actual (onde o drift é provável — confirmar sempre)

| Migração | Descrição | Estado |
|----------|-----------|--------|
| `092_public_phase_defs` | Fonte única das fases públicas (RPC) — ver ECOSYSTEM #1 | ✅ 08/07 aplicada + fbr-tracking em produção (main); smokado contra dados reais |
| `091_whatsapp_category_freeform` | Drop do CHECK (correr ANTES do deploy) | ✅ 04/07 (Maria confirmou) |
| `090_whatsapp_category` | Categoria WhatsApp | ✅ aplicada |
| `089_task_reminders` | Lembretes de tarefas (+ `CRON_SECRET` no GitHub) | ✅ 05/07 (Maria confirmou) |
| `088_push_subscriptions` | Subscrições push da PWA | ✅ aplicada |
| `087_analytics_snapshots` | Snapshots Clarity | ✅ aplicada (relatório mensal live) |
| `086_client_errors` | Monitorização de erros client-side | ✅ aplicada |
| `085_team_policies_centralized` | `is_team_admin()`/`is_team_member()` | ✅ aplicada |

## Histórico (001–084)

Assumidas **aplicadas** — a plataforma corre em produção e depende delas (login, encomendas,
vales, status, parcerias, finanças, forms públicos, Google, WhatsApp). Se alguma dúvida
específica surgir, verificar no Supabase antes de depender. O detalhe de cada uma vive no
próprio ficheiro em [`supabase/migrations/`](../supabase/migrations/) e nos commits.

Marcos confirmados por comportamento observável em produção:
- `084` revoke anon inserts + `016/017` form inserts → **forms públicos funcionam**
- `020/021/076` public status read + shift → **status.floresabeirario.pt lê da BD**
- `039/040` → **voucher.floresabeirario.pt via RPC `get_voucher_by_code`**
- `061/062/064/090/091` → **WhatsApp Cloud API end-to-end**

## Como usar
1. Criar migração com `/nova-migracao` (evita colisões de numeração + não esquece GRANTs/RLS).
2. Registá-la aqui como `⏳ por correr`.
3. Quando a Maria a correr no SQL Editor → mudar para `✅ dd/MM`.
4. **Tabelas novas precisam de GRANT explícito** (regra a partir de 30/10/2026); `INSERT…RETURNING`
   precisa de `GRANT SELECT`; `CREATE TABLE IF NOT EXISTS` é silencioso se já existe.
