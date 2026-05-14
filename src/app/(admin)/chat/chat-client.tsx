"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { pt } from "date-fns/locale";
import {
  MessageCircle,
  Send,
  Trash2,
  Reply,
  X,
  Info,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

import type { ChatMessage } from "@/types/chat";
import { sendChatMessageAction, deleteChatMessageAction } from "./actions";

const TEAM = [
  { email: "info+antonio@floresabeirario.pt", name: "António", photo: "/userphotos/antonio.webp", color: "bg-emerald-500" },
  { email: "info+mj@floresabeirario.pt",      name: "MJ",      photo: "/userphotos/mj.webp",      color: "bg-rose-500" },
  { email: "info+ana@floresabeirario.pt",     name: "Ana",     photo: "/userphotos/ana.webp",     color: "bg-violet-500" },
];

function memberFor(email: string) {
  return TEAM.find((m) => m.email === email) ?? {
    email,
    name: email,
    photo: null,
    color: "bg-slate-500",
  };
}

function formatTime(value: string): string {
  try {
    return format(parseISO(value), "HH:mm");
  } catch {
    return "";
  }
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
  const supabase = useMemo(() => createClient(), []);

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
      <div className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 border-b border-[#E8E0D5] bg-white">
        <div className="flex items-center gap-3 max-w-[1100px] mx-auto">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 shadow-sm flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-semibold text-[#3D2B1F]">Chat interno</h1>
            <p className="text-xs text-[#8B7355]">
              António, MJ e Ana — apenas vocês os 3 vêem esta conversa.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-[#B8A99A]">
            <Info className="h-3 w-3" />
            <span>Versão inicial — só texto. Fotos, vídeo e áudio em breve.</span>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto bg-[#FAF8F5]">
        <div className="max-w-[1100px] mx-auto px-3 sm:px-6 py-4 space-y-4">
          {groupedDays.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto text-sky-200 mb-3" />
              <p className="text-sm text-[#8B7355]">
                Conversa vazia. Sê a primeira a dizer olá!
              </p>
            </div>
          )}
          {groupedDays.map((group) => (
            <div key={group.day} className="space-y-2">
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-[#E8E0D5]" />
                <span className="text-[10px] uppercase tracking-wider text-[#B8A99A] font-medium">
                  {formatDayHeader(group.day)}
                </span>
                <div className="flex-1 h-px bg-[#E8E0D5]" />
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
        <div className="shrink-0 px-3 sm:px-6 py-2 border-t border-[#E8E0D5] bg-sky-50/60">
          <div className="max-w-[1100px] mx-auto flex items-center gap-2">
            <Reply className="h-3.5 w-3.5 text-sky-600" />
            <span className="text-xs text-[#8B7355]">
              A responder a <strong>{memberFor(replyTo.author_email).name}</strong>:
              <span className="ml-1 italic text-[#8B7355]/80 line-clamp-1">
                {replyTo.body.slice(0, 80)}
              </span>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="ml-auto text-[#B8A99A] hover:text-[#3D2B1F]"
              title="Cancelar resposta"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 px-3 sm:px-6 py-3 border-t border-[#E8E0D5] bg-white">
        <div className="max-w-[1100px] mx-auto flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreve uma mensagem... (Enter para enviar, Shift+Enter para quebra de linha)"
            rows={1}
            className="resize-none min-h-[40px] max-h-[160px] text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white"
          />
          <Button
            onClick={handleSend}
            disabled={pending || !draft.trim()}
            className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white h-10 px-3 shrink-0"
          >
            <Send className="h-4 w-4" />
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
      <div className={cn("max-w-[70%] space-y-1", isOwn && "items-end")}>
        {!stacked && (
          <div className={cn("flex items-baseline gap-2 text-xs text-[#8B7355]", isOwn && "flex-row-reverse")}>
            <span className="font-medium text-[#3D2B1F]">{member.name}</span>
            <span className="text-[10px] text-[#B8A99A]">{formatTime(message.created_at)}</span>
          </div>
        )}

        {repliedTo && (
          <div className={cn(
            "rounded-md border-l-2 px-2 py-1 text-xs bg-white/60",
            isOwn ? "border-l-[#3D2B1F]" : "border-l-sky-400"
          )}>
            <p className="text-[10px] text-[#B8A99A] font-medium">
              ↪ {memberFor(repliedTo.author_email).name}
            </p>
            <p className="text-[#8B7355] line-clamp-2">{repliedTo.body}</p>
          </div>
        )}

        <div className={cn(
          "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
          isOwn
            ? "bg-[#3D2B1F] text-white rounded-tr-sm"
            : "bg-white text-[#3D2B1F] border border-[#F0EAE0] rounded-tl-sm"
        )}>
          {message.body}
        </div>

        {/* Acções (hover) */}
        <div className={cn(
          "flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isOwn && "justify-end"
        )}>
          <button
            onClick={onReply}
            className="text-[10px] text-[#8B7355] hover:text-[#3D2B1F] inline-flex items-center gap-1"
            title="Responder"
          >
            <Reply className="h-3 w-3" />
            Responder
          </button>
          {isOwn && (
            <button
              onClick={onDelete}
              className="text-[10px] text-[#8B7355] hover:text-rose-600 inline-flex items-center gap-1"
              title="Apagar"
            >
              <Trash2 className="h-3 w-3" />
              Apagar
            </button>
          )}
          {stacked && (
            <span className="text-[10px] text-[#B8A99A]">{formatTime(message.created_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
