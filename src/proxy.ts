import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const { data: { user } } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/");
  // Endpoints de cron são protegidos por CRON_SECRET (header
  // Authorization), não por cookie de sessão — saltam o redirect.
  const isCronEndpoint = request.nextUrl.pathname.startsWith("/api/cron/");
  // Webhook do WhatsApp é chamado pela Meta sem sessão; validação é por
  // HMAC (X-Hub-Signature-256) e verify token (handshake GET).
  const isWhatsappWebhook = request.nextUrl.pathname.startsWith("/api/whatsapp/");

  if (!user && !isLoginPage && !isAuthCallback && !isCronEndpoint && !isWhatsappWebhook) {
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
