"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Search,
  ExternalLink,
  Pencil,
  Loader2,
  RotateCcw,
  Settings2,
  Eye,
  EyeOff,
  Globe,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Order,
  type PublicStatusLanguage,
  PUBLIC_STATUS_LANGUAGE_LABELS,
} from "@/types/database";
import {
  ALL_PUBLIC_PHASES,
  PUBLIC_PHASE_COLORS,
  PUBLIC_PHASE_LABEL_PT,
  PUBLIC_PHASE_LABEL_EN,
  STATUS_TO_PUBLIC_PHASE,
  publicStatusUrl,
  resolveMessage,
  formatPublicEstimatedDelivery,
  type PartialPublicMessages,
  type PublicPhase,
} from "@/lib/public-status";
import { updateOrderPublicStatusAction } from "./actions";

// ── Helpers ──────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: pt });
  } catch {
    return "—";
  }
}


function toDateInput(d: string | null): string {
  if (!d) return "";
  try {
    return format(parseISO(d), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

// Mostra uma versão curta da mensagem para preview na tabela.
function preview(s: string | null | undefined, fallback: string): string {
  const text = (s && s.trim()) || fallback;
  return text.length > 70 ? text.slice(0, 70) + "…" : text;
}

// ── Componente principal ────────────────────────────────────

export default function StatusClient({
  initialOrders,
  initialDefaults,
  canEdit,
}: {
  initialOrders: Order[];
  initialDefaults: PartialPublicMessages;
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<"todas" | PublicPhase>("todas");
  const [hideArchived, setHideArchived] = useState(true); // esconde concluídos + cancelados
  const [editing, setEditing] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = initialOrders.filter((o) => {
      const phase = STATUS_TO_PUBLIC_PHASE[o.status];
      if (hideArchived && (phase === 12 || phase === "cancelada")) return false;
      if (phaseFilter !== "todas" && phase !== phaseFilter) return false;
      if (!term) return true;
      return (
        o.client_name.toLowerCase().includes(term) ||
        o.order_id.toLowerCase().includes(term) ||
        (o.email ?? "").toLowerCase().includes(term)
      );
    });
    // Ordena por data do evento ascendente — mais próxima primeiro; sem data fica no fim.
    return list.sort((a, b) => {
      if (!a.event_date && !b.event_date) return 0;
      if (!a.event_date) return 1;
      if (!b.event_date) return -1;
      return a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : 0;
    });
  }, [initialOrders, search, phaseFilter, hideArchived]);

  // Estatísticas para os chips de filtro
  const phaseCounts = useMemo(() => {
    const counts = new Map<PublicPhase, number>();
    for (const o of initialOrders) {
      const p = STATUS_TO_PUBLIC_PHASE[o.status];
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return counts;
  }, [initialOrders]);

  return (
    <div className="p-6 lg:p-8 space-y-5">
      {!canEdit && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Modo leitura.</strong> Não tens permissão para editar mensagens públicas.
          </span>
        </div>
      )}
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-['TanMemories'] text-3xl text-[#3D2B1F] dark:text-[#E8D5B5]">
            Status
          </h1>
          <p className="mt-1 text-sm text-[#8B7355] dark:text-[#8E8E93] max-w-2xl">
            Gere o que cada cliente vê em{" "}
            <a
              href="https://status.floresabeirario.pt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 hover:underline"
            >
              status.floresabeirario.pt
            </a>
            . A fase pública é calculada automaticamente a partir do estado interno;
            a mensagem e o idioma podem ser personalizados por encomenda.
          </p>
        </div>
        {canEdit && (
          <Link href="/status/mensagens-default">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Mensagens default
            </Button>
          </Link>
        )}
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#B8A99A]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nome, ID, email…"
            className="pl-9 bg-white"
          />
        </div>

        <Select
          value={String(phaseFilter)}
          onValueChange={(v) =>
            setPhaseFilter(v === "todas" ? "todas" : (isNaN(Number(v)) ? (v as PublicPhase) : (Number(v) as PublicPhase)))
          }
        >
          <SelectTrigger className="w-[260px] bg-white">
            <SelectValue placeholder="Filtrar por fase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as fases</SelectItem>
            {ALL_PUBLIC_PHASES.map((p) => (
              <SelectItem key={String(p)} value={String(p)}>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PUBLIC_PHASE_COLORS[p]}`}
                >
                  {p === "cancelada" ? "—" : p}
                </span>
                <span className="text-xs">{PUBLIC_PHASE_LABEL_PT[p]}</span>
                {phaseCounts.has(p) && (
                  <span className="ml-auto text-[10px] text-[#B8A99A]">
                    {phaseCounts.get(p)}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setHideArchived((v) => !v)}
          className="gap-2"
        >
          {hideArchived ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {hideArchived ? "Mostrar concluídas/canceladas" : "Esconder concluídas/canceladas"}
        </Button>

        <span className="ml-auto text-xs text-[#B8A99A]">
          {filtered.length} {filtered.length === 1 ? "encomenda" : "encomendas"}
        </span>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-[#E8E0D5] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#FAF8F5] border-b border-[#E8E0D5]">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-[#8B7355]">
                <th className="text-left px-4 py-2.5">ID / Cliente</th>
                <th className="text-left px-3 py-2.5">Fase pública</th>
                <th className="text-left px-3 py-2.5">Idioma</th>
                <th className="text-left px-3 py-2.5">Mensagem PT</th>
                <th className="text-left px-3 py-2.5">Mensagem EN</th>
                <th className="text-left px-3 py-2.5">Data prevista</th>
                <th className="text-left px-3 py-2.5">Última atualização</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-[#B8A99A]">
                    Sem encomendas para mostrar.
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <StatusRow
                  key={o.id}
                  order={o}
                  defaults={initialDefaults}
                  onEdit={() => setEditing(o)}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo de edição */}
      {editing && (
        <EditMessagesDialog
          order={editing}
          defaults={initialDefaults}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── Linha da tabela ─────────────────────────────────────────

function StatusRow({
  order,
  defaults,
  onEdit,
  canEdit,
}: {
  order: Order;
  defaults: PartialPublicMessages;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticLang, setOptimisticLang] = useState<PublicStatusLanguage | null>(null);
  const [optimisticDate, setOptimisticDate] = useState<string | null | undefined>(undefined);

  const phase = STATUS_TO_PUBLIC_PHASE[order.status];
  const lang = optimisticLang ?? order.public_status_language;
  const estDate = optimisticDate === undefined ? order.estimated_delivery_date : optimisticDate;

  function changeLang(v: PublicStatusLanguage) {
    if (v === lang) return;
    setOptimisticLang(v);
    startTransition(async () => {
      try {
        await updateOrderPublicStatusAction(order.id, { public_status_language: v });
        router.refresh();
      } catch {
        setOptimisticLang(null);
      }
    });
  }

  function changeDate(v: string) {
    const next = v || null;
    if (next === estDate) return;
    setOptimisticDate(next);
    startTransition(async () => {
      try {
        await updateOrderPublicStatusAction(order.id, { estimated_delivery_date: next });
        router.refresh();
      } catch {
        setOptimisticDate(undefined);
      }
    });
  }

  const ptDefault = resolveMessage(phase, "pt", null, defaults);
  const enDefault = resolveMessage(phase, "en", null, defaults);
  const ptIsCustom = !!order.public_status_message_pt?.trim();
  const enIsCustom = !!order.public_status_message_en?.trim();

  return (
    <tr className="border-b border-[#F0EAE0] hover:bg-[#FDFAF7] transition-colors">
      {/* ID + Cliente */}
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-[#3D2B1F]">{order.client_name || "—"}</div>
        <a
          href={publicStatusUrl(order.order_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-700 hover:underline mt-0.5"
          title="Abrir página pública"
        >
          {order.order_id}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </td>

      {/* Fase pública */}
      <td className="px-3 py-3 align-top">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PUBLIC_PHASE_COLORS[phase]}`}
        >
          {phase !== "cancelada" && <span className="opacity-60">{phase}</span>}
          {PUBLIC_PHASE_LABEL_PT[phase]}
        </span>
      </td>

      {/* Idioma */}
      <td className="px-3 py-3 align-top">
        <Select value={lang} onValueChange={(v) => changeLang(v as PublicStatusLanguage)} disabled={isPending || !canEdit}>
          <SelectTrigger className="h-7 text-xs w-[130px] bg-white">
            {isPending && optimisticLang !== null ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <SelectValue labels={PUBLIC_STATUS_LANGUAGE_LABELS} />
            )}
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PUBLIC_STATUS_LANGUAGE_LABELS) as PublicStatusLanguage[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PUBLIC_STATUS_LANGUAGE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Mensagem PT */}
      <td className="px-3 py-3 align-top max-w-[320px]">
        <button
          onClick={onEdit}
          disabled={!canEdit}
          className="text-left text-xs text-[#3D2B1F] hover:text-sky-700 transition-colors flex items-start gap-1.5 group disabled:hover:text-[#3D2B1F] disabled:cursor-default"
          title={canEdit ? "Editar mensagens" : "Modo leitura"}
        >
          <span className="leading-relaxed">{preview(order.public_status_message_pt, ptDefault)}</span>
          {ptIsCustom && (
            <span className="shrink-0 mt-0.5 inline-flex items-center" title="Mensagem personalizada">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            </span>
          )}
          {canEdit && <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 mt-0.5" />}
        </button>
      </td>

      {/* Mensagem EN */}
      <td className="px-3 py-3 align-top max-w-[320px]">
        <button
          onClick={onEdit}
          disabled={!canEdit}
          className="text-left text-xs text-[#3D2B1F] hover:text-sky-700 transition-colors flex items-start gap-1.5 group disabled:hover:text-[#3D2B1F] disabled:cursor-default"
          title={canEdit ? "Editar mensagens" : "Modo leitura"}
        >
          <span className="leading-relaxed">{preview(order.public_status_message_en, enDefault)}</span>
          {enIsCustom && (
            <span className="shrink-0 mt-0.5 inline-flex items-center" title="Mensagem personalizada">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            </span>
          )}
          {canEdit && <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60 mt-0.5" />}
        </button>
      </td>

      {/* Data prevista */}
      <td className="px-3 py-3 align-top">
        <Input
          type="date"
          value={toDateInput(estDate)}
          onChange={(e) => changeDate(e.target.value)}
          className="h-7 text-xs w-[140px] bg-white"
          disabled={isPending || !canEdit}
        />
        {estDate && (
          <p
            className="mt-1 text-[10px] text-[#B8A99A]"
            title="Cliente vê só mês e ano"
          >
            Cliente vê: <span className="text-[#8B7355] font-medium">{formatPublicEstimatedDelivery(estDate, "pt")}</span>
          </p>
        )}
      </td>

      {/* Última atualização */}
      <td className="px-3 py-3 align-top text-xs text-[#8B7355] whitespace-nowrap">
        {formatDate(order.public_status_updated_at)}
      </td>

      {/* Acções */}
      <td className="px-4 py-3 align-top text-right">
        <div className="inline-flex items-center gap-1">
          <a
            href={publicStatusUrl(order.order_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#8B7355] hover:bg-sky-50 hover:text-sky-700 transition-colors"
            title="Ver página pública"
          >
            <Globe className="h-3.5 w-3.5" />
          </a>
          <Link
            href={`/preservacao/${order.order_id}`}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#8B7355] hover:bg-[#F0EAE0] hover:text-[#3D2B1F] transition-colors"
            title="Abrir workbench"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Diálogo de edição de mensagens ──────────────────────────

function EditMessagesDialog({
  order,
  defaults,
  onClose,
}: {
  order: Order;
  defaults: PartialPublicMessages;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const phase = STATUS_TO_PUBLIC_PHASE[order.status];

  const ptDefault = resolveMessage(phase, "pt", null, defaults);
  const enDefault = resolveMessage(phase, "en", null, defaults);

  const [pt, setPt] = useState(order.public_status_message_pt ?? "");
  const [en, setEn] = useState(order.public_status_message_en ?? "");

  const ptOverride = pt.trim().length > 0;
  const enOverride = en.trim().length > 0;

  function save() {
    startTransition(async () => {
      try {
        await updateOrderPublicStatusAction(order.id, {
          public_status_message_pt: ptOverride ? pt : null,
          public_status_message_en: enOverride ? en : null,
        });
        router.refresh();
        onClose();
      } catch (err) {
        console.error(err);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-sky-600" />
            Mensagem pública — {order.client_name}
          </DialogTitle>
          <DialogDescription>
            Fase pública{" "}
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border ${PUBLIC_PHASE_COLORS[phase]}`}
            >
              {phase !== "cancelada" && `${phase} · `}
              {PUBLIC_PHASE_LABEL_PT[phase]} / {PUBLIC_PHASE_LABEL_EN[phase]}
            </span>
            . Deixa em branco para usar a mensagem default.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* PT */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8B7355]">
                🇵🇹 Português
              </label>
              {ptOverride && (
                <button
                  onClick={() => setPt("")}
                  className="text-[11px] text-[#8B7355] hover:text-rose-600 inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Voltar ao default
                </button>
              )}
            </div>
            <Textarea
              value={pt}
              onChange={(e) => setPt(e.target.value)}
              placeholder={ptDefault}
              rows={4}
              className="text-sm"
            />
            {!ptOverride && (
              <p className="mt-1.5 text-[11px] text-[#B8A99A] italic">
                A usar default: <span className="text-[#8B7355]">{ptDefault}</span>
              </p>
            )}
          </div>

          {/* EN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#8B7355]">
                🇬🇧 English
              </label>
              {enOverride && (
                <button
                  onClick={() => setEn("")}
                  className="text-[11px] text-[#8B7355] hover:text-rose-600 inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Back to default
                </button>
              )}
            </div>
            <Textarea
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder={enDefault}
              rows={4}
              className="text-sm"
            />
            {!enOverride && (
              <p className="mt-1.5 text-[11px] text-[#B8A99A] italic">
                Using default: <span className="text-[#8B7355]">{enDefault}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

