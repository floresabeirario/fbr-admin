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

export type GroupedByStatus = Record<PartnerStatus, Partner[]> & {
  // Parceiros com estado desconhecido (BD↔código fora de sincronia).
  // Mesma rede de segurança das encomendas e vales — nunca esconder
  // silenciosamente. A UI mostra-os num grupo "Sem grupo" vermelho.
  orfas: Partner[];
};

export function groupByStatus(partners: Partner[]): GroupedByStatus {
  // PARTNER_STATUS_ORDER é `PartnerStatus[]` — o cast abaixo confia que
  // está sincronizado com o tipo. Se algum dia for adicionado um
  // PartnerStatus novo e esquecido em PARTNER_STATUS_ORDER, o
  // `Record<PartnerStatus, …>` cá em baixo dá erro de compilação por
  // chaves em falta. Não substituir por Partial.
  const knownStatuses = new Set<string>(PARTNER_STATUS_ORDER);
  const result: GroupedByStatus = {
    ...(Object.fromEntries(
      PARTNER_STATUS_ORDER.map((s) => [s, [] as Partner[]]),
    ) as Record<PartnerStatus, Partner[]>),
    orfas: [],
  };

  const sorted = [...partners].sort(byNameAsc);
  for (const p of sorted) {
    if (!knownStatuses.has(p.status)) {
      result.orfas.push(p);
      if (typeof window !== "undefined" && typeof console !== "undefined") {
        console.error(
          `[partners] Parceiro ${p.name} tem estado desconhecido "${p.status}". ` +
            `Adicione-o a PARTNER_STATUS_ORDER em types/partner.ts.`,
        );
      }
      continue;
    }
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
      p.phones.some(
        (ph) =>
          ph.number.toLowerCase().includes(q) ||
          (ph.label?.toLowerCase().includes(q) ?? false)
      )
    );
  });
}
