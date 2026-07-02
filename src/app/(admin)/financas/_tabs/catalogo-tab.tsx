"use client";

// ============================================================
// CATÁLOGO (preços, margem teórica) — extraído de financas-client.tsx
// ============================================================

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";
import type { PricingItem } from "@/types/pricing";
import type { ProductionCostItem } from "@/types/production-cost";
import { computeProductionCost } from "@/lib/production-cost";
import { updatePricingItemAction } from "../actions";
import { backfillProductionCostSnapshotsAction } from "@/app/(admin)/preservacao/actions";
import { CustosTab } from "./custos-tab";

export function CatalogoTab({
  pricing,
  productionCosts,
  canEdit,
}: {
  pricing: PricingItem[];
  productionCosts: ProductionCostItem[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      <MargemTeoricaSection
        pricing={pricing}
        productionCosts={productionCosts}
        canEdit={canEdit}
      />
      <CustosTab items={productionCosts} canEdit={canEdit} />
      {canEdit && <BackfillCogsSection />}
    </div>
  );
}

function BackfillCogsSection() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleBackfill = () => {
    if (
      !window.confirm(
        "Preencher snapshot de custos em todas as encomendas 100% pagas que ainda não têm? Usa os preços actuais (aproximação para encomendas antigas). Idempotente — pode correr-se várias vezes.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const { updated } = await backfillProductionCostSnapshotsAction();
        if (updated === 0) {
          toast.info("Nenhuma encomenda precisava de backfill.");
        } else {
          toast.success(`${updated} encomenda${updated === 1 ? "" : "s"} actualizada${updated === 1 ? "" : "s"} com snapshot de custos.`);
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro no backfill.");
      }
    });
  };

  return (
    <div className="rounded-xl border border-cocoa-200 bg-cream-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-cocoa-900 text-sm">Backfill de snapshots — encomendas 100% pagas antigas</h3>
          <p className="text-xs text-cocoa-700 mt-1 leading-relaxed">
            Encomendas 100% pagas criadas antes da introdução do snapshot (pré-mig 034) ou cuja transição para 100% aconteceu antes desta funcionalidade existir mostram <strong>COGS = 0</strong>. Este botão preenche o snapshot dessas encomendas com a tabela de custos actual. Encomendas em curso (30%/70%/por pagar) <strong>não</strong> são afectadas — o snapshot dessas é capturado automaticamente quando passam a 100%. Aproximação — usa preços de hoje. Idempotente.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBackfill}
          disabled={pending}
          className="shrink-0"
        >
          <Wand2 className="h-3.5 w-3.5 mr-1.5" />
          {pending ? "A preencher…" : "Preencher snapshots"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// MARGEM TEÓRICA — tabela editável (Bloco 1 quadros + Bloco 2 extras)
// ============================================================
// Substitui a antiga PrecosTab (3 subsecções) com uma única vista
// editável de preços cliente, custos derivados das 6 tabelas em baixo
// (Custos de produção), e margem calculada.
//
// Bloco 1 — 4 tamanhos × 3 fundos = 12 linhas. "Base" é partilhada
// entre as 3 linhas do mesmo tamanho (rowspan). "Supl." só aparece
// editável na linha fotografia. Custo, margem € e margem % são derivados.
//
// Bloco 2 — 2 extras autónomos (ornamento, pendente). Preço e custo
// FBR são ambos editáveis (custo guardado em pricing_items.cost_fbr).

type SizeKey = "30x40" | "40x50" | "50x70" | "20x25_mini";
type BgKey = "transparente" | "preto" | "fotografia";

interface SizeMeta {
  key: SizeKey;
  label: string;       // "Moldura 30x40", "Moldura 20x25 (mini)"
  costSize: "30x40" | "40x50" | "50x70" | "mini_20x25"; // chave nas tabelas de custos
  // O preço-base do mini está em pricing_items.extra.mini_frame; dos outros em
  // pricing_items.base_frame.<size>. Esta string identifica o sítio correcto.
  baseCategory: "base_frame" | "extra";
  baseKey: string;     // "30x40" / "40x50" / "50x70" / "mini_frame"
  // Chave do suplemento de fotografia no pricing_items.background_supplement.
  photoSuppKey: string; // "fotografia_30x40" / ... / "fotografia_mini"
}

const SIZES: SizeMeta[] = [
  { key: "30x40",      label: "Moldura 30x40 (A3)",     costSize: "30x40",      baseCategory: "base_frame", baseKey: "30x40",      photoSuppKey: "fotografia_30x40" },
  { key: "40x50",      label: "Moldura 40x50",          costSize: "40x50",      baseCategory: "base_frame", baseKey: "40x50",      photoSuppKey: "fotografia_40x50" },
  { key: "50x70",      label: "Moldura 50x70",          costSize: "50x70",      baseCategory: "base_frame", baseKey: "50x70",      photoSuppKey: "fotografia_50x70" },
  { key: "20x25_mini", label: "Moldura 20x25 (mini)",   costSize: "mini_20x25", baseCategory: "extra",      baseKey: "mini_frame", photoSuppKey: "fotografia_mini"  },
];

const BACKGROUNDS: Array<{ key: BgKey; label: string }> = [
  { key: "transparente", label: "Fundo transparente (vidro/vidro)" },
  { key: "preto",        label: "Fundo preto / branco / cor" },
  { key: "fotografia",   label: "Fundo fotografia" },
];

function MargemTeoricaSection({
  pricing,
  productionCosts,
  canEdit,
}: {
  pricing: PricingItem[];
  productionCosts: ProductionCostItem[];
  canEdit: boolean;
}) {
  // Snapshot vivo dos custos — para reusar `computeProductionCost` nos
  // quadros principais e garantir paridade exacta com o cálculo real.
  const snapshot = useMemo(
    () => ({
      captured_at: new Date().toISOString(),
      items: productionCosts
        .filter((i) => i.deleted_at === null)
        .map((i) => ({
          kind: i.kind,
          size_key: i.size_key,
          frame_type: i.frame_type,
          glass_type: i.glass_type,
          label: i.label,
          cost: i.cost,
        })),
    }),
    [productionCosts],
  );

  // Lookups por (categoria, key). Devolvem o item inteiro para podermos
  // editar via id, ou null se não existir.
  const findPricing = (category: PricingItem["category"], key: string) =>
    pricing.find(
      (p) => p.category === category && p.key === key && p.deleted_at === null,
    ) ?? null;

  const sizeBase = (s: SizeMeta) => findPricing(s.baseCategory, s.baseKey);
  const sizePhotoSupp = (s: SizeMeta) => findPricing("background_supplement", s.photoSuppKey);

  // ── Cálculo do custo de cada linha (read-only na verde) ──
  // Para 30x40/40x50/50x70 reusamos computeProductionCost para paridade.
  // Para o mini não dá (mini é add-on do main no fluxo real); calculo
  // manualmente: frame line + photo print se fotografia.
  function rowCost(size: SizeMeta, bg: BgKey): number {
    if (size.key !== "20x25_mini") {
      const bd = computeProductionCost(
        {
          frame_size: size.key as "30x40" | "40x50" | "50x70",
          frame_background: bg,
          pyramid_frame: false,
          frame_internal_type: "baixa",
          extra_small_frames: "nao",
          extra_small_frames_qty: 0,
        },
        snapshot,
      );
      return bd?.total ?? 0;
    }
    // Mini standalone — frame mini baixa + photo print mini se fotografia.
    const glass = bg === "transparente" ? "vidro_vidro" : "vidro_cartao";
    const frame = snapshot.items.find(
      (l) =>
        l.kind === "frame" &&
        l.size_key === "mini_20x25" &&
        l.frame_type === "baixa" &&
        l.glass_type === glass,
    );
    const photo = bg === "fotografia"
      ? snapshot.items.find(
          (l) => l.kind === "photo_print" && l.size_key === "mini_20x25",
        )
      : null;
    return Number(frame?.cost ?? 0) + Number(photo?.cost ?? 0);
  }

  // ── Extras autónomos (Bloco 2) — ornamento + pendente ──
  // Preço cliente vem de pricing_items. Custo deriva da soma de consumíveis
  // com size_key correspondente (mig 056 — ornament e pendant são produtos
  // vendáveis com a sua coluna na tabela de Custos de produção em baixo).
  const ornament = findPricing("extra", "christmas_ornament");
  const pendant = findPricing("extra", "necklace_pendant");
  const consumablesCostByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of productionCosts) {
      if (item.kind !== "consumable" || item.deleted_at !== null) continue;
      map.set(item.size_key, (map.get(item.size_key) ?? 0) + Number(item.cost));
    }
    return map;
  }, [productionCosts]);
  const consumablesCost = (productKey: string) =>
    consumablesCostByProduct.get(productKey) ?? 0;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 dark:border-emerald-900/50 p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-200/60 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
          <TrendingUp className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Margem teórica — preços, custos e lucro por quadro
          </h2>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
            Edita <strong>Base</strong> e <strong>Supl.</strong> (fotografia). <strong>Custo</strong> e <strong>Margem</strong> calculam-se a partir das tabelas em baixo. Combinações menos comuns (caixa, pirâmide, vidro/vidro) vivem só nessas tabelas.
            {!canEdit && <span className="block mt-1 italic">Modo leitura — só administradores podem editar.</span>}
          </p>
        </div>
      </div>

      {/* Bloco 1 — Quadros */}
      {/* overflow-x-auto + min-w: no telemóvel a tabela ganha scroll horizontal
          em vez de esmagar as colunas. No PC nada muda (já cabe folgada). */}
      <div className="rounded-xl bg-surface overflow-hidden overflow-x-auto border border-emerald-200/60 dark:border-emerald-900/40">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-emerald-100/60 dark:bg-emerald-900/30 text-xs uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Combinação</th>
              <th className="text-right px-3 py-2 font-medium w-28">Base (€)</th>
              <th className="text-right px-3 py-2 font-medium w-24">+€ Supl.</th>
              <th className="text-right px-3 py-2 font-medium w-24">Preço cli.</th>
              <th className="text-right px-3 py-2 font-medium w-24">Custo</th>
              <th className="text-right px-3 py-2 font-medium w-24">Margem €</th>
              <th className="text-right px-3 py-2 font-medium w-20">Margem %</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => {
              const baseItem = sizeBase(size);
              const supplItem = sizePhotoSupp(size);
              const basePrice = Number(baseItem?.price ?? 0);
              return (
                <React.Fragment key={size.key}>
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/20">
                    <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      {size.label}
                    </td>
                  </tr>
                  {BACKGROUNDS.map((bg, idx) => {
                    const isPhoto = bg.key === "fotografia";
                    const suppPrice = isPhoto ? Number(supplItem?.price ?? 0) : 0;
                    const clientPrice = basePrice + suppPrice;
                    const cost = rowCost(size, bg.key);
                    const margin = clientPrice - cost;
                    const marginPct = clientPrice > 0 ? (margin / clientPrice) * 100 : 0;
                    return (
                      <tr key={`${size.key}-${bg.key}`} className="border-t border-emerald-100 dark:border-emerald-900/30">
                        <td className="px-3 py-2 text-cocoa-900">{bg.label}</td>
                        {idx === 0 ? (
                          <td
                            rowSpan={3}
                            className="px-2 py-2 text-right align-middle border-l border-emerald-100/60"
                          >
                            <EditableEuro
                              item={baseItem}
                              field="price"
                              canEdit={canEdit}
                              align="right"
                            />
                          </td>
                        ) : null}
                        <td className="px-2 py-2 text-right">
                          {isPhoto ? (
                            <EditableEuro
                              item={supplItem}
                              field="price"
                              canEdit={canEdit}
                              align="right"
                            />
                          ) : (
                            <span className="text-cocoa-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-cocoa-900 font-medium">
                          {formatEUR(clientPrice)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                          {formatEUR(cost)}
                        </td>
                        <td className={cn(
                          "px-3 py-2 text-right tabular-nums font-semibold",
                          margin >= 0 ? "text-emerald-700" : "text-rose-700",
                        )}>
                          {formatEUR(margin)}
                        </td>
                        <td className={cn(
                          "px-3 py-2 text-right tabular-nums font-semibold",
                          marginPct >= 50 ? "text-emerald-700" : marginPct >= 30 ? "text-amber-700" : "text-rose-700",
                        )}>
                          {clientPrice > 0 ? `${marginPct.toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bloco 2 — Extras (ornamento + pendente) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
          Extras (vendidos à parte)
        </h3>
        <div className="rounded-xl bg-surface overflow-hidden overflow-x-auto border border-emerald-200/60 dark:border-emerald-900/40">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-emerald-100/60 dark:bg-emerald-900/30 text-xs uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-3 py-2 font-medium w-28">Preço cli. (€)</th>
                <th className="text-right px-3 py-2 font-medium w-24">Custo</th>
                <th className="text-right px-3 py-2 font-medium w-24">Margem €</th>
                <th className="text-right px-3 py-2 font-medium w-20">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {[
                { item: ornament, productKey: "christmas_ornament" },
                { item: pendant,  productKey: "necklace_pendant"   },
              ].map(({ item, productKey }) => {
                if (!item) return null;
                const price = Number(item.price ?? 0);
                const cost = consumablesCost(productKey);
                const margin = price - cost;
                const marginPct = price > 0 ? (margin / price) * 100 : 0;
                return (
                  <tr key={item.id} className="border-t border-emerald-100 dark:border-emerald-900/30">
                    <td className="px-3 py-2 text-cocoa-900">{item.label}</td>
                    <td className="px-2 py-2 text-right">
                      <EditableEuro item={item} field="price" canEdit={canEdit} align="right" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                      {formatEUR(cost)}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      margin >= 0 ? "text-emerald-700" : "text-rose-700",
                    )}>
                      {formatEUR(margin)}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      marginPct >= 50 ? "text-emerald-700" : marginPct >= 30 ? "text-amber-700" : "text-rose-700",
                    )}>
                      {price > 0 ? `${marginPct.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-emerald-800/70 italic">
          <strong>Custo</strong> deriva dos consumíveis das colunas <em>Ornamento</em> e <em>Pendente</em> na tabela “Outros custos recorrentes” em baixo.
        </p>
      </div>
    </div>
  );
}

// Célula editável de valor em €. Persiste em onBlur via updatePricingItemAction.
// Inputs vazios viram 0. Usa o padrão "store info from previous renders" para
// sincronizar o draft local quando o item muda na BD (sem useEffect+setState).
function EditableEuro({
  item,
  field,
  canEdit,
  align = "right",
}: {
  item: PricingItem | null;
  field: "price";
  canEdit: boolean;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const current = item ? Number(item[field] ?? 0) : 0;
  const [draft, setDraft] = useState(formatDraft(current));
  const [lastItemId, setLastItemId] = useState(item?.id ?? null);
  const [lastValue, setLastValue] = useState(current);
  if (item && (item.id !== lastItemId || current !== lastValue)) {
    setLastItemId(item.id);
    setLastValue(current);
    setDraft(formatDraft(current));
  }

  if (!item) {
    return <span className="text-cocoa-500 italic text-xs">item em falta</span>;
  }

  function save(raw: string) {
    const next = raw.trim() === "" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(next) || next < 0) {
      toast.error("Valor inválido");
      setDraft(formatDraft(current));
      return;
    }
    if (next === current) {
      setDraft(formatDraft(next)); // normaliza o display
      return;
    }
    setSaving(true);
    startTransition(async () => {
      try {
        await updatePricingItemAction(item!.id, { [field]: next });
        toast.success(`${item!.label}: ${formatEUR(next)}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
        setDraft(formatDraft(current));
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => save(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      disabled={!canEdit || saving}
      inputMode="decimal"
      placeholder="0"
      className={cn(
        "h-8 w-24 text-sm font-medium tabular-nums",
        align === "right" && "text-right",
      )}
    />
  );
}

function formatDraft(n: number): string {
  if (!n || n === 0) return "0";
  // Formato europeu sem unidade (vírgula decimal). Aparas zeros redundantes.
  const fixed = n.toFixed(2);
  return fixed.replace(/\.?0+$/, "").replace(".", ",");
}

