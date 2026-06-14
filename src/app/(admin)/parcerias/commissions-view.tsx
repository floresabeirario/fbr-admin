"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Coins,
  Gift,
  Flower2,
  ExternalLink,
  Check,
  Loader2,
  Clock,
} from "lucide-react";
import { formatEUR } from "@/lib/format";
import {
  PARTNER_COMMISSION_STATUS_LABELS,
  PARTNER_COMMISSION_STATUS_COLORS,
} from "@/types/database";
import {
  type CommissionItem,
  groupCommissionsByPartner,
  isCommissionDueNow,
  isCommissionNotYetDue,
  sumCommissions,
} from "@/lib/commissions";
import { markCommissionPaidAction } from "./actions";

function pendingLabel(updatedAt: string): string {
  const days = differenceInDays(new Date(), parseISO(updatedAt));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function CommissionRow({ item }: { item: CommissionItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const href =
    item.kind === "order"
      ? `/preservacao/${item.code}`
      : `/vale-presente/${item.code}`;

  function markPaid() {
    startTransition(async () => {
      try {
        await markCommissionPaidAction(item.kind, item.rowId);
        toast.success("Comissão marcada como paga.");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Não foi possível marcar como paga.",
        );
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50">
      {item.kind === "order" ? (
        <Flower2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />
      ) : (
        <Gift className="h-3.5 w-3.5 text-amber-600 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-cocoa-900 truncate">
          {item.label}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${PARTNER_COMMISSION_STATUS_COLORS[item.status]}`}
          >
            {PARTNER_COMMISSION_STATUS_LABELS[item.status]}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-cocoa-500">
            <Clock className="h-2.5 w-2.5" />
            {pendingLabel(item.updatedAt)}
          </span>
        </div>
      </div>

      <div className="text-sm font-semibold text-cocoa-900 tabular-nums text-right w-20 shrink-0">
        {item.amount != null ? formatEUR(item.amount) : "—"}
      </div>

      <Link
        href={href}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-cream-200 bg-surface text-[11px] font-medium text-cocoa-700 hover:bg-cream-50 shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir
      </Link>
      <button
        onClick={markPaid}
        disabled={isPending}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-emerald-300 bg-emerald-50 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 shrink-0"
        title="Marcar esta comissão como paga"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        Paga
      </button>
    </li>
  );
}

function PartnerGroupCard({
  partnerName,
  partnerId,
  items,
  total,
  showTotal,
}: {
  partnerName: string;
  partnerId: string;
  items: CommissionItem[];
  total: number;
  showTotal: boolean;
}) {
  return (
    <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-cream-100 bg-cream-50">
        <Link
          href={`/parcerias/${partnerId}`}
          className="text-sm font-semibold text-cocoa-900 hover:underline truncate"
        >
          {partnerName}
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-cocoa-700">
            {items.length} comiss{items.length !== 1 ? "ões" : "ão"}
          </span>
          {showTotal && (
            <span className="text-sm font-semibold text-cocoa-900 tabular-nums">
              {formatEUR(total)}
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y divide-cream-100">
        {items.map((item) => (
          <CommissionRow key={`${item.kind}-${item.rowId}`} item={item} />
        ))}
      </ul>
    </div>
  );
}

export default function CommissionsView({
  commissions,
  partnerNameById,
}: {
  commissions: CommissionItem[];
  partnerNameById: Record<string, string>;
}) {
  const dueNow = commissions.filter((c) => isCommissionDueNow(c.status));
  const notYetDue = commissions.filter((c) => isCommissionNotYetDue(c.status));

  const dueGroups = groupCommissionsByPartner(dueNow, partnerNameById);
  const notYetGroups = groupCommissionsByPartner(notYetDue, partnerNameById);
  const totalDue = sumCommissions(dueNow);

  if (commissions.length === 0) {
    return (
      <div className="rounded-xl border border-cream-200 bg-surface p-10 text-center">
        <Coins className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-cocoa-900">
          Sem comissões por saldar
        </p>
        <p className="text-xs text-cocoa-700 mt-1">
          Todas as comissões de parcerias estão pagas ou não aplicáveis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total por pagar */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Total por pagar agora
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              Comissões já devidas — parceiro informado ou a aguardar resposta.
            </p>
          </div>
          <span className="text-2xl font-bold text-amber-900 tabular-nums">
            {formatEUR(totalDue)}
          </span>
        </div>
      </div>

      {/* Por pagar */}
      {dueGroups.length > 0 ? (
        <div className="space-y-3">
          {dueGroups.map((g) => (
            <PartnerGroupCard
              key={g.partnerId}
              partnerId={g.partnerId}
              partnerName={g.partnerName}
              items={g.items}
              total={g.total}
              showTotal
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-cocoa-700 px-1">
          Nenhuma comissão devida de momento. 🎉
        </p>
      )}

      {/* Ainda não devidas */}
      {notYetGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pt-2">
            <Clock className="h-4 w-4 text-cocoa-500" />
            <h3 className="text-sm font-semibold text-cocoa-800">
              Ainda não devidas
            </h3>
            <span className="text-[11px] text-cocoa-500">
              (encomenda do cliente ainda não está paga na totalidade)
            </span>
          </div>
          {notYetGroups.map((g) => (
            <PartnerGroupCard
              key={g.partnerId}
              partnerId={g.partnerId}
              partnerName={g.partnerName}
              items={g.items}
              total={g.total}
              showTotal={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
