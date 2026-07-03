// Membros da equipa para a UI (avatar + nome legível). A fonte única
// no código é `src/lib/auth/roles.ts` (TEAM); na BD é a tabela
// team_members (mig 085). Este ficheiro só re-exporta na forma que o
// Dashboard consome.

import { TEAM } from "@/lib/auth/roles";

export const TEAM_MEMBERS = TEAM.map(({ email, name, photo }) => ({
  email,
  name,
  photo,
}));

export function memberName(email: string | null | undefined): string {
  if (!email) return "—";
  return TEAM_MEMBERS.find((m) => m.email === email)?.name ?? email;
}
