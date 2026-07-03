// ============================================================
// Rotação dos backups — funções puras (testadas em __tests__)
// ============================================================
// Separadas de backup.ts porque este ficheiro não pode ter
// `import "server-only"` (o vitest corre em ambiente node puro).
//
// Regras de retenção (aprovadas pela Maria na sessão 124):
//   • últimos 14 dias: um backup por dia
//   • último ano: só o do dia 1 de cada mês
//   • anos anteriores: só o de 1 de Janeiro
// ============================================================

export const BACKUP_FILE_PREFIX = "fbr-backup-";
export const BACKUP_FILE_SUFFIX = ".json.gz";

/** Extrai a data de um nome `fbr-backup-YYYY-MM-DD.json.gz`; null se não bater. */
export function backupDateFromName(name: string): Date | null {
  if (!name.startsWith(BACKUP_FILE_PREFIX) || !name.endsWith(BACKUP_FILE_SUFFIX)) {
    return null;
  }
  const middle = name.slice(
    BACKUP_FILE_PREFIX.length,
    name.length - BACKUP_FILE_SUFFIX.length,
  );
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(middle);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // Rejeita datas impossíveis (ex.: 2026-02-31 viraria 2 de Março)
  if (date.getUTCMonth() !== Number(m[2]) - 1 || date.getUTCDate() !== Number(m[3])) {
    return null;
  }
  return date;
}

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Dada a lista de nomes na pasta de backups, devolve os que já não
 * encaixam nas regras de retenção. Nomes que não sigam o padrão são
 * ignorados (nunca tocamos em ficheiros que não são nossos).
 */
export function backupsToRotateOut(names: string[], today: Date): string[] {
  const todayMs = utcMidnight(today);
  const out: string[] = [];
  for (const name of names) {
    const date = backupDateFromName(name);
    if (!date) continue;
    const ageDays = Math.floor((todayMs - date.getTime()) / 86_400_000);
    if (ageDays < 0) continue; // data futura — não mexer (relógio torto?)
    if (ageDays <= 14) continue; // diários recentes
    const isFirstOfMonth = date.getUTCDate() === 1;
    if (isFirstOfMonth && ageDays <= 366) continue; // mensais do último ano
    if (isFirstOfMonth && date.getUTCMonth() === 0) continue; // 1 de Janeiro — para sempre
    out.push(name);
  }
  return out;
}

/** Nome do ficheiro de backup para a data dada (data UTC). */
export function backupFileName(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${BACKUP_FILE_PREFIX}${y}-${m}-${d}${BACKUP_FILE_SUFFIX}`;
}
