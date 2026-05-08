import type {
  Partner,
  PartnerCategory,
  PartnerStatus,
} from "@/types/partner";
import { PARTNER_STATUS_ORDER } from "@/types/partner";

// ── Ordenação ────────────────────────────────────────────────

function byNameAsc(a: Partner, b: Partner): number {
  return a.name.localeCompare(b.name, "pt-PT");
}

// ── Filtragem por categoria ──────────────────────────────────

export function filterByCategory(
  partners: Partner[],
  category: PartnerCategory,
): Partner[] {
  return partners.filter((p) => p.category === category).sort(byNameAsc);
}

// ── Agrupamento por estado (dentro de uma categoria) ─────────

export type GroupedByStatus = Record<PartnerStatus, Partner[]>;

export function groupByStatus(partners: Partner[]): GroupedByStatus {
  const result = Object.fromEntries(
    PARTNER_STATUS_ORDER.map((s) => [s, [] as Partner[]]),
  ) as GroupedByStatus;

  const sorted = [...partners].sort(byNameAsc);
  for (const p of sorted) {
    result[p.status].push(p);
  }
  return result;
}

// ── Estatísticas globais ─────────────────────────────────────

export function partnerStats(partners: Partner[]) {
  const total = partners.length;
  const confirmados = partners.filter((p) => p.status === "confirmado").length;
  const aceites = partners.filter((p) => p.status === "aceite").length;
  const ativos = confirmados + aceites;
  const porContactar = partners.filter((p) => p.status === "por_contactar").length;
  const pendingActions = partners.reduce(
    (sum, p) => sum + p.actions.filter((a) => !a.done).length,
    0,
  );
  return { total, confirmados, aceites, ativos, porContactar, pendingActions };
}

// ── Procura ──────────────────────────────────────────────────

export function searchPartners(partners: Partner[], query: string): Partner[] {
  const q = query.trim().toLowerCase();
  if (!q) return partners;
  return partners.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      (p.contact_person?.toLowerCase().includes(q) ?? false) ||
      (p.email?.toLowerCase().includes(q) ?? false) ||
      (p.location_label?.toLowerCase().includes(q) ?? false) ||
      (p.notes?.toLowerCase().includes(q) ?? false) ||
      p.phones.some((ph) => ph.toLowerCase().includes(q))
    );
  });
}
