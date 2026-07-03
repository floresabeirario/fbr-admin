// Testes da detecção de clientes repetidos (sessão 124, item 8.5).
// Regra da Maria: avisar com link, nunca bloquear.

import { describe, it, expect } from "vitest";
import { findDuplicates, normalizePhone, normalizeEmail } from "@/lib/duplicates";

describe("normalizePhone", () => {
  it("iguala +351 912 345 678 a 912345678", () => {
    expect(normalizePhone("+351 912 345 678")).toBe("912345678");
    expect(normalizePhone("912345678")).toBe("912345678");
    expect(normalizePhone("00351912345678")).toBe("912345678");
    expect(normalizePhone("912-345-678")).toBe("912345678");
  });

  it("rejeita números demasiado curtos (evita falsos positivos)", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("números estrangeiros comparam pelos últimos 9 dígitos", () => {
    // EUA +1 555 123 4567 → últimos 9
    expect(normalizePhone("+1 555 123 4567")).toBe("551234567");
  });
});

describe("normalizeEmail", () => {
  it("ignora maiúsculas e espaços", () => {
    expect(normalizeEmail("  Maria@Gmail.COM ")).toBe("maria@gmail.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("findDuplicates", () => {
  const others = [
    { id: "a", email: "maria@gmail.com", phone: "+351 912 345 678" },
    { id: "b", email: "outra@gmail.com", phone: "911111111" },
    { id: "c", email: "MARIA@gmail.com", phone: null },
    { id: "d", email: null, phone: "912345678" },
  ];

  it("apanha por email (case-insensitive) e por telefone normalizado", () => {
    const matches = findDuplicates(
      { email: "maria@gmail.com", phone: "912 345 678" },
      others,
    );
    const ids = matches.map((m) => m.record.id);
    expect(ids).toEqual(["a", "c", "d"]);
    expect(matches[0].matchedBy).toBe("email + telemóvel");
    expect(matches[1].matchedBy).toBe("email");
    expect(matches[2].matchedBy).toBe("telemóvel");
  });

  it("sem contactos válidos não devolve nada (nunca match em vazio)", () => {
    expect(findDuplicates({ email: "", phone: "123" }, others)).toEqual([]);
    expect(
      findDuplicates({ email: null, phone: null }, [
        { id: "x", email: null, phone: null },
      ]),
    ).toEqual([]);
  });

  it("email vazio nos candidatos não faz match com email vazio", () => {
    expect(
      findDuplicates({ email: "so@tel.pt", phone: "919999999" }, [
        { id: "y", email: "", phone: "918888888" },
      ]),
    ).toEqual([]);
  });
});
