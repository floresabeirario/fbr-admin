"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sparkles, BookText, MessageSquareText, FileText, Save, ExternalLink, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSystemSettingAction } from "../templates/actions";

type Props = {
  initialPersona: string;
  initialFacts: string;
  templatesCount: number;
  conversationsWithNotes: number;
  cost: {
    monthEur: number;
    weekEur: number;
    monthCalls: number;
    weekCalls: number;
  };
};

function formatEur(n: number): string {
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}

export default function ClaudioClient({
  initialPersona,
  initialFacts,
  templatesCount,
  conversationsWithNotes,
  cost,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-semibold text-cocoa-900">Cérebro do Claudio</h1>
        </div>
        <p className="text-sm text-cocoa-600">
          O que o Claudio sabe sobre a FBR e como deve falar. Tudo o que mudares aqui afecta as
          sugestões de resposta no WhatsApp e em qualquer sítio onde ele apareça.
        </p>
      </header>

      {/* Cost tracking */}
      <section className="rounded-lg border border-cream-200 bg-surface p-4">
        <div className="flex items-start gap-2 mb-3">
          <Wallet className="h-4 w-4 text-emerald-600 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-cocoa-900">Custo da Claude</h2>
            <p className="text-xs text-cocoa-600 mt-0.5">
              Estimativa baseada em tokens × preço do modelo (USD × 0,92 ≈ EUR). Conta oficial em
              <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">
                console.anthropic.com
              </a>.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-cream-50 border border-cream-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-cocoa-500 font-semibold">Este mês</p>
            <p className="text-lg font-semibold text-cocoa-900 mt-0.5">{formatEur(cost.monthEur)}</p>
            <p className="text-[11px] text-cocoa-500">{cost.monthCalls} sugestões geradas</p>
          </div>
          <div className="rounded-md bg-cream-50 border border-cream-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-cocoa-500 font-semibold">Últimos 7 dias</p>
            <p className="text-lg font-semibold text-cocoa-900 mt-0.5">{formatEur(cost.weekEur)}</p>
            <p className="text-[11px] text-cocoa-500">{cost.weekCalls} sugestões geradas</p>
          </div>
        </div>
      </section>

      {/* A. Persona */}
      <SettingCard
        title="Tom & Persona"
        subtitle="A voz da FBR. Como o Claudio escreve — formalidade, emojis, regras de tratamento."
        icon={<MessageSquareText className="h-4 w-4 text-indigo-500" />}
        settingKey="claude_persona"
        initialValue={initialPersona}
        rows={14}
        placeholder="Ex: usa português europeu, trata por &quot;a senhora&quot;, evita emojis em mensagens formais…"
      />

      {/* B. Factos */}
      <SettingCard
        title="Factos & contexto adicional"
        subtitle="Coisas que o Claudio deve sempre saber sobre o negócio. Uma frase por linha."
        icon={<FileText className="h-4 w-4 text-amber-500" />}
        settingKey="claude_facts"
        initialValue={initialFacts}
        rows={10}
        placeholder={`Ex:\n- Não enviamos para os Açores nem Madeira.\n- Eventos com menos de 3 semanas não conseguem ser preservados.\n- A entrega em mãos só é gratuita até 30km de Coimbra.`}
      />

      {/* C. Templates link */}
      <section className="rounded-lg border border-cream-200 bg-surface p-4 space-y-2">
        <div className="flex items-start gap-2">
          <BookText className="h-4 w-4 text-emerald-500 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-cocoa-900">Biblioteca de templates</h2>
            <p className="text-xs text-cocoa-600 mt-0.5">
              Mensagens prontas que tu validaste. O Claudio lê todas como **referência de estilo** ao
              gerar sugestões — não as copia tal e qual, mas inspira-se no tom.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Link
            href="/comunicacoes/templates"
            className="text-sm text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
          >
            Gerir os {templatesCount} templates <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* D. Notas por conversa */}
      <section className="rounded-lg border border-cream-200 bg-surface p-4 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">📝</span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-cocoa-900">Notas por conversa</h2>
            <p className="text-xs text-cocoa-600 mt-0.5">
              Cada conversa de WhatsApp tem uma caixa de notas onde podes escrever info sobre a
              pessoa (ex: &quot;quer borgonha, não gosta de gypsophila&quot;). O Claudio lê essas notas
              quando sugere resposta APENAS para essa conversa.
            </p>
            <p className="text-xs text-cocoa-500 mt-1">
              Actualmente {conversationsWithNotes} conversa
              {conversationsWithNotes === 1 ? " tem" : "s têm"} notas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Link
            href="/whatsapp"
            className="text-sm text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
          >
            Ir ao WhatsApp <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <p className="text-xs text-cocoa-500 italic">
        💡 Mudanças nesta página afectam as próximas sugestões. Sugestões anteriores ficam intocadas.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SettingCard — bloco editavel ligado a uma chave do system_settings
// ──────────────────────────────────────────────────────────────
function SettingCard({
  title,
  subtitle,
  icon,
  settingKey,
  initialValue,
  rows,
  placeholder,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  settingKey: "claude_persona" | "claude_facts";
  initialValue: string;
  rows: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const lastSavedRef = useRef(initialValue);

  // Reset se prop muda (revalidate vindo do servidor)
  useEffect(() => {
    setValue(initialValue);
    setSavedValue(initialValue);
    lastSavedRef.current = initialValue;
  }, [initialValue]);

  const dirty = value !== savedValue;

  function handleSave() {
    startTransition(async () => {
      try {
        await updateSystemSettingAction(settingKey, value);
        setSavedValue(value);
        lastSavedRef.current = value;
        toast.success(`${title} guardado.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro a guardar");
      }
    });
  }

  return (
    <section className="rounded-lg border border-cream-200 bg-surface p-4 space-y-3">
      <div className="flex items-start gap-2">
        {icon}
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-cocoa-900">{title}</h2>
          <p className="text-xs text-cocoa-600 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="text-sm font-mono"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-cocoa-500">
          {value.length.toLocaleString("pt-PT")} caracteres
          {dirty && <span className="ml-2 text-amber-600">• alterações por guardar</span>}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!dirty || pending}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </section>
  );
}
