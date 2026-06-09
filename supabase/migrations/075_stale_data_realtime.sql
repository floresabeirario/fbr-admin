-- 075 — Aviso "há alterações novas" quando outro utilizador edita ao mesmo tempo.
--
-- Problema: a Maria e o António podem estar a trabalhar em simultâneo. Quem
-- está numa página não sabe que o outro alterou dados e tem de se lembrar de
-- fazer refresh. Esta migração suporta um banner discreto que avisa.
--
-- Duas peças:
--   1. Garantir que as tabelas colaborativas estão na publicação `supabase_realtime`,
--      para o browser receber eventos `postgres_changes`. Nota: `orders` já era
--      subscrita em use-new-orders.ts mas NUNCA foi adicionada por migração
--      (só chat/whatsapp estavam — migs 029/061); pode ter ido só pelo dashboard
--      ou nunca. Aqui garantimos de forma idempotente.
--   2. Trigger que preenche `updated_by = auth.uid()` em INSERT/UPDATE, para o
--      banner conseguir ignorar as MINHAS próprias edições (senão o aviso
--      aparecia sempre que eu próprio gravava). Nenhuma server action muda:
--      as actions usam o cliente do utilizador (anon key + cookie), por isso
--      auth.uid() resolve para o utilizador autenticado.

-- 1) Publicação realtime (idempotente — mesmo padrão das migs 029/061)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'vouchers', 'partners', 'public_figures'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) Preencher updated_by automaticamente com o utilizador autenticado.
CREATE OR REPLACE FUNCTION public.set_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() vem do JWT do pedido (PostgREST). Em INSERTs sem sessão
  -- (form público de encomenda/vale) fica NULL — desejável: conta como
  -- "outra pessoa", por isso o banner aparece, que é o pretendido.
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'vouchers', 'partners', 'public_figures'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_by ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_by BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_by()', t);
  END LOOP;
END $$;
