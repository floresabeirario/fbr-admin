"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ExternalLink, MessageSquareText, RefreshCw, MailQuestion } from "lucide-react";
import { linkify } from "@/lib/linkify";
import { formatDateTimeLisbon, formatTimeLisbon } from "@/lib/format-date";
import SuggestComposer from "@/components/suggest-composer";
import type { WhatsappConversation, WhatsappMessage } from "@/types/whatsapp-live";
import { markConversationReadAction, markConversationUnreadAction } from "@/app/(admin)/whatsapp/actions";

type Props = {
  // Telefone do cliente no formato livre da BD (ex: "935 896 353", "+351935...").
  phone: string | null | undefined;
  // Encomenda a que este painel pertence. Só o workbench da Preservação a
  // tem — as Parcerias e os Vales usam o mesmo painel sem encomenda.
  // Quando existe, o assistente funciona mesmo sem conversa nenhuma: lê o
  // que o cliente escolheu no formulário e sugere a PRIMEIRA mensagem.
  orderId?: string | null;
  contactName?: string | null;
};

function lastNineDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "").slice(-9);
}

function formatMessageTime(iso: string): string {
  return formatTimeLisbon(iso);
}

function mediaIconLabel(content_type: string): string {
  switch (content_type) {
    case "image": return "📷 Foto";
    case "video": return "🎥 Vídeo";
    case "audio": return "🎤 Áudio";
    case "document": return "📄 Documento";
    case "sticker": return "🌸 Sticker";
    case "location": return "📍 Localização";
    case "contacts": return "👤 Contacto";
    case "reaction": return "↩ Reacção";
    default: return "(mensagem)";
  }
}

export default function WhatsappLivePanel({ phone, orderId, contactName }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const phoneTail = lastNineDigits(phone);

  // undefined = ainda à procura; null = procurámos e não há conversa.
  const [conversation, setConversation] = useState<WhatsappConversation | null | undefined>(undefined);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const validPhone = phoneTail.length >= 9;

  // Reset durante o render quando o telefone muda (padrão "store info from
  // previous renders" — sem setState em effect).
  const [prevTail, setPrevTail] = useState(phoneTail);
  if (phoneTail !== prevTail) {
    setPrevTail(phoneTail);
    setConversation(undefined);
    setMessages([]);
  }

  // loading é derivado — sem estado próprio.
  const loading = validPhone && conversation === undefined;

  // Procurar conversa por last 9 digits do telefone do cliente.
  useEffect(() => {
    if (!phoneTail || phoneTail.length < 9) return;
    let cancelled = false;

    supabase
      .from("whatsapp_conversations")
      .select(
        "id, phone_e164, display_phone, contact_name, last_message_at, last_message_preview, last_message_direction, unread_count, archived, notes, created_at, updated_at",
      )
      .like("phone_e164", `%${phoneTail}`)
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const c = (data?.[0] ?? null) as WhatsappConversation | null;
        setConversation(c);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, phoneTail]);

  // Quando temos conversa: ir buscar mensagens + Realtime.
  // (reset de messages ao mudar de conversa é feito no render, acima)
  useEffect(() => {
    if (!conversation) return;
    let cancelled = false;

    supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("received_at", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMessages(data as WhatsappMessage[]);
      });

    const channel = supabase
      .channel(`wa-workbench-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const m = payload.new as WhatsappMessage;
          setMessages((prev) => (prev.some((x) => x.wamid === m.wamid) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const m = payload.new as WhatsappMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, conversation]);

  // Tambem subscrever INSERTs de novas conversas (caso o cliente envie pela 1a vez
  // enquanto temos o workbench aberto).
  useEffect(() => {
    if (conversation || !phoneTail) return;
    const channel = supabase
      .channel(`wa-workbench-discover-${phoneTail}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const c = payload.new as WhatsappConversation;
          if (c.phone_e164.replace(/\D/g, "").endsWith(phoneTail)) {
            setConversation(c);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversation, phoneTail]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-mark-as-read quando a conversa esta visivel no workbench
  // (consistencia com /whatsapp)
  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markConversationReadAction(conversation.id);
    }
  }, [conversation?.id, conversation?.unread_count, conversation]);

  // ─── Empty states ───
  // Sem conversa não quer dizer sem nada a dizer: a maior parte das
  // clientes preenche o formulário e fica à espera que sejamos nós a
  // escrever primeiro. Nesses casos o assistente continua disponível —
  // lê a encomenda em vez da conversa.
  if (!phone || phoneTail.length < 9) {
    return (
      <SemConversa
        orderId={orderId}
        contactName={contactName}
        phone={null}
        title="Sem número de telefone"
        description="Adiciona o número do cliente na ficha para começares a ver conversas."
      />
    );
  }
  if (loading) {
    return (
      <EmptyBox title="A carregar…" description="" />
    );
  }
  if (!conversation) {
    return (
      <SemConversa
        orderId={orderId}
        contactName={contactName}
        phone={phone}
        title="Sem conversa de WhatsApp ainda"
        description={`Quando esta cliente enviar ou tu lhe escreveres pelo telemóvel para ${phone}, a conversa aparece aqui automaticamente.`}
      />
    );
  }

  return (
    <div className="rounded-md border border-cream-200 bg-cream-50/40 overflow-hidden">
      {/* Header compacto */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cream-200 bg-surface">
        <div className="flex items-center gap-2 text-xs text-cocoa-600">
          <MessageSquareText className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-medium text-cocoa-900">
            {conversation.contact_name || conversation.display_phone || conversation.phone_e164}
          </span>
          {messages.length > 0 && (
            <span className="text-[10px] text-cocoa-500">
              · {messages.length} mensage{messages.length === 1 ? "m" : "ns"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => markConversationUnreadAction(conversation.id)}
          className="p-1 rounded hover:bg-cream-100 text-cocoa-500"
          title="Marcar como não lida"
        >
          <MailQuestion className="h-3.5 w-3.5" />
        </button>
        <Link
          href={`/whatsapp?conv=${conversation.id}`}
          className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1"
          title="Abrir na Caixa de Entrada"
        >
          Caixa de entrada <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className="max-h-[400px] overflow-y-auto p-2.5 space-y-1.5"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-cocoa-400 text-center py-4">Sem mensagens nesta conversa.</p>
        ) : (
          (() => {
            const wamidMap = new Map<string, WhatsappMessage>();
            for (const m of messages) wamidMap.set(m.wamid, m);
            const reactionsByTarget = new Map<string, WhatsappMessage[]>();
            for (const m of messages) {
              if (m.content_type === "reaction" && m.reaction_target_wamid) {
                const arr = reactionsByTarget.get(m.reaction_target_wamid) ?? [];
                arr.push(m);
                reactionsByTarget.set(m.reaction_target_wamid, arr);
              }
            }
            const renderable = messages.filter((m) => m.content_type !== "reaction");
            return renderable.map((m) => {
              const repliedTo = m.reply_to_wamid ? wamidMap.get(m.reply_to_wamid) ?? null : null;
              const reactions = reactionsByTarget.get(m.wamid) ?? [];
              return <MessageBubble key={m.id} message={m} repliedTo={repliedTo} reactions={reactions} />;
            });
          })()
        )}
      </div>

      {/* Composer Sugerir resposta */}
      <SuggestComposer
        conversationId={conversation.id}
        orderId={orderId ?? null}
        contactName={conversation.contact_name ?? contactName ?? null}
        phone={conversation.phone_e164}
      />
    </div>
  );
}

function EmptyBox({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed border-cream-200 p-4 text-center bg-cream-50/40">
      <MessageSquareText className="h-5 w-5 text-cocoa-400 mx-auto mb-1.5" />
      <p className="text-xs font-medium text-cocoa-700">{title}</p>
      {description && <p className="text-[11px] text-cocoa-500 mt-1">{description}</p>}
    </div>
  );
}

// Estado "ainda não há conversa": a caixa vazia de sempre, mais o
// assistente quando estamos numa encomenda. É o caso mais comum do
// workbench — a cliente preencheu o formulário e nunca escreveu — e era
// justamente aqui que não havia forma de pedir uma sugestão sem ir
// buscar um template à mão e adaptá-lo.
function SemConversa({
  orderId,
  contactName,
  phone,
  title,
  description,
}: {
  orderId?: string | null;
  contactName?: string | null;
  phone: string | null | undefined;
  title: string;
  description: string;
}) {
  if (!orderId) return <EmptyBox title={title} description={description} />;
  return (
    <div className="rounded-md border border-cream-200 bg-cream-50/40 overflow-hidden">
      <div className="p-4 text-center">
        <MessageSquareText className="h-5 w-5 text-cocoa-400 mx-auto mb-1.5" />
        <p className="text-xs font-medium text-cocoa-700">{title}</p>
        {description && <p className="text-[11px] text-cocoa-500 mt-1">{description}</p>}
      </div>
      <SuggestComposer
        orderId={orderId}
        contactName={contactName}
        phone={phone}
        ctaLabel="Sugerir mensagem"
        placeholder='Diz ao Claude o que queres comunicar (opcional). Sem instrução, ele lê o formulário e escreve o primeiro contacto.'
      />
    </div>
  );
}

function MessageBubble({
  message,
  repliedTo,
  reactions = [],
}: {
  message: WhatsappMessage;
  repliedTo?: WhatsappMessage | null;
  reactions?: WhatsappMessage[];
}) {
  const isSent = message.direction === "sent_echo";
  return (
    <div className={cn("flex relative", isSent ? "justify-end" : "justify-start", reactions.length > 0 && "mb-3")}>
      <div
        className={cn(
          "max-w-[85%] px-2.5 py-1.5 rounded-2xl text-xs shadow-sm relative",
          isSent
            ? "bg-emerald-100 text-cocoa-900 rounded-br-sm"
            : "bg-surface border border-cream-200 text-cocoa-900 rounded-bl-sm",
        )}
      >
        {reactions.length > 0 && (
          <div
            className={cn(
              "absolute -bottom-2.5 flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-surface border border-cream-200 shadow-sm z-10",
              isSent ? "right-1.5" : "left-1.5",
            )}
          >
            {reactions.slice(0, 3).map((r) => (
              <span key={r.id} className="text-xs leading-none" title={`Reagiu com ${r.text}`}>
                {r.text || "•"}
              </span>
            ))}
            {reactions.length > 3 && (
              <span className="text-[9px] text-cocoa-500 ml-0.5">+{reactions.length - 3}</span>
            )}
          </div>
        )}
        {repliedTo && (
          <div
            className={cn(
              "border-l-2 pl-1.5 py-0.5 mb-1 text-[10px] rounded-r-sm",
              repliedTo.direction === "sent_echo"
                ? "bg-emerald-50 border-emerald-400"
                : "bg-cream-50 border-cocoa-400",
            )}
          >
            <div className={cn("font-medium", repliedTo.direction === "sent_echo" ? "text-emerald-700" : "text-cocoa-600")}>
              {repliedTo.direction === "sent_echo" ? "FBR" : "Cliente"}
            </div>
            <div className="text-cocoa-700 truncate max-w-[260px]">
              {repliedTo.text || mediaIconLabel(repliedTo.content_type)}
            </div>
          </div>
        )}
        {message.content_type === "text" ? (
          <p className="whitespace-pre-wrap break-words">{linkify(message.text ?? "")}</p>
        ) : (
          (() => {
            const failed =
              !message.media_pending && !message.media_url_drive && !!message.media_id;
            const fileId = message.media_drive_file_id;
            const proxyUrl = fileId ? `/api/whatsapp/media/${fileId}` : null;
            const isVisualMedia =
              message.content_type === "image" || message.content_type === "sticker";
            const isAudio = message.content_type === "audio";
            const isVideo = message.content_type === "video";
            const isDocument = message.content_type === "document";
            return (
              <div>
                {proxyUrl && isVisualMedia ? (
                  <a href={message.media_url_drive ?? "#"} target="_blank" rel="noopener noreferrer" className="block mb-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- media do WhatsApp via proxy autenticado; next/image não traz benefício e custaria optimização */}
                    <img
                      src={proxyUrl}
                      alt={message.text ?? "foto"}
                      loading="lazy"
                      className="rounded max-h-48 w-auto max-w-full object-contain bg-cocoa-50"
                    />
                  </a>
                ) : proxyUrl && isAudio ? (
                  <audio controls preload="metadata" className="w-full max-w-[220px]" src={proxyUrl} />
                ) : proxyUrl && isVideo ? (
                  <video controls preload="metadata" className="rounded max-h-48 w-auto max-w-full bg-cocoa-50" src={proxyUrl} />
                ) : proxyUrl && isDocument ? (
                  <a href={proxyUrl} download className="inline-flex items-center gap-1 text-cocoa-700 hover:text-cocoa-900 bg-cream-50 border border-cream-200 rounded px-2 py-1 text-[10px]">
                    📄 <span className="underline">{message.text || "Documento"}</span>
                  </a>
                ) : (
                  <p className="text-cocoa-600 italic">
                    {mediaIconLabel(message.content_type)}
                    {message.media_pending && (
                      <span className="text-cocoa-400 ml-1">(a carregar…)</span>
                    )}
                    {failed && (
                      <span className="text-rose-500 ml-1" title="A URL temporária da Meta expirou ou houve erro. Vê no telemóvel.">
                        ⚠ não consegui guardar
                      </span>
                    )}
                    {failed && <RetryMediaButton messageId={message.id} />}
                  </p>
                )}
                {message.text && !isDocument && (
                  <p className="mt-1 whitespace-pre-wrap break-words">{linkify(message.text)}</p>
                )}
                {message.media_url_drive && !proxyUrl && (
                  <a
                    href={message.media_url_drive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-indigo-600 hover:underline"
                  >
                    Abrir na Drive ↗
                  </a>
                )}
              </div>
            );
          })()
        )}
        <div
          className={cn(
            "text-[9px] mt-0.5 flex items-center gap-1",
            isSent ? "text-cocoa-500 justify-end" : "text-cocoa-400",
          )}
        >
          {formatMessageTime(message.received_at)}
          {isSent && <DeliveryTicks message={message} />}
        </div>
      </div>
    </div>
  );
}

function RetryMediaButton({ messageId }: { messageId: string }) {
  const [loading, setLoading] = useState(false);
  async function handleRetry() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/retry-media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json();
      if (data.ok) toast.success("Puxada com sucesso.");
      else toast.error(data.error || "URL da Meta expirou ou houve erro.");
    } catch {
      toast.error("Falhou — tenta de novo.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={loading}
      className="ml-1 text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
      title="Tentar puxar de novo"
    >
      <RefreshCw className={cn("h-2.5 w-2.5 inline", loading && "animate-spin")} />
    </button>
  );
}

function DeliveryTicks({ message }: { message: WhatsappMessage }) {
  if (message.delivery_status === "failed") {
    return <span title="Falhou" className="text-rose-500">⚠</span>;
  }
  if (message.delivery_status === "read") {
    return (
      <span title={`Lida ${message.read_at ? formatDateTimeLisbon(message.read_at) : ""}`} className="text-sky-500">
        ✓✓
      </span>
    );
  }
  if (message.delivery_status === "delivered") {
    return (
      <span title={`Entregue ${message.delivered_at ? formatDateTimeLisbon(message.delivered_at) : ""}`} className="text-cocoa-400">
        ✓✓
      </span>
    );
  }
  // Sem status (ainda) — mostra so o icone do telemovel.
  return <span title="Enviada pelo telemóvel">📱</span>;
}
