"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { pt } from "date-fns/locale";
import { formatTimeLisbon } from "@/lib/format-date";
import {
  MessageCircle,
  Send,
  Trash2,
  Reply,
  X,
  Info,
  Loader2,
  Smile,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// Emoji picker — categorias compactas, zero dependências.
const EMOJI_CATEGORIES: Array<{ label: string; chars: string[] }> = [
  {
    label: "Sorrisos",
    chars: ["😀", "😄", "😅", "😂", "🤣", "😊", "😍", "🥰", "😘", "😉", "😎", "🤔", "🙄", "😴", "😭", "😢", "😡", "🥳", "🤯", "🤪"],
  },
  {
    label: "Gestos",
    chars: ["👍", "👎", "👏", "🙌", "🙏", "💪", "👋", "🤝", "✋", "🤘", "👌", "🤞", "✌️", "🫶", "🤗", "🫡"],
  },
  {
    label: "Corações",
    chars: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️", "💕", "💖", "💘", "💝"],
  },
  {
    label: "Flores",
    chars: ["🌸", "🌺", "🌻", "🌷", "🌹", "🌼", "💐", "🌿", "🍃", "🌳", "🪻", "🌾"],
  },
  {
    label: "Festa",
    chars: ["🎉", "🎊", "🥂", "🍾", "🎁", "☕", "🍰", "🎂", "🍷", "🥳", "🎈", "🪩"],
  },
  {
    label: "Trabalho",
    chars: ["✅", "❌", "⚠️", "⭐", "🔥", "✨", "💡", "📌", "📍", "❓", "⏰", "⏳", "📅", "🗓️", "📷", "📦", "💌", "💸"],
  },
];

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tabIdx, setTabIdx] = useState(0);
  const cat = EMOJI_CATEGORIES[tabIdx];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Inserir emoji"
        className="shrink-0 inline-flex items-center justify-center rounded-lg text-cocoa-500 hover:text-cocoa-900 hover:bg-cream-50 transition-colors h-11 w-11 sm:h-10 sm:w-10"
      >
        <Smile className="h-5 w-5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-[280px] p-0 overflow-hidden"
      >
        <div className="flex border-b border-cream-200 bg-cream-50">
          {EMOJI_CATEGORIES.map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setTabIdx(i)}
              className={cn(
                "flex-1 px-2 py-1.5 text-[18px] leading-none transition-colors",
                tabIdx === i
                  ? "bg-surface border-b-2 border-cocoa-900"
                  : "hover:bg-surface/60 border-b-2 border-transparent"
              )}
              title={c.label}
            >
              {c.chars[0]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 p-2 max-h-[180px] overflow-y-auto">
          {cat.chars.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="h-9 w-9 rounded-md text-[20px] leading-none hover:bg-cream-100 transition-colors inline-flex items-center justify-center"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import type { ChatMessage } from "@/types/chat";
import { sendChatMessageAction, deleteChatMessageAction, markChatMessagesReadAction } from "./actions";
import { TEAM as TEAM_ROLES } from "@/lib/auth/roles";

// Fonte única da equipa em roles.ts; as cores das bolhas são detalhe
// do chat e vivem aqui. Membro novo sem cor atribuída cai no fallback.
const CHAT_COLORS: Record<string, string> = {
  "info+antonio@floresabeirario.pt": "bg-emerald-500",
  "info+mj@floresabeirario.pt": "bg-rose-500",
  "info+ana@floresabeirario.pt": "bg-violet-500",
};

const TEAM = TEAM_ROLES.map(({ email, name, photo }) => ({
  email,
  name,
  photo,
  color: CHAT_COLORS[email] ?? "bg-slate-500",
}));

function memberFor(email: string) {
  return TEAM.find((m) => m.email === email) ?? {
    email,
    name: email,
    photo: null,
    color: "bg-slate-500",
  };
}

function formatTime(value: string): string {
  return formatTimeLisbon(value);
}

function formatDayHeader(value: string): string {
  try {
    const d = parseISO(value);
    return format(d, "EEEE, dd 'de' MMMM", { locale: pt });
  } catch {
    return "";
  }
}

export default function ChatClient({
  initialMessages,
  currentEmail,
}: {
  initialMessages: ChatMessage[];
  currentEmail: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = useMemo(() => createClient(), []);

  function insertEmojiAtCursor(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setDraft((d) => d + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    // Repõe o cursor depois do emoji, no próximo tick.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as ChatMessage;
          if (m.deleted_at) return;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) =>
            m.deleted_at
              ? prev.filter((x) => x.id !== m.id)
              : prev.map((x) => (x.id === m.id ? m : x))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // ── Auto-scroll para o fim quando chega mensagem nova ──
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Marcar como lidas todas as mensagens que vejo e ainda não li ──
  // (mensagens próprias não contam; tab/aba só mostra "por ler" das outras)
  useEffect(() => {
    if (!currentEmail) return;
    const toMark = messages
      .filter((m) => m.author_email !== currentEmail && !m.read_by.includes(currentEmail))
      .map((m) => m.id);
    if (toMark.length === 0) return;
    markChatMessagesReadAction(toMark).catch(() => {
      // silencioso: não vale a pena chatear o user com um toast só por isto
    });
  }, [messages, currentEmail]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    const replyId = replyTo?.id ?? null;
    setDraft("");
    setReplyTo(null);
    startTransition(async () => {
      try {
        const msg = await sendChatMessageAction(text, replyId);
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao enviar.");
        setDraft(text);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Apagar esta mensagem?")) return;
    startTransition(async () => {
      try {
        await deleteChatMessageAction(id);
        setMessages((prev) => prev.filter((x) => x.id !== id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao apagar.");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Agrupar mensagens por dia
  const groupedDays = useMemo(() => {
    const groups: { day: string; messages: ChatMessage[] }[] = [];
    for (const m of messages) {
      const last = groups[groups.length - 1];
      if (last && isSameDay(parseISO(last.day), parseISO(m.created_at))) {
        last.messages.push(m);
      } else {
        groups.push({ day: m.created_at, messages: [m] });
      }
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 border-b border-cream-200 bg-surface">
        <div className="flex items-center gap-3 max-w-[1100px] mx-auto">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 shadow-sm flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-semibold text-cocoa-900">Chat interno</h1>
            <p className="text-xs text-cocoa-700">
              António, MJ e Ana — apenas vocês os 3 vêem esta conversa.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-cocoa-500">
            <Info className="h-3 w-3" />
            <span>Versão inicial — só texto. Fotos, vídeo e áudio em breve.</span>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto bg-cream-50">
        <div className="max-w-[1100px] mx-auto px-3 sm:px-6 py-4 space-y-4">
          {groupedDays.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto text-sky-200 mb-3" />
              <p className="text-sm text-cocoa-700">
                Conversa vazia. Sê a primeira a dizer olá!
              </p>
            </div>
          )}
          {groupedDays.map((group) => (
            <div key={group.day} className="space-y-2">
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-cream-200" />
                <span className="text-[10px] uppercase tracking-wider text-cocoa-500 font-medium">
                  {formatDayHeader(group.day)}
                </span>
                <div className="flex-1 h-px bg-cream-200" />
              </div>
              {group.messages.map((m, i) => {
                const isOwn = m.author_email === currentEmail;
                const member = memberFor(m.author_email);
                const prev = group.messages[i - 1];
                const stacked =
                  prev && prev.author_email === m.author_email &&
                  parseISO(m.created_at).getTime() - parseISO(prev.created_at).getTime() < 5 * 60 * 1000;
                const repliedTo = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    member={member}
                    isOwn={isOwn}
                    stacked={!!stacked}
                    repliedTo={repliedTo}
                    onDelete={() => handleDelete(m.id)}
                    onReply={() => setReplyTo(m)}
                  />
                );
              })}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="shrink-0 px-3 sm:px-6 py-2 border-t border-cream-200 bg-sky-50/60">
          <div className="max-w-[1100px] mx-auto flex items-center gap-2">
            <Reply className="h-3.5 w-3.5 text-sky-600" />
            <span className="text-xs text-cocoa-700">
              A responder a <strong>{memberFor(replyTo.author_email).name}</strong>:
              <span className="ml-1 italic text-cocoa-700/80 line-clamp-1">
                {replyTo.body.slice(0, 80)}
              </span>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="ml-auto text-cocoa-500 hover:text-cocoa-900"
              title="Cancelar resposta"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div
        className="shrink-0 px-3 sm:px-6 py-3 border-t border-cream-200 bg-surface"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-[1100px] mx-auto flex items-end gap-2">
          <EmojiPicker onPick={insertEmojiAtCursor} />
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreve uma mensagem..."
            rows={1}
            className="resize-none min-h-[44px] sm:min-h-[40px] max-h-[160px] text-base sm:text-sm border-cream-200 bg-cream-50 focus:bg-surface"
          />
          <Button
            onClick={handleSend}
            disabled={pending || !draft.trim()}
            aria-label="Enviar mensagem"
            className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg h-11 w-11 sm:h-10 sm:w-auto sm:px-3 p-0 shrink-0"
          >
            {pending ? <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" /> : <Send className="h-5 w-5 sm:h-4 sm:w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  member,
  isOwn,
  stacked,
  repliedTo,
  onDelete,
  onReply,
}: {
  message: ChatMessage;
  member: ReturnType<typeof memberFor>;
  isOwn: boolean;
  stacked: boolean;
  repliedTo: ChatMessage | null | undefined;
  onDelete: () => void;
  onReply: () => void;
}) {
  return (
    <div className={cn("flex gap-2 group", isOwn && "flex-row-reverse")}>
      {/* Avatar */}
      <div className="w-8 shrink-0">
        {!stacked && member.photo && (
          <div className="relative h-8 w-8 rounded-full overflow-hidden">
            <Image src={member.photo} alt={member.name} fill sizes="32px" className="object-cover" />
          </div>
        )}
        {!stacked && !member.photo && (
          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium", member.color)}>
            {member.name[0]}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div className={cn("max-w-[85%] sm:max-w-[70%] space-y-1", isOwn && "items-end")}>
        {!stacked && (
          <div className={cn("flex items-baseline gap-2 text-xs text-cocoa-700", isOwn && "flex-row-reverse")}>
            <span className="font-medium text-cocoa-900">{member.name}</span>
            <span className="text-[10px] text-cocoa-500">{formatTime(message.created_at)}</span>
          </div>
        )}

        {repliedTo && (
          <div className={cn(
            "rounded-md border-l-2 px-2 py-1 text-xs bg-surface/60",
            isOwn ? "border-l-cocoa-900" : "border-l-sky-400"
          )}>
            <p className="text-[10px] text-cocoa-500 font-medium">
              ↪ {memberFor(repliedTo.author_email).name}
            </p>
            <p className="text-cocoa-700 line-clamp-2">{repliedTo.body}</p>
          </div>
        )}

        <div className={cn(
          "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
          isOwn
            ? "bg-btn-primary text-btn-primary-fg rounded-tr-sm"
            : "bg-surface text-cocoa-900 border border-cream-100 rounded-tl-sm"
        )}>
          {message.body}
        </div>

        {/* Acções: em mobile sempre visíveis (sem hover); em desktop só on-hover. */}
        <div className={cn(
          "flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity",
          isOwn && "justify-end"
        )}>
          <button
            onClick={onReply}
            className="text-[10px] text-cocoa-700 hover:text-cocoa-900 inline-flex items-center gap-1"
            title="Responder"
          >
            <Reply className="h-3 w-3" />
            Responder
          </button>
          {isOwn && (
            <button
              onClick={onDelete}
              className="text-[10px] text-cocoa-700 hover:text-rose-600 inline-flex items-center gap-1"
              title="Apagar"
            >
              <Trash2 className="h-3 w-3" />
              Apagar
            </button>
          )}
          {stacked && (
            <span className="text-[10px] text-cocoa-500">{formatTime(message.created_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
