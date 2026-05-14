"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Map,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  Handshake,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  MapPin,
  ListChecks,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportPartnersToCsv } from "@/lib/export-csv";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type Partner,
  type PartnerCategory,
  type PartnerStatus,
  PARTNER_CATEGORY_LABELS,
  PARTNER_CATEGORY_SINGULAR,
  PARTNER_CATEGORY_ORDER,
  PARTNER_STATUS_LABELS,
  PARTNER_STATUS_COLORS,
  PARTNER_STATUS_ORDER,
  PARTNER_ACCEPTS_COMMISSION_LABELS,
  PARTNER_ACCEPTS_COMMISSION_COLORS,
} from "@/types/partner";
import {
  filterByCategory,
  groupByStatus,
  partnerStats,
  searchPartners,
} from "@/lib/supabase/partners";
import { updatePartnerAction } from "./actions";
import NovoParceiroSheet from "./novo-parceiro-sheet";
import PortugalMap from "./portugal-map";

// ── Utilitários ──────────────────────────────────────────────

function StatusSelect({
  value,
  onChange,
  busy,
}: {
  value: PartnerStatus;
  onChange: (s: PartnerStatus) => void;
  busy?: boolean;
}) {
  const colorClass = PARTNER_STATUS_COLORS[value];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PartnerStatus)} disabled={busy}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-7 text-[11px] font-semibold border rounded-md px-2.5 ${colorClass} hover:brightness-95 transition`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (
          <SelectValue labels={PARTNER_STATUS_LABELS} />
        )}
      </SelectTrigger>
      <SelectContent className="rounded-md border border-cream-200">
        {PARTNER_STATUS_ORDER.map((k) => (
          <SelectItem key={k} value={k} className="my-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PARTNER_STATUS_COLORS[k]}`}>
              {PARTNER_STATUS_LABELS[k]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Linha de parceiro ────────────────────────────────────────

function PartnerRow({
  partner,
  onOpen,
  ordersCount,
  vouchersCount,
  isLoading,
}: {
  partner: Partner;
  onOpen: (p: Partner) => void;
  ordersCount: number;
  vouchersCount: number;
  isLoading: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<PartnerStatus | null>(null);

  const currentStatus = optimisticStatus ?? partner.status;
  const pendingActions = partner.actions.filter((a) => !a.done).length;
  const recommended = ordersCount + vouchersCount;

  function changeStatus(s: PartnerStatus) {
    if (s === currentStatus) return;
    setOptimisticStatus(s);
    startTransition(async () => {
      try {
        await updatePartnerAction(partner.id, { status: s });
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
        "border-b border-cream-100 cursor-pointer transition-colors",
        isLoading ? "bg-cream-100/60" : "hover:bg-cream-50"
      )}
      onClick={() => onOpen(partner)}
    >
      <td className="px-4 py-1.5">
        <div className="flex items-start gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882] shrink-0 mt-1" />}
          <div className="min-w-0">
            <div className="font-medium text-sm text-cocoa-900 truncate">{partner.name || "—"}</div>
            {partner.contact_person && (
              <div className="text-[11px] text-cocoa-700 truncate">{partner.contact_person}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-1.5">
        <div className="flex flex-col gap-0.5 text-xs text-cocoa-700">
          {partner.email && (
            <a
              href={`mailto:${partner.email}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-cocoa-900 truncate"
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{partner.email}</span>
            </a>
          )}
          {partner.phones[0] && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {partner.phones[0].label && (
                <span className="text-cocoa-700">{partner.phones[0].label}:</span>
              )}
              {partner.phones[0].number}
              {partner.phones.length > 1 && (
                <span className="text-[10px] text-cocoa-500">+{partner.phones.length - 1}</span>
              )}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-1.5">
        {partner.location_label ? (
          <span className="inline-flex items-center gap-1 text-xs text-cocoa-900">
            <MapPin className="h-3 w-3 text-cocoa-500" />
            {partner.location_label}
          </span>
        ) : (
          <span className="text-xs text-cocoa-500">—</span>
        )}
      </td>
      <td className="px-4 py-1.5">
        {partner.accepts_commission ? (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
            PARTNER_ACCEPTS_COMMISSION_COLORS[partner.accepts_commission]
          )}>
            {PARTNER_ACCEPTS_COMMISSION_LABELS[partner.accepts_commission]}
          </span>
        ) : (
          <span className="text-xs text-cocoa-500">—</span>
        )}
      </td>
      <td className="px-4 py-1.5 text-center">
        {recommended > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Sparkles className="h-3 w-3" />
            {recommended}
          </span>
        ) : (
          <span className="text-xs text-cocoa-500">—</span>
        )}
      </td>
      <td className="px-4 py-1.5 text-center">
        {pendingActions > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <ListChecks className="h-3 w-3" />
            {pendingActions}
          </span>
        ) : (
          <span className="text-xs text-cocoa-500">—</span>
        )}
      </td>
      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
        <StatusSelect
          value={currentStatus}
          onChange={changeStatus}
          busy={isPending && optimisticStatus !== null}
        />
      </td>
      <td className="px-4 py-1.5 text-right">
        <button
          className="text-[#C4A882] hover:text-cocoa-900 transition-colors"
          onClick={(e) => { e.stopPropagation(); onOpen(partner); }}
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
  partners,
  isCollapsed,
  onToggle,
  onOpen,
  ordersCount,
  vouchersCount,
  loadingId,
}: {
  status: PartnerStatus;
  partners: Partner[];
  isCollapsed: boolean;
  onToggle: () => void;
  onOpen: (p: Partner) => void;
  ordersCount: Record<string, number>;
  vouchersCount: Record<string, number>;
  loadingId: string | null;
}) {
  const isEmpty = partners.length === 0;

  return (
    <div className={cn("rounded-xl border border-cream-200 bg-surface overflow-hidden", isEmpty && isCollapsed && "opacity-60")}>
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 transition-colors"
        onClick={onToggle}
      >
        {isCollapsed
          ? <ChevronRight className="h-4 w-4 text-cocoa-700 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-cocoa-700 shrink-0" />
        }
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", PARTNER_STATUS_COLORS[status])}>
          {PARTNER_STATUS_LABELS[status]}
        </span>
        <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-cocoa-700">
          {partners.length}
        </span>
        {isEmpty && <span className="ml-2 text-[11px] text-cocoa-500 italic">sem parceiros</span>}
      </button>
      {!isCollapsed && isEmpty && (
        <div className="px-4 py-4 text-center text-[11px] text-cocoa-500 italic border-t border-cream-100">
          Nenhum parceiro neste estado.
        </div>
      )}
      {!isCollapsed && partners.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left">
            <thead>
              <tr className="border-t border-cream-100 bg-cream-50">
                {["Nome", "Contacto", "Local", "Comissão", "Recom.", "Acções", "Estado", ""].map((h, i) => (
                  <th key={i} className={cn(
                    "px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide",
                    (i === 4 || i === 5) && "text-center"
                  )}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <PartnerRow
                  key={p.id}
                  partner={p}
                  onOpen={onOpen}
                  ordersCount={ordersCount[p.id] ?? 0}
                  vouchersCount={vouchersCount[p.id] ?? 0}
                  isLoading={loadingId === p.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Grupo "Sem grupo" (rede de segurança para estados desconhecidos) ──
// Renderiza a mesma tabela do GroupSection mas com um cabeçalho
// vermelho de alerta em vez do badge de status colorido. Está sempre
// expandido — é deliberadamente impossível esconder.
function OrfasGroupSection({
  partners,
  onOpen,
  ordersCount,
  vouchersCount,
  loadingId,
}: {
  partners: Partner[];
  onOpen: (p: Partner) => void;
  ordersCount: Record<string, number>;
  vouchersCount: Record<string, number>;
  loadingId: string | null;
}) {
  return (
    <div className="rounded-xl border-2 border-red-400 bg-surface overflow-hidden">
      <div className="w-full flex items-center gap-3 px-4 py-2.5 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        <span className="text-xs font-semibold text-red-800 uppercase tracking-wide">
          Sem grupo (estado desconhecido)
        </span>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {partners.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left">
          <thead>
            <tr className="border-t border-cream-100 bg-cream-50">
              {["Nome", "Contacto", "Local", "Comissão", "Recom.", "Acções", "Estado", ""].map((h, i) => (
                <th key={i} className={cn(
                  "px-4 py-2 text-xs font-medium text-cocoa-700 uppercase tracking-wide",
                  (i === 4 || i === 5) && "text-center"
                )}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <PartnerRow
                key={p.id}
                partner={p}
                onOpen={onOpen}
                ordersCount={ordersCount[p.id] ?? 0}
                vouchersCount={vouchersCount[p.id] ?? 0}
                isLoading={loadingId === p.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────

interface Props {
  initialPartners: Partner[];
  ordersCount: Record<string, number>;
  vouchersCount: Record<string, number>;
}

type ViewMode = "tabela" | "mapa";

export default function ParceriasClient({ initialPartners, ordersCount, vouchersCount }: Props) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<PartnerCategory>("wedding_planners");
  const [viewMode, setViewMode] = useState<ViewMode>("tabela");
  const [search, setSearch] = useState("");
  // Grupos vazios começam colapsados por default (o utilizador pode abrir).
  // "rejeitado" também começa colapsado mesmo quando tem parceiros: é o
  // fim-de-linha desta vista — só interessa quando especificamente
  // procurado. Mesmo princípio que "Cancelamentos"/"Concluídos" na
  // Preservação e na Vale-Presente.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const inThisCategory = filterByCategory(initialPartners, "wedding_planners");
    const byStatus = groupByStatus(inThisCategory);
    const empty = new Set<string>();
    for (const s of PARTNER_STATUS_ORDER) {
      if (byStatus[s].length === 0) empty.add(s);
    }
    empty.add("rejeitado");
    return empty;
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();

  const stats = partnerStats(initialPartners);
  const inCategory = filterByCategory(initialPartners, activeCategory);
  const filtered = search.trim() ? searchPartners(inCategory, search) : inCategory;
  const grouped = groupByStatus(filtered);

  // Cada categoria tem distribuição diferente de estados, e o open/close da
  // anterior já não faz sentido. Recalcula o set de vazios para colapsar.
  function changeCategory(c: PartnerCategory) {
    const inNewCategory = filterByCategory(initialPartners, c);
    const byStatus = groupByStatus(inNewCategory);
    const empty = new Set<string>();
    for (const s of PARTNER_STATUS_ORDER) {
      if (byStatus[s].length === 0) empty.add(s);
    }
    empty.add("rejeitado");
    setActiveCategory(c);
    setCollapsedGroups(empty);
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openPartner(p: Partner) {
    if (navigatingId) return;
    setNavigatingId(p.id);
    startNavTransition(() => {
      router.push(`/parcerias/${p.id}`);
    });
  }

  // Conta por categoria para o badge das tabs
  const countByCategory: Record<PartnerCategory, number> = {
    wedding_planners: 0,
    floristas: 0,
    quintas_eventos: 0,
    outros: 0,
  };
  for (const p of initialPartners) countByCategory[p.category]++;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-cream-200 bg-surface shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-cocoa-900">Parcerias</h1>
          <p className="text-xs text-cocoa-700 mt-0.5">
            {stats.total} parceiro{stats.total !== 1 ? "s" : ""} ·{" "}
            {stats.ativos} activo{stats.ativos !== 1 ? "s" : ""}
            {stats.pendingActions > 0 && (
              <> · {stats.pendingActions} acç{stats.pendingActions !== 1 ? "ões" : "ão"} pendente{stats.pendingActions !== 1 ? "s" : ""}</>
            )}
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
          <button
            onClick={() => exportPartnersToCsv(inCategory, activeCategory)}
            className="inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-lg border border-cream-200 bg-surface text-xs font-medium text-cocoa-900 hover:bg-cream-50 transition-colors"
            title="Exportar parceiros desta categoria para Excel/CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <Button
            size="sm"
            className="h-9 sm:h-8 bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg gap-1.5"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo parceiro
          </Button>
        </div>
      </div>

      {/* Sub-tabs (categorias) + view switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-6 pt-3 sm:pt-4 shrink-0">
        <div className="flex items-center gap-1 rounded-lg border border-cream-200 bg-surface p-1">
          {PARTNER_CATEGORY_ORDER.map((c) => {
            const active = c === activeCategory;
            return (
              <button
                key={c}
                onClick={() => changeCategory(c)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-btn-primary text-btn-primary-fg"
                    : "text-cocoa-700 hover:bg-cream-50 hover:text-cocoa-900"
                )}
              >
                {PARTNER_CATEGORY_LABELS[c]}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-cream-100 text-cocoa-700"
                )}>
                  {countByCategory[c]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-cream-200 bg-surface p-1">
          <button
            onClick={() => setViewMode("tabela")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "tabela"
                ? "bg-cream-100 text-cocoa-900"
                : "text-cocoa-700 hover:text-cocoa-900"
            )}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Tabela
          </button>
          <button
            onClick={() => setViewMode("mapa")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "mapa"
                ? "bg-cream-100 text-cocoa-900"
                : "text-cocoa-700 hover:text-cocoa-900"
            )}
          >
            <Map className="h-3.5 w-3.5" />
            Mapa
          </button>
        </div>
      </div>

      {/* Rede de segurança: banner global se houver parceiros com estado
          desconhecido (mesmo padrão da Preservação e da Vale-Presente). */}
      {grouped.orfas.length > 0 && (
        <div className="mx-6 mt-4 rounded-xl border-2 border-red-400 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">
                {grouped.orfas.length} parceiro{grouped.orfas.length !== 1 ? "s" : ""} com estado desconhecido nesta categoria
              </p>
              <p className="text-xs text-red-700 mt-1">
                Estes parceiros têm um estado na base de dados que o código
                ainda não reconhece. Continuam visíveis abaixo em &ldquo;Sem
                grupo&rdquo; para nunca se perderem. Avisa o programador.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4">
        {initialPartners.length === 0 ? (
          <EmptyState category={activeCategory} onCreate={() => setSheetOpen(true)} />
        ) : viewMode === "tabela" ? (
          inCategory.length === 0 ? (
            <EmptyCategory category={activeCategory} onCreate={() => setSheetOpen(true)} />
          ) : (
            <>
              {grouped.orfas.length > 0 && (
                <OrfasGroupSection
                  partners={grouped.orfas}
                  onOpen={openPartner}
                  ordersCount={ordersCount}
                  vouchersCount={vouchersCount}
                  loadingId={navigatingId}
                />
              )}
              {PARTNER_STATUS_ORDER.map((s) => (
                <GroupSection
                  key={s}
                  status={s}
                  partners={grouped[s]}
                  isCollapsed={collapsedGroups.has(s)}
                  onToggle={() => toggleGroup(s)}
                  onOpen={openPartner}
                  ordersCount={ordersCount}
                  vouchersCount={vouchersCount}
                  loadingId={navigatingId}
                />
              ))}
              {search.trim() && filtered.length === 0 && (
                <div className="text-center py-12 text-sm text-cocoa-700">
                  Sem resultados para &ldquo;{search}&rdquo;.
                </div>
              )}
            </>
          )
        ) : (
          <div className="rounded-xl border border-cream-200 bg-surface p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cocoa-900">
                Parceiros — {PARTNER_CATEGORY_LABELS[activeCategory]}
              </h2>
              <span className="text-[11px] text-cocoa-700">{inCategory.length} parceiro{inCategory.length !== 1 ? "s" : ""}</span>
            </div>
            <PortugalMap partners={inCategory} onSelect={openPartner} selectedId={navigatingId} />
          </div>
        )}
      </div>

      {/* Sheet de criação */}
      <NovoParceiroSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultCategory={activeCategory}
        onSuccess={() => {
          setSheetOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

// ── Empty states ─────────────────────────────────────────────

function EmptyState({ category, onCreate }: { category: PartnerCategory; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-amber-100 mb-4">
        <Handshake className="h-8 w-8 text-rose-600" />
      </div>
      <h2 className="text-lg font-semibold text-cocoa-900 mb-1">Ainda não há parcerias</h2>
      <p className="text-sm text-cocoa-700 max-w-sm">
        Adiciona wedding planners, floristas, quintas e outros parceiros recomendadores para acompanhar a relação e a comissão.
      </p>
      <Button
        className="mt-6 bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg gap-1.5"
        onClick={onCreate}
      >
        <Plus className="h-4 w-4" />
        Adicionar primeiro {PARTNER_CATEGORY_SINGULAR[category].toLowerCase()}
      </Button>
    </div>
  );
}

function EmptyCategory({ category, onCreate }: { category: PartnerCategory; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-cream-200 bg-surface">
      <CheckCircle2 className="h-8 w-8 text-cocoa-500 mb-2" />
      <p className="text-sm text-cocoa-700 max-w-sm mb-4">
        Ainda não há {PARTNER_CATEGORY_LABELS[category].toLowerCase()} cadastrados.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={onCreate}
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar {PARTNER_CATEGORY_SINGULAR[category].toLowerCase()}
      </Button>
    </div>
  );
}
