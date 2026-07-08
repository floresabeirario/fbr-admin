import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaFromMigrations } from "../schema-drift";

// ============================================================
// Contrato de colunas website ↔ admin (ver docs/ECOSYSTEM.md)
//
// O fbr-website insere directamente em `orders` e `vouchers` (service
// role) com payloads construídos em app/_lib/supabase-mappings.js.
// Se uma migração daqui renomear/remover uma coluna que o form usa,
// o form público parte em silêncio. Este teste extrai as chaves dos
// dois payloads do website e verifica-as contra o schema derivado
// das migrações (mesma fonte do schema-drift).
//
// Só corre quando o repo do website existe ao lado (máquina da Maria,
// onde o preflight é obrigatório); na CI do GitHub o sibling não
// existe e o teste é ignorado.
// ============================================================

const MAPPINGS_PATH = join(
  process.cwd(),
  "..",
  "fbr-website",
  "fbr-website",
  "app",
  "_lib",
  "supabase-mappings.js",
);

const hasWebsite = existsSync(MAPPINGS_PATH);

function schemaFromDisk(): Map<string, Set<string>> {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));
  return schemaFromMigrations(files);
}

// Extrai os blocos `const payload = { … };` (por ordem: orders, vouchers)
// e devolve as chaves de cada um (propriedades normais e shorthand).
function payloadKeyBlocks(source: string): string[][] {
  const blocks: string[][] = [];
  const marker = "const payload = {";
  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start === -1) break;
    // varrer até à chaveta que fecha o literal (contagem de profundidade)
    let depth = 0;
    let end = -1;
    for (let i = start + marker.length - 1; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break;
    const body = source.slice(start + marker.length, end);
    const keys: string[] = [];
    for (const line of body.split("\n")) {
      const clean = line.trim();
      if (clean.startsWith("//") || !clean) continue;
      const m = clean.match(/^([a-z][a-z0-9_]*)\s*[:,]/);
      if (m) keys.push(m[1]);
    }
    blocks.push(keys);
    from = end;
  }
  return blocks;
}

describe.skipIf(!hasWebsite)("contrato: payloads do form do website ↔ schema das migrações", () => {
  it("todas as colunas que o website insere existem em orders/vouchers", () => {
    const schema = schemaFromDisk();
    const source = readFileSync(MAPPINGS_PATH, "utf8");
    const [orderKeys, voucherKeys] = payloadKeyBlocks(source);

    // Sanidade: se o parsing partir (refactor no website), queremos saber.
    expect(orderKeys?.length).toBeGreaterThan(10);
    expect(voucherKeys?.length).toBeGreaterThan(10);

    const orders = schema.get("orders") ?? new Set();
    const vouchers = schema.get("vouchers") ?? new Set();

    const missingOrders = orderKeys.filter((k) => !orders.has(k));
    const missingVouchers = voucherKeys.filter((k) => !vouchers.has(k));

    expect(missingOrders, "colunas do payload de orders sem coluna na BD").toEqual([]);
    expect(missingVouchers, "colunas do payload de vouchers sem coluna na BD").toEqual([]);
  });
});
