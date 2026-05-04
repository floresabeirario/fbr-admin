import "server-only";
import { createClient } from "@/lib/supabase/server";
import { roleForEmail, type Role } from "./roles";

export async function getCurrentRole(): Promise<Role> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return roleForEmail(data.user?.email);
}

// Atira erro se o utilizador actual não for admin.
// Usar no início de qualquer Server Action que escreva na BD.
export async function requireAdmin(): Promise<void> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    throw new Error(
      "Sem permissão. Apenas administradores podem fazer esta alteração.",
    );
  }
}
