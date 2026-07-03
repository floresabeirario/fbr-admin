"use client";

// Cartão "Flores, quadro e extras": congelador, campos da moldura,
// extras no quadro e peças extra. Extraído do workbench-client.tsx
// (refactor sessão 128).

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Flower2, Snowflake } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order, ExtrasInFrame } from "@/types/database";
import {
  FRAME_BACKGROUND_LABELS,
  FRAME_SIZE_LABELS,
  FRAME_SIZE_COLORS,
  SIM_NAO_LABELS,
  isStatusAtOrAfter,
} from "@/types/database";
import { Card, Grid2, Field, CheckRow, inp, sel } from "./layout";
import { ExtraPieceRow } from "./fields";
import type { UpdateFn, ClientUpdateFn } from "./shared";

// Opções de extras tal como aparecem no formulário público.
// "Não pretendo incluir extras" e "Outro (especifique abaixo)" têm
// comportamento especial (ver toggleExtra).
const EXTRAS_NONE = "Não pretendo incluir extras";
const EXTRAS_OTHER = "Outro (especifique abaixo)";

const EXTRA_OPTIONS = [
  EXTRAS_NONE,
  "Votos manuscritos",
  "Convite do casamento",
  "Fitas, tecidos ou rendas",
  "Fotografia",
  "Joia ou medalha",
  "Coleira de animal",
  "Cartas ou bilhetes",
  EXTRAS_OTHER,
];

export function FlowersCard({
  local,
  update,
  clientUpdate,
}: {
  local: Order;
  update: UpdateFn;
  clientUpdate: ClientUpdateFn;
}) {
  const extras: ExtrasInFrame = local.extras_in_frame ?? { options: [], notes: "" };

  function toggleExtra(opt: string) {
    const has = extras.options.includes(opt);
    let nextOptions: string[];
    if (opt === EXTRAS_NONE) {
      // "Não pretendo incluir extras" é exclusivo: limpa tudo se ligar.
      nextOptions = has ? [] : [EXTRAS_NONE];
    } else if (has) {
      nextOptions = extras.options.filter((o) => o !== opt);
    } else {
      // Ao escolher qualquer outro extra, remove o "Não pretendo incluir".
      nextOptions = [...extras.options.filter((o) => o !== EXTRAS_NONE), opt];
    }
    update("extras_in_frame", { options: nextOptions, notes: extras.notes });
  }

  function setExtraNotes(v: string) {
    update("extras_in_frame", { options: extras.options, notes: v });
  }

  return (
    <Card title="Flores, quadro e extras" icon={<Flower2 className="h-3.5 w-3.5" />} accent="emerald" className="order-6 lg:order-none">
      {/* Congelador — 5 dias para eliminar insectos (mig 079).
          Marcação manual: nem todas as encomendas passam pelo
          congelador ao mesmo ritmo. Só aparece de "Flores na prensa"
          para a frente (antes disso as flores ainda nem chegaram). */}
      {isStatusAtOrAfter(local.status, "flores_na_prensa") && (
       <>
      <div className="rounded-lg border border-sky-200 bg-sky-50/60 dark:bg-sky-950/20 dark:border-sky-900 px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300 flex items-center gap-1">
            <Snowflake className="h-3 w-3" />
            Congelador (5 dias anti-insectos)
          </p>
          {local.freezer_in_at && !local.freezer_out_at && (() => {
            const dias = differenceInCalendarDays(new Date(), parseISO(local.freezer_in_at));
            const pronto = dias >= 5;
            return (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  pronto
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-sky-100 border-sky-300 text-sky-800"
                }`}
              >
                {pronto ? "Pronto a sair ✓" : `Dia ${Math.max(dias, 0) + 1} de 5`}
              </span>
            );
          })()}
        </div>
        {!local.freezer_in_at ? (
          <button
            type="button"
            onClick={() => update("freezer_in_at", new Date().toISOString())}
            className="text-xs font-medium rounded-lg border border-sky-300 bg-surface px-2.5 py-1.5 text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition-colors"
          >
            ❄ Entrou no congelador agora
          </button>
        ) : !local.freezer_out_at ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-cocoa-700">
              Entrou a {format(parseISO(local.freezer_in_at), "dd/MM/yyyy HH:mm")}
            </span>
            <button
              type="button"
              onClick={() => update("freezer_out_at", new Date().toISOString())}
              className="text-xs font-medium rounded-lg border border-sky-300 bg-surface px-2.5 py-1.5 text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition-colors"
            >
              Saiu do congelador
            </button>
            <button
              type="button"
              onClick={() => update("freezer_in_at", null)}
              className="text-[11px] text-cocoa-500 hover:text-cocoa-700 underline"
              title="Anular a entrada (engano)"
            >
              anular
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-emerald-700 font-medium">
              ✓ Concluído: {format(parseISO(local.freezer_in_at), "dd/MM")} → {format(parseISO(local.freezer_out_at), "dd/MM/yyyy")}
              {" "}({differenceInCalendarDays(parseISO(local.freezer_out_at), parseISO(local.freezer_in_at))} dias)
            </span>
            <button
              type="button"
              onClick={() => { update("freezer_in_at", null); update("freezer_out_at", null); }}
              className="text-[11px] text-cocoa-500 hover:text-cocoa-700 underline"
              title="Limpar o registo do congelador"
            >
              limpar
            </button>
          </div>
        )}
      </div>

      <Separator className="bg-cream-100" />
       </>
      )}

      <Grid2>
        <Field label="Tipo de flores" span2>
          <Input className={inp} value={local.flower_type ?? ""} onChange={(e) => update("flower_type", e.target.value || null)} placeholder="Rosas, peónias, silvestres…" />
        </Field>
        <Field label="Tamanho da moldura">
          <Select value={local.frame_size ?? ""} onValueChange={(v) => clientUpdate("frame_size", v as Order["frame_size"], "Tamanho da moldura", (val) => val ? FRAME_SIZE_LABELS[val] : "—")}>
            <SelectTrigger
              className={`${sel} font-medium ${local.frame_size ? FRAME_SIZE_COLORS[local.frame_size] : ""}`}
            >
              <SelectValue placeholder="—" labels={FRAME_SIZE_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FRAME_SIZE_LABELS) as Array<keyof typeof FRAME_SIZE_LABELS>).map((k) => (
                <SelectItem key={k} value={k} className="my-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${FRAME_SIZE_COLORS[k]}`}>
                    {FRAME_SIZE_LABELS[k]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fundo do quadro">
          <Select value={local.frame_background ?? ""} onValueChange={(v) => clientUpdate("frame_background", v as Order["frame_background"], "Fundo do quadro", (val) => val ? FRAME_BACKGROUND_LABELS[val] : "—")}>
            <SelectTrigger className={sel}><SelectValue placeholder="—" labels={FRAME_BACKGROUND_LABELS} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="transparente">Transparente</SelectItem>
              <SelectItem value="preto">Preto</SelectItem>
              <SelectItem value="branco">Branco</SelectItem>
              <SelectItem value="fotografia">Fotografia</SelectItem>
              <SelectItem value="cor">Cor</SelectItem>
              <SelectItem value="voces_a_escolher">Vocês a escolher</SelectItem>
              <SelectItem value="nao_sei">Não sei</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Moldura pirâmide"
          hint="Upgrade pago pelo cliente. Aplica suplemento ao orçamento."
        >
          <Select
            value={local.pyramid_frame ? "sim" : "nao"}
            onValueChange={(v) => update("pyramid_frame", v === "sim")}
          >
            <SelectTrigger
              className={`${sel} font-medium ${
                local.pyramid_frame
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : ""
              }`}
            >
              <SelectValue labels={SIM_NAO_LABELS} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Tipo de moldura (interno)"
          hint="Baixa (2x2cm, default) ou Caixa (2x3cm, flores altas). Cliente paga igual; afecta custo de produção."
        >
          {local.pyramid_frame ? (
            <div className={`${sel} flex items-center text-cocoa-500 italic`}>
              Pirâmide
            </div>
          ) : (
            <Select
              value={local.frame_internal_type ?? ""}
              onValueChange={(v) =>
                update("frame_internal_type", v as "baixa" | "caixa")
              }
            >
              <SelectTrigger className={sel}>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa (2x2cm)</SelectItem>
                <SelectItem value="caixa">Caixa (2x3cm)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </Grid2>

      <Separator className="bg-cream-100" />

      {/* Extras a incluir no quadro */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
          Extras a incluir no quadro
        </p>
        <div className="grid grid-cols-2 gap-2">
          {EXTRA_OPTIONS.map((opt) => (
            <CheckRow
              key={opt}
              label={opt}
              checked={extras.options.includes(opt)}
              onChange={() => toggleExtra(opt)}
            />
          ))}
        </div>
        {extras.options.includes(EXTRAS_OTHER) && (
          <Field label='Especifique "Outro"'>
            <Textarea
              className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
              rows={2}
              value={extras.notes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Ex: pequena pena de pavão, anel da avó…"
            />
          </Field>
        )}
      </div>

      <Separator className="bg-cream-100" />

      {/* Peças extra — compactas, qty estreito (max 2 algarismos típicos) */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
          Peças extra
        </p>
        <div className="space-y-1.5">
          <ExtraPieceRow
            label="Quadros extra pequenos"
            value={local.extra_small_frames}
            qty={local.extra_small_frames_qty}
            onValue={(v) => update("extra_small_frames", v)}
            onQty={(q) => update("extra_small_frames_qty", q)}
          />
          {(local.extra_small_frames === "sim" ||
            local.extra_small_frames === "mais_info") && (
            <div className="ml-2 pl-3 border-l-2 border-cream-200">
              <Field
                label="Fundo do quadro extra"
                hint="Só preencher se for diferente do fundo do quadro principal."
              >
                <Select
                  value={local.extra_small_frames_background ?? ""}
                  onValueChange={(v) =>
                    update(
                      "extra_small_frames_background",
                      (v || null) as Order["extra_small_frames_background"],
                    )
                  }
                >
                  <SelectTrigger className={sel}>
                    <SelectValue
                      placeholder="— (igual ao principal)"
                      labels={FRAME_BACKGROUND_LABELS}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transparente">Transparente</SelectItem>
                    <SelectItem value="preto">Preto</SelectItem>
                    <SelectItem value="branco">Branco</SelectItem>
                    <SelectItem value="fotografia">Fotografia</SelectItem>
                    <SelectItem value="cor">Cor</SelectItem>
                    <SelectItem value="voces_a_escolher">Vocês a escolher</SelectItem>
                    <SelectItem value="nao_sei">Não sei</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <ExtraPieceRow
            label="Ornamentos de Natal"
            value={local.christmas_ornaments}
            qty={local.christmas_ornaments_qty}
            onValue={(v) => update("christmas_ornaments", v)}
            onQty={(q) => update("christmas_ornaments_qty", q)}
          />
          <ExtraPieceRow
            label="Pendentes para colares"
            value={local.necklace_pendants}
            qty={local.necklace_pendants_qty}
            onValue={(v) => update("necklace_pendants", v)}
            onQty={(q) => update("necklace_pendants_qty", q)}
          />
        </div>
      </div>
    </Card>
  );
}
