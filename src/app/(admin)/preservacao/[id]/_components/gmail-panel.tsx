"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { linkify } from "@/lib/linkify";
import {
  Mail,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Link2Off,
} from "lucide-react";

type Props = {
  // Email do cliente guardado na ficha (Preservação ou Vale-Presente).
  email: string | null | undefined;
};

type GmailMessage = {
  id: string;
  direction: "sent" | "received";
  from: string;
  to: string;
  date: string | null;
  snippet: string;
  body: string;
};

type GmailThread = {
  id: string;
  subject: string;
  messages: GmailMessage[];
  lastDate: string | null;
};

type FetchResult =
  | { status: "ok"; account: string; threads: GmailThread[] }
  | { status: "not_connected" }
  | { status: "missing_scope"; account: string | null }
  | { status: "error"; error: string };

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Nome legível do remetente: "Maria <maria@x.pt>" → "Maria". */
function displayName(headerVal: string): string {
  const angle = headerVal.indexOf("<");
  const name = angle > 0 ? headerVal.slice(0, angle).trim() : headerVal.trim();
  return name.replace(/^"|"$/g, "") || headerVal;
}

export default function GmailPanel({ email }: Props) {
  const [result, setResult] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!email || !email.includes("@")) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/google/emails?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((data: FetchResult) => setResult(data))
      .catch(() =>
        setResult({ status: "error", error: "Não consegui contactar o servidor." }),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  if (!email || !email.includes("@")) {
    return (
      <EmptyBox
        title="Sem email do cliente"
        description="Adiciona o email na ficha para veres aqui as conversas trocadas por email."
      />
    );
  }

  if (loading) {
    return <EmptyBox title="A puxar emails…" description="" />;
  }

  if (!result || result.status === "error") {
    return (
      <div className="rounded-md border border-dashed border-rose-200 bg-rose-50/40 p-4 text-center">
        <AlertTriangle className="h-5 w-5 text-rose-400 mx-auto mb-1.5" />
        <p className="text-xs font-medium text-rose-700">Erro a puxar emails</p>
        {result?.status === "error" && (
          <p className="text-[11px] text-rose-500 mt-1">{result.error}</p>
        )}
        <RetryButton onClick={load} />
      </div>
    );
  }

  if (result.status === "not_connected") {
    return (
      <div className="rounded-md border border-dashed border-amber-200 bg-amber-50/40 p-4 text-center">
        <Link2Off className="h-5 w-5 text-amber-400 mx-auto mb-1.5" />
        <p className="text-xs font-medium text-amber-800">Google não está conectado</p>
        <p className="text-[11px] text-amber-600 mt-1">
          Vai a{" "}
          <a href="/settings/google" className="underline font-medium">
            Definições → Google
          </a>{" "}
          e clica em “Conectar Google” para puxar os emails.
        </p>
      </div>
    );
  }

  if (result.status === "missing_scope") {
    return (
      <div className="rounded-md border border-dashed border-amber-200 bg-amber-50/40 p-4 text-center">
        <AlertTriangle className="h-5 w-5 text-amber-400 mx-auto mb-1.5" />
        <p className="text-xs font-medium text-amber-800">Falta autorizar o Gmail</p>
        <p className="text-[11px] text-amber-600 mt-1">
          A ligação à conta {result.account ?? "Google"} não inclui acesso ao Gmail.
          Vai a{" "}
          <a href="/settings/google" className="underline font-medium">
            Definições → Google
          </a>
          , desconecta e volta a “Conectar Google”, aceitando o acesso ao email.
        </p>
      </div>
    );
  }

  // status === "ok"
  if (result.threads.length === 0) {
    return (
      <EmptyBox
        title="Sem emails com este cliente"
        description={`Ainda não há mensagens trocadas com ${email} na conta ${result.account}.`}
        onRefresh={load}
      />
    );
  }

  const totalMsgs = result.threads.reduce((n, t) => n + t.messages.length, 0);

  return (
    <div className="rounded-md border border-cream-200 bg-cream-50/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cream-200 bg-surface">
        <div className="flex items-center gap-2 text-xs text-cocoa-600">
          <Mail className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-medium text-cocoa-900">{email}</span>
          <span className="text-[10px] text-cocoa-500">
            · {result.threads.length} conversa{result.threads.length === 1 ? "" : "s"} ·{" "}
            {totalMsgs} email{totalMsgs === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          onClick={load}
          className="p-1 rounded hover:bg-cream-100 text-cocoa-500"
          title="Actualizar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[400px] overflow-y-auto divide-y divide-cream-200">
        {result.threads.map((thread) => (
          <ThreadItem key={thread.id} thread={thread} account={result.account} />
        ))}
      </div>
    </div>
  );
}

function ThreadItem({ thread, account }: { thread: GmailThread; account: string }) {
  const [open, setOpen] = useState(false);
  const gmailUrl = `https://mail.google.com/mail/u/${encodeURIComponent(
    account,
  )}/#search/rfc822msgid+OR+thread/${thread.id}`;

  return (
    <div className="bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-cream-50/60"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 mt-0.5 text-cocoa-400 transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-cocoa-900 truncate">{thread.subject}</p>
            <span className="text-[10px] text-cocoa-400 shrink-0">
              {formatDateTime(thread.lastDate)}
            </span>
          </div>
          {!open && (
            <p className="text-[11px] text-cocoa-500 truncate mt-0.5">
              {thread.messages[thread.messages.length - 1]?.snippet}
            </p>
          )}
          <span className="text-[10px] text-cocoa-400">
            {thread.messages.length} mensage{thread.messages.length === 1 ? "m" : "ns"}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {thread.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline pt-1"
          >
            Abrir no Gmail <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: GmailMessage }) {
  const isSent = message.direction === "sent";
  const text = (message.body || message.snippet).trim();
  return (
    <div className={cn("flex", isSent ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] px-2.5 py-1.5 rounded-2xl text-xs shadow-sm",
          isSent
            ? "bg-blue-50 border border-blue-100 text-cocoa-900 rounded-br-sm"
            : "bg-surface border border-cream-200 text-cocoa-900 rounded-bl-sm",
        )}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={cn(
              "text-[10px] font-semibold",
              isSent ? "text-blue-700" : "text-cocoa-600",
            )}
          >
            {isSent ? "FBR" : displayName(message.from)}
          </span>
          <span className="text-[9px] text-cocoa-400">{formatDateTime(message.date)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words leading-snug">{linkify(text)}</p>
      </div>
    </div>
  );
}

function EmptyBox({
  title,
  description,
  onRefresh,
}: {
  title: string;
  description: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-cream-200 p-4 text-center bg-cream-50/40">
      <Mail className="h-5 w-5 text-cocoa-400 mx-auto mb-1.5" />
      <p className="text-xs font-medium text-cocoa-700">{title}</p>
      {description && <p className="text-[11px] text-cocoa-500 mt-1">{description}</p>}
      {onRefresh && <RetryButton onClick={onRefresh} />}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
    >
      <RefreshCw className="h-3 w-3" /> Tentar de novo
    </button>
  );
}
