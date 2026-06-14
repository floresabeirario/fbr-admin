-- ============================================================
-- 077 — Limpeza do health check dos formulários (fbr-website)
-- ============================================================
-- O endpoint /api/health do site faz uma submissão de TESTE de ponta-a-ponta:
-- insere uma encomenda + um vale "sentinela" usando a MESMA chave anónima e o
-- MESMO mapeamento dos forms reais (para apanhar policies/grants/colunas
-- partidas — a causa típica de "o form dá erro"), e depois chama esta função
-- para os apagar imediatamente.
--
-- Porque é SECURITY DEFINER: o papel `anon` consegue INSERIR (policies dos
-- forms) mas NÃO tem policy de DELETE em orders/vouchers. Esta função corre com
-- privilégios do dono e apaga APENAS as linhas sentinela (email + nome fixos),
-- por isso o âmbito é mínimo. `search_path` fixo evita hijacking.

create or replace function public.cleanup_form_healthchecks()
returns void
language sql
security definer
set search_path = public
as $$
  delete from orders
   where email = 'healthcheck@floresabeirario.pt'
     and client_name = 'HEALTHCHECK — apagar';
  delete from vouchers
   where sender_email = 'healthcheck@floresabeirario.pt'
     and sender_name = 'HEALTHCHECK — apagar';
$$;

-- Só o anónimo (site) e utilizadores autenticados podem chamar; ninguém mais.
revoke all on function public.cleanup_form_healthchecks() from public;
grant execute on function public.cleanup_form_healthchecks() to anon, authenticated;
