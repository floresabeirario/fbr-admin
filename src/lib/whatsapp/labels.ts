// ============================================================
// Etiquetas (categorias) das conversas de WhatsApp
// ============================================================
// A Maria gere as etiquetas: pode mudar cor/nome das que existem e criar
// novas. Guardadas em system_settings["whatsapp_labels"] como JSON.
//
// Três etiquetas são "automáticas" (auto: true): cliente / lead / cancelado.
// São postas sozinhas a partir do estado da encomenda ligada e não podem ser
// apagadas (o automático precisa delas), mas a cor e o nome são editáveis.
// As restantes são manuais — a Maria põe-nas à mão no seletor de cada conversa.
//
// A `category` da conversa guarda a KEY de uma etiqueta (string). As keys das
// automáticas são fixas ("cliente"/"lead"/"cancelado"); as manuais têm keys
// opacas geradas na criação, para que renomear não parta as referências.

export type LabelColor =
  | "emerald" | "amber" | "sky" | "rose" | "violet" | "cyan"
  | "orange" | "lime" | "slate" | "red" | "teal" | "indigo"
  | "pink" | "fuchsia";

export type WhatsappLabel = {
  key: string;
  name: string;
  color: LabelColor;
  auto?: boolean;
};

// Paleta pronta. As classes são LITERAIS (o Tailwind gera-as ao ler este
// ficheiro) — nunca construir nomes de classes dinamicamente.
export const LABEL_PALETTE: Record<LabelColor, { chip: string; solid: string; name: string }> = {
  emerald: { chip: "bg-emerald-100 text-emerald-700", solid: "bg-emerald-500", name: "Verde" },
  amber: { chip: "bg-amber-100 text-amber-700", solid: "bg-amber-500", name: "Âmbar" },
  sky: { chip: "bg-sky-100 text-sky-700", solid: "bg-sky-500", name: "Azul" },
  rose: { chip: "bg-rose-100 text-rose-700", solid: "bg-rose-500", name: "Rosa" },
  violet: { chip: "bg-violet-100 text-violet-700", solid: "bg-violet-500", name: "Roxo" },
  cyan: { chip: "bg-cyan-100 text-cyan-700", solid: "bg-cyan-500", name: "Ciano" },
  orange: { chip: "bg-orange-100 text-orange-700", solid: "bg-orange-500", name: "Coral" },
  lime: { chip: "bg-lime-100 text-lime-700", solid: "bg-lime-600", name: "Lima" },
  slate: { chip: "bg-slate-200 text-slate-600", solid: "bg-slate-400", name: "Cinza" },
  red: { chip: "bg-red-100 text-red-700", solid: "bg-red-500", name: "Vermelho" },
  teal: { chip: "bg-teal-100 text-teal-700", solid: "bg-teal-500", name: "Teal" },
  indigo: { chip: "bg-indigo-100 text-indigo-700", solid: "bg-indigo-500", name: "Índigo" },
  pink: { chip: "bg-pink-100 text-pink-700", solid: "bg-pink-500", name: "Rosa forte" },
  fuchsia: { chip: "bg-fuchsia-100 text-fuchsia-700", solid: "bg-fuchsia-500", name: "Magenta" },
};

export const PALETTE_ORDER: LabelColor[] = [
  "emerald", "amber", "sky", "rose", "violet", "cyan", "orange",
  "lime", "teal", "indigo", "pink", "fuchsia", "red", "slate",
];

// Keys das etiquetas automáticas (derivadas do estado da encomenda).
export const AUTO_LABEL_KEYS = ["cliente", "lead", "cancelado"] as const;
export type AutoLabelKey = (typeof AUTO_LABEL_KEYS)[number];

export const SETTINGS_KEY = "whatsapp_labels";

export const DEFAULT_WHATSAPP_LABELS: WhatsappLabel[] = [
  { key: "cliente", name: "Cliente", color: "emerald", auto: true },
  { key: "lead", name: "Lead", color: "amber", auto: true },
  { key: "cancelado", name: "Cancelado", color: "slate", auto: true },
  { key: "operacional", name: "Operacional", color: "sky" },
];

function isLabelColor(c: unknown): c is LabelColor {
  return typeof c === "string" && c in LABEL_PALETTE;
}

// Sanitiza a lista vinda da BD e garante que as 3 automáticas existem sempre
// (no início e pela ordem canónica). Entradas inválidas são descartadas.
export function normalizeLabels(raw: unknown): WhatsappLabel[] {
  const arr = Array.isArray(raw) ? raw : [];
  const valid: WhatsappLabel[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const key = typeof rec.key === "string" ? rec.key.trim() : "";
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!key || !name || seen.has(key)) continue;
    const color = isLabelColor(rec.color) ? rec.color : "slate";
    seen.add(key);
    const isAuto = (AUTO_LABEL_KEYS as readonly string[]).includes(key);
    valid.push(isAuto ? { key, name, color, auto: true } : { key, name, color });
  }

  const result: WhatsappLabel[] = [];
  // Automáticas primeiro, na ordem canónica (usa a guardada se existir).
  for (const def of DEFAULT_WHATSAPP_LABELS.filter((l) => l.auto)) {
    const found = valid.find((l) => l.key === def.key);
    result.push(found ? { ...found, auto: true } : def);
  }
  // Depois as manuais, pela ordem guardada.
  for (const l of valid) {
    if (!(AUTO_LABEL_KEYS as readonly string[]).includes(l.key)) result.push(l);
  }
  return result;
}

export function parseLabelsJson(value: string | null | undefined): WhatsappLabel[] {
  if (!value) return DEFAULT_WHATSAPP_LABELS;
  try {
    return normalizeLabels(JSON.parse(value));
  } catch {
    return DEFAULT_WHATSAPP_LABELS;
  }
}

// Devolve a etiqueta pela key; se já não existir (apagada mas ainda referida
// numa conversa), sintetiza uma neutra para não rebentar a UI.
export function resolveLabel(
  key: string,
  byKey: Map<string, WhatsappLabel>,
): WhatsappLabel {
  return byKey.get(key) ?? { key, name: key, color: "slate" };
}

// Key opaca e estável para etiquetas novas (renomear não a muda).
export function newLabelKey(): string {
  return `l_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
