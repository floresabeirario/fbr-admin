import { createClient } from "@/lib/supabase/server";
import { isTeamEmail } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Só a equipa entra. Se por alguma razão uma conta desconhecida
    // completar o fluxo (signups abertos por engano no Supabase),
    // terminamos a sessão imediatamente.
    const { data } = await supabase.auth.getClaims();
    const email = data?.claims?.email;
    if (typeof email !== "string" || !isTeamEmail(email)) {
      await supabase.auth.signOut();
      const url = new URL("/login", origin);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
