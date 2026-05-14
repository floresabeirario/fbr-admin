import "server-only";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

/**
 * Foundation OAuth para integrar com info@floresabeirario.pt.
 *
 * Setup necessário no Google Cloud Console:
 *  1. Criar projecto (ou reusar).
 *  2. Activar APIs: Drive, Gmail, Calendar.
 *  3. Configurar OAuth Consent Screen (External, Testing — adicionar
 *     info@floresabeirario.pt como test user).
 *  4. Criar credenciais OAuth 2.0 → Web application:
 *      - Authorised redirect URIs: https://admin.floresabeirario.pt/api/google/callback
 *        e http://localhost:3000/api/google/callback
 *  5. Copiar Client ID + Secret para env vars no Vercel:
 *      - GOOGLE_CLIENT_ID
 *      - GOOGLE_CLIENT_SECRET
 *      - GOOGLE_REDIRECT_URI (fallback: admin.floresabeirario.pt/api/google/callback)
 *  6. Login admin → /settings/google → "Conectar Google" → consent
 *     flow autoriza tudo e guarda o refresh_token na tabela
 *     `google_integration`.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "openid",
  "email",
  "profile",
];

export type GoogleIntegrationRow = {
  id: string;
  refresh_token: string | null;
  google_email: string | null;
  scopes: string[];
  drive_root_folder_id: string | null;
  drive_orders_folder_id: string | null;
  drive_vouchers_folder_id: string | null;
  calendar_id: string | null;
  connected_at: string | null;
  connected_by_email: string | null;
};

function getRedirectUri(): string {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/google/callback`;
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltam variáveis de ambiente GOOGLE_CLIENT_ID e/ou GOOGLE_CLIENT_SECRET. " +
        "Configura-as no Vercel e em .env.local — ver instruções em src/lib/google/oauth.ts.",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function buildConsentUrl(state: string): string {
  const oauth = getOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forçar refresh_token novo em cada conexão
    scope: GOOGLE_SCOPES,
    state,
  });
}

export async function loadIntegration(): Promise<GoogleIntegrationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_integration")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Erro ao ler google_integration: ${error.message}`);
  }
  return data as GoogleIntegrationRow | null;
}

export async function saveIntegrationAfterConsent(params: {
  refresh_token: string;
  google_email: string;
  scopes: string[];
  connected_by_email: string;
}): Promise<void> {
  const supabase = await createClient();
  const existing = await loadIntegration();

  const payload = {
    refresh_token: params.refresh_token,
    google_email: params.google_email,
    scopes: params.scopes,
    connected_at: new Date().toISOString(),
    connected_by_email: params.connected_by_email,
  };

  if (existing) {
    const { error } = await supabase
      .from("google_integration")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(`Erro a actualizar google_integration: ${error.message}`);
  } else {
    const { error } = await supabase.from("google_integration").insert(payload);
    if (error) throw new Error(`Erro a inserir google_integration: ${error.message}`);
  }
}

export async function disconnectIntegration(): Promise<void> {
  const supabase = await createClient();
  const existing = await loadIntegration();
  if (!existing) return;
  const { error } = await supabase
    .from("google_integration")
    .update({
      refresh_token: null,
      google_email: null,
      scopes: [],
      connected_at: null,
      connected_by_email: null,
      drive_root_folder_id: null,
      drive_orders_folder_id: null,
      drive_vouchers_folder_id: null,
      calendar_id: null,
    })
    .eq("id", existing.id);
  if (error) throw new Error(`Erro a desconectar: ${error.message}`);
}

/**
 * Devolve um OAuth2Client autenticado com o refresh_token persistido.
 * Lança erro descritivo se a integração ainda não foi conectada.
 */
export async function getAuthenticatedClient() {
  const integration = await loadIntegration();
  if (!integration?.refresh_token) {
    throw new Error(
      "Integração Google ainda não está conectada. Vai a /settings/google e clica em 'Conectar Google'.",
    );
  }
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: integration.refresh_token });
  return oauth;
}
