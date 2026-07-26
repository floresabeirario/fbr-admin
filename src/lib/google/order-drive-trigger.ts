import "server-only";
import {
  ensureOrderFolder,
  ensureDriedOrderFolder,
  ensureVoucherFolder,
  uploadToDriveFolder,
} from "./drive";
import { loadIntegration } from "./oauth";
import { createClient } from "@/lib/supabase/server";
import {
  downloadBouquetPhoto,
  deleteBouquetPhotos,
} from "@/lib/storage/bouquet-photos";
import type { PaymentStatus, Order, ClientPhoto } from "@/types/database";
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
  order: Pick<
    Order,
    | "id"
    | "client_name"
    | "event_date"
    | "drive_folder_id"
    | "service_type"
    | "client_photos"
  >,
): Promise<{ id: string; url: string } | null> {
  if (order.drive_folder_id) return null;
  if (!(await isGoogleConnected())) return null;

  try {
    const supabase = await createClient();

    // Serviço "Emoldurar Flores Secas": pasta na categoria própria + mover
    // as fotos do ramo (Storage → Drive) para dentro dela.
    if (order.service_type === "emoldurar_secas") {
      const folder = await ensureDriedOrderFolder({
        customerName: order.client_name || "Sem nome",
        eventDate: order.event_date,
      });

      const remaining = await moveClientPhotosToDrive(
        order.client_photos ?? [],
        folder.clientPhotosFolderId,
      );

      await supabase
        .from("orders")
        .update({
          drive_folder_id: folder.id,
          drive_folder_url: folder.url,
          // Se todas moveram, esvazia; se alguma falhou, guarda as que
          // sobraram para retentar (nunca as perdemos silenciosamente).
          client_photos: remaining,
        })
        .eq("id", order.id);
      return { id: folder.id, url: folder.url };
    }

    // Preservação (default).
    const folder = await ensureOrderFolder({
      customerName: order.client_name || "Sem nome",
      eventDate: order.event_date,
    });
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

/**
 * Move as fotos do ramo do Storage para a pasta "Fotos do cliente" na Drive.
 * Cada foto: descarrega do Storage → sobe para a Drive → apaga do Storage.
 * Devolve a lista das fotos que NÃO conseguiram mover (para retentar) — em
 * condições normais é vazia. Best-effort: uma falha numa foto não trava as
 * outras nem a criação da pasta.
 */
async function moveClientPhotosToDrive(
  photos: ClientPhoto[],
  driveFolderId: string,
): Promise<ClientPhoto[]> {
  const failed: ClientPhoto[] = [];
  const movedPaths: string[] = [];

  for (const photo of photos) {
    try {
      const file = await downloadBouquetPhoto(photo.path);
      if (!file) {
        failed.push(photo);
        continue;
      }
      await uploadToDriveFolder(driveFolderId, {
        filename: photo.name,
        mimeType: file.mimeType,
        buffer: file.buffer,
      });
      movedPaths.push(photo.path);
    } catch (err) {
      console.error("[drive] Falha a mover foto do ramo:", photo.path, err);
      failed.push(photo);
    }
  }

  if (movedPaths.length) await deleteBouquetPhotos(movedPaths);
  return failed;
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
