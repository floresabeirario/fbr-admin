import { describe, expect, it } from "vitest";
import { foldSearch, matchesSearch } from "../search-text";

describe("foldSearch", () => {
  it("ignora acentos, cedilhas e maiúsculas", () => {
    expect(foldSearch("João")).toBe("joao");
    expect(foldSearch("  CONCEIÇÃO ")).toBe("conceicao");
    expect(foldSearch("Óbidos")).toBe("obidos");
  });

  it("null/undefined dão texto vazio", () => {
    expect(foldSearch(null)).toBe("");
    expect(foldSearch(undefined)).toBe("");
  });
});

describe("matchesSearch", () => {
  it("joao e joão encontram o mesmo", () => {
    expect(matchesSearch(foldSearch("joao"), "João Silva")).toBe(true);
    expect(matchesSearch(foldSearch("joão"), "Joao Silva")).toBe(true);
  });

  it("procura em qualquer dos campos e salta os vazios", () => {
    expect(matchesSearch(foldSearch("coimbra"), null, "Quinta, Coimbra")).toBe(true);
    expect(matchesSearch(foldSearch("porto"), null, "Coimbra")).toBe(false);
  });

  it("termo vazio deixa passar tudo", () => {
    expect(matchesSearch("", "qualquer")).toBe(true);
  });
});
