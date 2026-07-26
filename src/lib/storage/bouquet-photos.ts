import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientPhoto } from "@/types/database";

// ============================================================
// Fotos do ramo (serviço "Emoldurar Flores Secas")
// ============================================================
// As fotos submetidas no form público vivem TEMPORARIAMENTE no bucket
// privado `bouquet-photos` do Supabase Storage. Ao 1º pagamento são
// movidas para a pasta Drive do cliente e apagadas daqui
// (ver src/lib/google/order-drive-trigger.ts). O cron diário limpa as
// que ficam órfãs (pré-reservas por pagar há muito tempo, canceladas…).
//
// Todo o acesso é feito com service_role (bucket privado sem policies) —
// por isso este módulo é server-only.

export const BOUQUET_BUCKET = "bouquet-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora — chega para ver no workbench

/**
 * Gera signed URLs para mostrar as fotos no workbench (bucket privado).
 * Devolve só as que resolveram; falhas silenciosas (nunca rebenta a página).
 */
export async function getBouquetPhotoUrls(
  photos: ClientPhoto[] | null | undefined,
): Promise<{ name: string; path: string; url: string }[]> {
  if (!photos?.length) return [];
  const supabase = createAdminClient();
  const paths = photos.map((p) => p.path);
  const { data, error } = await supabase.storage
    .from(BOUQUET_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("[bouquet-photos] createSignedUrls falhou:", error);
    return [];
  }
  return photos
    .map((p, i) => ({ name: p.name, path: p.path, url: data[i]?.signedUrl ?? "" }))
    .filter((x) => x.url);
}

/**
 * Descarrega os bytes de uma foto (para a mover para o Drive).
 * Devolve o buffer + o mime type detectado, ou null se falhar.
 */
export async function downloadBouquetPhoto(
  path: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BOUQUET_BUCKET).download(path);
  if (error || !data) {
    console.error("[bouquet-photos] download falhou:", path, error);
    return null;
  }
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: data.type || "application/octet-stream",
  };
}

/** Apaga fotos do Storage (após mover para Drive, ou na limpeza). */
export async function deleteBouquetPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BOUQUET_BUCKET).remove(paths);
  if (error) console.error("[bouquet-photos] remove falhou:", error);
}

/**
 * Apaga as fotos do ramo de UMA encomenda (Storage) e limpa o array na BD.
 * Usado pelo botão manual do workbench e ao cancelar/arquivar a encomenda.
 */
export async function clearOrderClientPhotos(
  supabase: SupabaseClient,
  orderId: string,
  photos: ClientPhoto[] | null | undefined,
): Promise<void> {
  if (photos?.length) {
    await deleteBouquetPhotos(photos.map((p) => p.path));
  }
  await supabase.from("orders").update({ client_photos: [] }).eq("id", orderId);
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Limpeza periódica (cron 7h) das fotos que já não fazem sentido guardar no
 * Storage gratuito: encomendas de flores secas canceladas, arquivadas, ou
 * "100% por pagar" há mais de 90 dias (lead morto). As pagas já tiveram as
 * fotos movidas para o Drive ao 1º pagamento. Devolve nº de fotos apagadas.
 */
export async function cleanupOrphanBouquetPhotos(
  supabase: SupabaseClient,
): Promise<number> {
  // Poucas encomendas deste tipo — fetch simples e filtro em JS (o filtro
  // jsonb "array não vazio" não é fiável via PostgREST).
  const { data, error } = await supabase
    .from("orders")
    .select("id, client_photos, status, payment_status, deleted_at, created_at")
    .eq("service_type", "emoldurar_secas");
  if (error || !data) return 0;

  const cutoff = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
  let apagadas = 0;

  for (const o of data as Array<{
    id: string;
    client_photos: ClientPhoto[] | null;
    status: string;
    payment_status: string;
    deleted_at: string | null;
    created_at: string;
  }>) {
    const photos = o.client_photos ?? [];
    if (!photos.length) continue;
    const orfa =
      o.deleted_at !== null ||
      o.status === "cancelado" ||
      (o.payment_status === "100_por_pagar" && o.created_at < cutoff);
    if (!orfa) continue;
    await clearOrderClientPhotos(supabase, o.id, photos);
    apagadas += photos.length;
  }
  return apagadas;
}
