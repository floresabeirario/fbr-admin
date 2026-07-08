import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ============================================================
// Contrato do ecossistema (ver docs/ECOSYSTEM.md)
//
// Guarda offline: se alguém renomear/apagar um endpoint ou RPC de que
// OUTRO repo depende (website, tracking, voucher), o preflight apita
// aqui — antes de partir o site em produção. Não substitui o smoke
// nem o healthcheck em runtime; apanha o erro estúpido cedo.
// ============================================================

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function allMigrationsSql(): string {
  const dir = join(ROOT, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

describe("contrato: endpoints HTTP que o fbr-website chama", () => {
  it("notify-order existe e aceita o payload documentado", () => {
    const src = read("src/app/api/internal/notify-order/route.ts");
    expect(src).toContain("export async function POST");
    // Campos do contrato com o website (ECOSYSTEM.md).
    expect(src).toContain("order_id");
    expect(src).toContain("client_name");
    expect(src).toContain("event_type");
    // Autenticação por segredo partilhado.
    expect(src).toContain("INTERNAL_NOTIFY_SECRET");
  });

  it("notify-voucher existe e autentica pelo mesmo segredo", () => {
    const src = read("src/app/api/internal/notify-voucher/route.ts");
    expect(src).toContain("export async function POST");
    expect(src).toContain("INTERNAL_NOTIFY_SECRET");
  });
});

describe("contrato: RPCs de que os sites públicos dependem", () => {
  it("get_voucher_by_code existe nas migrações (usado pelo fbr-voucher)", () => {
    expect(allMigrationsSql()).toMatch(/function\s+(public\.)?get_voucher_by_code/i);
  });

  it("get_public_order_status existe nas migrações (usado pelo fbr-tracking)", () => {
    expect(allMigrationsSql()).toMatch(/function\s+(public\.)?get_public_order_status/i);
  });
});
