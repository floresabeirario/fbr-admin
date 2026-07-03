// ============================================================
// Anti-drift: cada propriedade dos interfaces Order/Voucher tem de
// existir como coluna nas migrações. Apanha a classe do bug
// `total_budget` (sessão 119): nome de coluna inventado no TS que o
// PostgREST rejeita em silêncio. Corre offline (migrações locais são
// a fonte da verdade), portanto corre no preflight e no CI.
// ============================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { schemaFromMigrations, interfaceProps } from "@/lib/schema-drift";

const ROOT = path.resolve(__dirname, "../../..");
const MIG_DIR = path.join(ROOT, "supabase", "migrations");

function loadSchema() {
  const files = readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({
      name,
      sql: readFileSync(path.join(MIG_DIR, name), "utf8"),
    }));
  return schemaFromMigrations(files);
}

const schema = loadSchema();

function missingColumns(interfaceFile: string, interfaceName: string, table: string): string[] {
  const source = readFileSync(path.join(ROOT, "src", "types", interfaceFile), "utf8");
  const props = interfaceProps(source, interfaceName);
  const cols = schema.get(table);
  expect(cols, `tabela ${table} não encontrada nas migrações`).toBeDefined();
  expect(props.length).toBeGreaterThan(10); // sanidade: o parser leu mesmo o interface
  return props.filter((p) => !cols!.has(p));
}

describe("schema-drift: types ↔ migrações", () => {
  it("parser apanha colunas de CREATE TABLE, ADD, RENAME e DROP", () => {
    const mini = schemaFromMigrations([
      {
        name: "001.sql",
        sql: `CREATE TABLE demo (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT CHECK (status IN ('a', 'b')),
          UNIQUE (name)
        );`,
      },
      { name: "002.sql", sql: "ALTER TABLE demo ADD COLUMN IF NOT EXISTS extra INT;" },
      { name: "003.sql", sql: "ALTER TABLE demo RENAME COLUMN extra TO extra2;" },
      { name: "004.sql", sql: "ALTER TABLE demo DROP COLUMN IF EXISTS status;" },
    ]);
    expect([...(mini.get("demo") ?? [])].sort()).toEqual(["extra2", "id", "name"]);
  });

  it("todas as propriedades de Order existem como colunas de orders", () => {
    expect(missingColumns("database.ts", "Order", "orders")).toEqual([]);
  });

  it("todas as propriedades de Voucher existem como colunas de vouchers", () => {
    expect(missingColumns("voucher.ts", "Voucher", "vouchers")).toEqual([]);
  });

  it("uma coluna inventada seria apanhada (regressão total_budget)", () => {
    const cols = schema.get("orders")!;
    expect(cols.has("budget")).toBe(true);
    expect(cols.has("total_budget")).toBe(false); // o bug da sessão 119
  });
});
