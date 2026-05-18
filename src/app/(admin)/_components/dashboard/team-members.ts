// Membros da equipa para o Dashboard. NOTA: a fonte autoritária dos
// emails admin/viewer está em `src/lib/auth/roles.ts` — esta constante
// duplica apenas os emails para a UI (avatar + nome legível).
// Refactor C1 (unificação) consolidará tudo numa só tabela.

export const TEAM_MEMBERS = [
  { email: "info+antonio@floresabeirario.pt", name: "António", photo: "/userphotos/antonio.webp" },
  { email: "info+mj@floresabeirario.pt",      name: "MJ",      photo: "/userphotos/mj.webp" },
  { email: "info+ana@floresabeirario.pt",     name: "Ana",     photo: "/userphotos/ana.webp" },
] as const;

export function memberName(email: string | null | undefined): string {
  if (!email) return "—";
  return TEAM_MEMBERS.find((m) => m.email === email)?.name ?? email;
}
