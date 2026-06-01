-- ============================================================
-- FBR Admin — Figuras Públicas (campanha de seeding a influencers/noivas)
-- Executar no Supabase SQL Editor
-- ============================================================
--
-- Cria a tabela `public_figures`: figuras públicas / influencers (muitas
-- delas noivas) que contactamos para oferecer a preservação das flores em
-- troca de exposição. Vive na MESMA aba que as Parcerias (toggle no topo),
-- mas é uma tabela separada porque o funil e os campos são próprios.
--
-- Modelada na `partners` (mig 013): mesmos padrões de interactions/actions
-- JSONB, RLS para os 3 utilizadores (a Ana edita aqui também) e audit log.
-- ============================================================

CREATE TABLE IF NOT EXISTS public_figures (

  -- Metadados
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),

  -- ── Identificação ─────────────────────────────────────────
  name            TEXT NOT NULL DEFAULT '',
  figure_type     TEXT NOT NULL DEFAULT 'influencer'
                  CHECK (figure_type IN (
                    'influencer',
                    'celebridade',
                    'figura_publica'
                  )),

  -- Estado do funil da oferta
  status          TEXT NOT NULL DEFAULT 'por_contactar'
                  CHECK (status IN (
                    'por_contactar',
                    'contactada',
                    'em_conversa',
                    'aceitou',
                    'em_producao',
                    'concluida',
                    'recusou',
                    'sem_resposta'
                  )),

  -- Prioridade (foco de esforço)
  priority        TEXT NOT NULL DEFAULT 'media'
                  CHECK (priority IN ('alta', 'media', 'baixa')),

  -- ── Redes sociais / alcance ───────────────────────────────
  instagram_handle  TEXT,                 -- sem @, ex.: "sofiacosta"
  tiktok_handle     TEXT,
  followers         INTEGER,              -- alcance aproximado

  -- ── Segmentação ───────────────────────────────────────────
  tags              TEXT[] DEFAULT '{}',  -- nicho: moda, lifestyle, maternidade...
  fit_note          TEXT,                 -- nota de qualidade da audiência / fit

  -- ── Evento (foco noivas, mas permite outras ocasiões) ─────
  event_type        TEXT NOT NULL DEFAULT 'casamento'
                    CHECK (event_type IN ('casamento', 'batizado', 'outro')),
  event_date        DATE,                 -- data do casamento → alerta de aproximação

  -- ── Oferta ────────────────────────────────────────────────
  offer_type        TEXT CHECK (offer_type IN (
                      'preservacao_gratis',
                      'desconto',
                      'contrapartida'
                    )),
  -- Tamanho de moldura escolhido (mesmas opções dos orders) para derivar custo
  frame_size        TEXT,
  estimated_cost    NUMERIC(10,2),        -- custo estimado da oferta (€)

  -- ── Contrapartida (entregáveis) ───────────────────────────
  -- Array de { id, title, due_date: ISO|null, done: bool,
  --            published_url: string|null, done_at, done_by }
  deliverables      JSONB DEFAULT '[]'::jsonb NOT NULL,
  -- Screenshots das stories (expiram em 24h → guardar na Drive); URLs Drive
  story_screenshots TEXT[] DEFAULT '{}',

  -- ── Brief / kit ───────────────────────────────────────────
  brief_sent        BOOLEAN NOT NULL DEFAULT false,
  brief_mention     TEXT,                 -- @ a marcar (ex.: @floresabeirario)
  brief_hashtag     TEXT,                 -- # a usar (ex.: #floresabeirario)

  -- ── Contacto ──────────────────────────────────────────────
  contact_channel   TEXT CHECK (contact_channel IN (
                      'instagram_dm',
                      'email',
                      'agencia',
                      'whatsapp',
                      'outro'
                    )),
  email             TEXT,
  -- Mesmo formato que partners (mig 015): array de { label, number }
  phones            JSONB DEFAULT '[]'::jsonb NOT NULL,
  agency_name       TEXT,                 -- agência / manager
  agency_contact    TEXT,

  -- ── Ligação a encomenda de Preservação (cortesia) ─────────
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  -- Cortesia NÃO conta para faturação (evita duplicação, como os vales)
  is_courtesy       BOOLEAN NOT NULL DEFAULT true,

  -- ── Notas / histórico / acções ────────────────────────────
  notes             TEXT,
  -- Mesmo formato que partners: { id, date, channel, summary, by }
  interactions      JSONB DEFAULT '[]'::jsonb NOT NULL,
  -- Mesmo formato que partners: { id, title, assignee_email, due_date,
  --                               done, done_at, done_by, created_at, created_by }
  actions           JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS public_figures_status_idx     ON public_figures(status)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS public_figures_name_idx       ON public_figures(name)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS public_figures_event_date_idx ON public_figures(event_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS public_figures_order_id_idx   ON public_figures(order_id)   WHERE deleted_at IS NULL;

-- ── Trigger: auto-actualizar updated_at ───────────────────────
DROP TRIGGER IF EXISTS public_figures_updated_at ON public_figures;
CREATE TRIGGER public_figures_updated_at
  BEFORE UPDATE ON public_figures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Como nas Parcerias, a Ana (viewer noutras abas) também escreve aqui.
-- Permite-se a TODOS os 3 utilizadores.
-- ============================================================
ALTER TABLE public_figures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_figures_all_users" ON public_figures;
CREATE POLICY "public_figures_all_users" ON public_figures FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  );

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE OR REPLACE FUNCTION log_public_figure_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('public_figures', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('public_figures', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('public_figures', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS public_figures_audit ON public_figures;
CREATE TRIGGER public_figures_audit
  AFTER INSERT OR UPDATE OR DELETE ON public_figures
  FOR EACH ROW EXECUTE FUNCTION log_public_figure_changes();

-- ============================================================
-- PERMISSÕES
-- ============================================================
-- authenticated: necessário além da RLS (lição das migs 003/011/013).
-- service_role: defensivo — qualquer tabela nova leva grant a service_role
--   (lição da mig 065; evita 42501 se um job de fundo lhe tocar no futuro).
GRANT SELECT, INSERT, UPDATE, DELETE ON public_figures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public_figures TO service_role;
