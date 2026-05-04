-- ============================================================
-- FBR Admin — Aba Status (sessão 13)
-- Site público: status.floresabeirario.pt
--
-- Adiciona campos personalizáveis por encomenda para alimentar
-- (futuramente, na Fase 6) o site público de acompanhamento.
-- Executar no Supabase SQL Editor.
-- ============================================================

-- ── Mensagens personalizadas por encomenda ─────────────────────
-- Quando NULL, o site público usa a mensagem default da fase.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS public_status_message_pt TEXT,
  ADD COLUMN IF NOT EXISTS public_status_message_en TEXT;

-- ── Idioma a mostrar ao cliente ────────────────────────────────
-- 'pt' | 'en' | 'ambos' (default: ambos)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS public_status_language TEXT
    NOT NULL DEFAULT 'ambos'
    CHECK (public_status_language IN ('pt', 'en', 'ambos'));

-- ── Data prevista de entrega ───────────────────────────────────
-- Auto-gerada (data + 6 meses) quando o estado passa para
-- "flores_na_prensa". Editável manualmente depois.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;

-- ── Última actualização da info pública ────────────────────────
-- Mostrado no site para o cliente perceber quando a info foi
-- alterada pela última vez. Actualizado automaticamente quando
-- mudam: status, public_status_message_pt/en, estimated_delivery_date.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS public_status_updated_at TIMESTAMPTZ
    DEFAULT now();

-- ── Trigger: auto-preencher estimated_delivery_date e
--             public_status_updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION sync_public_status_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o estado mudou para "flores_na_prensa" e ainda não há
  -- data prevista, gera (data actual + 6 meses).
  IF NEW.status = 'flores_na_prensa'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'flores_na_prensa')
     AND NEW.estimated_delivery_date IS NULL THEN
    NEW.estimated_delivery_date := (CURRENT_DATE + INTERVAL '6 months')::date;
  END IF;

  -- Sempre que algo público muda, actualizar o timestamp.
  IF TG_OP = 'INSERT' THEN
    NEW.public_status_updated_at := now();
  ELSIF TG_OP = 'UPDATE' AND (
       NEW.status                   IS DISTINCT FROM OLD.status
    OR NEW.public_status_message_pt IS DISTINCT FROM OLD.public_status_message_pt
    OR NEW.public_status_message_en IS DISTINCT FROM OLD.public_status_message_en
    OR NEW.estimated_delivery_date  IS DISTINCT FROM OLD.estimated_delivery_date
  ) THEN
    NEW.public_status_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_sync_public_status ON orders;
CREATE TRIGGER orders_sync_public_status
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_public_status_fields();

-- ============================================================
-- TABELA DE SETTINGS — mensagens default editáveis pelo admin
-- ============================================================
-- Singleton (só uma linha) com os textos default por fase pública.
-- Permite à Maria fazer rephrase global sem mexer em código.
-- Estrutura JSONB:
--   {
--     "0":  { "pt": "...", "en": "..." },
--     "1":  { "pt": "...", "en": "..." },
--     ...
--     "11": { "pt": "...", "en": "..." },
--     "cancelada": { "pt": "...", "en": "..." }
--   }

CREATE TABLE IF NOT EXISTS public_status_settings (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  messages    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by  UUID REFERENCES auth.users(id)
);

-- Garantir 1 linha
INSERT INTO public_status_settings (id, messages)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public_status_settings ENABLE ROW LEVEL SECURITY;

-- Admins têm acesso total
CREATE POLICY "admins_all_settings" ON public_status_settings FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

-- Viewer (Ana) pode ler (precisa para a aba Status)
CREATE POLICY "viewer_read_settings" ON public_status_settings FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt'
  );

-- Permissões para a role authenticated
GRANT SELECT, INSERT, UPDATE ON public_status_settings TO authenticated;
