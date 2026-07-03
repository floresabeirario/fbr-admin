// ============================================================
// Guarda anti-drift: types/*.ts vs supabase/migrations/*.sql
// ============================================================
// O types/database.ts é escrito à mão. Quando um nome de coluna no TS
// não existe na BD, o PostgREST devolve erro que o código muitas vezes
// engole (?? []) — foi exactamente o bug `total_budget` da sessão 119,
// que deixou o assistente inútil durante semanas sem ninguém ver.
//
// Estas funções são puras (recebem strings) e correm num teste vitest
// (schema-drift.test.ts) SEM rede: as migrações locais são a fonte da
// verdade do esquema. Se alguém escrever um campo no interface que
// nenhuma migração criou, o preflight/CI falha na hora.
// ============================================================

export type MigrationFile = { name: string; sql: string };

const RE_CREATE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(/gi;
// Instrução ALTER TABLE inteira (até ao ";") — um só ALTER pode ter
// VÁRIOS "ADD COLUMN" separados por vírgulas (ex.: mig 016).
const RE_ALTER_STMT =
  /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?([^;]*);/gi;
const RE_ADD_COL = /add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi;
const RE_RENAME_COL =
  /alter\s+table\s+(?:public\.)?"?(\w+)"?\s+rename\s+column\s+"?(\w+)"?\s+to\s+"?(\w+)"?/gi;
const RE_DROP_COL =
  /alter\s+table\s+(?:public\.)?"?(\w+)"?\s+drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?/gi;

// Palavras que iniciam linhas de constraint dentro de CREATE TABLE
// (não são colunas).
const CONSTRAINT_STARTERS = new Set([
  "primary",
  "unique",
  "check",
  "constraint",
  "foreign",
  "like",
  "exclude",
]);

/**
 * Extrai as colunas declaradas no corpo de um CREATE TABLE, a partir da
 * posição do "(" de abertura. Conta parêntesis para saber onde o corpo
 * acaba (CHECK (... IN (...)) tem parêntesis aninhados) e considera
 * coluna qualquer item ao nível 1 que comece por identificador que não
 * seja constraint.
 */
function columnsFromCreateBody(sql: string, openParenIdx: number): string[] {
  const cols: string[] = [];
  let depth = 0;
  let inString = false;
  let itemStart = openParenIdx + 1;
  for (let i = openParenIdx; i < sql.length; i++) {
    const ch = sql[i];
    // Parêntesis dentro de strings ('Não sei (talvez)') não contam.
    if (ch === "'") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth--;
      if (depth === 0) {
        pushItem(sql.slice(itemStart, i));
        break;
      }
      continue;
    }
    if (ch === "," && depth === 1) {
      pushItem(sql.slice(itemStart, i));
      itemStart = i + 1;
    }
  }
  function pushItem(raw: string) {
    const cleaned = raw.trim();
    const m = /^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s/.exec(cleaned);
    if (!m) return;
    const first = m[1].toLowerCase();
    if (CONSTRAINT_STARTERS.has(first)) return;
    cols.push(first);
  }
  return cols;
}

/** Remove comentários "-- …" linha a linha — os parêntesis/vírgulas
 *  dentro de comentários baralhavam a contagem do corpo do CREATE. */
function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

/**
 * Constrói o esquema (tabela → colunas) a partir das migrações, pela
 * ordem dos ficheiros: CREATE TABLE, ALTER ADD, RENAME e DROP COLUMN.
 */
export function schemaFromMigrations(
  files: readonly MigrationFile[],
): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));

  for (const file of sorted) {
    const sql = stripLineComments(file.sql);
    let m: RegExpExecArray | null;

    RE_CREATE.lastIndex = 0;
    while ((m = RE_CREATE.exec(sql))) {
      const table = m[1].toLowerCase();
      const openParen = RE_CREATE.lastIndex - 1;
      const set = tables.get(table) ?? new Set<string>();
      for (const c of columnsFromCreateBody(sql, openParen)) set.add(c);
      tables.set(table, set);
    }

    RE_ALTER_STMT.lastIndex = 0;
    while ((m = RE_ALTER_STMT.exec(sql))) {
      const table = m[1].toLowerCase();
      const rest = m[2];
      let a: RegExpExecArray | null;
      RE_ADD_COL.lastIndex = 0;
      while ((a = RE_ADD_COL.exec(rest))) {
        const set = tables.get(table) ?? new Set<string>();
        set.add(a[1].toLowerCase());
        tables.set(table, set);
      }
    }

    RE_RENAME_COL.lastIndex = 0;
    while ((m = RE_RENAME_COL.exec(sql))) {
      const set = tables.get(m[1].toLowerCase());
      if (set) {
        set.delete(m[2].toLowerCase());
        set.add(m[3].toLowerCase());
      }
    }

    RE_DROP_COL.lastIndex = 0;
    while ((m = RE_DROP_COL.exec(sql))) {
      tables.get(m[1].toLowerCase())?.delete(m[2].toLowerCase());
    }
  }
  return tables;
}

/**
 * Extrai os nomes das propriedades de um `export interface X { … }` de
 * um ficheiro TS (propriedades simples, uma por linha — o estilo do
 * types/database.ts). Ignora comentários e linhas em branco.
 */
export function interfaceProps(source: string, interfaceName: string): string[] {
  const start = source.indexOf(`export interface ${interfaceName} {`);
  if (start === -1) {
    throw new Error(`Interface ${interfaceName} não encontrada`);
  }
  const props: string[] = [];
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i + 1;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = source.slice(bodyStart, i);
  for (const line of body.split("\n")) {
    const m = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??:/.exec(line);
    if (m) props.push(m[1]);
  }
  return props;
}
