import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { MessageSquareText, MessageCircle, BookText, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ComunicacoesHub() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  // Estatisticas rapidas — uma query por card.
  const [waConvsRes, chatUnreadRes, templatesRes] = await Promise.all([
    supabase
      .from("whatsapp_conversations")
      .select("id, unread_count, archived", { count: "exact" })
      .eq("archived", false),
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("message_templates")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  const waConvs = (waConvsRes.data ?? []) as Array<{
    unread_count: number;
  }>;
  const waConvsCount = waConvsRes.count ?? waConvs.length;
  const waUnread = waConvs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  const chatTotal = chatUnreadRes.count ?? 0;
  const templatesCount = templatesRes.count ?? 0;

  const cards: Array<{
    href: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    stat?: string;
    badge?: number;
    hidden?: boolean;
  }> = [
    {
      href: "/whatsapp",
      label: "WhatsApp",
      description: "Conversas em tempo real com clientes e leads. Echoes do telemóvel, sugestões da Claude.",
      icon: MessageSquareText,
      accent: "text-emerald-600 bg-emerald-50",
      stat: `${waConvsCount} conversa${waConvsCount === 1 ? "" : "s"} activa${waConvsCount === 1 ? "" : "s"}`,
      badge: waUnread,
    },
    {
      href: "/chat",
      label: "Chat interno",
      description: "Mensagens entre os 3 utilizadores da plataforma (António, MJ, Ana).",
      icon: MessageCircle,
      accent: "text-sky-600 bg-sky-50",
      stat: `${chatTotal} mensage${chatTotal === 1 ? "m" : "ns"} no histórico`,
    },
    {
      href: "/comunicacoes/templates",
      label: "Templates",
      description: "Biblioteca de mensagens prontas (PT + EN). A Claudio usa-as como referência de tom.",
      icon: BookText,
      accent: "text-amber-600 bg-amber-50",
      stat: `${templatesCount} templates`,
      hidden: role !== "admin",
    },
    {
      href: "/comunicacoes/claudio",
      label: "Cérebro do Claudio",
      description: "Persona, factos da FBR e configuração da IA. Edita aqui como o Claudio fala.",
      icon: Sparkles,
      accent: "text-indigo-600 bg-indigo-50",
      hidden: role !== "admin",
    },
  ];

  // Se nao for admin, redirecciona para o card que pode ver (WhatsApp).
  // Mas mostra hub na mesma — Chat e WA estao acessiveis a todos.

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-cocoa-900">Comunicações</h1>
        <p className="text-sm text-cocoa-600 mt-1">
          Tudo o que tem a ver com falar com clientes e entre nós.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards
          .filter((c) => !c.hidden)
          .map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-lg border border-cream-200 bg-surface p-4 hover:border-cocoa-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${card.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {card.badge !== undefined && card.badge > 0 && (
                    <span className="bg-emerald-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-2 inline-flex items-center justify-center">
                      {card.badge > 99 ? "99+" : card.badge}
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-semibold text-cocoa-900 mb-1 group-hover:text-cocoa-700">
                  {card.label}
                </h2>
                <p className="text-xs text-cocoa-600 mb-2">{card.description}</p>
                {card.stat && (
                  <p className="text-[11px] text-cocoa-500 italic">{card.stat}</p>
                )}
              </Link>
            );
          })}
      </div>
    </div>
  );
}
