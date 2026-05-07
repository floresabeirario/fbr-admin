"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Gift,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupVouchers, isExpiringSoon, isExpired, monthsUntilExpiry } from "@/lib/supabase/vouchers";
import {
  type Voucher,
  type VoucherPaymentStatus,
  type VoucherSendStatus,
  type VoucherUsageStatus,
  VOUCHER_PAYMENT_STATUS_LABELS,
  VOUCHER_PAYMENT_STATUS_COLORS,
  VOUCHER_SEND_STATUS_LABELS,
  VOUCHER_SEND_STATUS_COLORS,
  VOUCHER_USAGE_STATUS_LABELS,
  VOUCHER_USAGE_STATUS_COLORS,
} from "@/types/voucher";
import NovoValeSheet from "./novo-vale-sheet";
import { updateVoucherAction } from "./actions";

// ── Formatação ────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: pt });
  } catch {
    return "—";
  }
}

function formatEuro(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

// ── Selects inline ────────────────────────────────────────────

export function PaymentSelect({
  value,
  onChange,
  busy,
  disabled,
}: {
  value: VoucherPaymentStatus;
  onChange: (s: VoucherPaymentStatus) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const colorClass = VOUCHER_PAYMENT_STATUS_COLORS[value];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VoucherPaymentStatus)} disabled={busy || disabled}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-7 text-[11px] font-medium border ${colorClass} rounded-full px-2.5 ${disabled ? "opacity-70" : ""}`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (
          <SelectValue labels={VOUCHER_PAYMENT_STATUS_LABELS} />
        )}
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(VOUCHER_PAYMENT_STATUS_LABELS) as VoucherPaymentStatus[]).map((k) => (
          <SelectItem key={k} value={k} className="my-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VOUCHER_PAYMENT_STATUS_COLORS[k]}`}>
              {VOUCHER_PAYMENT_STATUS_LABELS[k]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SendSelect({
  value,
  onChange,
  busy,
  disabled,
}: {
  value: VoucherSendStatus;
  onChange: (s: VoucherSendStatus) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const colorClass = VOUCHER_SEND_STATUS_COLORS[value];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VoucherSendStatus)} disabled={busy || disabled}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-7 text-[11px] font-medium border ${colorClass} rounded-full px-2.5 ${disabled ? "opacity-70" : ""}`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (
          <SelectValue labels={VOUCHER_SEND_STATUS_LABELS} />
        )}
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(VOUCHER_SEND_STATUS_LABELS) as VoucherSendStatus[]).map((k) => (
          <SelectItem key={k} value={k} className="my-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VOUCHER_SEND_STATUS_COLORS[k]}`}>
              {VOUCHER_SEND_STATUS_LABELS[k]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function UsageSelect({
  value,
  onChange,
  busy,
  disabled,
}: {
  value: VoucherUsageStatus;
  onChange: (s: VoucherUsageStatus) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const colorClass = VOUCHER_USAGE_STATUS_COLORS[value];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VoucherUsageStatus)} disabled={busy || disabled}>
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-7 text-[11px] font-medium border ${colorClass} rounded-full px-2.5 ${disabled ? "opacity-70" : ""}`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (
          <SelectValue labels={VOUCHER_USAGE_STATUS_LABELS} />
        )}
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(VOUCHER_USAGE_STATUS_LABELS) as VoucherUsageStatus[]).map((k) => (
          <SelectItem key={k} value={k} className="my-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VOUCHER_USAGE_STATUS_COLORS[k]}`}>
              {VOUCHER_USAGE_STATUS_LABELS[k]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Badge do código com botão de copiar ───────────────────────

function CodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#E8E0D5] bg-[#FAF8F5] px-2 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#3D2B1F] hover:border-[#3D2B1F] transition-colors"
      title="Copiar código"
    >
      {code}
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-[#B8A99A]" />}
    </button>
  );
}

// ── Linha de vale ─────────────────────────────────────────────

function VoucherRow({
  voucher,
  onOpen,
  isLoading,
  canEdit,
}: {
  voucher: Voucher;
  onOpen: (v: Voucher) => void;
  isLoading: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<{
    payment?: VoucherPaymentStatus;
    send?: VoucherSendStatus;
    usage?: VoucherUsageStatus;
  }>({});

  const currentPayment = optimistic.payment ?? voucher.payment_status;
  const currentSend = optimistic.send ?? voucher.send_status;
  const currentUsage = optimistic.usage ?? voucher.usage_status;

  const expiringSoon = isExpiringSoon(voucher.expiry_date);
  const expired = isExpired(voucher.expiry_date);
  const months = monthsUntilExpiry(voucher.expiry_date);

  function changePayment(newStatus: VoucherPaymentStatus) {
    if (newStatus === currentPayment) return;
    setOptimistic((p) => ({ ...p, payment: newStatus }));
    startTransition(async () => {
      try {
        await updateVoucherAction(voucher.id, { payment_status: newStatus });
        router.refresh();
      } catch (err) {
        console.error(err);
        setOptimistic((p) => ({ ...p, payment: undefined }));
      }
    });
  }

  function changeSend(newStatus: VoucherSendStatus) {
    if (newStatus === currentSend) return;
    setOptimistic((p) => ({ ...p, send: newStatus }));
    startTransition(async () => {
      try {
        await updateVoucherAction(voucher.id, { send_status: newStatus });
        router.refresh();
      } catch (err) {
        console.error(err);
        setOptimistic((p) => ({ ...p, send: undefined }));
      }
    });
  }

  function changeUsage(newStatus: VoucherUsageStatus) {
    if (newStatus === currentUsage) return;
    setOptimistic((p) => ({ ...p, usage: newStatus }));
    startTransition(async () => {
      try {
        await updateVoucherAction(voucher.id, { usage_status: newStatus });
        router.refresh();
      } catch (err) {
        console.error(err);
        setOptimistic((p) => ({ ...p, usage: undefined }));
      }
    });
  }

  return (
    <tr
      className={`border-b border-[#F0EAE0] cursor-pointer transition-colors ${
        isLoading ? "bg-[#F0EAE0]/60" : "hover:bg-[#FDFAF7]"
      }`}
      onClick={() => onOpen(voucher)}
    >
      <td className="px-4 py-1.5">
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882] shrink-0" />}
          <CodeBadge code={voucher.code} />
        </div>
      </td>
      <td className="px-4 py-1.5">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-[#3D2B1F] truncate">{voucher.sender_name || "—"}</span>
          <span className="text-[11px] text-[#8B7355] truncate">→ {voucher.recipient_name || "—"}</span>
        </div>
      </td>
      <td className="px-4 py-1.5 text-right">
        <span className="text-sm font-semibold text-[#3D2B1F]">{formatEuro(voucher.amount)}</span>
      </td>
      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
        <PaymentSelect value={currentPayment} onChange={changePayment} busy={isPending && !!optimistic.payment} disabled={!canEdit} />
      </td>
      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
        <SendSelect value={currentSend} onChange={changeSend} busy={isPending && !!optimistic.send} disabled={!canEdit} />
      </td>
      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
        <UsageSelect value={currentUsage} onChange={changeUsage} busy={isPending && !!optimistic.usage} disabled={!canEdit} />
      </td>
      <td className="px-4 py-1.5">
        <span
          className={`text-sm ${
            expired ? "text-red-600 font-semibold"
              : expiringSoon ? "text-amber-700 font-medium"
              : "text-[#3D2B1F]"
          }`}
          title={expired ? "Expirado" : expiringSoon ? `Expira em ${months} mês(es)` : undefined}
        >
          {expired && "⚠ "}
          {expiringSoon && !expired && "◐ "}
          {formatDate(voucher.expiry_date)}
        </span>
      </td>
      <td className="px-4 py-1.5 text-right">
        <button
          className="text-[#C4A882] hover:text-[#3D2B1F] transition-colors"
          onClick={(e) => { e.stopPropagation(); onOpen(voucher); }}
          title="Abrir workbench"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ── Secção de grupo ───────────────────────────────────────────

function GroupSection({
  title,
  vouchers,
  colorClass,
  isCollapsed,
  onToggle,
  onOpen,
  loadingId,
  canEdit,
}: {
  title: string;
  vouchers: Voucher[];
  colorClass: string;
  isCollapsed: boolean;
  onToggle: () => void;
  onOpen: (v: Voucher) => void;
  loadingId: string | null;
  canEdit: boolean;
}) {
  const isEmpty = vouchers.length === 0;
  const effectivelyCollapsed = isCollapsed || isEmpty;

  return (
    <div className={`rounded-xl border border-[#E8E0D5] bg-white overflow-hidden ${isEmpty ? "opacity-60" : ""}`}>
      <button
        className={`w-full flex items-center gap-3 px-4 hover:bg-[#FDFAF7] transition-colors ${isEmpty ? "py-1.5 cursor-default" : "py-2.5"}`}
        onClick={isEmpty ? undefined : onToggle}
      >
        {isEmpty ? (
          <span className="h-3.5 w-3.5 shrink-0" />
        ) : effectivelyCollapsed ? (
          <ChevronRight className="h-4 w-4 text-[#8B7355] shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#8B7355] shrink-0" />
        )}
        <span className={`text-sm font-semibold ${colorClass}`}>{title}</span>
        <span className="ml-1 rounded-full bg-[#F0EAE0] px-2 py-0.5 text-xs font-medium text-[#8B7355]">
          {vouchers.length}
        </span>
        {isEmpty && <span className="ml-2 text-[11px] text-[#B8A99A] italic">sem vales</span>}
      </button>
      {!effectivelyCollapsed && vouchers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead>
              <tr className="border-t border-[#F0EAE0] bg-[#FAF8F5]">
                {["Código", "Remetente / Destinatário", "Valor", "Pagamento", "Envio", "Utilização", "Validade", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-2 text-xs font-medium text-[#8B7355] uppercase tracking-wide ${i === 2 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <VoucherRow
                  key={v.id}
                  voucher={v}
                  onOpen={onOpen}
                  isLoading={loadingId === v.id}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

type GroupedVouchers = ReturnType<typeof groupVouchers>;

interface Props {
  initialVouchers: Voucher[];
  initialGrouped: GroupedVouchers;
  canEdit: boolean;
}

export default function ValePresenteClient({ initialVouchers, initialGrouped, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [, startNavTransition] = useTransition();

  const filtered = search.trim()
    ? initialVouchers.filter(
        (v) =>
          v.sender_name.toLowerCase().includes(search.toLowerCase()) ||
          v.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
          v.code.toLowerCase().includes(search.toLowerCase()) ||
          v.sender_email?.toLowerCase().includes(search.toLowerCase())
      )
    : initialVouchers;

  const grouped = search.trim() ? groupVouchers(filtered) : initialGrouped;

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openVoucher(v: Voucher) {
    if (navigatingId) return;
    setNavigatingId(v.id);
    startNavTransition(() => {
      router.push(`/vale-presente/${v.code}`);
    });
  }

  // Métricas rápidas
  const totalActive = initialVouchers.length;
  const totalPagos = initialVouchers.filter((v) => v.payment_status === "100_pago").length;
  const totalValor = initialVouchers
    .filter((v) => v.payment_status === "100_pago")
    .reduce((sum, v) => sum + (v.amount ?? 0), 0);
  const expirandoBreve = initialVouchers.filter(
    (v) => v.payment_status === "100_pago" &&
      v.usage_status === "preservacao_nao_agendada" &&
      isExpiringSoon(v.expiry_date) &&
      !isExpired(v.expiry_date)
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E8E0D5] bg-white shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[#3D2B1F]">Vale-Presente</h1>
          <p className="text-xs text-[#8B7355] mt-0.5">
            {totalActive} vale{totalActive !== 1 ? "s" : ""} · {totalPagos} pago{totalPagos !== 1 ? "s" : ""} · {formatEuro(totalValor)} faturado
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
          {canEdit && (
            <Button
              size="sm"
              className="h-8 bg-[#3D2B1F] hover:bg-[#2C1F15] text-white gap-1.5"
              onClick={() => setSheetOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo vale
            </Button>
          )}
        </div>
      </div>

      {/* Modo leitura banner para viewer */}
      {!canEdit && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Modo leitura — apenas administradores podem editar vales.
        </div>
      )}

      {/* Alerta de vales a expirar */}
      {expirandoBreve > 0 && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {expirandoBreve} vale{expirandoBreve !== 1 ? "s" : ""} pago{expirandoBreve !== 1 ? "s" : ""} ainda sem preservação agendada e a expirar nos próximos 3 meses.
          </span>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
        {initialVouchers.length === 0 ? (
          <EmptyState onCreate={canEdit ? () => setSheetOpen(true) : undefined} />
        ) : (
          <>
            <GroupSection
              title="Pré-reservas"
              vouchers={grouped.pre_reservas}
              colorClass="text-amber-600"
              isCollapsed={collapsedGroups.has("pre_reservas")}
              onToggle={() => toggleGroup("pre_reservas")}
              onOpen={openVoucher}
              loadingId={navigatingId}
              canEdit={canEdit}
            />
            <GroupSection
              title="Reservas"
              vouchers={grouped.reservas}
              colorClass="text-emerald-600"
              isCollapsed={collapsedGroups.has("reservas")}
              onToggle={() => toggleGroup("reservas")}
              onOpen={openVoucher}
              loadingId={navigatingId}
              canEdit={canEdit}
            />
          </>
        )}
      </div>

      {/* Sheet de criação */}
      {canEdit && (
        <NovoValeSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSuccess={() => {
            setSheetOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-rose-100 mb-4">
        <Gift className="h-8 w-8 text-amber-600" />
      </div>
      <h2 className="text-lg font-semibold text-[#3D2B1F] mb-1">Ainda não há vales-presente</h2>
      <p className="text-sm text-[#8B7355] max-w-sm">
        Os vales aparecem aqui quando alguém os compra através do site ou quando os crias manualmente.
      </p>
      {onCreate && (
        <Button
          className="mt-6 bg-[#3D2B1F] hover:bg-[#2C1F15] text-white gap-1.5"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" />
          Criar primeiro vale
        </Button>
      )}
    </div>
  );
}
