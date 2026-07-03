// ============================================================
// Backup diário da base de dados → Google Drive
// ============================================================
// Corre via /api/cron/backup (Vercel Cron, protegido por CRON_SECRET).
// Exporta todas as tabelas em JSON, comprime (gzip) e grava na pasta
// "Backups da base de dados" dentro de "FBR — Encomendas" na Drive.
//
// Rotação (aprovada pela Maria na sessão 124 — backups diários
// infinitos não servem para nada):
//   • últimos 14 dias: um por dia
//   • último ano: só o do dia 1 de cada mês
//   • anos anteriores: só o de 1 de Janeiro
// Os que saem das regras vão para o LIXO da Drive (recuperáveis
// durante 30 dias), não são apagados definitivamente.
//
// Exclusões: `google_integration` fica FORA do backup — contém o
// refresh_token do OAuth (um segredo). Se se perder, reconecta-se
// em /settings/google em 30 segundos.
//
// O resultado de cada corrida fica em system_settings[backup_status]
// para o healthcheck alertar se o backup partir em silêncio.
// ============================================================

import "server-only";
import { gzipSync } from "node:zlib";
import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOAuthClient } from "@/lib/google/oauth";
import { backupFileName, backupsToRotateOut } from "@/lib/backup-rotation";

export const BACKUP_STATUS_KEY = "backup_status";
export const BACKUP_FOLDER_KEY = "backup_drive_folder_id";
export const BACKUP_FOLDER_NAME = "Backups da base de dados";

const PAGE_SIZE = 1000; // limite por resposta do PostgREST

// Todas as tabelas das migrações excepto google_integration (segredos).
export const BACKUP_TABLES = [
  "orders",
  "vouchers",
  "partners",
  "tasks",
  "personal_checklist",
  "task_templates",
  "competitors",
  "pricing_items",
  "production_cost_items",
  "expenses",
  "ideas",
  "recipes",
  "chat_messages",
  "message_templates",
  "system_settings",
  "team_members",
  "public_status_settings",
  "public_figures",
  "whatsapp_conversations",
  "whatsapp_messages",
  "claude_usage",
  "audit_log",
] as const;

// Coluna de ordenação estável para paginar (o PostgREST devolve no
// máximo 1000 linhas por pedido; sem ORDER BY a paginação pode
// saltar/duplicar linhas).
const ORDER_COLUMN: Record<string, string> = {
  system_settings: "key",
  team_members: "email",
};

export type BackupStatus = {
  ran_at: string;
  ok: boolean;
  file_name?: string;
  size_bytes?: number;
  total_rows?: number;
  row_counts?: Record<string, number>;
  rotated_out?: string[];
  error?: string;
};

// ──────────────────────────────────────────────────────────────
// Exportação das tabelas
// ──────────────────────────────────────────────────────────────

async function exportTable(
  supabase: SupabaseClient,
  table: string,
): Promise<Record<string, unknown>[]> {
  const orderCol = ORDER_COLUMN[table] ?? "id";
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderCol, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Tabela ${table}: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────
// Drive (sem sessão — o OAuth vem do refresh_token lido com o
// client service_role, porque num cron não há cookies)
// ──────────────────────────────────────────────────────────────

async function getDriveForCron(supabase: SupabaseClient): Promise<drive_v3.Drive> {
  const { data, error } = await supabase
    .from("google_integration")
    .select("refresh_token")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler google_integration: ${error.message}`);
  if (!data?.refresh_token) {
    throw new Error("Integração Google não conectada — liga em /settings/google.");
  }
  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: data.refresh_token });
  return google.drive({ version: "v3", auth: oauth });
}

async function readSetting(supabase: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return typeof data?.value === "string" && data.value.length > 0 ? data.value : null;
}

async function writeSetting(supabase: SupabaseClient, key: string, value: string): Promise<void> {
  await supabase.from("system_settings").upsert({ key, value });
}

/** Garante a pasta de backups na Drive; cacheia o id em system_settings. */
async function ensureBackupFolder(
  supabase: SupabaseClient,
  drive: drive_v3.Drive,
): Promise<string> {
  const cached = await readSetting(supabase, BACKUP_FOLDER_KEY);
  if (cached) {
    // Confirma que ainda existe e não está no lixo (alguém pode tê-la apagado)
    try {
      const res = await drive.files.get({ fileId: cached, fields: "id, trashed" });
      if (res.data.id && !res.data.trashed) return cached;
    } catch {
      // caiu para a criação abaixo
    }
  }

  // Debaixo da raiz "FBR — Encomendas" se existir; senão na raiz da Drive.
  const { data: integ } = await supabase
    .from("google_integration")
    .select("drive_root_folder_id")
    .limit(1)
    .maybeSingle();
  const parentId = integ?.drive_root_folder_id ?? null;

  const escaped = BACKUP_FOLDER_NAME.replace(/'/g, "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const found = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false${parentClause}`,
    fields: "files(id)",
    pageSize: 1,
    spaces: "drive",
  });
  let folderId = found.data.files?.[0]?.id ?? null;

  if (!folderId) {
    const created = await drive.files.create({
      requestBody: {
        name: BACKUP_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id",
    });
    folderId = created.data.id ?? null;
  }
  if (!folderId) throw new Error("Falhou a criar a pasta de backups na Drive.");

  await writeSetting(supabase, BACKUP_FOLDER_KEY, folderId);
  return folderId;
}

// ──────────────────────────────────────────────────────────────
// Corrida completa
// ──────────────────────────────────────────────────────────────

export async function runBackup(supabase: SupabaseClient): Promise<BackupStatus> {
  const now = new Date();
  try {
    // 1. Exportar todas as tabelas
    const tables: Record<string, Record<string, unknown>[]> = {};
    const rowCounts: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      const rows = await exportTable(supabase, table);
      tables[table] = rows;
      rowCounts[table] = rows.length;
    }
    const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);

    // 2. JSON → gzip
    const payload = {
      version: 1,
      exported_at: now.toISOString(),
      note: "Backup da BD do FBR Admin. google_integration excluída de propósito (segredos OAuth).",
      row_counts: rowCounts,
      tables,
    };
    const gz = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));

    // 3. Upload para a Drive (substitui se já houver um de hoje)
    const drive = await getDriveForCron(supabase);
    const folderId = await ensureBackupFolder(supabase, drive);
    const fileName = backupFileName(now);

    const existing = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: "files(id)",
      pageSize: 1,
      spaces: "drive",
    });
    const existingId = existing.data.files?.[0]?.id ?? null;

    const media = { mimeType: "application/gzip", body: Readable.from(gz) };
    if (existingId) {
      await drive.files.update({ fileId: existingId, media });
    } else {
      await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media,
        fields: "id",
      });
    }

    // 4. Rotação — os que saem das regras vão para o lixo da Drive
    const listing = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      pageSize: 1000,
      spaces: "drive",
    });
    const files = listing.data.files ?? [];
    const namesToRotate = new Set(
      backupsToRotateOut(files.map((f) => f.name ?? ""), now),
    );
    const rotatedOut: string[] = [];
    for (const f of files) {
      if (!f.id || !f.name || !namesToRotate.has(f.name)) continue;
      await drive.files.update({ fileId: f.id, requestBody: { trashed: true } });
      rotatedOut.push(f.name);
    }

    // 5. Registar sucesso
    const status: BackupStatus = {
      ran_at: now.toISOString(),
      ok: true,
      file_name: fileName,
      size_bytes: gz.byteLength,
      total_rows: totalRows,
      row_counts: rowCounts,
      rotated_out: rotatedOut,
    };
    await writeSetting(supabase, BACKUP_STATUS_KEY, JSON.stringify(status));
    return status;
  } catch (err) {
    const status: BackupStatus = {
      ran_at: now.toISOString(),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    // Registar a falha para o healthcheck apanhar (best effort)
    try {
      await writeSetting(supabase, BACKUP_STATUS_KEY, JSON.stringify(status));
    } catch {
      // se nem isto der, o healthcheck alerta por "backup velho"
    }
    return status;
  }
}
