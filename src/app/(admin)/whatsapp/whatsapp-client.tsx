"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Search, Archive, ArchiveRestore, Sparkles, Copy, RotateCcw, X, MailQuestion, RefreshCw, FolderOpen } from "lucide-react";
import { linkify } from "@/lib/linkify";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import TemplatePicker from "@/components/template-picker";
import type {
  WhatsappConversation,
  WhatsappMessage,
} from "@/types/whatsapp-live";
import {
  markConversationReadAction,
  markConversationUnreadAction,
  archiveConversationAction,
  updateConversationNotesAction,
} from "./actions";

type OrderLite = {
  id: string;
  order_id: string;
  client_name: string | null;
  phone: string | null;
  status: string;
  drive_folder_url: string | null;
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

// Usado dentro das bolhas para a etiqueta do tipo de media. Nunca devolve
// o caption — esse aparece numa linha separada por baixo.
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

type InboxFilter = "todas" | "nao_lidas" | "com_encomenda" | "sem_encomenda";

export default function WhatsappClient({ initialConversations, orders }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const convParam = searchParams.get("conv");
  const [conversations, setConversations] = useState<WhatsappConversation[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(convParam);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("todas");

  // Sincroniza com ?conv= quando muda externamente (ex: cmd+k → conversa).
  // Feito durante o render (padrão "store info from previous renders").
  const [prevConvParam, setPrevConvParam] = useState(convParam);
  if (convParam !== prevConvParam) {
    setPrevConvParam(convParam);
    if (convParam) setSelectedId(convParam);
  }

  // Pre-calcular para cada conversa se tem encomenda associada (matching por last 9 digits).
  const convHasOrder = useMemo(() => {
    const phoneTails = new Set(
      orders.map((o) => digitsOnly(o.phone).slice(-9)).filter((t) => t.length === 9),
    );
    const map = new Map<string, boolean>();
    for (const c of conversations) {
      map.set(c.id, phoneTails.has(digitsOnly(c.phone_e164).slice(-9)));
    }
    return map;
  }, [conversations, orders]);

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
        switch (filter) {
          case "nao_lidas": return c.unread_count > 0;
          case "com_encomenda": return convHasOrder.get(c.id) === true;
          case "sem_encomenda": return convHasOrder.get(c.id) === false;
          default: return true;
        }
      })
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
  }, [conversations, search, showArchived, filter, convHasOrder]);

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
            <Link
              href="/comunicacoes/templates"
              title="Biblioteca de mensagens prontas (templates)"
              className="text-xs text-cocoa-600 hover:text-cocoa-900 px-2 py-1 rounded border border-cream-200 hover:bg-cream-100 inline-flex items-center gap-1"
            >
              <span className="text-amber-500">📋</span> Templates
            </Link>
            <Link
              href="/comunicacoes/claudio"
              title="Editar persona, factos e templates do Claudio"
              className="text-xs text-cocoa-600 hover:text-cocoa-900 px-2 py-1 rounded border border-cream-200 hover:bg-cream-100 inline-flex items-center gap-1"
            >
              <span className="text-indigo-500">✨</span> Claudio
            </Link>
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
          {/* Filtros: chips toggle */}
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {(["todas", "nao_lidas", "com_encomenda", "sem_encomenda"] as const).map((k) => {
              const labels: Record<typeof k, string> = {
                todas: "Todas",
                nao_lidas: "Não lidas",
                com_encomenda: "Com encomenda",
                sem_encomenda: "Sem encomenda",
              };
              const active = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn(
                    "shrink-0 text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                    active
                      ? "bg-cocoa-900 text-surface border-cocoa-900"
                      : "bg-surface text-cocoa-600 border-cream-200 hover:border-cocoa-300",
                  )}
                >
                  {labels[k]}
                </button>
              );
            })}
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
            onMarkUnread={() => {
              markConversationUnreadAction(selectedConv.id);
              setSelectedId(null);
            }}
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
  onMarkUnread,
}: {
  conversation: WhatsappConversation;
  orders: OrderLite[];
  onBack: () => void;
  onMarkUnread: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset ao trocar de conversa — durante o render (padrão "store info from
  // previous renders", sem setState em effect).
  const [prevConversationId, setPrevConversationId] = useState(conversation.id);
  if (conversation.id !== prevConversationId) {
    setPrevConversationId(conversation.id);
    setSearchOpen(false);
    setSearchTerm("");
    setMessages([]);
    setLoading(true);
  }

  // Filtro de mensagens por termo de pesquisa
  const visibleMessages = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((m) => (m.text ?? "").toLowerCase().includes(term));
  }, [messages, searchTerm]);

  const linkedOrders = useMemo(() =>
    orders.filter((o) => phoneMatches(o.phone, conversation.phone_e164)),
    [orders, conversation.phone_e164],
  );

  // Fetch mensagens da conversa + subscrever Realtime.
  // (reset de loading/messages ao mudar de conversa é feito no render, acima)
  useEffect(() => {
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

  // Auto-scroll para fundo em cada mensagem nova.
  // Usamos scrollIntoView num sentinel em vez de scrollTop=scrollHeight
  // porque em mobile com imagens lazy o scrollHeight nao esta calculado
  // na primeira render (resultava em abrir no topo da conversa).
  // Dois passos: 1) imediato, 2) microtask para apanhar layouts que
  // ainda estavam a estabilizar.
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ block: "end" });
    const id = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }, 100);
    return () => window.clearTimeout(id);
  }, [messages, loading]);

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
                <span key={o.id} className="inline-flex items-center gap-0.5">
                  <Link
                    href={`/preservacao/${o.order_id}`}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 truncate max-w-[160px]"
                    title={`${o.client_name ?? o.order_id} — ${o.status}`}
                  >
                    {o.client_name ?? o.order_id}
                  </Link>
                  {o.drive_folder_url && (
                    <a
                      href={o.drive_folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cocoa-500 hover:text-cocoa-800 p-0.5"
                      title="Abrir pasta Drive desta encomenda"
                    >
                      <FolderOpen className="h-3 w-3" />
                    </a>
                  )}
                </span>
              ))}
              {linkedOrders.length > 4 && (
                <span className="text-[10px] text-cocoa-500">+{linkedOrders.length - 4}</span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className={cn(
            "p-1.5 rounded text-cocoa-600",
            searchOpen ? "bg-cream-100" : "hover:bg-cream-100",
          )}
          title="Pesquisar nesta conversa"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMarkUnread}
          className="p-1.5 rounded hover:bg-cream-100 text-cocoa-600"
          title="Marcar como não lida (para retomar depois)"
        >
          <MailQuestion className="h-4 w-4" />
        </button>
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

      {/* Search inline */}
      {searchOpen && (
        <div className="px-3 py-2 border-b border-cream-200 bg-cream-50 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-cocoa-400 shrink-0" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Procurar texto nesta conversa…"
            autoFocus
            className="h-7 text-xs flex-1"
          />
          <span className="text-[10px] text-cocoa-500 shrink-0">
            {searchTerm.trim() ? `${visibleMessages.length} resultado${visibleMessages.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
      )}

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
        ) : visibleMessages.length === 0 ? (
          <div className="text-center text-xs text-cocoa-400 py-6">
            Nenhuma mensagem com &quot;{searchTerm}&quot;.
          </div>
        ) : (
          (() => {
            // Map wamid -> message para resolver replies em O(1).
            const wamidMap = new Map<string, WhatsappMessage>();
            for (const m of messages) wamidMap.set(m.wamid, m);
            // Reaccoes agrupadas por mensagem alvo. Sao filtradas das
            // mensagens visiveis e renderizadas como badges anexas.
            const reactionsByTarget = new Map<string, WhatsappMessage[]>();
            for (const m of messages) {
              if (m.content_type === "reaction" && m.reaction_target_wamid) {
                const arr = reactionsByTarget.get(m.reaction_target_wamid) ?? [];
                arr.push(m);
                reactionsByTarget.set(m.reaction_target_wamid, arr);
              }
            }
            const renderableMessages = visibleMessages.filter(
              (m) => m.content_type !== "reaction",
            );
            return renderableMessages.map((m, i) => {
              const prev = i > 0 ? renderableMessages[i - 1] : null;
              const showDay = !prev || dayBoundary(prev.received_at, m.received_at);
              const repliedTo = m.reply_to_wamid ? wamidMap.get(m.reply_to_wamid) ?? null : null;
              const reactions = reactionsByTarget.get(m.wamid) ?? [];
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="text-center my-2">
                      <span className="text-[10px] text-cocoa-500 bg-cream-100 px-2 py-0.5 rounded-full">
                        {formatDayLabel(m.received_at)}
                      </span>
                    </div>
                  )}
                  <MessageBubble message={m} repliedTo={repliedTo} reactions={reactions} />
                </div>
              );
            });
          })()
        )}
        <div ref={bottomRef} aria-hidden />
      </div>

      {/* Composer: caixa de instrucao opcional + sugerir resposta com Claude */}
      <SuggestComposer
        conversationId={conversation.id}
        contactName={conversation.contact_name}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// COMPOSER — "Sugerir resposta" com Claude
// ──────────────────────────────────────────────────────────────
function SuggestComposer({
  conversationId,
  contactName,
}: {
  conversationId: string;
  contactName?: string | null;
}) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Reset quando muda de conversa — durante o render, sem setState em effect.
  const [prevSuggestConvId, setPrevSuggestConvId] = useState(conversationId);
  if (conversationId !== prevSuggestConvId) {
    setPrevSuggestConvId(conversationId);
    setInstruction("");
    setSuggestion(null);
    setLoading(false);
  }

  async function handleSuggest() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, instruction }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSuggestion(data.suggestion || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro a gerar sugestão");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!suggestion) return;
    try {
      await navigator.clipboard.writeText(suggestion);
      toast.success("Copiado. Cola no telemóvel.");
    } catch {
      toast.error("Não consegui copiar — selecciona manualmente.");
    }
  }

  function handleClose() {
    setSuggestion(null);
    setInstruction("");
  }

  if (suggestion !== null) {
    return (
      <footer className="p-3 border-t border-cream-200 bg-surface space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-cocoa-700 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-indigo-500" /> Sugestão (edita antes de copiar)
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-cocoa-400 hover:text-cocoa-700"
            aria-label="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <Textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          rows={6}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleCopy} className="flex-1">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSuggest}
            disabled={loading}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Refazer
          </Button>
        </div>
      </footer>
    );
  }

  return (
    <footer className="p-3 border-t border-cream-200 bg-surface space-y-2">
      <div className="text-[10px] text-cocoa-500">
        💡 Mensagens enviam-se pelo telemóvel. Aqui só sugerimos.
      </div>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder='Diz ao Claude o que queres comunicar (opcional). Ex: "responde que sim, conseguimos fazer mas o prazo é mais longo"'
        rows={2}
        className="text-sm"
      />
      <div className="flex items-center gap-2">
        {/* Templates prontos a copiar/colar (leads: 1º contacto, preços, 3 opções de entrega, …) */}
        <TemplatePicker scope="lead" contactName={contactName} />
        <Button
          type="button"
          size="sm"
          onClick={handleSuggest}
          disabled={loading}
          className="flex-1"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {loading ? "A pensar…" : "Sugerir resposta"}
        </Button>
      </div>
    </footer>
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
          "max-w-[80%] sm:max-w-[60%] px-3 py-2 rounded-2xl text-sm shadow-sm relative",
          isSent
            ? "bg-emerald-100 text-cocoa-900 rounded-br-sm"
            : "bg-surface border border-cream-200 text-cocoa-900 rounded-bl-sm",
        )}
      >
        {repliedTo && <RepliedQuote message={repliedTo} />}
        <MessageContent message={message} />
        {reactions.length > 0 && (
          <div
            className={cn(
              "absolute -bottom-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-surface border border-cream-200 shadow-sm",
              isSent ? "right-2" : "left-2",
            )}
          >
            {reactions.slice(0, 3).map((r) => (
              <span key={r.id} className="text-sm leading-none" title={`Reagiu com ${r.text}`}>
                {r.text || "•"}
              </span>
            ))}
            {reactions.length > 3 && (
              <span className="text-[10px] text-cocoa-500 ml-0.5">+{reactions.length - 3}</span>
            )}
          </div>
        )}
        <div
          className={cn(
            "text-[10px] mt-1 flex items-center gap-1",
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

// Citacao quando esta mensagem responde a outra. Cor da barra lateral
// distingue se a citada e nossa (cinza) ou do cliente (verde).
function RepliedQuote({ message }: { message: WhatsappMessage }) {
  const repliedIsSent = message.direction === "sent_echo";
  const previewText =
    message.text || mediaIconLabel(message.content_type);
  return (
    <div
      className={cn(
        "border-l-2 pl-2 py-0.5 mb-1.5 text-[11px] rounded-r-sm",
        repliedIsSent
          ? "bg-emerald-50 border-emerald-400"
          : "bg-cream-50 border-cocoa-400",
      )}
    >
      <div className={cn("font-medium", repliedIsSent ? "text-emerald-700" : "text-cocoa-600")}>
        {repliedIsSent ? "FBR" : "Cliente"}
      </div>
      <div className="text-cocoa-700 truncate max-w-[280px]">{previewText}</div>
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
      className="ml-1 text-indigo-600 hover:text-indigo-800 underline text-[10px] disabled:opacity-50"
      title="Tentar puxar de novo"
    >
      <RefreshCw className={cn("h-3 w-3 inline", loading && "animate-spin")} />
    </button>
  );
}

function DeliveryTicks({ message }: { message: WhatsappMessage }) {
  if (message.delivery_status === "failed") {
    return <span title="Falhou" className="text-rose-500">⚠</span>;
  }
  if (message.delivery_status === "read") {
    return (
      <span
        title={`Lida ${message.read_at ? new Date(message.read_at).toLocaleString("pt-PT") : ""}`}
        className="text-sky-500"
      >
        ✓✓
      </span>
    );
  }
  if (message.delivery_status === "delivered") {
    return (
      <span
        title={`Entregue ${message.delivered_at ? new Date(message.delivered_at).toLocaleString("pt-PT") : ""}`}
        className="text-cocoa-400"
      >
        ✓✓
      </span>
    );
  }
  return <span title="Enviada pelo telemóvel">📱</span>;
}

function MessageContent({ message }: { message: WhatsappMessage }) {
  if (message.content_type === "text") {
    return <p className="whitespace-pre-wrap break-words">{linkify(message.text ?? "")}</p>;
  }

  // Media bubble: 3 estados possiveis
  //   1. pending true  -> '(a carregar…)'
  //   2. pending false + media_url_drive -> link Drive
  //   3. pending false + nenhum url + media_id presente -> falhou
  if (
    message.content_type === "image" ||
    message.content_type === "video" ||
    message.content_type === "audio" ||
    message.content_type === "document" ||
    message.content_type === "sticker"
  ) {
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
        {/* Bloco principal de media */}
        {proxyUrl && isVisualMedia ? (
          <a href={message.media_url_drive ?? "#"} target="_blank" rel="noopener noreferrer" className="block mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- media do WhatsApp via proxy autenticado; next/image não traz benefício e custaria optimização */}
            <img
              src={proxyUrl}
              alt={message.text ?? "foto"}
              loading="lazy"
              className="rounded-lg max-h-80 w-auto max-w-full object-contain bg-cocoa-50"
            />
          </a>
        ) : proxyUrl && isAudio ? (
          <audio controls preload="metadata" className="w-full max-w-[260px]" src={proxyUrl}>
            <a href={message.media_url_drive ?? "#"} target="_blank" rel="noopener noreferrer">Abrir áudio</a>
          </audio>
        ) : proxyUrl && isVideo ? (
          <video
            controls
            preload="metadata"
            className="rounded-lg max-h-80 w-auto max-w-full bg-cocoa-50"
            src={proxyUrl}
          />
        ) : proxyUrl && isDocument ? (
          <a
            href={proxyUrl}
            download
            className="inline-flex items-center gap-1.5 text-cocoa-700 hover:text-cocoa-900 bg-cream-50 border border-cream-200 rounded-md px-2.5 py-1.5 text-xs"
          >
            📄 <span className="underline">{message.text || "Documento"}</span>
          </a>
        ) : (
          <div className="text-cocoa-600 italic">
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
          </div>
        )}
        {/* Caption / texto associado (nao mostrar para documentos onde a label ja contém o nome) */}
        {message.text && !isDocument && (
          <p className="mt-1 whitespace-pre-wrap break-words">{linkify(message.text)}</p>
        )}
        {/* Fallback link Drive se nao foi possivel renderizar inline mas temos URL */}
        {message.media_url_drive && !proxyUrl && (
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

  // Tipos sem media (location, contacts, reaction, system, unsupported).
  return (
    <div>
      <p className="text-cocoa-600 italic">{mediaIconLabel(message.content_type)}</p>
      {message.text && (
        <p className="mt-1 whitespace-pre-wrap break-words">{linkify(message.text)}</p>
      )}
    </div>
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

  // Reset quando muda de conversa ou as notas vêm actualizadas do servidor —
  // durante o render, sem setState em effect.
  const [prevNotesKey, setPrevNotesKey] = useState(`${conversationId} ${initialNotes ?? ""}`);
  const notesKey = `${conversationId} ${initialNotes ?? ""}`;
  if (notesKey !== prevNotesKey) {
    setPrevNotesKey(notesKey);
    setValue(initialNotes ?? "");
    setOpen(false);
  }

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
          placeholder="Notas só na plataforma — não aparecem no WhatsApp do telemóvel."
          rows={3}
          className="w-full px-3 py-2 text-xs bg-cream-50 border-t border-cream-100 resize-none focus:outline-none focus:bg-surface"
        />
      )}
    </div>
  );
}
