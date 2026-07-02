"use client";

// ============================================================
// CUSTOS DE PRODUÇÃO (tabelas por moldura + consumíveis)
// — extraído de financas-client.tsx
// ============================================================

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Frame, Camera, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";
import type {
  ProductionCostItem,
  ProductionCostSize,
  ProductionFrameType,
  ProductionGlassType,
} from "@/types/production-cost";
import {
  PRODUCTION_SIZE_LABELS,
  PRODUCTION_FRAME_TYPE_LABELS,
  PRODUCTION_FRAME_TYPE_SHORT,
  PRODUCTION_GLASS_TYPE_LABELS,
} from "@/types/production-cost";
import {
  updateProductionCostItemAction,
  createConsumableAction,
  archiveConsumableAction,
  renameConsumableAction,
} from "../actions";

// Aqui guardamos o custo da Maria a produzir cada quadro: moldura,
// embalagem, cartão informativo, enchimento, autocolante, etc.
//
// 3 variáveis: tamanho × tipo de moldura × tipo de vidro.
//   - Tamanhos: 30x40 (A3), 40x50, 50x70, mini 20x25.
//   - Tipo de moldura: baixa (2x2cm), caixa (2x3cm), pirâmide.
//     Baixa vs caixa é decisão INTERNA (consoante a altura das flores).
//     Pirâmide é a única visível ao cliente (upgrade pago).
//   - Tipo de vidro: vidro sobre vidro (fundo transparente) ou
//     vidro sobre cartão (preto/branco/cor/fotografia).
//
// Bonus: tabela "Impressão de fotografia" — somada ao custo do quadro
// quando o cliente escolhe fundo fotografia.

const PRODUCTION_SIZES_ORDER: ProductionCostSize[] = [
  "30x40",
  "40x50",
  "50x70",
  "mini_20x25",
];

const PRODUCTION_FRAME_TYPES_ORDER: ProductionFrameType[] = [
  "baixa",
  "caixa",
  "piramide",
];

const PRODUCTION_GLASS_TYPES_ORDER: ProductionGlassType[] = [
  "vidro_vidro",
  "vidro_cartao",
];

export function CustosTab({
  items,
  canEdit,
}: {
  items: ProductionCostItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);

  // Index para lookup rápido.
  const frameByKey = useMemo(() => {
    const map = new Map<string, ProductionCostItem>();
    for (const it of items) {
      if (it.kind !== "frame") continue;
      map.set(`${it.size_key}|${it.frame_type}|${it.glass_type}`, it);
    }
    return map;
  }, [items]);

  const photoBySize = useMemo(() => {
    const map = new Map<string, ProductionCostItem>();
    for (const it of items) {
      if (it.kind !== "photo_print") continue;
      map.set(it.size_key, it);
    }
    return map;
  }, [items]);

  // Consumables agrupados por label. Mantemos a ordem pela menor
  // `position` do grupo (o seed posicionou os 3 tamanhos lado a lado).
  const consumableGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; minPosition: number; items: Map<string, ProductionCostItem> }
    >();
    for (const it of items) {
      if (it.kind !== "consumable" || !it.label) continue;
      const g = groups.get(it.label) ?? {
        label: it.label,
        minPosition: it.position,
        items: new Map<string, ProductionCostItem>(),
      };
      g.minPosition = Math.min(g.minPosition, it.position);
      g.items.set(it.size_key, it);
      groups.set(it.label, g);
    }
    return [...groups.values()].sort((a, b) => a.minPosition - b.minPosition);
  }, [items]);

  function saveCost(item: ProductionCostItem, raw: string) {
    const next = raw.trim() === "" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(next) || next < 0) {
      toast.error("Custo inválido");
      return;
    }
    if (next === item.cost) return;
    setSaving(item.id);
    startTransition(async () => {
      try {
        await updateProductionCostItemAction(item.id, { cost: next });
        toast.success(`${describe(item)}: ${formatEUR(next)}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
      } finally {
        setSaving(null);
      }
    });
  }

  function createConsumable(label: string, onDone: () => void) {
    startTransition(async () => {
      try {
        await createConsumableAction(label);
        toast.success(`"${label}" adicionado.`);
        onDone();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
      }
    });
  }

  function archiveConsumable(label: string) {
    if (!window.confirm(`Remover "${label}"? Encomendas antigas não são afectadas.`)) return;
    startTransition(async () => {
      try {
        await archiveConsumableAction(label);
        toast.success(`"${label}" removido.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao remover");
      }
    });
  }

  function renameConsumable(oldLabel: string, newLabel: string) {
    if (newLabel.trim() === oldLabel || newLabel.trim().length === 0) return;
    startTransition(async () => {
      try {
        await renameConsumableAction(oldLabel, newLabel.trim());
        toast.success(`"${oldLabel}" → "${newLabel.trim()}"`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao renomear");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Aviso explicativo */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex gap-3">
        <Frame className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
          <p className="font-semibold mb-1">Como funcionam os custos de produção</p>
          <p>
            Estes são os custos REAIS de produzir cada produto vendável
            (moldura, embalagem, cartão, enchimento, autocolante, etc.) —
            distintos das despesas únicas. Cada encomenda guarda um snapshot
            dos custos vigentes no dia da criação; <strong>alterações aqui
            não recalculam encomendas antigas</strong>.
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
            <strong>Vidro sobre vidro</strong> = cliente escolheu fundo transparente.{" "}
            <strong>Vidro sobre cartão</strong> = preto, branco, cor ou fotografia.{" "}
            Baixa vs caixa é decisão interna (consoante a altura das flores);
            o cliente paga o mesmo, só a margem muda. Pirâmide é o único upgrade
            que o cliente também paga.
          </p>
          {!canEdit && (
            <p className="mt-2 italic text-amber-700 dark:text-amber-300">
              Modo leitura — só administradores podem editar.
            </p>
          )}
        </div>
      </div>

      {/* Grelha 4 cards: um por tamanho */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
        {PRODUCTION_SIZES_ORDER.map((size) => (
          <div
            key={size}
            className="rounded-2xl border bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 p-3 sm:p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Frame className="h-4 w-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-cocoa-900">
                {PRODUCTION_SIZE_LABELS[size]}
              </h2>
            </div>
            <div className="rounded-xl bg-surface overflow-hidden border border-white/40">
              <table className="w-full text-xs">
                <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium" />
                    {PRODUCTION_GLASS_TYPES_ORDER.map((g) => (
                      <th key={g} className="text-left px-2 py-1.5 font-medium">
                        {g === "vidro_vidro" ? "Vidro" : "Cartão"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTION_FRAME_TYPES_ORDER.map((ft) => (
                    <tr key={ft} className="border-t border-cream-100">
                      <td className="px-2 py-1.5 align-middle text-xs font-medium text-cocoa-900">
                        {PRODUCTION_FRAME_TYPE_SHORT[ft]}
                      </td>
                      {PRODUCTION_GLASS_TYPES_ORDER.map((gt) => {
                        const item = frameByKey.get(`${size}|${ft}|${gt}`);
                        return (
                          <td key={gt} className="px-1 py-1 align-middle">
                            {item ? (
                              <CostInput
                                item={item}
                                canEdit={canEdit}
                                saving={saving === item.id}
                                onSave={(v) => saveCost(item, v)}
                              />
                            ) : (
                              <span className="text-cocoa-500 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Card: Impressão de fotografia */}
      <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 p-3 sm:p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-violet-700" />
          <h2 className="text-sm font-semibold text-cocoa-900">
            Impressão de fotografia
          </h2>
          <span className="text-[11px] text-cocoa-700">
            Somado ao custo do quadro quando o cliente escolhe fundo fotografia
          </span>
        </div>
        {/* overflow-x-auto + min-w: scroll horizontal no telemóvel em vez de
            esmagar os inputs. No PC nada muda. */}
        <div className="rounded-xl bg-surface border border-white/40 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
              <tr>
                {PRODUCTION_SIZES_ORDER.map((s) => (
                  <th key={s} className="text-left px-3 py-1.5 font-medium">
                    {PRODUCTION_SIZE_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {PRODUCTION_SIZES_ORDER.map((s) => {
                  const it = photoBySize.get(s);
                  return (
                    <td key={s} className="px-2 py-2 align-middle">
                      {it ? (
                        <CostInput
                          item={it}
                          canEdit={canEdit}
                          saving={saving === it.id}
                          onSave={(v) => saveCost(it, v)}
                        />
                      ) : (
                        <span className="text-cocoa-500 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Card: Outros custos recorrentes (consumíveis por encomenda) */}
      <ConsumablesSection
        groups={consumableGroups}
        canEdit={canEdit}
        saving={saving}
        onSaveCost={saveCost}
        onCreate={createConsumable}
        onArchive={archiveConsumable}
        onRename={renameConsumable}
      />
    </div>
  );
}

function ConsumablesSection({
  groups,
  canEdit,
  saving,
  onSaveCost,
  onCreate,
  onArchive,
  onRename,
}: {
  groups: Array<{ label: string; items: Map<string, ProductionCostItem> }>;
  canEdit: boolean;
  saving: string | null;
  onSaveCost: (item: ProductionCostItem, raw: string) => void;
  onCreate: (label: string, onDone: () => void) => void;
  onArchive: (label: string) => void;
  onRename: (oldLabel: string, newLabel: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");

  // Produtos vendáveis (4 tamanhos físicos + 2 extras autónomos, mig 056).
  // Cada consumível tem 6 linhas — uma por produto. Maria edita custo onde
  // o consumível se aplica e deixa 0 nos restantes.
  const sizes: ProductionCostSize[] = [
    "30x40",
    "40x50",
    "50x70",
    "mini_20x25",
    "christmas_ornament",
    "necklace_pendant",
  ];

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-rose-50 to-pink-100 border-rose-200 p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-rose-700" />
        <h2 className="text-sm font-semibold text-cocoa-900">
          Outros custos recorrentes
        </h2>
        <span className="text-[11px] text-cocoa-700">
          Custo por produto vendável (tamanho do quadro ou extra autónomo)
        </span>
      </div>
      {/* overflow-x-auto + min-w: 6 colunas de produto não cabem num telemóvel;
          ganha scroll horizontal em vez de esmagar. No PC nada muda. */}
      <div className="rounded-xl bg-surface border border-white/40 overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">Item</th>
              {sizes.map((s) => (
                <th key={s} className="text-left px-3 py-1.5 font-medium w-32">
                  {PRODUCTION_SIZE_LABELS[s]}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={sizes.length + 2} className="px-3 py-4 text-xs text-cocoa-500 italic text-center">
                  Sem consumíveis ainda. Adiciona em baixo.
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <tr key={g.label} className="border-t border-cream-100">
                <td className="px-3 py-1.5 align-middle">
                  <ConsumableLabelInput
                    label={g.label}
                    canEdit={canEdit}
                    onRename={(v) => onRename(g.label, v)}
                  />
                </td>
                {sizes.map((s) => {
                  const item = g.items.get(s);
                  return (
                    <td key={s} className="px-2 py-1 align-middle">
                      {item ? (
                        <CostInput
                          item={item}
                          canEdit={canEdit}
                          saving={saving === item.id}
                          onSave={(v) => onSaveCost(item, v)}
                        />
                      ) : (
                        <span className="text-cocoa-500 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1 align-middle text-right">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onArchive(g.label)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-rose-600 hover:bg-rose-100 transition-colors"
                      title={`Remover "${g.label}"`}
                      aria-label={`Remover ${g.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {canEdit && (
              <tr className="border-t border-cream-100 bg-rose-50/50">
                <td colSpan={sizes.length + 2} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Plus className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newLabel.trim().length > 0) {
                          e.preventDefault();
                          onCreate(newLabel.trim(), () => setNewLabel(""));
                        }
                      }}
                      placeholder="Novo item (ex: Cartão de visita)"
                      className="h-7 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      disabled={newLabel.trim().length === 0}
                      onClick={() =>
                        onCreate(newLabel.trim(), () => setNewLabel(""))
                      }
                      className="h-7 px-3 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConsumableLabelInput({
  label,
  canEdit,
  onRename,
}: {
  label: string;
  canEdit: boolean;
  onRename: (v: string) => void;
}) {
  const [draft, setDraft] = useState(label);
  const [lastLabel, setLastLabel] = useState(label);
  if (label !== lastLabel) {
    setLastLabel(label);
    setDraft(label);
  }
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed.length === 0) {
          setDraft(label); // não permite vazio — reverte
          return;
        }
        if (trimmed !== label) onRename(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(label);
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={!canEdit}
      className="h-7 text-xs font-medium border-transparent hover:border-cream-200 focus:border-rose-300 bg-transparent focus:bg-surface transition-colors"
    />
  );
}

function CostInput({
  item,
  canEdit,
  saving,
  onSave,
}: {
  item: ProductionCostItem;
  canEdit: boolean;
  saving: boolean;
  onSave: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(item.cost.toString().replace(".", ","));
  // Padrão "store info from previous renders" — re-sincroniza o draft local
  // quando a BD muda (ex: outro admin editou) sem useEffect+setState.
  const [lastItemId, setLastItemId] = useState(item.id);
  const [lastCost, setLastCost] = useState(item.cost);
  if (item.id !== lastItemId || item.cost !== lastCost) {
    setLastItemId(item.id);
    setLastCost(item.cost);
    setDraft(item.cost.toString().replace(".", ","));
  }
  return (
    <div className="relative inline-block w-full max-w-[100px]">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        disabled={!canEdit || saving}
        inputMode="decimal"
        className="h-7 w-full pr-5 text-xs font-medium tabular-nums"
        placeholder="0,00"
      />
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-cocoa-500">
        €
      </span>
    </div>
  );
}

// Descrição curta usada nas notificações toast.
function describe(item: ProductionCostItem): string {
  if (item.kind === "photo_print") {
    return `Impressão fotografia ${PRODUCTION_SIZE_LABELS[item.size_key]}`;
  }
  const ft = item.frame_type ?? "";
  const gt = item.glass_type ?? "";
  return `${PRODUCTION_SIZE_LABELS[item.size_key]} · ${PRODUCTION_FRAME_TYPE_LABELS[ft as ProductionFrameType] ?? ft} · ${PRODUCTION_GLASS_TYPE_LABELS[gt as ProductionGlassType] ?? gt}`;
}
