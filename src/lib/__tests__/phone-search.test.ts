import { describe, it, expect } from "vitest";
import { parsePhoneQuery, phoneDigits, phoneMatches } from "../phone-search";

// Sessão 162: a pesquisa global passa a reconhecer telemóveis colados
// do WhatsApp ("+351 910 843 885") e a casá-los pelos últimos 9 dígitos.

describe("parsePhoneQuery", () => {
  it("aceita formatos habituais do WhatsApp e de contactos", () => {
    expect(parsePhoneQuery("+351 910 843 885")).toBe("351910843885");
    expect(parsePhoneQuery("910843885")).toBe("910843885");
    expect(parsePhoneQuery("00351 910-843-885")).toBe("351910843885");
    expect(parsePhoneQuery("(+44) 7700 900123")).toBe("447700900123");
  });

  it("número a meio de ser escrito (6+ dígitos) já conta", () => {
    expect(parsePhoneQuery("910 843")).toBe("910843");
  });

  it("não é telemóvel: letras, códigos de vale, poucos dígitos", () => {
    expect(parsePhoneQuery("Ana Silva")).toBeNull();
    expect(parsePhoneQuery("AB12CD")).toBeNull();
    expect(parsePhoneQuery("2026")).toBeNull();
    expect(parsePhoneQuery("")).toBeNull();
  });
});

describe("phoneMatches", () => {
  it("casa pelo fim do número, seja como for que esteja guardado", () => {
    const q = "351910843885";
    expect(phoneMatches("910843885", q)).toBe(true);
    expect(phoneMatches("+351910843885", q)).toBe(true);
    expect(phoneMatches("+351 910 843 885", q)).toBe(true);
    expect(phoneMatches("00351910843885", q)).toBe(true);
  });

  it("número diferente não casa", () => {
    expect(phoneMatches("+351912345678", "351910843885")).toBe(false);
    expect(phoneMatches(null, "351910843885")).toBe(false);
  });

  it("pesquisa parcial casa por conter a sequência", () => {
    expect(phoneMatches("+351 910 843 885", "910843")).toBe(true);
    expect(phoneMatches("+351 910 843 885", "843885")).toBe(true);
    expect(phoneMatches("+351 910 843 885", "999999")).toBe(false);
  });

  it("phoneDigits tira o 00 internacional", () => {
    expect(phoneDigits("00351 910")).toBe("351910");
    expect(phoneDigits(undefined)).toBe("");
  });
});
