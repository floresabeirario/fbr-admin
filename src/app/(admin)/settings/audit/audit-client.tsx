"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  History,
  Filter,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  User,
  AlertTriangle,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { AuditLogEntry, AuditAction } from "@/types/audit";
import {
  AUDIT_TABLE_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_COLORS,
  diffValues,
} from "@/types/audit";

const ACTION_ICONS: Record<AuditAction, React.ComponentType<{ className?: string }>> = {
  INSERT: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
};

function shortName(email: string | null): string {
  if (!email) return "—";
  if (email.includes("antonio")) return "António";
  if (email.includes("mj")) return "MJ";
  if (email.includes("ana")) return "Ana";
  return email.split("@")[0];
}

interface Props {
  entries: AuditLogEntry[];
  initialTable: string;
  initialAction: string;
  initialSince: string;
  error: string | null;
}

export default function AuditClient({
  entries,
  initialTable,
  initialAction,
  initialSince,
  error,
}: Props) {
  const router = useRouter();
  const [table, setTable] = useState(initialTable);
  const [action, setAction] = useState(initialAction);
  const [since, setSince] = useState(initialSince);
  const [search, setSearch] = useState("");

  function applyFilters() {
    const params = new URLSearchParams();
    if (table) params.set("table", table);
    if (action) params.set("action", action);
    if (since) params.set("since", since);
    const qs = params.toString();
    router.push(`/settings/audit${qs ? "?" + qs : ""}`);
  }

  function clearFilters() {
    setTable("");
    setAction("");
    setSince("");
    setSearch("");
    router.push("/settings/audit");
  }

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        (e.changed_by_email ?? "").toLowerCase().includes(q) ||
        e.record_id.toLowerCase().includes(q) ||
        e.table_name.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const tableOptions = Array.from(
    new Set([
      ...Object.keys(AUDIT_TABLE_LABELS),
      ...entries.map((e) => e.table_name),
    ]),
  ).sort();

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 shadow-sm flex items-center justify-center">
          <History className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-cocoa-900">
            Histórico de alterações
          </h1>
          <p className="text-sm text-cocoa-700">
            Quem alterou o quê e quando — últimas {entries.length} entradas (máx. 200)
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Erro a carregar histórico: {error}
            <div className="text-xs mt-1 text-red-600">
              Verifica se a migração 027 foi corrida no Supabase.
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-2xl border border-cream-200 bg-surface p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-cocoa-700">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Select value={table || "todas"} onValueChange={(v) => setTable(v === "todas" ? "" : v ?? "")}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todas as tabelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as tabelas</SelectItem>
              {tableOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {AUDIT_TABLE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action || "todas"} onValueChange={(v) => setAction(v === "todas" ? "" : v ?? "")}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todas as acções" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as acções</SelectItem>
              <SelectItem value="INSERT">Criado</SelectItem>
              <SelectItem value="UPDATE">Alterado</SelectItem>
              <SelectItem value="DELETE">Apagado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="h-9"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="flex-1 h-9 px-3 rounded-lg bg-btn-primary text-btn-primary-fg text-sm font-medium hover:bg-btn-primary-hover transition-colors"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 px-3 rounded-lg border border-cream-200 text-sm text-cocoa-700 hover:bg-cream-50 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Search inline */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar nas entradas carregadas (email, ID, tabela…)"
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Lista */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-200 bg-cream-50 p-12 text-center space-y-2">
          <History className="h-8 w-8 text-cocoa-500 mx-auto" />
          <p className="text-sm text-cocoa-700">
            Sem entradas para estes filtros.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((e) => (
            <AuditEntry key={e.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const ActionIcon = ACTION_ICONS[entry.action];
  const diffs = entry.action === "UPDATE" ? diffValues(entry.old_values, entry.new_values) : [];
  const tableLabel = AUDIT_TABLE_LABELS[entry.table_name] ?? entry.table_name;

  return (
    <div className="rounded-2xl border border-cream-200 bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-50 transition-colors text-left"
      >
        <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center shrink-0", AUDIT_ACTION_COLORS[entry.action])}>
          <ActionIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-cocoa-900">
              {AUDIT_ACTION_LABELS[entry.action]}
            </span>
            <span className="text-[10px] uppercase tracking-wider rounded-full bg-cream-100 text-cocoa-700 px-1.5 py-0.5 font-bold">
              {tableLabel}
            </span>
            <span className="text-[10px] text-cocoa-500 font-mono truncate">
              {entry.record_id.slice(0, 8)}…
            </span>
          </div>
          <div className="text-xs text-cocoa-700 flex items-center gap-2 mt-0.5">
            <User className="h-3 w-3" />
            <span>{shortName(entry.changed_by_email)}</span>
            <span>·</span>
            <span>{format(parseISO(entry.changed_at), "dd/MM/yyyy HH:mm:ss", { locale: pt })}</span>
            {entry.action === "UPDATE" && diffs.length > 0 && (
              <>
                <span>·</span>
                <span>{diffs.length} campo(s)</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-cocoa-500 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-cream-200 bg-cream-50 p-4 text-xs space-y-2">
          {entry.action === "UPDATE" && diffs.length > 0 ? (
            <>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-700">
                Alterações
              </div>
              <div className="space-y-1.5">
                {diffs.map(({ key, old, new: newV }) => (
                  <div key={key} className="rounded-md bg-surface border border-cream-200 p-2">
                    <div className="font-mono font-semibold text-cocoa-900 text-[11px]">
                      {key}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div className="bg-rose-50 dark:bg-rose-950/30 rounded px-2 py-1 border border-rose-200 dark:border-rose-900">
                        <div className="text-[9px] uppercase text-rose-700 mb-0.5">Antes</div>
                        <pre className="whitespace-pre-wrap break-all text-[11px] text-rose-900 dark:text-rose-200 font-mono">
                          {JSON.stringify(old, null, 2)}
                        </pre>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded px-2 py-1 border border-emerald-200 dark:border-emerald-900">
                        <div className="text-[9px] uppercase text-emerald-700 mb-0.5">Depois</div>
                        <pre className="whitespace-pre-wrap break-all text-[11px] text-emerald-900 dark:text-emerald-200 font-mono">
                          {JSON.stringify(newV, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : entry.action === "INSERT" ? (
            <>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-700">
                Novo registo
              </div>
              <pre className="whitespace-pre-wrap break-all text-[11px] text-cocoa-900 font-mono bg-surface border border-cream-200 rounded p-2">
                {JSON.stringify(entry.new_values, null, 2)}
              </pre>
            </>
          ) : entry.action === "DELETE" ? (
            <>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-700">
                Registo apagado
              </div>
              <pre className="whitespace-pre-wrap break-all text-[11px] text-cocoa-900 font-mono bg-surface border border-rose-200 dark:border-rose-900 rounded p-2">
                {JSON.stringify(entry.old_values, null, 2)}
              </pre>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
