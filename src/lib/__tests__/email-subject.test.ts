import { describe, it, expect } from "vitest";
import { splitAssunto } from "@/lib/email-subject";

describe("splitAssunto", () => {
  it("separa o assunto em português", () => {
    const { subject, body } = splitAssunto(
      "Assunto: A sua reserva de preservação\n\nOlá Maria,\n\nObrigada pelo pedido.",
    );
    expect(subject).toBe("A sua reserva de preservação");
    expect(body).toBe("Olá Maria,\n\nObrigada pelo pedido.");
  });

  it("separa o assunto em inglês", () => {
    const { subject, body } = splitAssunto("Subject: Your booking\nHi Anna,");
    expect(subject).toBe("Your booking");
    expect(body).toBe("Hi Anna,");
  });

  it("sem linha de assunto devolve o texto inteiro como corpo", () => {
    const texto = "Olá Maria,\n\nObrigada pelo pedido.";
    expect(splitAssunto(texto)).toEqual({ subject: null, body: texto });
  });

  it("não come a primeira frase quando o assunto vem formatado de outra maneira", () => {
    const texto = "**Assunto:** A sua reserva\n\nOlá Maria,";
    expect(splitAssunto(texto).subject).toBeNull();
    expect(splitAssunto(texto).body).toBe(texto);
  });
});
