import "server-only";
import { google, type drive_v3 } from "googleapis";
import {
  getAuthenticatedClient,
  loadIntegration,
} from "./oauth";
import { createClient } from "@/lib/supabase/server";

/**
 * Estrutura aprovada pela Maria:
 *
 *   📁 FBR — Encomendas              (raiz)
 *   ├─ 📁 Preservação de Flores
 *   │   └─ 📁 {ano do evento}        (ex.: 2026)
 *   │       └─ 📁 [Cliente] | dd/MM/yyyy
 *   │           ├─ 📁 Comprovativos de pagamento
 *   │           ├─ 📁 Faturas
 *   │           ├─ 📁 1. Receção das flores
 *   │           ├─ 📁 2. Preservação
 *   │           ├─ 📁 3. Reconstrução
 *   │           ├─ 📁 4. Composição e colagem
 *   │           ├─ 📁 5. Emolduramento
 *   │           └─ 📁 6. Resultado final
 *   └─ 📁 Vale-Presente
 *       └─ 📁 {ano de criação}
 *           └─ 📁 [Remetente] | dd/MM/yyyy (data criação)
 *               ├─ 📁 Comprovativos de pagamento
 *               └─ 📁 Faturas
 */

export const DRIVE_ROOT_NAME = "FBR — Encomendas";
export const DRIVE_ORDERS_NAME = "Preservação de Flores";
export const DRIVE_VOUCHERS_NAME = "Vale-Presente";
export const DRIVE_EXPENSES_NAME = "Despesas";

export const ORDER_SUBFOLDERS = [
  "Comprovativos de pagamento",
  "Faturas",
  "1. Receção das flores",
  "2. Preservação",
  "3. Reconstrução",
  "4. Composição e colagem",
  "5. Emolduramento",
  "6. Resultado final",
] as const;

export const VOUCHER_SUBFOLDERS = [
  "Comprovativos de pagamento",
  "Faturas",
] as const;

const FOLDER_MIME = "application/vnd.google-apps.folder";

function formatDateForFolder(dateIso: string | null | undefined): string {
  const source = dateIso ? new Date(dateIso) : new Date();
  if (Number.isNaN(source.getTime())) return "sem data";
  const dd = String(source.getDate()).padStart(2, "0");
  const mm = String(source.getMonth() + 1).padStart(2, "0");
  const yyyy = source.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function yearFolderName(dateIso: string | null | undefined): string {
  if (!dateIso) return "Sem data";
  const source = new Date(dateIso);
  if (Number.isNaN(source.getTime())) return "Sem data";
  return String(source.getFullYear());
}

/** Sanitiza o nome do cliente para não rebentar paths/queries. */
function sanitize(name: string): string {
  return name.replace(/[\\/<>:"|?*]/g, " ").replace(/\s+/g, " ").trim() || "Sem nome";
}

async function getDrive(): Promise<drive_v3.Drive> {
  const auth = await getAuthenticatedClient();
  return google.drive({ version: "v3", auth });
}

async function findFolderByName(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string | null> {
  const escaped = name.replace(/'/g, "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const q = `mimeType='${FOLDER_MIME}' and name='${escaped}' and trashed=false${parentClause}`;
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  if (!res.data.id) {
    throw new Error(`Falhou ao criar pasta "${name}" na Drive.`);
  }
  return res.data.id;
}

async function ensureFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string> {
  const existing = await findFolderByName(drive, name, parentId);
  if (existing) return existing;
  return createFolder(drive, name, parentId);
}

/**
 * Garante que as 3 pastas-mãe existem (raiz + Preservação + Vale-Presente)
 * e cacheia os IDs em `google_integration`. Idempotente.
 */
export async function ensureRootFolders(): Promise<{
  rootId: string;
  ordersId: string;
  vouchersId: string;
}> {
  const integration = await loadIntegration();
  if (!integration) {
    throw new Error("Integração Google não encontrada. Conecta primeiro em /settings/google.");
  }

  const drive = await getDrive();

  let rootId = integration.drive_root_folder_id;
  if (!rootId) {
    rootId = await ensureFolder(drive, DRIVE_ROOT_NAME, null);
  }

  let ordersId = integration.drive_orders_folder_id;
  if (!ordersId) {
    ordersId = await ensureFolder(drive, DRIVE_ORDERS_NAME, rootId);
  }

  let vouchersId = integration.drive_vouchers_folder_id;
  if (!vouchersId) {
    vouchersId = await ensureFolder(drive, DRIVE_VOUCHERS_NAME, rootId);
  }

  // Persistir cache se algo mudou
  if (
    rootId !== integration.drive_root_folder_id ||
    ordersId !== integration.drive_orders_folder_id ||
    vouchersId !== integration.drive_vouchers_folder_id
  ) {
    const supabase = await createClient();
    await supabase
      .from("google_integration")
      .update({
        drive_root_folder_id: rootId,
        drive_orders_folder_id: ordersId,
        drive_vouchers_folder_id: vouchersId,
      })
      .eq("id", integration.id);
  }

  return { rootId, ordersId, vouchersId };
}

function folderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

export type CreatedFolder = { id: string; url: string };

/**
 * Cria a pasta de uma encomenda (Preservação) + 8 subpastas.
 * Reutiliza se já existir. Devolve { id, url }.
 */
export async function ensureOrderFolder(params: {
  customerName: string;
  eventDate: string | null;
}): Promise<CreatedFolder> {
  const { ordersId } = await ensureRootFolders();
  const drive = await getDrive();

  const yearId = await ensureFolder(drive, yearFolderName(params.eventDate), ordersId);

  const folderName = `${sanitize(params.customerName)} | ${formatDateForFolder(params.eventDate)}`;
  const orderFolderId = await ensureFolder(drive, folderName, yearId);

  for (const sub of ORDER_SUBFOLDERS) {
    await ensureFolder(drive, sub, orderFolderId);
  }

  return { id: orderFolderId, url: folderUrl(orderFolderId) };
}

/**
 * Garante a pasta "Despesas" sob a raiz, com subpasta por ano. Devolve
 * o ID da pasta do ano (onde os anexos de facturas vão).
 */
export async function ensureExpenseFolder(params: {
  expenseDate: string | null;
}): Promise<{ id: string; url: string }> {
  const integration = await loadIntegration();
  if (!integration) {
    throw new Error("Integração Google não encontrada. Conecta primeiro em /settings/google.");
  }

  const { rootId } = await ensureRootFolders();
  const drive = await getDrive();

  let expensesId = integration.drive_expenses_folder_id;
  if (!expensesId) {
    expensesId = await ensureFolder(drive, DRIVE_EXPENSES_NAME, rootId);
    const supabase = await createClient();
    await supabase
      .from("google_integration")
      .update({ drive_expenses_folder_id: expensesId })
      .eq("id", integration.id);
  }

  const yearId = await ensureFolder(drive, yearFolderName(params.expenseDate), expensesId);
  return { id: yearId, url: folderUrl(yearId) };
}

/**
 * Faz upload de um ficheiro de factura para a pasta Despesas/{ano}/.
 * Devolve o webViewLink (URL pública partilhável) do ficheiro criado.
 */
export async function uploadExpenseInvoice(params: {
  expenseDate: string | null;
  supplier: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ id: string; url: string }> {
  const { id: yearFolderId } = await ensureExpenseFolder({ expenseDate: params.expenseDate });
  const drive = await getDrive();

  const datePart = params.expenseDate
    ? formatDateForFolder(params.expenseDate).replace(/\//g, "-")
    : "sem-data";
  const safeName = `${datePart} — ${sanitize(params.supplier)} — ${sanitize(params.filename)}`;

  // googleapis aceita Buffer/Readable como media.body. Usamos um Readable
  // wrapper porque a versão Node nativa do FormData não serializa Buffer
  // correctamente quando o stream-size é zero.
  const { Readable } = await import("node:stream");
  const stream = Readable.from(params.buffer);

  const res = await drive.files.create({
    requestBody: {
      name: safeName,
      parents: [yearFolderId],
    },
    media: {
      mimeType: params.mimeType,
      body: stream,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  if (!res.data.id) {
    throw new Error("Falhou ao criar o ficheiro na Drive.");
  }

  return {
    id: res.data.id,
    url: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`,
  };
}

/**
 * Cria a pasta de um vale-presente + 2 subpastas. Reutiliza se já existir.
 */
export async function ensureVoucherFolder(params: {
  senderName: string;
  createdAt: string | null;
}): Promise<CreatedFolder> {
  const { vouchersId } = await ensureRootFolders();
  const drive = await getDrive();

  const yearId = await ensureFolder(drive, yearFolderName(params.createdAt), vouchersId);

  const folderName = `${sanitize(params.senderName)} | ${formatDateForFolder(params.createdAt)}`;
  const voucherFolderId = await ensureFolder(drive, folderName, yearId);

  for (const sub of VOUCHER_SUBFOLDERS) {
    await ensureFolder(drive, sub, voucherFolderId);
  }

  return { id: voucherFolderId, url: folderUrl(voucherFolderId) };
}
