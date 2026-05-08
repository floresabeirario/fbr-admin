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
        className={`h-7 text-[11px] font-medium border ${colorClass} rounded-full px-2.5`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (
          <SelectValue labels={PARTNER_STATUS_LABELS} />
        )}
      </SelectTrigger>
      <SelectContent>
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
        "border-b border-[#F0EAE0] cursor-pointer transition-colors",
        isLoading ? "bg-[#F0EAE0]/60" : "hover:bg-[#FDFAF7]"
      )}
      onClick={() => onOpen(partner)}
    >
      <td className="px-4 py-2">
        <div className="flex items-start gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882] shrink-0 mt-1" />}
          <div className="min-w-0">
            <div className="font-medium text-sm text-[#3D2B1F] truncate">{partner.name || "—"}</div>
            {partner.contact_person && (
              <div className="text-[11px] text-[#8B7355] truncate">{partner.contact_person}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-col gap-0.5 text-xs text-[#8B7355]">
          {partner.email && (
            <a
              href={`mailto:${partner.email}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-[#3D2B1F] truncate"
            >
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{partner.email}</span>
            </a>
          )}
          {partner.phones[0] && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {partner.phones[0]}
              {partner.phones.length > 1 && (
                <span className="text-[10px] text-[#B8A99A]">+{partner.phones.length - 1}</span>
              )}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        {partner.location_label ? (
          <span className="inline-flex items-center gap-1 text-xs text-[#3D2B1F]">
            <MapPin className="h-3 w-3 text-[#B8A99A]" />
            {partner.location_label}
          </span>
        ) : (
          <span className="text-xs text-[#B8A99A]">—</span>
        )}
      </td>
      <td className="px-4 py-2">
        {partner.accepts_commission ? (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
            PARTNER_ACCEPTS_COMMISSION_COLORS[partner.accepts_commission]
          )}>
            {PARTNER_ACCEPTS_COMMISSION_LABELS[partner.accepts_commission]}
          </span>
        ) : (
          <span className="text-xs text-[#B8A99A]">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-center">
        {recommended > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Sparkles className="h-3 w-3" />
            {recommended}
          </span>
        ) : (
          <span className="text-xs text-[#B8A99A]">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-center">
        {pendingActions > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
            <ListChecks className="h-3 w-3" />
            {pendingActions}
          </span>
        ) : (
          <span className="text-xs text-[#B8A99A]">—</span>
        )}
      </td>
      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <StatusSelect
          value={currentStatus}
          onChange={changeStatus}
          busy={isPending && optimisticStatus !== null}
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          className="text-[#C4A882] hover:text-[#3D2B1F] transition-colors"
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
  const collapsed = isCollapsed || isEmpty;

  return (
    <div className={cn("rounded-xl border border-[#E8E0D5] bg-white overflow-hidden", isEmpty && "opacity-60")}>
      <button
        className={cn(
          "w-full flex items-center gap-3 px-4 hover:bg-[#FDFAF7] transition-colors",
          isEmpty ? "py-1.5 cursor-default" : "py-2.5"
        )}
        onClick={isEmpty ? undefined : onToggle}
      >
        {isEmpty ? (
          <span className="h-3.5 w-3.5 shrink-0" />
        ) : collapsed ? (
          <ChevronRight className="h-4 w-4 text-[#8B7355] shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#8B7355] shrink-0" />
        )}
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", PARTNER_STATUS_COLORS[status])}>
          {PARTNER_STATUS_LABELS[status]}
        </span>
        <span className="rounded-full bg-[#F0EAE0] px-2 py-0.5 text-xs font-medium text-[#8B7355]">
          {partners.length}
        </span>
        {isEmpty && <span className="ml-1 text-[11px] text-[#B8A99A] italic">vazio</span>}
      </button>
      {!collapsed && partners.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-t border-[#F0EAE0] bg-[#FAF8F5]">
                {["Nome", "Contacto", "Local", "Comissão", "Recom.", "Acções", "Estado", ""].map((h, i) => (
                  <th key={i} className={cn(
                    "px-4 py-2 text-[10px] font-medium text-[#8B7355] uppercase tracking-wider",
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();

  const stats = partnerStats(initialPartners);
  const inCategory = filterByCategory(initialPartners, activeCategory);
  const filtered = search.trim() ? searchPartners(inCategory, search) : inCategory;
  const grouped = groupByStatus(filtered);

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
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E8E0D5] bg-white shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#3D2B1F]">Parcerias</h1>
          <p className="text-xs text-[#8B7355] mt-0.5">
            {stats.total} parceiro{stats.total !== 1 ? "s" : ""} ·{" "}
            {stats.ativos} activo{stats.ativos !== 1 ? "s" : ""}
            {stats.pendingActions > 0 && (
              <> · {stats.pendingActions} acç{stats.pendingActions !== 1 ? "ões" : "ão"} pendente{stats.pendingActions !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A]" />
            <Input
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white"
            />
          </div>
          <Button
            size="sm"
            className="h-8 bg-[#3D2B1F] hover:bg-[#2C1F15] text-white gap-1.5"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo parceiro
          </Button>
        </div>
      </div>

      {/* Sub-tabs (categorias) + view switcher */}
      <div className="flex items-center justify-between gap-4 px-6 pt-4 shrink-0">
        <div className="flex items-center gap-1 rounded-lg border border-[#E8E0D5] bg-white p-1">
          {PARTNER_CATEGORY_ORDER.map((c) => {
            const active = c === activeCategory;
            return (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#3D2B1F] text-white"
                    : "text-[#8B7355] hover:bg-[#FAF8F5] hover:text-[#3D2B1F]"
                )}
              >
                {PARTNER_CATEGORY_LABELS[c]}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? "bg-white/20 text-white" : "bg-[#F0EAE0] text-[#8B7355]"
                )}>
                  {countByCategory[c]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[#E8E0D5] bg-white p-1">
          <button
            onClick={() => setViewMode("tabela")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "tabela"
                ? "bg-[#F0EAE0] text-[#3D2B1F]"
                : "text-[#8B7355] hover:text-[#3D2B1F]"
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
                ? "bg-[#F0EAE0] text-[#3D2B1F]"
                : "text-[#8B7355] hover:text-[#3D2B1F]"
            )}
          >
            <Map className="h-3.5 w-3.5" />
            Mapa
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
        {initialPartners.length === 0 ? (
          <EmptyState category={activeCategory} onCreate={() => setSheetOpen(true)} />
        ) : viewMode === "tabela" ? (
          inCategory.length === 0 ? (
            <EmptyCategory category={activeCategory} onCreate={() => setSheetOpen(true)} />
          ) : (
            <>
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
                <div className="text-center py-12 text-sm text-[#8B7355]">
                  Sem resultados para "{search}".
                </div>
              )}
            </>
          )
        ) : (
          <div className="rounded-xl border border-[#E8E0D5] bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#3D2B1F]">
                Parceiros — {PARTNER_CATEGORY_LABELS[activeCategory]}
              </h2>
              <span className="text-[11px] text-[#8B7355]">{inCategory.length} parceiro{inCategory.length !== 1 ? "s" : ""}</span>
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
      <h2 className="text-lg font-semibold text-[#3D2B1F] mb-1">Ainda não há parcerias</h2>
      <p className="text-sm text-[#8B7355] max-w-sm">
        Adiciona wedding planners, floristas, quintas e outros parceiros recomendadores para acompanhar a relação e a comissão.
      </p>
      <Button
        className="mt-6 bg-[#3D2B1F] hover:bg-[#2C1F15] text-white gap-1.5"
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
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-[#E8E0D5] bg-white">
      <CheckCircle2 className="h-8 w-8 text-[#B8A99A] mb-2" />
      <p className="text-sm text-[#8B7355] max-w-sm mb-4">
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
