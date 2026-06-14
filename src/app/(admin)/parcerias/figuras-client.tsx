"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/navigation-progress";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Star,
  ExternalLink,
  Loader2,
  AtSign,
  Users2,
  ListChecks,
  CalendarHeart,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  type PublicFigure,
  type FigureStatus,
  FIGURE_STATUS_LABELS,
  FIGURE_STATUS_COLORS,
  FIGURE_STATUS_ORDER,
  FIGURE_TERMINAL_STATUSES,
  FIGURE_PRIORITY_LABELS,
  FIGURE_PRIORITY_COLORS,
  figureDisplayName,
} from "@/types/public-figure";
import {
  groupFiguresByStatus,
  searchFigures,
  figureStats,
  daysUntilEvent,
  daysSinceUpdate,
} from "@/lib/supabase/public-figures";
import { setNavList } from "@/lib/workbench-nav";
import { updateFigureAction } from "./figuras-actions";
import NovaFiguraSheet from "./nova-figura-sheet";

// ── Utilitários ──────────────────────────────────────────────

function formatFollowers(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")}k`;
  return n.toLocaleString("pt-PT");
}

function StatusSelect({
  value,
  onChange,
  busy,
}: {
  value: FigureStatus;
  onChange: (s: FigureStatus) => void;
  busy?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as FigureStatus)} disabled={busy}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-7 text-[11px] font-semibold border rounded-md px-2.5 ${FIGURE_STATUS_COLORS[value]} hover:brightness-95 transition`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (
          <SelectValue labels={FIGURE_STATUS_LABELS} />
        )}
      </SelectTrigger>
      <SelectContent className="rounded-md border border-cream-200">
        {FIGURE_STATUS_ORDER.map((k) => (
          <SelectItem key={k} value={k} className="my-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${FIGURE_STATUS_COLORS[k]}`}>
              {FIGURE_STATUS_LABELS[k]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Aviso de evento próximo (recolha das flores) ─────────────

function EventCell({ figure }: { figure: PublicFigure }) {
  const days = daysUntilEvent(figure.event_date);
  if (figure.event_date === null) return <span className="text-xs text-cocoa-500">—</span>;
  let label = "";
  try {
    label = format(parseISO(figure.event_date), "dd/MM/yyyy", { locale: pt });
  } catch {
    return <span className="text-xs text-cocoa-500">—</span>;
  }
  // Só alerta para figuras ainda em jogo (aceitaram / em produção).
  const inPlay = figure.status === "aceitou" || figure.status === "em_producao";
  const soon = inPlay && days !== null && days >= 0 && days <= 14;
  const past = days !== null && days < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        soon ? "text-rose-700 font-semibold" : past ? "text-cocoa-500" : "text-cocoa-900",
      )}
    >
      <CalendarHeart className={cn("h-3 w-3", soon ? "text-rose-600" : "text-cocoa-500")} />
      {label}
      {soon && <span className="text-[10px]">· {days}d ⚠</span>}
    </span>
  );
}

// ── Linha de figura ──────────────────────────────────────────

function FigureRow({
  figure,
  onOpen,
  isLoading,
}: {
  figure: PublicFigure;
  onOpen: (f: PublicFigure) => void;
  isLoading: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<FigureStatus | null>(null);

  const currentStatus = optimisticStatus ?? figure.status;
  const pendingDeliverables = figure.deliverables.filter((d) => !d.done).length;
  const pendingActions = figure.actions.filter((a) => !a.done).length;

  // Alerta de follow-up: contactada e sem mexer há 7+ dias.
  const staleContact =
    currentStatus === "contactada" && daysSinceUpdate(figure.updated_at) >= 7;

  function changeStatus(s: FigureStatus) {
    if (s === currentStatus) return;
    setOptimisticStatus(s);
    startTransition(async () => {
      try {
        await updateFigureAction(figure.id, { status: s });
        router.refresh();
      } catch (err) {
        console.error(err);
        setOptimisticStatus(null);
      }
    });
  }

  return (
    <tr
      className={cn(
        "border-b border-cream-100 cursor-pointer transition-colors active:bg-cream-200",
        isLoading ? "bg-cream-100/60" : "hover:bg-cream-50",
      )}
      onClick={() => onOpen(figure)}
    >
      <td className="px-4 py-1.5">
        <div className="flex items-start gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882] shrink-0 mt-1" />}
          <div className="min-w-0">
            <div className="font-medium text-sm text-cocoa-900 truncate">{figureDisplayName(figure)}</div>
            {figure.instagram_handle && (
              <div className="text-[11px] text-cocoa-700 truncate inline-flex items-center gap-1">
                <AtSign className="h-3 w-3 shrink-0" />
                @{figure.instagram_handle.replace(/^@/, "")}
                {figure.partner_instagram && (
                  <span className="text-cocoa-500"> · @{figure.partner_instagram.replace(/^@/, "")}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-1.5">
        <span className="inline-flex items-center gap-1 text-xs text-cocoa-900">
          <Users2 className="h-3 w-3 text-cocoa-500" />
          {formatFollowers(figure.followers)}
        </span>
      </td>
      <td className="px-4 py-1.5 hidden lg:table-cell">
        <EventCell figure={figure} />
      </td>
      <td className="px-4 py-1.5">
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
          FIGURE_PRIORITY_COLORS[figure.priority],
        )}>
          {FIGURE_PRIORITY_LABELS[figure.priority]}
        </span>
      </td>
      <td className="px-4 py-1.5 text-center">
        {pendingDeliverables + pendingActions > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <ListChecks className="h-3 w-3" />
            {pendingDeliverables + pendingActions}
          </span>
        ) : (
          <span className="text-xs text-cocoa-500">—</span>
        )}
      </td>
      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <StatusSelect
            value={currentStatus}
            onChange={changeStatus}
            busy={isPending && optimisticStatus !== null}
          />
          {staleContact && (
            <span
              className="inline-flex items-center text-[10px] text-orange-700"
              title={`Contactada há ${daysSinceUpdate} dias sem resposta`}
            >
              <AlertTriangle className="h-3 w-3" />
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-1.5 text-right">
        <button
          className="text-[#C4A882] hover:text-cocoa-900 transition-colors"
          onClick={(e) => { e.stopPropagation(); onOpen(figure); }}
          title="Abrir workbench"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ── Secção de grupo (por estado) ─────────────────────────────

function GroupSection({
  status,
  figures,
  isCollapsed,
  onToggle,
  onOpen,
  loadingId,
}: {
  status: FigureStatus;
  figures: PublicFigure[];
  isCollapsed: boolean;
  onToggle: () => void;
  onOpen: (f: PublicFigure) => void;
  loadingId: string | null;
}) {
  const isEmpty = figures.length === 0;
  return (
    <div className={cn("rounded-xl border border-cream-200 bg-surface overflow-hidden", isEmpty && isCollapsed && "opacity-60")}>
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 transition-colors"
        onClick={onToggle}
      >
        {isCollapsed
          ? <ChevronRight className="h-4 w-4 text-cocoa-700 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-cocoa-700 shrink-0" />}
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", FIGURE_STATUS_COLORS[status])}>
          {FIGURE_STATUS_LABELS[status]}
        </span>
        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-cocoa-700">
          {figures.length}
        </span>
        {isEmpty && <span className="ml-2 text-[11px] text-cocoa-500 italic">sem figuras</span>}
      </button>
      {!isCollapsed && isEmpty && (
        <div className="px-4 py-4 text-center text-[11px] text-cocoa-500 italic border-t border-cream-100">
          Nenhuma figura neste estado.
        </div>
      )}
      {!isCollapsed && figures.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] lg:min-w-[760px] text-left">
            <thead>
              <tr className="border-t border-cream-100 bg-cream-50">
                {["Nome", "Alcance", "Evento", "Prioridade", "Tarefas", "Estado", ""].map((h, i) => (
                  <th key={i} className={cn(
                    "px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide",
                    i === 4 && "text-center",
                    i === 2 && "hidden lg:table-cell",
                  )}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {figures.map((f) => (
                <FigureRow key={f.id} figure={f} onOpen={onOpen} isLoading={loadingId === f.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Mini-painel de métricas ──────────────────────────────────

function MetricsStrip({ figures }: { figures: PublicFigure[] }) {
  const s = figureStats(figures);
  const cards: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: "Contactadas", value: `${s.contacted}`, hint: `de ${s.total}`, icon: Users2 },
    { label: "Taxa de resposta", value: `${s.responseRate}%`, hint: `${s.responded} responderam`, icon: TrendingUp },
    { label: "Taxa de aceitação", value: `${s.acceptanceRate}%`, hint: `${s.accepted} aceitaram`, icon: Star },
    { label: "Alcance publicado", value: formatFollowers(s.reachPublished), hint: `${s.publishedCount} publicaram`, icon: AtSign },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-cream-200 bg-surface px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-cocoa-700">
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold text-cocoa-900 tabular-nums">{c.value}</span>
            {c.hint && <span className="text-[11px] text-cocoa-500">{c.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────

interface Props {
  initialFigures: PublicFigure[];
}

function computeCollapsed(figures: PublicFigure[]): Set<string> {
  const byStatus = groupFiguresByStatus(figures);
  const empty = new Set<string>();
  for (const s of FIGURE_STATUS_ORDER) {
    if (byStatus[s].length === 0) empty.add(s);
  }
  for (const s of FIGURE_TERMINAL_STATUSES) empty.add(s);
  return empty;
}

export default function FigurasClient({ initialFigures }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => computeCollapsed(initialFigures));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();

  const filtered = search.trim() ? searchFigures(initialFigures, search) : initialFigures;
  const grouped = groupFiguresByStatus(filtered);

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function flatIds(): string[] {
    const ids: string[] = [];
    if (grouped.orfas?.length) ids.push(...grouped.orfas.map((f) => f.id));
    for (const s of FIGURE_STATUS_ORDER) ids.push(...grouped[s].map((f) => f.id));
    return ids;
  }

  function openFigure(f: PublicFigure) {
    if (navigatingId) return;
    setNavigatingId(f.id);
    setNavList("public_figures", flatIds());
    startNavigationProgress();
    startNavTransition(() => {
      router.push(`/parcerias/figura/${f.id}`);
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-cream-200 bg-surface shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-cocoa-900">Figuras Públicas</h1>
          <p className="text-xs text-cocoa-700 mt-0.5">
            Influencers e figuras públicas a quem oferecemos a preservação das flores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
            <Input
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 sm:h-8 w-full sm:w-52 text-sm border-cream-200 bg-cream-50 focus:bg-surface"
            />
          </div>
          <Button
            size="sm"
            className="h-9 sm:h-8 bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg gap-1.5"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova figura
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4">
        {initialFigures.length === 0 ? (
          <EmptyState onCreate={() => setSheetOpen(true)} />
        ) : (
          <>
            <MetricsStrip figures={initialFigures} />

            {grouped.orfas.length > 0 && (
              <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 text-xs text-red-800">
                {grouped.orfas.length} figura(s) com estado desconhecido — avisa o programador.
              </div>
            )}

            {FIGURE_STATUS_ORDER.map((s) => (
              <GroupSection
                key={s}
                status={s}
                figures={grouped[s]}
                isCollapsed={collapsedGroups.has(s)}
                onToggle={() => toggleGroup(s)}
                onOpen={openFigure}
                loadingId={navigatingId}
              />
            ))}

            {search.trim() && filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-cocoa-700">
                Sem resultados para &ldquo;{search}&rdquo;.
              </div>
            )}
          </>
        )}
      </div>

      <NovaFiguraSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => {
          setSheetOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-amber-100 mb-4">
        <Star className="h-8 w-8 text-rose-600" />
      </div>
      <h2 className="text-lg font-semibold text-cocoa-900 mb-1">Ainda não há figuras públicas</h2>
      <p className="text-sm text-cocoa-700 max-w-sm">
        Adiciona influencers e figuras públicas (noivas!) a quem queres oferecer a
        preservação das flores, e acompanha o contacto, a oferta e a publicação.
      </p>
      <Button
        className="mt-6 bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg gap-1.5"
        onClick={onCreate}
      >
        <Plus className="h-4 w-4" />
        Adicionar primeira figura
      </Button>
    </div>
  );
}
