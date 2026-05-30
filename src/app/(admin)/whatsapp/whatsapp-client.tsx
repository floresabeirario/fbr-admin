"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Search, Archive, ArchiveRestore } from "lucide-react";
import { Input } from "@/components/ui/input";
import type {
  WhatsappConversation,
  WhatsappMessage,
} from "@/types/whatsapp-live";
import {
  markConversationReadAction,
  archiveConversationAction,
  updateConversationNotesAction,
} from "./actions";

type OrderLite = {
  id: string;
  order_id: string;
  client_name: string | null;
  phone: string | null;
  status: string;
};

type Props = {
  initialConversations: WhatsappConversation[];
  orders: OrderLite[];
};

function digitsOnly(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

// Soft match: termina em pelo menos 9 digitos iguais (cobre PT sem indicativo).
function phoneMatches(orderPhone: string | null, conversationE164: string): boolean {
  const a = digitsOnly(orderPhone);
  const b = digitsOnly(conversationE164);
  if (!a || !b) return false;
  const tail = 9;
  return a.slice(-tail) === b.slice(-tail);
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function previewLabel(content_type: string, text: string | null): string {
  if (text) return text;
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

export default function WhatsappClient({ initialConversations, orders }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState<WhatsappConversation[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  // Realtime: conversas (UPDATE de sumario/unread/archive + INSERT de nova conversa)
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-convs-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const c = payload.new as WhatsappConversation;
          setConversations((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const c = payload.new as WhatsappConversation;
          setConversations((prev) =>
            prev.map((x) => (x.id === c.id ? c : x)).sort(sortByLastMessage),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredConvs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((c) => c.archived === showArchived)
      .filter((c) => {
        if (!term) return true;
        return (
          (c.contact_name?.toLowerCase().includes(term) ?? false) ||
          c.phone_e164.includes(term) ||
          (c.display_phone?.includes(term) ?? false) ||
          (c.last_message_preview?.toLowerCase().includes(term) ?? false)
        );
      })
      .sort(sortByLastMessage);
  }, [conversations, search, showArchived]);

  const selectedConv = selectedId ? conversations.find((c) => c.id === selectedId) ?? null : null;

  // Quando seleciona conversa nao-lida, marca como lida.
  useEffect(() => {
    if (selectedConv && selectedConv.unread_count > 0) {
      markConversationReadAction(selectedConv.id);
    }
  }, [selectedConv?.id, selectedConv?.unread_count, selectedConv]);

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4.5rem)] flex flex-col lg:flex-row gap-0 bg-cream-50">
      {/* COLUNA ESQUERDA — lista de conversas */}
      <aside
        className={cn(
          "lg:w-96 lg:border-r lg:border-cream-200 lg:flex lg:flex-col bg-surface",
          selectedId ? "hidden lg:flex" : "flex flex-col flex-1",
        )}
      >
        <div className="p-3 border-b border-cream-200 space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-cocoa-900 flex-1">WhatsApp</h1>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs text-cocoa-600 hover:text-cocoa-900 px-2 py-1 rounded border border-cream-200 hover:bg-cream-100"
              title={showArchived ? "Voltar a activas" : "Ver arquivadas"}
            >
              {showArchived ? "← Activas" : "Arquivadas"}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar nome, número, mensagem..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="p-8 text-center text-sm text-cocoa-500">
              {showArchived ? "Nenhuma conversa arquivada." : "Nenhuma conversa ainda."}
            </div>
          ) : (
            <ul className="divide-y divide-cream-100">
              {filteredConvs.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-cream-50 transition-colors",
                      selectedId === c.id && "bg-cream-100",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="font-medium text-sm text-cocoa-900 truncate">
                        {c.contact_name || c.display_phone || c.phone_e164}
                      </span>
                      <span className="text-[10px] text-cocoa-500 shrink-0">
                        {formatRelativeTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-cocoa-600 truncate flex-1">
                        {c.last_message_direction === "sent_echo" && (
                          <span className="text-cocoa-400">↪ </span>
                        )}
                        {c.last_message_preview ?? "(sem mensagens)"}
                      </p>
                      {c.unread_count > 0 && (
                        <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 inline-flex items-center justify-center shrink-0">
                          {c.unread_count > 99 ? "99+" : c.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* COLUNA DIREITA — conversa seleccionada */}
      <main className={cn("flex-1 flex flex-col bg-cream-50", !selectedId && "hidden lg:flex")}>
        {selectedConv ? (
          <ConversationViewer
            conversation={selectedConv}
            orders={orders}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-cocoa-400 text-sm">
            Escolhe uma conversa.
          </div>
        )}
      </main>
    </div>
  );
}

function sortByLastMessage(a: WhatsappConversation, b: WhatsappConversation): number {
  const aT = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
  const bT = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
  return bT - aT;
}

// ──────────────────────────────────────────────────────────────
// CONVERSATION VIEWER
// ──────────────────────────────────────────────────────────────
function ConversationViewer({
  conversation,
  orders,
  onBack,
}: {
  conversation: WhatsappConversation;
  orders: OrderLite[];
  onBack: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const linkedOrders = useMemo(() =>
    orders.filter((o) => phoneMatches(o.phone, conversation.phone_e164)),
    [orders, conversation.phone_e164],
  );

  // Fetch mensagens da conversa + subscrever Realtime
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);

    supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("received_at", { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMessages(data as WhatsappMessage[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`whatsapp-msgs-${conversation.id}`)
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
  }, [supabase, conversation.id]);

  // Auto-scroll para fundo em cada mensagem nova
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Header */}
      <header className="p-3 border-b border-cream-200 bg-surface flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="lg:hidden p-1.5 -ml-1 rounded hover:bg-cream-100"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-cocoa-900 truncate">
              {conversation.contact_name || conversation.display_phone || conversation.phone_e164}
            </h2>
            {conversation.contact_name && (
              <span className="text-xs text-cocoa-500 truncate">{conversation.display_phone}</span>
            )}
          </div>
          {linkedOrders.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {linkedOrders.slice(0, 4).map((o) => (
                <Link
                  key={o.id}
                  href={`/preservacao/${o.order_id}`}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 truncate max-w-[160px]"
                  title={`${o.client_name ?? o.order_id} — ${o.status}`}
                >
                  {o.client_name ?? o.order_id}
                </Link>
              ))}
              {linkedOrders.length > 4 && (
                <span className="text-[10px] text-cocoa-500">+{linkedOrders.length - 4}</span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => archiveConversationAction(conversation.id, !conversation.archived)}
          className="p-1.5 rounded hover:bg-cream-100 text-cocoa-600"
          title={conversation.archived ? "Desarquivar" : "Arquivar"}
        >
          {conversation.archived ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
        </button>
      </header>

      {/* Notes */}
      <NotesArea
        conversationId={conversation.id}
        initialNotes={conversation.notes}
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loading ? (
          <div className="text-center text-xs text-cocoa-400 py-6">A carregar...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-cocoa-400 py-6">Sem mensagens.</div>
        ) : (
          messages.map((m, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const showDay = !prev || dayBoundary(prev.received_at, m.received_at);
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="text-center my-2">
                    <span className="text-[10px] text-cocoa-500 bg-cream-100 px-2 py-0.5 rounded-full">
                      {formatDayLabel(m.received_at)}
                    </span>
                  </div>
                )}
                <MessageBubble message={m} />
              </div>
            );
          })
        )}
      </div>

      {/* Composer placeholder + "Sugerir resposta" (Claude vem em sessao proxima) */}
      <footer className="p-3 border-t border-cream-200 bg-surface text-center text-xs text-cocoa-500">
        💡 As mensagens são enviadas pelo telemóvel. <br />
        <span className="text-cocoa-400">Botão &quot;Sugerir resposta&quot; com Claude — em desenvolvimento.</span>
      </footer>
    </>
  );
}

function dayBoundary(prevIso: string, nextIso: string): boolean {
  const a = new Date(prevIso);
  const b = new Date(nextIso);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Hoje";
  if (sameDay(date, yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function MessageBubble({ message }: { message: WhatsappMessage }) {
  const isSent = message.direction === "sent_echo";
  return (
    <div className={cn("flex", isSent ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] sm:max-w-[60%] px-3 py-2 rounded-2xl text-sm shadow-sm",
          isSent
            ? "bg-emerald-100 text-cocoa-900 rounded-br-sm"
            : "bg-surface border border-cream-200 text-cocoa-900 rounded-bl-sm",
        )}
      >
        <MessageContent message={message} />
        <div
          className={cn(
            "text-[10px] mt-1 flex items-center gap-1",
            isSent ? "text-cocoa-500 justify-end" : "text-cocoa-400",
          )}
        >
          {formatMessageTime(message.received_at)}
          {isSent && <span title="Enviada pelo telemóvel">📱</span>}
        </div>
      </div>
    </div>
  );
}

function MessageContent({ message }: { message: WhatsappMessage }) {
  if (message.content_type === "text") {
    return <p className="whitespace-pre-wrap break-words">{message.text}</p>;
  }

  // Media: media_url_drive ainda nao disponivel (job assincrono em sessao
  // futura). Por agora mostra label + media_pending state.
  if (
    message.content_type === "image" ||
    message.content_type === "video" ||
    message.content_type === "audio" ||
    message.content_type === "document" ||
    message.content_type === "sticker"
  ) {
    return (
      <div>
        <div className="text-cocoa-600 italic">
          {previewLabel(message.content_type, message.text)}
          {message.media_pending && (
            <span className="text-cocoa-400 ml-1">(a carregar…)</span>
          )}
        </div>
        {message.text && (
          <p className="mt-1 whitespace-pre-wrap break-words">{message.text}</p>
        )}
        {message.media_url_drive && (
          <a
            href={message.media_url_drive}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:underline"
          >
            Abrir na Drive ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <p className="text-cocoa-600 italic">
      {previewLabel(message.content_type, message.text)}
    </p>
  );
}

// ──────────────────────────────────────────────────────────────
// NOTES — editavel com debounce
// ──────────────────────────────────────────────────────────────
function NotesArea({
  conversationId,
  initialNotes,
}: {
  conversationId: string;
  initialNotes: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset quando muda de conversa
  useEffect(() => {
    setValue(initialNotes ?? "");
    setOpen(false);
  }, [conversationId, initialNotes]);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateConversationNotesAction(conversationId, next);
    }, 800);
  }

  return (
    <div className="border-b border-cream-200 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-1.5 text-left text-[11px] text-cocoa-500 hover:text-cocoa-700 hover:bg-cream-50 flex items-center justify-between"
      >
        <span>📝 Notas{value.trim() ? ` (${value.length} car.)` : ""}</span>
        <span className="text-cocoa-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Notas sobre esta pessoa (sincronizam entre dispositivos)…"
          rows={3}
          className="w-full px-3 py-2 text-xs bg-cream-50 border-t border-cream-100 resize-none focus:outline-none focus:bg-surface"
        />
      )}
    </div>
  );
}
