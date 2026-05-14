"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Loader2, Check, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ALL_PUBLIC_PHASES,
  DEFAULT_MESSAGES_PT,
  DEFAULT_MESSAGES_EN,
  PUBLIC_PHASE_COLORS,
  PUBLIC_PHASE_LABEL_PT,
  PUBLIC_PHASE_LABEL_EN,
  type PartialPublicMessages,
  type PublicPhase,
} from "@/lib/public-status";
import { updateDefaultMessagesAction } from "../actions";

type Draft = {
  [K in PublicPhase as string]: { pt: string; en: string };
};

function buildDraft(saved: PartialPublicMessages): Draft {
  const out: Draft = {} as Draft;
  for (const p of ALL_PUBLIC_PHASES) {
    const key = String(p);
    out[key] = {
      pt: saved[p]?.pt ?? "",
      en: saved[p]?.en ?? "",
    };
  }
  return out;
}

export default function DefaultMessagesClient({
  initial,
  canEdit,
}: {
  initial: PartialPublicMessages;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => buildDraft(initial));
  const [isPending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);

  const initialDraft = useMemo(() => buildDraft(initial), [initial]);

  const isDirty = useMemo(() => {
    return ALL_PUBLIC_PHASES.some((p) => {
      const k = String(p);
      return draft[k].pt !== initialDraft[k].pt || draft[k].en !== initialDraft[k].en;
    });
  }, [draft, initialDraft]);

  function setPhase(phase: PublicPhase, lang: "pt" | "en", value: string) {
    setDraft((d) => ({
      ...d,
      [String(phase)]: { ...d[String(phase)], [lang]: value },
    }));
  }

  function resetPhase(phase: PublicPhase, lang: "pt" | "en") {
    setPhase(phase, lang, "");
  }

  function save() {
    // Só guardamos os campos não-vazios. Quando vazio, cai para o
    // default de código (em DEFAULT_MESSAGES_PT/EN).
    const out: PartialPublicMessages = {};
    for (const p of ALL_PUBLIC_PHASES) {
      const k = String(p);
      const pt = draft[k].pt.trim();
      const en = draft[k].en.trim();
      if (pt || en) {
        out[p] = {};
        if (pt) out[p]!.pt = pt;
        if (en) out[p]!.en = en;
      }
    }
    startTransition(async () => {
      try {
        await updateDefaultMessagesAction(out);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  }

  function resetAll() {
    setDraft(buildDraft({}));
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-5xl">
      {!canEdit && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Modo leitura.</strong> Não tens permissão para editar mensagens default.
          </span>
        </div>
      )}
      <fieldset disabled={!canEdit} className="contents">
      {/* Header */}
      <header className="space-y-3">
        <Link
          href="/status"
          className="inline-flex items-center gap-1.5 text-xs text-cocoa-700 hover:text-cocoa-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar à aba Status
        </Link>
        <div>
          <h1 className="font-['TanMemories'] text-3xl text-cocoa-900">
            Mensagens default
          </h1>
          <p className="mt-1 text-sm text-cocoa-700 max-w-3xl">
            Estes são os textos default que aparecem no site público para cada
            fase. Edita aqui se quiseres rephrasing global. Encomendas com
            mensagem personalizada não são afectadas. Deixa em branco para
            voltar ao texto original do PDF.
          </p>
        </div>
      </header>

      {/* Aviso */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-sm">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-amber-900">
          <p className="font-medium">Esta página afecta todas as encomendas que usem o default.</p>
          <p className="text-xs text-amber-800 mt-0.5">
            Encomendas com mensagem personalizada (editada na aba Status para essa
            encomenda) mantêm o seu texto e ignoram esta página.
          </p>
        </div>
      </div>

      {/* Lista de fases */}
      <div className="space-y-4">
        {ALL_PUBLIC_PHASES.map((phase) => {
          const k = String(phase);
          const ptValue = draft[k].pt;
          const enValue = draft[k].en;
          const ptOriginal = DEFAULT_MESSAGES_PT[phase];
          const enOriginal = DEFAULT_MESSAGES_EN[phase];
          const ptCustom = !!ptValue.trim();
          const enCustom = !!enValue.trim();

          return (
            <div
              key={k}
              className="rounded-xl border border-cream-200 bg-surface overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PUBLIC_PHASE_COLORS[phase]}`}
                >
                  {phase !== "cancelada" && <span className="opacity-60">{phase}</span>}
                  {PUBLIC_PHASE_LABEL_PT[phase]}
                </span>
                <span className="text-xs text-cocoa-700">
                  {PUBLIC_PHASE_LABEL_EN[phase]}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                {/* PT */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-cocoa-700">
                      🇵🇹 Português
                    </label>
                    {ptCustom && (
                      <button
                        onClick={() => resetPhase(phase, "pt")}
                        className="text-[11px] text-cocoa-700 hover:text-rose-600 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Repor original
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={ptValue}
                    onChange={(e) => setPhase(phase, "pt", e.target.value)}
                    placeholder={ptOriginal}
                    rows={3}
                    className="text-xs"
                  />
                </div>

                {/* EN */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-cocoa-700">
                      🇬🇧 English
                    </label>
                    {enCustom && (
                      <button
                        onClick={() => resetPhase(phase, "en")}
                        className="text-[11px] text-cocoa-700 hover:text-rose-600 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to original
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={enValue}
                    onChange={(e) => setPhase(phase, "en", e.target.value)}
                    placeholder={enOriginal}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer fixo */}
      <div className="sticky bottom-0 -mx-6 lg:-mx-8 mt-6 px-6 lg:px-8 py-3 bg-surface/95 backdrop-blur border-t border-cream-200 flex items-center justify-between">
        <div className="text-xs text-cocoa-700">
          {isDirty ? (
            <span className="text-amber-700">Tens alterações por guardar.</span>
          ) : savedFlash ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Guardado.
            </span>
          ) : (
            <span>Sem alterações.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetAll} disabled={isPending}>
            Limpar tudo
          </Button>
          <Button onClick={save} disabled={isPending || !isDirty} className="gap-2">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar mensagens default
          </Button>
        </div>
      </div>
      </fieldset>
    </div>
  );
}
