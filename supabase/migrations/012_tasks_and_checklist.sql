-- ============================================================
-- FBR Admin — Fase 4: Dashboard (Tarefas + Checklist pessoal)
-- Executar no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TABELA: tasks (afazeres globais)
-- ============================================================
-- Tarefas partilhadas por toda a equipa.
-- Cada tarefa pode ter um responsável (assignee) e prazo.
-- Os 3 utilizadores são identificados pela sua coluna do auth.users.
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by    UUID REFERENCES auth.users(id),
  updated_by    UUID REFERENCES auth.users(id),
  deleted_at    TIMESTAMPTZ,

  title         TEXT NOT NULL DEFAULT '',
  description   TEXT,

  -- assignee_email: usamos o email (não o UUID) porque é estável e legível
  -- nos audit logs. NULL = não atribuída.
  assignee_email TEXT,

  priority      TEXT NOT NULL DEFAULT 'media'
                CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),

  due_date      DATE,

  -- Estado
  done          BOOLEAN NOT NULL DEFAULT false,
  done_at       TIMESTAMPTZ,
  done_by       UUID REFERENCES auth.users(id),

  -- Ligação opcional a uma encomenda (ex.: "Falar com cliente X")
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tasks_assignee_idx   ON tasks(assignee_email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_due_date_idx   ON tasks(due_date)        WHERE deleted_at IS NULL AND done = false;
CREATE INDEX IF NOT EXISTS tasks_done_idx       ON tasks(done)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at DESC);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABELA: personal_checklist (checklist por utilizador)
-- ============================================================
-- Cada utilizador tem a sua própria checklist privada (ex.: "Comprar fitas").
-- Admin pode mudar o utilizador visualizado para ver a checklist do outro.
-- ============================================================

CREATE TABLE IF NOT EXISTS personal_checklist (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at    TIMESTAMPTZ,

  -- owner_email: dono da checklist (qualquer um dos 3 utilizadores)
  owner_email   TEXT NOT NULL,

  text          TEXT NOT NULL DEFAULT '',
  done          BOOLEAN NOT NULL DEFAULT false,
  done_at       TIMESTAMPTZ,

  -- Posição manual para arrastar e soltar (lower = topo).
  -- Default usa o epoch em segundos para manter ordem cronológica inicial.
  position      DOUBLE PRECISION NOT NULL DEFAULT extract(epoch from now())
);

CREATE INDEX IF NOT EXISTS personal_checklist_owner_idx
  ON personal_checklist(owner_email, position)
  WHERE deleted_at IS NULL;

CREATE TRIGGER personal_checklist_updated_at
  BEFORE UPDATE ON personal_checklist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Os 3 utilizadores conseguem ver/editar tarefas globais (a Ana tem
-- permissão de edição na aba Dashboard, conforme spec).
-- A checklist pessoal só é vista/editada pelo dono ou pelos admins.
-- ============================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_checklist ENABLE ROW LEVEL SECURITY;

-- ── tasks ────────────────────────────────────────────────────
CREATE POLICY "tasks_team_all" ON tasks FOR ALL
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

-- ── personal_checklist ───────────────────────────────────────
-- Admins (António e MJ) vêem todas; Ana só vê a sua.
CREATE POLICY "checklist_admins_all" ON personal_checklist FOR ALL
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

CREATE POLICY "checklist_owner_all" ON personal_checklist FOR ALL
  USING (
    owner_email = auth.jwt() ->> 'email'
  )
  WITH CHECK (
    owner_email = auth.jwt() ->> 'email'
  );

-- ============================================================
-- AUDIT LOG (só tasks; checklist é pessoal e ruidosa demais)
-- ============================================================
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('tasks', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('tasks', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('tasks', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tasks_audit
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_changes();

-- ============================================================
-- PERMISSÕES (lição da sessão 4 / sessão 20: RLS sem GRANT base
-- continua a dar 401/403 porque o role authenticated não tem
-- privilégio nenhum por defeito).
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON personal_checklist TO authenticated;
