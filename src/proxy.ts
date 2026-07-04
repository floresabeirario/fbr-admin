import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isTeamEmail } from "@/lib/auth/roles";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() em vez de getUser(): valida o JWT localmente (assinatura
  // verificada com as chaves públicas do projecto, cacheadas) em vez de
  // fazer uma chamada de rede ao Supabase Auth em CADA pedido. Continua a
  // refrescar a sessão quando o token está a expirar. Isto tira ~100-300ms
  // a cada navegação — era uma das causas da app "demorar imenso a carregar".
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  // Sessão só conta se o email for de um dos 3 membros da equipa.
  // Defesa em profundidade: mesmo que os signups do Supabase Auth
  // fiquem abertos por engano, uma conta estranha com sessão válida
  // fica presa no /login (as RLS já a impediam de ler dados; isto
  // impede-a de sequer entrar na app ou tocar em rotas internas).
  const email = typeof claims?.email === "string" ? claims.email : null;
  const user = claims && isTeamEmail(email) ? claims : null;

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/");
  // Endpoints de cron são protegidos por CRON_SECRET (header
  // Authorization), não por cookie de sessão — saltam o redirect.
  const isCronEndpoint = request.nextUrl.pathname.startsWith("/api/cron/");
  // Webhook do WhatsApp é chamado pela Meta sem sessão; validação é por
  // token no path + (opcional) HMAC X-Hub-Signature-256. Só o /webhook é
  // isento — as restantes rotas /api/whatsapp/* (media, suggest, retry)
  // fazem a sua própria autenticação e têm de continuar atrás do gate,
  // para que uma rota WhatsApp futura sem auth não fique pública por engano.
  const isWhatsappWebhook = request.nextUrl.pathname.startsWith("/api/whatsapp/webhook/");
  // Endpoints internos (ex.: o site avisa de nova encomenda para push) são
  // chamados sem sessão e autenticam-se com INTERNAL_NOTIFY_SECRET.
  const isInternalEndpoint = request.nextUrl.pathname.startsWith("/api/internal/");

  if (!user && !isLoginPage && !isAuthCallback && !isCronEndpoint && !isWhatsappWebhook && !isInternalEndpoint) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // `manifest.webmanifest` e `sw.js` ficam fora do gate de auth: o Chrome
  // do Android busca-os em contexto cross-origin (sem cookies da sessão)
  // para avaliar a PWA. Se forem redireccionados para /login, o site
  // perde a oferta "Instalar app" e a Maria só consegue "Adicionar atalho"
  // (ícone "F" cinzento).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|otf|ttf|woff|woff2)$).*)"],
};
