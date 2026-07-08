import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_PUBLIC_PHASES,
  DEFAULT_MESSAGES_EN,
  DEFAULT_MESSAGES_PT,
  PUBLIC_PHASE_LABEL_EN,
  PUBLIC_PHASE_LABEL_PT,
  STATUS_TO_PUBLIC_PHASE,
} from "../public-status";

// ============================================================
// Guarda de drift: a fase pública tem uma fonte única em runtime
// (a RPC get_public_order_status, migração 092) que o fbr-tracking
// consome. O admin mantém public-status.ts para a sua UI síncrona.
// Este teste garante que os dois NÃO divergem — se editares um sem
// o outro, o preflight apita. Ver docs/ECOSYSTEM.md #1.
// ============================================================

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "092_public_phase_defs.sql"),
  "utf8",
);

describe("public-status.ts ↔ migração 092 (fonte única da fase)", () => {
  it("o mapeamento estado→fase é idêntico", () => {
    for (const [status, phase] of Object.entries(STATUS_TO_PUBLIC_PHASE)) {
      if (phase === "cancelada") {
        expect(SQL).toMatch(new RegExp(`when\\s+'${status}'\\s+then\\s+null`));
      } else {
        expect(SQL).toMatch(new RegExp(`when\\s+'${status}'\\s+then\\s+${phase}\\b`));
      }
    }
  });

  it("labels PT e EN de cada fase estão na RPC", () => {
    for (const phase of ALL_PUBLIC_PHASES) {
      expect(SQL).toContain(PUBLIC_PHASE_LABEL_PT[phase]);
      expect(SQL).toContain(PUBLIC_PHASE_LABEL_EN[phase]);
    }
  });

  it("mensagens default PT e EN de cada fase estão na RPC", () => {
    for (const phase of ALL_PUBLIC_PHASES) {
      expect(SQL).toContain(DEFAULT_MESSAGES_PT[phase]);
      expect(SQL).toContain(DEFAULT_MESSAGES_EN[phase]);
    }
  });
});
