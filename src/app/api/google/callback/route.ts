import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import {
  getOAuthClient,
  GOOGLE_SCOPES,
  saveIntegrationAfterConsent,
} from "@/lib/google/oauth";
import { getCurrentEmail, getCurrentRole } from "@/lib/auth/server";

function settingsUrl(origin: string, params: Record<string, string>): string {
  const url = new URL("/settings/google", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(settingsUrl(origin, { error: errorParam }));
  }

  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.redirect(settingsUrl(origin, { error: "no_permission" }));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(settingsUrl(origin, { error: "state_mismatch" }));
  }
  if (!code) {
    return NextResponse.redirect(settingsUrl(origin, { error: "no_code" }));
  }

  try {
    const oauth = getOAuthClient();
    const { tokens } = await oauth.getToken(code);
    if (!tokens.refresh_token) {
      // Acontece se o utilizador já tinha consentido antes e o `prompt: consent`
      // falhou; pedimos para revogar acesso e tentar de novo.
      return NextResponse.redirect(
        settingsUrl(origin, { error: "no_refresh_token" }),
      );
    }

    oauth.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email ?? "";

    if (googleEmail !== "info@floresabeirario.pt") {
      return NextResponse.redirect(
        settingsUrl(origin, { error: "wrong_account", got: googleEmail }),
      );
    }

    const adminEmail = (await getCurrentEmail()) ?? "unknown";

    const grantedScopes = tokens.scope
      ? tokens.scope.split(" ").filter(Boolean)
      : GOOGLE_SCOPES;

    await saveIntegrationAfterConsent({
      refresh_token: tokens.refresh_token,
      google_email: googleEmail,
      scopes: grantedScopes,
      connected_by_email: adminEmail,
    });

    return NextResponse.redirect(settingsUrl(origin, { ok: "1" }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(settingsUrl(origin, { error: "exchange_failed", detail: msg }));
  }
}
