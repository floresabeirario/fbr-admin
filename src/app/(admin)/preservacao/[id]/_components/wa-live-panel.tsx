"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Sparkles, Copy, RotateCcw, X, ExternalLink, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsappConversation, WhatsappMessage } from "@/types/whatsapp-live";

type Props = {
  // Telefone do cliente no formato livre da BD (ex: "935 896 353", "+351935...").
  phone: string | null | undefined;
};

function lastNineDigits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "").slice(-9);
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

export default function WhatsappLivePanel({ phone }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const phoneTail = lastNineDigits(phone);

  const [conversation, setConversation] = useState<WhatsappConversation | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Procurar conversa por last 9 digits do telefone do cliente.
  useEffect(() => {
    let cancelled = false;
    if (!phoneTail || phoneTail.length < 9) {
      setLoading(false);
      return;
    }

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
        setLoading(false);
      });
  }, [supabase, phoneTail]);

  // Quando temos conversa: ir buscar mensagens + Realtime.
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }
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

  // ─── Empty states ───
  if (!phone || phoneTail.length < 9) {
    return (
      <EmptyBox
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
      <EmptyBox
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
        <Link
          href="/whatsapp"
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
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      {/* Composer Sugerir resposta */}
      <SuggestComposer conversationId={conversation.id} />
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

function MessageBubble({ message }: { message: WhatsappMessage }) {
  const isSent = message.direction === "sent_echo";
  return (
    <div className={cn("flex", isSent ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-2.5 py-1.5 rounded-2xl text-xs shadow-sm",
          isSent
            ? "bg-emerald-100 text-cocoa-900 rounded-br-sm"
            : "bg-surface border border-cream-200 text-cocoa-900 rounded-bl-sm",
        )}
      >
        {message.content_type === "text" ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          <p className="text-cocoa-600 italic">
            {previewLabel(message.content_type, message.text)}
            {message.media_pending && (
              <span className="text-cocoa-400 ml-1">(a carregar…)</span>
            )}
          </p>
        )}
        <div
          className={cn(
            "text-[9px] mt-0.5 flex items-center gap-1",
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

function SuggestComposer({ conversationId }: { conversationId: string }) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    setInstruction("");
    setSuggestion(null);
    setLoading(false);
  }, [conversationId]);

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

  if (suggestion !== null) {
    return (
      <div className="p-2.5 border-t border-cream-200 bg-surface space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-cocoa-700 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-indigo-500" /> Sugestão (editável)
          </span>
          <button
            type="button"
            onClick={() => setSuggestion(null)}
            className="p-0.5 text-cocoa-400 hover:text-cocoa-700"
            aria-label="Fechar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <Textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          rows={5}
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleCopy} className="flex-1">
            <Copy className="h-3 w-3 mr-1.5" /> Copiar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSuggest}
            disabled={loading}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" /> Refazer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2.5 border-t border-cream-200 bg-surface space-y-2">
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder='O que queres dizer? (opcional)'
        rows={2}
        className="text-xs"
      />
      <Button
        type="button"
        size="sm"
        onClick={handleSuggest}
        disabled={loading}
        className="w-full"
      >
        <Sparkles className="h-3 w-3 mr-1.5" />
        {loading ? "A pensar…" : "Sugerir resposta"}
      </Button>
    </div>
  );
}
