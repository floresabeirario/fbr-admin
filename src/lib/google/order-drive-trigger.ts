import "server-only";
import { ensureOrderFolder, ensureVoucherFolder } from "./drive";
import { loadIntegration } from "./oauth";
import { createClient } from "@/lib/supabase/server";
import type { PaymentStatus, Order } from "@/types/database";
import type { VoucherPaymentStatus } from "@/types/voucher";

/**
 * Devolve true sse a transição de pagamento é o "1º pagamento" — o ponto
 * onde queremos criar a pasta na Drive. Para encomendas isso significa
 * passar de `100_por_pagar` para qualquer outro estado (`30_pago`,
 * `70_pago`, `100_pago`). Para vales só existe `100_por_pagar`→`100_pago`.
 */
function isFirstPayment<T extends string>(prev: T, next: T, unpaidValue: T): boolean {
  return prev === unpaidValue && next !== unpaidValue;
}

export function isFirstOrderPayment(
  prev: PaymentStatus | null | undefined,
  next: PaymentStatus | null | undefined,
): boolean {
  if (!prev || !next) return false;
  return isFirstPayment(prev, next, "100_por_pagar");
}

export function isFirstVoucherPayment(
  prev: VoucherPaymentStatus | null | undefined,
  next: VoucherPaymentStatus | null | undefined,
): boolean {
  if (!prev || !next) return false;
  return isFirstPayment(prev, next, "100_por_pagar");
}

async function isGoogleConnected(): Promise<boolean> {
  try {
    const integration = await loadIntegration();
    return !!integration?.refresh_token;
  } catch {
    return false;
  }
}

/**
 * Cria a pasta da encomenda na Drive (se ainda não existir) e persiste
 * o ID + URL na linha. Não rebenta em caso de erro — loga e segue, para
 * a Maria poder retentar manualmente do workbench.
 */
export async function createOrderDriveFolderIfNeeded(
  order: Pick<Order, "id" | "client_name" | "event_date" | "drive_folder_id">,
): Promise<{ id: string; url: string } | null> {
  if (order.drive_folder_id) return null;
  if (!(await isGoogleConnected())) return null;

  try {
    const folder = await ensureOrderFolder({
      customerName: order.client_name || "Sem nome",
      eventDate: order.event_date,
    });
    const supabase = await createClient();
    await supabase
      .from("orders")
      .update({ drive_folder_id: folder.id, drive_folder_url: folder.url })
      .eq("id", order.id);
    return folder;
  } catch (err) {
    console.error("[drive] Erro a criar pasta da encomenda:", err);
    return null;
  }
}

export async function createVoucherDriveFolderIfNeeded(
  voucher: {
    id: string;
    sender_name: string | null;
    created_at: string | null;
    drive_folder_id: string | null;
  },
): Promise<{ id: string; url: string } | null> {
  if (voucher.drive_folder_id) return null;
  if (!(await isGoogleConnected())) return null;

  try {
    const folder = await ensureVoucherFolder({
      senderName: voucher.sender_name || "Sem nome",
      createdAt: voucher.created_at,
    });
    const supabase = await createClient();
    await supabase
      .from("vouchers")
      .update({ drive_folder_id: folder.id, drive_folder_url: folder.url })
      .eq("id", voucher.id);
    return folder;
  } catch (err) {
    console.error("[drive] Erro a criar pasta do vale:", err);
    return null;
  }
}
