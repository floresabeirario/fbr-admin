"use client";

import { useState } from "react";
import {
  ChevronDown,
  Columns3,
  Filter,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  HOW_FOUND_FBR_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  COUPON_STATUS_LABELS,
  type HowFoundFBR,
  type PaymentStatus,
  type EventType,
  type CouponStatus,
} from "@/types/database";

import {
  COLUMN_LABELS,
  EMPTY_FILTERS,
  OPTIONAL_COLUMNS,
  countActiveFilters,
  makeId,
  type ColumnKey,
  type FilterConfig,
  type SavedView,
} from "@/lib/preservacao-views";

// Estilo partilhado para os 3 triggers da barra (Filtros / Colunas / Vista).
// O `PopoverTrigger` deste projecto não aceita `asChild` (vem de @base-ui/react),
// por isso passamos directamente o className. Aproveitamos para manter a
// aparência alinhada com o `Button variant="outline" size="sm"` mas sem o
// wrapper extra.
const TRIGGER_BASE =
  "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors";
const TRIGGER_NEUTRAL = "border-cream-200 bg-surface text-cocoa-900 hover:bg-cream-50";
const TRIGGER_ACTIVE = "border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100";

interface Props {
  columns: ColumnKey[];
  setColumns: (next: ColumnKey[]) => void;
  filters: FilterConfig;
  setFilters: (next: FilterConfig) => void;
  views: SavedView[];
  setViews: (next: SavedView[]) => void;
  activeViewId: string | null;
  setActiveViewId: (id: string | null) => void;
  partners: { id: string; name: string }[];
}

export function ViewsBar({
  columns,
  setColumns,
  filters,
  setFilters,
  views,
  setViews,
  activeViewId,
  setActiveViewId,
  partners,
}: Props) {
  const activeFiltersCount = countActiveFilters(filters);
  const activeColumnsCount = columns.length;
  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) ?? null : null;

  function toggleColumn(c: ColumnKey) {
    if (columns.includes(c)) setColumns(columns.filter((x) => x !== c));
    else setColumns([...columns, c]);
    setActiveViewId(null);
  }

  function loadView(v: SavedView) {
    setColumns(v.columns);
    setFilters({ ...EMPTY_FILTERS, ...v.filters });
    setActiveViewId(v.id);
  }

  function deleteView(id: string) {
    if (!confirm("Apagar esta vista?")) return;
    setViews(views.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Selector de Vista */}
        <ViewsMenu
          views={views}
          activeView={activeView}
          onLoad={loadView}
          onDelete={deleteView}
          onClear={() => {
            setColumns([]);
            setFilters({ ...EMPTY_FILTERS });
            setActiveViewId(null);
          }}
        />

        {/* Botão Filtros */}
        <FiltersPopover
          filters={filters}
          setFilters={(f) => {
            setFilters(f);
            setActiveViewId(null);
          }}
          partners={partners}
          activeCount={activeFiltersCount}
        />

        {/* Botão Colunas */}
        <ColumnsPopover
          columns={columns}
          onToggle={toggleColumn}
          activeCount={activeColumnsCount}
        />

        {/* Guardar como vista */}
        {(activeFiltersCount > 0 || activeColumnsCount > 0) && !activeViewId && (
          <SaveViewPopover
            currentColumns={columns}
            currentFilters={filters}
            onSave={(name) => {
              const newView: SavedView = {
                id: makeId(),
                name: name.trim(),
                columns: [...columns],
                filters: { ...filters },
              };
              setViews([...views, newView]);
              setActiveViewId(newView.id);
            }}
          />
        )}
      </div>

      {/* Chips de filtros activos */}
      {activeFiltersCount > 0 && (
        <ActiveFilterChips
          filters={filters}
          partners={partners}
          onRemove={(key) => {
            setFilters({ ...filters, [key]: EMPTY_FILTERS[key] });
            setActiveViewId(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Menu de Vistas
// ============================================================

function ViewsMenu({
  views,
  activeView,
  onLoad,
  onDelete,
  onClear,
}: {
  views: SavedView[];
  activeView: SavedView | null;
  onLoad: (v: SavedView) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(TRIGGER_BASE, TRIGGER_NEUTRAL)}
        title="Mudar de vista"
      >
        <span className="text-cocoa-500">Vista:</span>
        <span className="text-cocoa-900">{activeView ? activeView.name : "Todas"}</span>
        <ChevronDown className="h-3 w-3 text-cocoa-500" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <button
          type="button"
          onClick={() => {
            onClear();
            setOpen(false);
          }}
          className={cn(
            "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-cream-50 transition-colors",
            !activeView && "bg-cream-50 font-semibold",
          )}
        >
          <span className="text-cocoa-900">Todas</span>
          <span className="text-[10px] text-cocoa-500">sem filtros</span>
        </button>
        {views.length > 0 && <div className="my-1 border-t border-cream-200" />}
        {views.map((v) => {
          const isActive = activeView?.id === v.id;
          const adjustments = countActiveFilters(v.filters) + v.columns.length;
          return (
            <div
              key={v.id}
              className={cn(
                "group flex items-center gap-1 rounded transition-colors",
                isActive ? "bg-cream-50" : "hover:bg-cream-50",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  onLoad(v);
                  setOpen(false);
                }}
                className="flex-1 text-left px-2 py-1.5 text-xs text-cocoa-900 truncate"
              >
                <span className={cn(isActive && "font-semibold")}>{v.name}</span>
                <span className="ml-1.5 text-[10px] text-cocoa-500">
                  {adjustments} ajuste{adjustments === 1 ? "" : "s"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(v.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-cocoa-500 hover:text-rose-600 transition-all"
                title="Apagar vista"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
        {views.length === 0 && (
          <p className="px-2 py-2 text-[10px] text-cocoa-500 italic">
            Nenhuma vista guardada. Aplica filtros/colunas e usa &ldquo;Guardar
            vista&rdquo; para criar uma.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Popover de Filtros
// ============================================================

function FiltersPopover({
  filters,
  setFilters,
  partners,
  activeCount,
}: {
  filters: FilterConfig;
  setFilters: (f: FilterConfig) => void;
  partners: { id: string; name: string }[];
  activeCount: number;
}) {
  // Narrowing manual: o select de Partner precisa de uma `string` no
  // value. Se for o objecto `{ id }`, extraímos o id. Caso contrário é
  // uma das 3 strings literais.
  const partnerSelectValue =
    typeof filters.partner === "object" ? filters.partner.id : filters.partner;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          TRIGGER_BASE,
          activeCount > 0 ? TRIGGER_ACTIVE : TRIGGER_NEUTRAL,
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        Filtros
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold leading-none">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 space-y-3">
        <FilterRow label="Parceiro">
          <Select
            value={partnerSelectValue}
            onValueChange={(v) => {
              if (!v) return;
              if (v === "any" || v === "with" || v === "without") {
                setFilters({ ...filters, partner: v });
              } else {
                setFilters({ ...filters, partner: { id: v } });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="any">Qualquer</SelectItem>
              <SelectItem value="with">Com parceiro (qualquer)</SelectItem>
              <SelectItem value="without">Sem parceiro</SelectItem>
              {partners.length > 0 && (
                <>
                  <div className="my-1 border-t border-cream-200" />
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </FilterRow>

        <FilterRow label="Origem">
          <Select
            value={filters.origin}
            onValueChange={(v) =>
              setFilters({ ...filters, origin: v as HowFoundFBR | "any" | "missing" })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <SelectItem value="missing">Não preenchido</SelectItem>
              <div className="my-1 border-t border-cream-200" />
              {(Object.keys(HOW_FOUND_FBR_LABELS) as HowFoundFBR[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {HOW_FOUND_FBR_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterRow>

        <FilterRow label="Pagamento">
          <Select
            value={filters.payment}
            onValueChange={(v) =>
              setFilters({ ...filters, payment: v as PaymentStatus | "any" })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <div className="my-1 border-t border-cream-200" />
              {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {PAYMENT_STATUS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterRow>

        <FilterRow label="Tipo de evento">
          <Select
            value={filters.eventType}
            onValueChange={(v) =>
              setFilters({ ...filters, eventType: v as EventType | "any" | "missing" })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <SelectItem value="missing">Não preenchido</SelectItem>
              <div className="my-1 border-t border-cream-200" />
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {EVENT_TYPE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterRow>

        <FilterRow label="Cupão">
          <Select
            value={filters.couponStatus}
            onValueChange={(v) =>
              setFilters({ ...filters, couponStatus: v as CouponStatus | "any" })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <div className="my-1 border-t border-cream-200" />
              {(Object.keys(COUPON_STATUS_LABELS) as CouponStatus[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {COUPON_STATUS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterRow>

        <FilterRow label="NIF">
          <Select
            value={filters.nif}
            onValueChange={(v) =>
              setFilters({ ...filters, nif: v as "any" | "with" | "without" })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer</SelectItem>
              <SelectItem value="with">Com NIF</SelectItem>
              <SelectItem value="without">Sem NIF</SelectItem>
            </SelectContent>
          </Select>
        </FilterRow>

        {activeCount > 0 && (
          <div className="pt-1 border-t border-cream-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-cocoa-700"
              onClick={() => setFilters({ ...EMPTY_FILTERS })}
            >
              Limpar todos os filtros
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <span className="text-xs text-cocoa-700">{label}</span>
      {children}
    </div>
  );
}

// ============================================================
// Popover de Colunas
// ============================================================

function ColumnsPopover({
  columns,
  onToggle,
  activeCount,
}: {
  columns: ColumnKey[];
  onToggle: (c: ColumnKey) => void;
  activeCount: number;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          TRIGGER_BASE,
          activeCount > 0 ? TRIGGER_ACTIVE : TRIGGER_NEUTRAL,
        )}
      >
        <Columns3 className="h-3.5 w-3.5" />
        Colunas
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold leading-none">
            +{activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <p className="px-2 py-1 text-[10px] text-cocoa-500 uppercase tracking-wide">
          Colunas extra
        </p>
        {OPTIONAL_COLUMNS.map((c) => {
          const active = columns.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-cream-50 transition-colors text-left"
            >
              <span
                className={cn(
                  "inline-flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                  active
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-surface border-cream-300",
                )}
              >
                {active && <span className="text-[8px] font-bold leading-none">✓</span>}
              </span>
              <span className="text-cocoa-900">{COLUMN_LABELS[c]}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Popover "Guardar como vista"
// ============================================================

function SaveViewPopover({
  currentColumns,
  currentFilters,
  onSave,
}: {
  currentColumns: ColumnKey[];
  currentFilters: FilterConfig;
  onSave: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const total = currentColumns.length + countActiveFilters(currentFilters);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setName("");
      }}
    >
      <PopoverTrigger
        className={cn(
          TRIGGER_BASE,
          "border-transparent bg-transparent text-cocoa-700 hover:bg-cream-50",
        )}
      >
        <Save className="h-3.5 w-3.5" />
        Guardar vista
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-2">
        <p className="text-xs text-cocoa-700">
          Guardar a combinação actual ({total} ajuste{total === 1 ? "" : "s"}) como
          vista re-utilizável.
        </p>
        <Input
          placeholder="Nome (ex.: Encomendas via Instagram)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-xs"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              onSave(name);
              setOpen(false);
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg"
            disabled={!name.trim()}
            onClick={() => {
              onSave(name);
              setOpen(false);
            }}
          >
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Chips de filtros activos
// ============================================================

function ActiveFilterChips({
  filters,
  partners,
  onRemove,
}: {
  filters: FilterConfig;
  partners: { id: string; name: string }[];
  onRemove: (key: keyof FilterConfig) => void;
}) {
  const chips: Array<{ key: keyof FilterConfig; label: string }> = [];

  // Narrowing manual: extraímos o id para uma const antes da branch para
  // evitar que o TS perca a inferência dentro da árvore JSX.
  const partner = filters.partner;
  if (partner !== "any") {
    let label = "Parceiro: ";
    if (partner === "with") label += "com qualquer";
    else if (partner === "without") label += "sem";
    else label += partners.find((p) => p.id === partner.id)?.name ?? "desconhecido";
    chips.push({ key: "partner", label });
  }
  if (filters.origin !== "any") {
    chips.push({
      key: "origin",
      label:
        "Origem: " +
        (filters.origin === "missing"
          ? "não preenchido"
          : HOW_FOUND_FBR_LABELS[filters.origin]),
    });
  }
  if (filters.payment !== "any") {
    chips.push({
      key: "payment",
      label: "Pagamento: " + PAYMENT_STATUS_LABELS[filters.payment],
    });
  }
  if (filters.eventType !== "any") {
    chips.push({
      key: "eventType",
      label:
        "Tipo: " +
        (filters.eventType === "missing"
          ? "não preenchido"
          : EVENT_TYPE_LABELS[filters.eventType]),
    });
  }
  if (filters.couponStatus !== "any") {
    chips.push({
      key: "couponStatus",
      label: "Cupão: " + COUPON_STATUS_LABELS[filters.couponStatus],
    });
  }
  if (filters.nif !== "any") {
    chips.push({
      key: "nif",
      label: filters.nif === "with" ? "Com NIF" : "Sem NIF",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[11px] font-medium text-indigo-900"
        >
          {c.label}
          <button
            type="button"
            onClick={() => onRemove(c.key)}
            className="text-indigo-600 hover:text-indigo-900"
            aria-label={`Remover filtro ${c.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
