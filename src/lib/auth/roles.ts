// Mapeamento de papéis (admin/viewer) por email.
// Pode ser importado tanto no servidor como no cliente.
//
// Regras:
// - 2 admins (António e MJ): acesso total a todas as abas
// - 1 viewer (Ana): só pode editar Tarefas (Dashboard) e Parcerias.
//   Em todas as outras abas tem acesso só de leitura.
// - Por defeito (email desconhecido), assumimos viewer — o caminho mais seguro.

export type Role = "admin" | "viewer";

const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  "info+antonio@floresabeirario.pt",
  "info+mj@floresabeirario.pt",
]);

export function roleForEmail(email: string | null | undefined): Role {
  return email && ADMIN_EMAILS.has(email) ? "admin" : "viewer";
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  viewer: "Visualizador",
};
