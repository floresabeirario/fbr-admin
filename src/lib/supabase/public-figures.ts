import type { PublicFigure, FigureStatus } from "@/types/public-figure";
import { FIGURE_STATUS_ORDER } from "@/types/public-figure";

// ── Ordenação ────────────────────────────────────────────────
// Prioridade primeiro (alta → baixa), depois nome.

const PRIORITY_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

function byPriorityThenName(a: PublicFigure, b: PublicFigure): number {
  const pa = PRIORITY_RANK[a.priority] ?? 1;
  const pb = PRIORITY_RANK[b.priority] ?? 1;
  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name, "pt-PT");
}

// ── Agrupamento por estado ───────────────────────────────────

export type FiguresGroupedByStatus = Record<FigureStatus, PublicFigure[]> & {
  // Rede de segurança: figuras com estado desconhecido (BD↔código fora de
  // sincronia). Nunca esconder silenciosamente.
  orfas: PublicFigure[];
};

export function groupFiguresByStatus(figures: PublicFigure[]): FiguresGroupedByStatus {
  const known = new Set<string>(FIGURE_STATUS_ORDER);
  const result: FiguresGroupedByStatus = {
    ...(Object.fromEntries(
      FIGURE_STATUS_ORDER.map((s) => [s, [] as PublicFigure[]]),
    ) as Record<FigureStatus, PublicFigure[]>),
    orfas: [],
  };

  const sorted = [...figures].sort(byPriorityThenName);
  for (const f of sorted) {
    if (!known.has(f.status)) {
      result.orfas.push(f);
      continue;
    }
    result[f.status].push(f);
  }
  return result;
}

// ── Procura ──────────────────────────────────────────────────

export function searchFigures(figures: PublicFigure[], query: string): PublicFigure[] {
  const q = query.trim().toLowerCase();
  if (!q) return figures;
  return figures.filter((f) => {
    return (
      f.name.toLowerCase().includes(q) ||
      (f.instagram_handle?.toLowerCase().includes(q) ?? false) ||
      (f.tiktok_handle?.toLowerCase().includes(q) ?? false) ||
      (f.email?.toLowerCase().includes(q) ?? false) ||
      (f.agency_name?.toLowerCase().includes(q) ?? false) ||
      (f.notes?.toLowerCase().includes(q) ?? false) ||
      f.tags.some((t) => t.toLowerCase().includes(q)) ||
      f.phones.some(
        (ph) =>
          ph.number.toLowerCase().includes(q) ||
          (ph.label?.toLowerCase().includes(q) ?? false),
      )
    );
  });
}

// ── Métricas (mini-painel) ───────────────────────────────────
// "Contactada+" = já lhe falámos (qualquer estado excepto por_contactar).
// "Respondeu" = saiu de "contactada"/"sem_resposta" (em_conversa em diante
//   ou recusou — houve resposta).
// "Aceitou" = aceitou / em_producao / concluida.
// "Alcance publicado" = soma de seguidores das que já publicaram (concluida).

const RESPONDED: FigureStatus[] = ["em_conversa", "aceitou", "em_producao", "concluida", "recusou"];
const ACCEPTED: FigureStatus[] = ["aceitou", "em_producao", "concluida"];

export function figureStats(figures: PublicFigure[]) {
  const total = figures.length;
  const porContactar = figures.filter((f) => f.status === "por_contactar").length;
  const contacted = total - porContactar;
  const responded = figures.filter((f) => RESPONDED.includes(f.status)).length;
  const accepted = figures.filter((f) => ACCEPTED.includes(f.status)).length;
  const published = figures.filter((f) => f.status === "concluida");
  const reachPublished = published.reduce((s, f) => s + (f.followers ?? 0), 0);

  const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;
  const acceptanceRate = contacted > 0 ? Math.round((accepted / contacted) * 100) : 0;

  const pendingDeliverables = figures.reduce(
    (sum, f) => sum + f.deliverables.filter((d) => !d.done).length,
    0,
  );

  return {
    total,
    porContactar,
    contacted,
    responded,
    accepted,
    publishedCount: published.length,
    reachPublished,
    responseRate,
    acceptanceRate,
    pendingDeliverables,
  };
}

// ── Alerta de proximidade do evento (recolha das flores) ─────
// Devolve o nº de dias até ao casamento (negativo se já passou),
// ou null se não houver data.

export function daysUntilEvent(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ev = new Date(eventDate);
  ev.setHours(0, 0, 0, 0);
  return Math.round((ev.getTime() - today.getTime()) / 86_400_000);
}
