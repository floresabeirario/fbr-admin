import { describe, expect, it } from "vitest";
import { publicPhaseChanges } from "../public-status";

// O texto personalizado do status público é de uma fase. Quando o estado
// muda de fase, o texto volta ao default da fase nova (ver updateOrderAction).
describe("publicPhaseChanges", () => {
  it("muda de fase pública → repõe o texto", () => {
    expect(publicPhaseChanges("flores_recebidas", "flores_na_prensa")).toBe(true);
    expect(publicPhaseChanges("a_compor_design", "cancelado")).toBe(true);
  });

  it("estados que partilham fase pública → o texto mantém-se", () => {
    expect(publicPhaseChanges("entrega_agendada", "flores_enviadas")).toBe(false);
    expect(publicPhaseChanges("a_ser_emoldurado", "emoldurado")).toBe(false);
  });

  it("sem mudança de estado → o texto mantém-se", () => {
    expect(publicPhaseChanges("flores_na_prensa", "flores_na_prensa")).toBe(false);
    expect(publicPhaseChanges("flores_na_prensa", undefined)).toBe(false);
    expect(publicPhaseChanges(null, "flores_na_prensa")).toBe(false);
  });
});
