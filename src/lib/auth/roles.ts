// Mapeamento de papéis (admin/viewer) por email.
// Pode ser importado tanto no servidor como no cliente.
//
// Regras:
// - 2 admins (António e MJ): acesso total a todas as abas
// - 1 viewer (Ana): só pode editar Tarefas (Dashboard) e Parcerias.
//   Em todas as outras abas tem acesso só de leitura.
// - Por defeito (email desconhecido), assumimos viewer — o caminho mais seguro.

export type Role = "admin" | "viewer";

// Lista (ordem estável) dos emails admin. Útil quando precisamos de
// atribuir algo aos dois admins (ex.: tarefas-lembrete geradas pela
// cadência de comunicação). O Set abaixo deriva desta lista.
export const ADMIN_EMAILS_LIST: readonly string[] = [
  "info+antonio@floresabeirario.pt",
  "info+mj@floresabeirario.pt",
];

const ADMIN_EMAILS: ReadonlySet<string> = new Set(ADMIN_EMAILS_LIST);

export const VIEWER_EMAILS_LIST: readonly string[] = [
  "info+ana@floresabeirario.pt",
];

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
