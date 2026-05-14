"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  LinkIcon,
  Unlink,
  FolderPlus,
  RefreshCcw,
  AlertTriangle,
  CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GoogleIntegrationRow } from "@/lib/google/oauth";
import {
  disconnectGoogleAction,
  ensureRootFoldersAction,
  ensureCalendarAction,
} from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch:
    "Estado OAuth inválido (cookie expirou ou redirect veio de outro browser). Tenta de novo.",
  no_code: "Google não devolveu o código de autorização. Tenta de novo.",
  no_refresh_token:
    "Google não devolveu refresh_token. Vai a https://myaccount.google.com/permissions, revoga 'FBR Admin' e tenta de novo.",
  wrong_account:
    "Conectaste com a conta errada. Tem de ser info@floresabeirario.pt.",
  exchange_failed: "Erro ao trocar o código por tokens.",
  no_permission: "Não tens permissão para conectar (precisa de ser admin).",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function folderUrl(id: string | null): string | null {
  if (!id) return null;
  return `https://drive.google.com/drive/folders/${id}`;
}

export function GoogleSettingsClient({
  integration,
  okFlag,
  errorCode,
  errorDetail,
  gotEmail,
}: {
  integration: GoogleIntegrationRow | null;
  okFlag: boolean;
  errorCode?: string;
  errorDetail?: string;
  gotEmail?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [showDetail, setShowDetail] = useState(false);
  const connected = !!integration?.refresh_token;

  function onDisconnect() {
    if (!confirm("Tens a certeza? Vais ter de reconectar para usar Drive/Gmail/Calendar.")) {
      return;
    }
    startTransition(async () => {
      try {
        await disconnectGoogleAction();
        toast.success("Integração Google desconectada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao desconectar.");
      }
    });
  }

  function onEnsureFolders() {
    startTransition(async () => {
      try {
        await ensureRootFoldersAction();
        toast.success("Pastas-mãe verificadas e criadas se necessário.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar pastas.");
      }
    });
  }

  function onEnsureCalendar() {
    startTransition(async () => {
      try {
        await ensureCalendarAction();
        toast.success("Calendário verificado e criado se necessário.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar calendário.");
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="font-['TanMemories'] text-3xl text-[#3D2B1F] dark:text-[#E8D5B5]">
          Integração Google
        </h1>
        <p className="text-sm text-[#8B7355] mt-1">
          Conecta a conta info@floresabeirario.pt para autorizar acesso a Drive, Gmail e Google Calendar.
        </p>
      </div>

      {/* Banner OK */}
      {okFlag && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Integração conectada com sucesso!
        </div>
      )}

      {/* Banner erro */}
      {errorCode && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {ERROR_MESSAGES[errorCode] ?? `Erro: ${errorCode}`}
            {errorCode === "wrong_account" && gotEmail && (
              <span className="font-mono text-xs ml-1">(recebi: {gotEmail})</span>
            )}
          </div>
          {errorDetail && (
            <div className="text-xs">
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                className="underline opacity-70 hover:opacity-100"
              >
                {showDetail ? "esconder" : "ver"} detalhe
              </button>
              {showDetail && (
                <pre className="mt-1 p-2 bg-rose-100 rounded overflow-x-auto whitespace-pre-wrap">
                  {errorDetail}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Estado da conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Conectado
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-stone-400" />
                Não conectado
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {connected ? (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[#B8A99A]">Conta Google</dt>
                  <dd className="font-mono text-[13px] text-[#3D2B1F]">{integration?.google_email}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[#B8A99A]">Conectado em</dt>
                  <dd className="text-[13px] text-[#3D2B1F]">{formatDate(integration?.connected_at ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[#B8A99A]">Conectado por</dt>
                  <dd className="text-[13px] text-[#3D2B1F]">{integration?.connected_by_email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-[#B8A99A]">Permissões (scopes)</dt>
                  <dd className="text-[12px] text-[#3D2B1F] flex flex-wrap gap-1 mt-0.5">
                    {(integration?.scopes ?? []).map((s) => {
                      const short = s.split("/").pop() || s;
                      return (
                        <Badge key={s} variant="outline" className="font-mono text-[10px]">
                          {short}
                        </Badge>
                      );
                    })}
                  </dd>
                </div>
              </dl>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={onDisconnect}
                  disabled={pending}
                  className="text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
                <a href="/api/google/connect">
                  <Button variant="outline" disabled={pending}>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Reconectar (refresh consent)
                  </Button>
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#8B7355]">
                Carrega no botão abaixo para iniciar o fluxo de autorização do Google. Vais ser redirecionado
                para a tela de consentimento; tem de ser feito com{" "}
                <span className="font-mono">info@floresabeirario.pt</span>.
              </p>
              <a href="/api/google/connect">
                <Button disabled={pending}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Conectar Google
                </Button>
              </a>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pastas-mãe na Drive */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Estrutura de pastas na Drive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-[#8B7355]">
              Estrutura: <span className="font-medium text-[#3D2B1F]">FBR — Encomendas</span> →
              {" "}<span className="font-medium">Preservação de Flores</span> ou
              {" "}<span className="font-medium">Vale-Presente</span> → pasta de cada cliente com subpastas
              por fase.
            </div>

            <ul className="space-y-1.5 text-sm">
              <FolderRow
                label="FBR — Encomendas (raiz)"
                id={integration?.drive_root_folder_id ?? null}
              />
              <FolderRow
                label="Preservação de Flores"
                id={integration?.drive_orders_folder_id ?? null}
                indent
              />
              <FolderRow
                label="Vale-Presente"
                id={integration?.drive_vouchers_folder_id ?? null}
                indent
              />
            </ul>

            <Button
              variant="outline"
              onClick={onEnsureFolders}
              disabled={pending}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Verificar / criar pastas-mãe agora
            </Button>
            <p className="text-xs text-[#B8A99A]">
              Em geral isto é feito automaticamente da 1ª vez que uma encomenda recebe pagamento. Este botão
              é útil se quiseres preparar a estrutura agora ou se algo correu mal.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Calendário "Preservação de Flores" */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Calendário &ldquo;Preservação de Flores&rdquo;</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-[#8B7355]">
              Ao 1º pagamento de uma encomenda, é criado automaticamente um evento all-day na
              data do evento do cliente neste calendário dedicado. Vales não geram eventos.
            </div>

            <div className="flex items-center gap-2 text-sm">
              {integration?.calendar_id ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[#3D2B1F]">Calendário pronto</span>
                  <a
                    href={`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(integration.calendar_id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs ml-auto"
                  >
                    abrir no Google Calendar
                  </a>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-stone-300 shrink-0" />
                  <span className="text-[#3D2B1F]">Ainda não criado</span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              onClick={onEnsureCalendar}
              disabled={pending}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Verificar / criar calendário agora
            </Button>
            <p className="text-xs text-[#B8A99A]">
              Cria o calendário (se ainda não existir) ou apenas confirma que está acessível.
              É feito automaticamente no 1º evento — este botão é útil para preparar antes ou
              recuperar caso o calendário tenha sido apagado.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Setup guide quando não conectado */}
      {!connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Antes de conectar — setup do Google Cloud</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[#8B7355] space-y-2">
            <p>Se ainda não criaste o OAuth client no Google Cloud Console:</p>
            <ol className="list-decimal pl-5 space-y-1 text-[13px]">
              <li>Vai a{" "}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  console.cloud.google.com
                </a>{" "}
                e cria/seleciona um projecto.
              </li>
              <li>Activa as APIs <strong>Drive</strong>, <strong>Gmail</strong> e <strong>Calendar</strong>.</li>
              <li>OAuth Consent Screen → External → Testing — adiciona info@floresabeirario.pt como test user.</li>
              <li>
                Credenciais → criar OAuth 2.0 Client (Web). Redirect URIs:
                <ul className="list-disc pl-5 mt-1 font-mono text-[11px]">
                  <li>https://admin.floresabeirario.pt/api/google/callback</li>
                  <li>http://localhost:3000/api/google/callback</li>
                </ul>
              </li>
              <li>
                Copia Client ID + Secret para env vars no Vercel (e .env.local):
                <ul className="list-disc pl-5 mt-1 font-mono text-[11px]">
                  <li>GOOGLE_CLIENT_ID</li>
                  <li>GOOGLE_CLIENT_SECRET</li>
                  <li>GOOGLE_REDIRECT_URI (opcional — fallback usa NEXT_PUBLIC_SITE_URL)</li>
                </ul>
              </li>
              <li>Redeploy (Vercel não auto-redeploya ao mudar env vars).</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FolderRow({ label, id, indent }: { label: string; id: string | null; indent?: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${indent ? "pl-5" : ""}`}>
      {id ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-stone-300 shrink-0" />
      )}
      <span className="text-[#3D2B1F]">{label}</span>
      {id && (
        <a
          href={folderUrl(id) ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-xs ml-auto"
        >
          abrir
        </a>
      )}
    </li>
  );
}
