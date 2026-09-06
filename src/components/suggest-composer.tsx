"use client";

// ============================================================
// Composer "Sugerir resposta" — partilhado
// ============================================================
// Nasceu dentro da Caixa de Entrada do WhatsApp (sessão 153). Passou a
// componente próprio porque a Maria precisa exactamente do mesmo
// assistente quando a cliente **nunca escreveu nada**: preencheu o
// formulário e ficou à espera. Aí não há conversa nenhuma para abrir,
// mas há o que ela escolheu no formulário — que é precisamente o que o
// assistente já lê.
//
// Por isso o alvo passa a ser um de dois:
//   • `conversationId` — conversa do WhatsApp (Caixa de Entrada, e
//     workbench quando já houve mensagens);
//   • `orderId` — encomenda sem conversa (workbench de Preservação).
//
// Tudo o resto é igual nos dois casos: rascunhos persistentes com
// histórico, afinação por texto livre, "Abrir no WhatsApp" e a captura
// silenciosa do par gerado/usado que alimenta as regras de voz.
// ============================================================

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  RotateCcw,
  X,
  Check,
  Send,
  Mail,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { phoneToWaMe } from "@/lib/format-phone";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import TemplatePicker from "@/components/template-picker";
import { boldForWhatsapp, boldToHtml, stripBold } from "@/lib/rich-text";
import { buildMailtoHref } from "@/lib/mailto";
import type { Order } from "@/types/database";
import {
  subscribeComposer,
  getComposerSnapshot,
  getServerComposerSnapshot,
  conversationDrafts,
  currentDraft,
  saveInstruction,
  pushDraft,
  updateDraftText,
  setDraftIndex,
  markDraftUsed,
  clearConversationDrafts,
} from "@/lib/whatsapp/composer-drafts";

// Faz a caixa crescer com o texto em vez de ficar presa a `rows`. No
// telemóvel, com o teclado aberto, uma caixa de 6 linhas fixas mostrava
// só uma nesga da mensagem.
//
// O tecto é relativo ao ecrã, não fixo: 320px num portátil é razoável,
// mas num telemóvel é quase metade da altura e empurrava a conversa toda
// para fora. Fica-se por ~30% do ecrã, com um mínimo utilizável.
export function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const tecto = Math.max(
    112,
    Math.min(320, Math.round((window.innerHeight || 800) * 0.3)),
  );
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, tecto)}px`;
}

export type SuggestComposerProps = {
  /** Conversa do WhatsApp. Um destes dois tem de vir preenchido. */
  conversationId?: string | null;
  /** Encomenda — usado quando ainda não há conversa nenhuma. */
  orderId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  /**
   * Canal da mensagem. "email" muda o formato (assunto + saudação +
   * despedida, sem gíria de WhatsApp) e o botão de acção passa a abrir o
   * programa de email. Os rascunhos ficam guardados em separado: a
   * mesma encomenda pode ter uma mensagem a meio nos dois canais.
   */
  channel?: "whatsapp" | "email";
  /** Destinatário do `mailto:` quando `channel === "email"`. */
  email?: string | null;
  /**
   * Picker de templates ao lado do botão. Só na Caixa de Entrada: o
   * workbench já tem o seu próprio picker (com a encomenda) mesmo por
   * cima disto, e dois pickers seguidos só confundem.
   */
  leadTemplates?: boolean;
  /**
   * Encomenda completa desta conversa, quando existe. É o que faz o
   * picker sugerir os templates **da fase certa** (e preencher valores,
   * datas e tamanhos) em vez da lista fixa de primeiro contacto. Sem
   * ela, cai-se no modo "lead", que é o correcto para quem escreve antes
   * de preencher o formulário.
   */
  order?: Order | null;
  /** "Sugerir resposta" quando há conversa; "Sugerir mensagem" quando não há. */
  ctaLabel?: string;
  placeholder?: string;
  className?: string;
};

export default function SuggestComposer({
  conversationId,
  orderId,
  contactName,
  phone,
  channel = "whatsapp",
  email,
  leadTemplates = false,
  order,
  ctaLabel = "Sugerir resposta",
  placeholder = 'Diz ao Claude o que queres comunicar (opcional). Ex: "responde que sim, conseguimos fazer mas o prazo é mais longo"',
  className,
}: SuggestComposerProps) {
  const porEmail = channel === "email";
  // Chave dos rascunhos em localStorage. Prefixo `order:` para uma
  // encomenda nunca colidir com um id de conversa, e `email:` para os
  // dois canais da mesma encomenda não se pisarem.
  const alvo = conversationId || (orderId ? `order:${orderId}` : "");
  const storageKey = alvo && porEmail ? `email:${alvo}` : alvo;

  const [loading, setLoading] = useState(false);
  // O que ela quer mudar na versão actual ("mais curta", "diz que só
  // depois de Agosto"). Local: é uma intenção do momento, não vale a
  // pena sobreviver ao reload como o rascunho.
  const [refine, setRefine] = useState("");
  // Encolher a sugestão para ler a conversa por trás. O rodapé cresceu
  // com o histórico, a afinação e o botão do WhatsApp, e no telemóvel
  // tapava as mensagens do cliente — que é justamente o que ela precisa
  // de ver enquanto responde.
  const [compacta, setCompacta] = useState(false);
  // Confirmação de "copiado" no próprio botão. Era um toast, mas no
  // telemóvel o toast aparecia por cima destes botões e não saía mais
  // (o toque conta como hover e o sonner pausa o auto-fechar).
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  // O que ela escreve vive em localStorage, não em memória: o Android
  // mata a PWA quando ela vai ao WhatsApp e volta, e antes disto perdia
  // a mensagem a meio. Cada geração empilha um rascunho, por isso o
  // "Refazer" deixou de destruir a versão anterior.
  const snapshot = useSyncExternalStore(
    subscribeComposer,
    getComposerSnapshot,
    getServerComposerSnapshot,
  );
  const conv = conversationDrafts(snapshot, storageKey);
  const draft = currentDraft(conv);
  const suggestion = draft?.text ?? null;
  const instruction = conv.instruction;
  const totalDrafts = conv.drafts.length;
  const draftIndex = Math.min(Math.max(conv.index, 0), Math.max(totalDrafts - 1, 0));

  // Reset do "copiado" ao mudar de alvo — durante o render, sem
  // setState em effect.
  const [prevKey, setPrevKey] = useState(storageKey);
  if (storageKey !== prevKey) {
    setPrevKey(storageKey);
    setLoading(false);
    setCopied(false);
    setRefine("");
    setCompacta(false);
  }

  // Guarda o par sugestão-gerada / texto-usado. Silencioso e
  // best-effort: se falhar, a Maria nem dá por isso e a mensagem sai na
  // mesma. Nunca `await`-ado no caminho do clique.
  function registarUso(usedVia: "copiar" | "whatsapp") {
    if (!draft || draft.used || !draft.original || !draft.text) return;
    markDraftUsed(storageKey);
    void fetch("/api/whatsapp/suggest-edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: conversationId ?? null,
        orderId: orderId ?? null,
        instruction: instruction || null,
        original: draft.original,
        final: draft.text,
        usedVia,
        language: draft.language ?? null,
      }),
    }).catch(() => {});
  }

  // `refineWith` presente = reescrever a versao actual em vez de gerar do
  // zero. O resultado empilha como rascunho novo, por isso a versao
  // anterior fica sempre a um toque de distancia no historico.
  async function handleSuggest(refineWith?: string) {
    if (loading || !storageKey) return;
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          orderId: orderId ?? undefined,
          channel,
          instruction,
          refineFrom: refineWith ? suggestion : undefined,
          refineWith: refineWith || undefined,
          // "Refazer" (sem afinação) com o prompt igual devolvia a MESMA
          // mensagem: a tarefa é constrangida demais para a aleatoriedade
          // do modelo dar a volta sozinha. Mandar o que já saiu é o que o
          // faz mudar de abordagem.
          avoid:
            !refineWith && conv.drafts.length > 0
              ? conv.drafts.slice(-2).map((d) => d.original)
              : undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const texto = data.suggestion || "";
      pushDraft(storageKey, {
        original: texto,
        text: texto,
        language: data.language ?? null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro a gerar sugestão");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!suggestion) return;
    try {
      if (porEmail) {
        // O Gmail não percebe asteriscos: o que vai a negrito tem de ir
        // como HTML. O `text/plain` segue limpo, sem marcadores, para os
        // sítios que não aceitam formatação. [[lib/rich-text]]
        const item = typeof ClipboardItem !== "undefined"
          ? new ClipboardItem({
              "text/html": new Blob([boldToHtml(suggestion)], { type: "text/html" }),
              "text/plain": new Blob([stripBold(suggestion)], { type: "text/plain" }),
            })
          : null;
        if (item && navigator.clipboard.write) {
          await navigator.clipboard.write([item]);
        } else {
          await navigator.clipboard.writeText(stripBold(suggestion));
        }
      } else {
        // WhatsApp: *asterisco simples* é o negrito nativo.
        await navigator.clipboard.writeText(boldForWhatsapp(suggestion));
      }
      registarUso("copiar");
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não consegui copiar — selecciona manualmente.");
    }
  }

  function handleClose() {
    clearConversationDrafts(storageKey);
    setCopied(false);
  }

  // Abre o WhatsApp já na conversa certa e com a mensagem na caixa de
  // escrita — só falta carregar em enviar. Poupa o ciclo
  // copiar → sair da app → procurar a conversa → colar.
  // Continua a ser a Maria a enviar: não enviamos nada por ela.
  const waNumero = !porEmail && phone ? phoneToWaMe(phone) : null;
  const waHref =
    waNumero && suggestion
      ? `https://wa.me/${waNumero}?text=${encodeURIComponent(boldForWhatsapp(suggestion))}`
      : null;

  // Equivalente para email: abre o programa de email dela já com o
  // destinatário, o assunto e o corpo. Continua a ser ela a carregar em
  // enviar — a plataforma nunca envia nada por si.
  const mailtoHref = porEmail ? buildMailtoHref(email, suggestion) : null;

  const accaoHref = waHref ?? mailtoHref;

  const base = "p-3 border-t border-cream-200 bg-surface space-y-2";

  if (suggestion !== null) {
    return (
      <div className={cn(base, className)}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-cocoa-700 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-indigo-500" />{" "}
            {porEmail ? "Email sugerido (edita antes de enviar)" : "Sugestão (edita antes de enviar)"}
          </span>
          <div className="flex items-center gap-1">
            {/* Histórico: o "Refazer" empilha em vez de destruir, por isso
                dá para voltar a uma sugestão anterior que estava melhor. */}
            {totalDrafts > 1 && (
              <div className="flex items-center gap-0.5 mr-1">
                <button
                  type="button"
                  onClick={() => setDraftIndex(storageKey, draftIndex - 1)}
                  disabled={draftIndex === 0}
                  className="p-1.5 -m-0.5 text-cocoa-400 hover:text-cocoa-700 disabled:opacity-30"
                  aria-label="Sugestão anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] tabular-nums text-cocoa-500">
                  {draftIndex + 1}/{totalDrafts}
                </span>
                <button
                  type="button"
                  onClick={() => setDraftIndex(storageKey, draftIndex + 1)}
                  disabled={draftIndex === totalDrafts - 1}
                  className="p-1.5 -m-0.5 text-cocoa-400 hover:text-cocoa-700 disabled:opacity-30"
                  aria-label="Sugestão seguinte"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setCompacta((v) => !v)}
              className="p-2 -m-1 text-cocoa-400 hover:text-cocoa-700"
              aria-label={compacta ? "Expandir sugestão" : "Encolher para ver a conversa"}
              title={compacta ? "Expandir sugestão" : "Encolher para ver a conversa"}
            >
              {compacta ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 -m-1 text-cocoa-400 hover:text-cocoa-700"
              aria-label="Fechar"
            >
              <X className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
            </button>
          </div>
        </div>
        <Textarea
          value={suggestion}
          ref={autoGrow}
          onChange={(e) => {
            updateDraftText(storageKey, e.target.value);
            if (!compacta) autoGrow(e.currentTarget);
          }}
          rows={4}
          // `!h-16` vence a altura inline do autoGrow (o !important do
          // Tailwind ganha a estilos inline sem !important).
          className={cn(
            "text-sm resize-none",
            compacta && "!h-16 overflow-auto",
          )}
        />
        {/* Construir sobre a sugestão em vez de aceitar ou refazer do
            zero. Cada afinação empilha um rascunho novo, por isso a
            versão anterior fica sempre no histórico ‹ ›. */}
        <div className="flex gap-2">
          <Input
            value={refine}
            onChange={(e) => setRefine(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && refine.trim() && !loading) {
                e.preventDefault();
                handleSuggest(refine.trim());
                setRefine("");
              }
            }}
            placeholder="O que queres mudar? Ex: mais curta"
            className="flex-1 h-11 lg:h-8 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !refine.trim()}
            onClick={() => {
              handleSuggest(refine.trim());
              setRefine("");
            }}
            className="h-11 lg:h-8"
          >
            {loading ? "…" : "Aplicar"}
          </Button>
        </div>

        {/* Acção principal no telemóvel: abre o WhatsApp com o texto já
            escrito (ou o programa de email, quando é por email). Copiar
            fica como alternativa (desktop, ou colar noutro sítio). */}
        {accaoHref && (
          <a
            href={accaoHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => registarUso(porEmail ? "copiar" : "whatsapp")}
            className={cn(
              "flex h-11 lg:h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-white transition-colors",
              porEmail
                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                : "bg-green-600 hover:bg-green-700 active:bg-green-800",
            )}
          >
            {porEmail ? (
              <>
                <Mail className="h-4 w-4" /> Abrir no email
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Abrir no WhatsApp
              </>
            )}
          </a>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={accaoHref ? "outline" : "default"}
            onClick={handleCopy}
            className="flex-1 h-11 lg:h-8"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleSuggest()}
            disabled={loading}
            className="h-11 lg:h-8"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            {loading ? "A pensar…" : "Refazer"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(base, className)}>
      <div className="text-[10px] text-cocoa-500">
        {porEmail
          ? "💡 Os emails enviam-se do teu correio. Aqui só sugerimos."
          : "💡 Mensagens enviam-se pelo telemóvel. Aqui só sugerimos."}
      </div>
      <Textarea
        value={instruction}
        onChange={(e) => {
          saveInstruction(storageKey, e.target.value);
          autoGrow(e.currentTarget);
        }}
        placeholder={placeholder}
        rows={2}
        className="text-sm resize-none"
      />
      <div className="flex items-center gap-2">
        {/* Templates prontos a copiar/colar. Com encomenda ligada, os
            sugeridos são os da fase dela (e das escolhas do formulário);
            sem encomenda, os típicos de primeiro contacto. */}
        {leadTemplates &&
          (order ? (
            <TemplatePicker
              scope="order"
              order={order}
              preferredLanguage={order.form_language}
            />
          ) : (
            <TemplatePicker
              scope="lead"
              contactName={contactName}
              phone={phone}
              email={email}
            />
          ))}
        <Button
          type="button"
          size="sm"
          onClick={() => handleSuggest()}
          disabled={loading}
          className="flex-1 h-11 lg:h-8"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {loading ? "A pensar…" : ctaLabel}
        </Button>
      </div>
    </div>
  );
}
