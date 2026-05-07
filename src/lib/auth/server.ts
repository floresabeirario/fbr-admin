import "server-only";
import { createClient } from "@/lib/supabase/server";
import { roleForEmail, type Role } from "./roles";

export async function getCurrentRole(): Promise<Role> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return roleForEmail(data.user?.email);
}

export async function getCurrentEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
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

// Atira erro se não houver utilizador autenticado.
// Usar em endpoints que TODOS os 3 utilizadores podem usar
// (ex.: tarefas e checklist do Dashboard, aba Parcerias).
export async function requireUser(): Promise<string> {
  const email = await getCurrentEmail();
  if (!email) {
    throw new Error("Sem permissão. Sessão expirada — volta a entrar.");
  }
  return email;
}
