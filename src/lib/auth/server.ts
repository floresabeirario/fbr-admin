import "server-only";
import { createClient } from "@/lib/supabase/server";
import { roleForEmail, type Role } from "./roles";

// getClaims() em vez de getUser(): valida a assinatura do JWT localmente
// (chaves públicas do projecto, cacheadas) em vez de uma chamada de rede
// ao Supabase Auth. Como o proxy já valida a sessão em cada pedido, cada
// página fazia pelo menos 2 idas ao Auth antes de tocar nos dados — era
// uma das causas da lentidão. A verificação continua criptográfica (não é
// ler o cookie às cegas), por isso requireAdmin/requireUser mantêm-se seguros.
async function getVerifiedEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  return typeof email === "string" ? email : null;
}

export async function getCurrentRole(): Promise<Role> {
  return roleForEmail(await getVerifiedEmail());
}

export async function getCurrentEmail(): Promise<string | null> {
  return getVerifiedEmail();
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
