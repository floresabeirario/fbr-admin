// Mapeamento de papéis (admin/viewer) por email.
// Pode ser importado tanto no servidor como no cliente.
//
// Regras:
// - 2 admins (António e MJ): acesso total a todas as abas
// - 1 viewer (Ana): só pode editar Tarefas (Dashboard) e Parcerias.
//   Em todas as outras abas tem acesso só de leitura.
// - Por defeito (email desconhecido), assumimos viewer — o caminho mais seguro.

export type Role = "admin" | "viewer";

// ── FONTE ÚNICA da equipa no código (sessão 124/item 3) ─────────
// Na base de dados a fonte é a tabela `team_members` (mig 085: todas
// as policies RLS usam is_team_admin/is_team_member). No código a
// lista tem de ser estática porque o /login mostra os perfis ANTES
// de haver sessão (e o anon não pode ler team_members). Para mudar a
// equipa: 1 linha aqui + 1 linha em team_members na BD + password no
// Supabase Auth. Tudo o resto (layout, login, chat, dashboards,
// workbenches, proxy, RLS) deriva destas duas fontes.
export type TeamMember = {
  email: string;
  name: string;
  photo: string;
  role: Role;
};

export const TEAM: readonly TeamMember[] = [
  { email: "info+antonio@floresabeirario.pt", name: "António", photo: "/userphotos/antonio.webp", role: "admin" },
  { email: "info+mj@floresabeirario.pt",      name: "MJ",      photo: "/userphotos/mj.webp",      role: "admin" },
  { email: "info+ana@floresabeirario.pt",     name: "Ana",     photo: "/userphotos/ana.webp",     role: "viewer" },
];

// Lista (ordem estável) dos emails admin. Útil quando precisamos de
// atribuir algo aos dois admins (ex.: tarefas-lembrete geradas pela
// cadência de comunicação). O Set abaixo deriva desta lista.
export const ADMIN_EMAILS_LIST: readonly string[] = TEAM.filter(
  (m) => m.role === "admin",
).map((m) => m.email);

const ADMIN_EMAILS: ReadonlySet<string> = new Set(ADMIN_EMAILS_LIST);

export const VIEWER_EMAILS_LIST: readonly string[] = TEAM.filter(
  (m) => m.role === "viewer",
).map((m) => m.email);

// Toda a equipa (admins + viewer). Usado pelo proxy para barrar sessões
// de contas desconhecidas: mesmo que os signups do Supabase estejam
// abertos por engano, uma conta estranha nunca passa do /login.
const TEAM_EMAILS: ReadonlySet<string> = new Set([
  ...ADMIN_EMAILS_LIST,
  ...VIEWER_EMAILS_LIST,
]);

export function isTeamEmail(email: string | null | undefined): boolean {
  return !!email && TEAM_EMAILS.has(email);
}

export function roleForEmail(email: string | null | undefined): Role {
  return email && ADMIN_EMAILS.has(email) ? "admin" : "viewer";
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  viewer: "Visualizador",
};
