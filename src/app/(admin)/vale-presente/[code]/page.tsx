import { createClient } from "@/lib/supabase/server";
import { getCurrentRole, getCurrentEmail } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import type { Voucher, VoucherPaymentStatus } from "@/types/voucher";
import { VOUCHER_PAYMENT_STATUS_LABELS } from "@/types/voucher";
import { STATUS_LABELS, type OrderStatus } from "@/types/database";
import type { Partner } from "@/types/partner";
import type { Task, TaskTemplate } from "@/types/tasks";
import { findDuplicates } from "@/lib/duplicates";
import VoucherWorkbenchClient, { type VoucherDuplicateInfo } from "./workbench-client";

export default async function VoucherWorkbenchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const role = await getCurrentRole();
  const currentEmail = (await getCurrentEmail()) ?? "";

  // Aceita o código curto (6 dígitos) ou o UUID interno.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
  const column = isUuid ? "id" : "code";

  const [voucherRes, partnersRes, templatesRes] = await Promise.all([
    supabase.from("vouchers").select("*").eq(column, code.toUpperCase()).single(),
    supabase
      .from("partners")
      .select("id, name, category, status")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("task_templates")
      .select("*")
      .is("deleted_at", null)
      .in("scope", ["voucher", "both"])
      .order("position", { ascending: true }),
  ]);

  if (voucherRes.error || !voucherRes.data) notFound();

  const partnerOptions = (partnersRes.data ?? []) as Pick<Partner, "id" | "name" | "category" | "status">[];
  const taskTemplates = (templatesRes.data ?? []) as TaskTemplate[];
  const voucher = voucherRes.data as Voucher;

  const { data: tasksData } = await supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .eq("voucher_id", voucher.id)
    .order("created_at", { ascending: false });
  const voucherTasks = (tasksData ?? []) as Task[];

  // Cliente repetido: outros vales E encomendas com o mesmo contacto do
  // remetente. Só informativo (aviso com link, NUNCA bloqueia — regra
  // da Maria). Matching em JS por causa da normalização de telefones.
  let duplicates: VoucherDuplicateInfo[] = [];
  if (voucher.sender_email || voucher.sender_phone) {
    const contact = { email: voucher.sender_email, phone: voucher.sender_phone };
    const [otherVouchersRes, ordersRes] = await Promise.all([
      supabase
        .from("vouchers")
        .select("id, code, sender_email, sender_phone, payment_status")
        .is("deleted_at", null)
        .neq("id", voucher.id),
      supabase
        .from("orders")
        .select("id, order_id, email, phone, status")
        .is("deleted_at", null),
    ]);
    const voucherDups = findDuplicates(
      contact,
      (otherVouchersRes.data ?? []).map((v) => ({
        ...v,
        email: v.sender_email as string | null,
        phone: v.sender_phone as string | null,
      })),
    ).map(({ record, matchedBy }) => ({
      key: `v-${record.id}`,
      href: `/vale-presente/${record.code}`,
      label: `Vale ${record.code} · ${
        VOUCHER_PAYMENT_STATUS_LABELS[record.payment_status as VoucherPaymentStatus] ??
        record.payment_status
      }`,
      matchedBy,
    }));
    const orderDups = findDuplicates(contact, ordersRes.data ?? []).map(
      ({ record, matchedBy }) => ({
        key: `o-${record.id}`,
        href: `/preservacao/${record.order_id}`,
        label: `Encomenda #${String(record.order_id).slice(0, 6)} · ${
          STATUS_LABELS[record.status as OrderStatus] ?? record.status
        }`,
        matchedBy,
      }),
    );
    duplicates = [...voucherDups, ...orderDups];
  }

  return (
    <VoucherWorkbenchClient
      voucher={voucher}
      canEdit={role === "admin"}
      partners={partnerOptions}
      taskTemplates={taskTemplates}
      voucherTasks={voucherTasks}
      currentEmail={currentEmail}
      duplicates={duplicates}
    />
  );
}
