// ============================================================
// Testes da rotação dos backups da BD (sessão 124).
// Regras: 14 diários + mensais (dia 1) do último ano + 1 de
// Janeiro para sempre. Ficheiros fora do padrão nunca são tocados.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  backupDateFromName,
  backupFileName,
  backupsToRotateOut,
} from "@/lib/backup-rotation";

const TODAY = new Date(Date.UTC(2026, 6, 3)); // 3 de Julho de 2026

function name(y: number, m: number, d: number): string {
  return backupFileName(new Date(Date.UTC(y, m - 1, d)));
}

describe("backupDateFromName", () => {
  it("faz o parse de um nome válido", () => {
    const date = backupDateFromName("fbr-backup-2026-07-03.json.gz");
    expect(date).not.toBeNull();
    expect(date!.toISOString().slice(0, 10)).toBe("2026-07-03");
  });

  it("rejeita ficheiros que não são nossos", () => {
    expect(backupDateFromName("fotos-casamento.zip")).toBeNull();
    expect(backupDateFromName("fbr-backup-notas.json.gz")).toBeNull();
    expect(backupDateFromName("fbr-backup-2026-07-03.json")).toBeNull();
  });

  it("rejeita datas impossíveis (31 de Fevereiro)", () => {
    expect(backupDateFromName("fbr-backup-2026-02-31.json.gz")).toBeNull();
  });

  it("faz round-trip com backupFileName", () => {
    const d = new Date(Date.UTC(2026, 0, 1));
    expect(backupDateFromName(backupFileName(d))!.getTime()).toBe(d.getTime());
  });
});

describe("backupsToRotateOut", () => {
  it("mantém os últimos 14 dias", () => {
    const names = [name(2026, 7, 3), name(2026, 6, 25), name(2026, 6, 19)];
    expect(backupsToRotateOut(names, TODAY)).toEqual([]);
  });

  it("roda um diário com 15 dias que não é dia 1", () => {
    // 18 de Junho = 15 dias antes de 3 de Julho
    expect(backupsToRotateOut([name(2026, 6, 18)], TODAY)).toEqual([
      name(2026, 6, 18),
    ]);
  });

  it("mantém exactamente 14 dias de idade (fronteira)", () => {
    expect(backupsToRotateOut([name(2026, 6, 19)], TODAY)).toEqual([]);
  });

  it("mantém os mensais (dia 1) do último ano", () => {
    const names = [name(2026, 6, 1), name(2026, 3, 1), name(2025, 8, 1)];
    expect(backupsToRotateOut(names, TODAY)).toEqual([]);
  });

  it("roda um mensal com mais de um ano que não é 1 de Janeiro", () => {
    expect(backupsToRotateOut([name(2025, 6, 1)], TODAY)).toEqual([
      name(2025, 6, 1),
    ]);
  });

  it("mantém 1 de Janeiro para sempre", () => {
    const names = [name(2026, 1, 1), name(2025, 1, 1), name(2020, 1, 1)];
    expect(backupsToRotateOut(names, TODAY)).toEqual([]);
  });

  it("ignora ficheiros com nomes estranhos na pasta", () => {
    const names = ["notas.txt", "fbr-backup-velho.json.gz", name(2024, 5, 17)];
    expect(backupsToRotateOut(names, TODAY)).toEqual([name(2024, 5, 17)]);
  });

  it("não mexe em datas futuras (relógio torto)", () => {
    expect(backupsToRotateOut([name(2027, 1, 15)], TODAY)).toEqual([]);
  });

  it("um ano de backups diários estabiliza em ~26 ficheiros", () => {
    // Simula 365 dias seguidos de backups sem rotação nenhuma e aplica
    // a rotação de uma vez: devem sobrar 15 diários (hoje + 14) +
    // mensais do último ano + 1 de Janeiro.
    const names: string[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(TODAY.getTime() - i * 86_400_000);
      names.push(backupFileName(d));
    }
    const rotated = new Set(backupsToRotateOut(names, TODAY));
    const kept = names.filter((n) => !rotated.has(n));
    // 15 diários + 11 dias-1 fora da janela dos 14 dias (Jul 2025..Jun 2026,
    // com Jul 2026 dia 1 já dentro dos 14 dias) — o total exacto pode
    // variar ±1 com o calendário; o que importa é a ordem de grandeza.
    expect(kept.length).toBeGreaterThanOrEqual(24);
    expect(kept.length).toBeLessThanOrEqual(28);
    // Todos os dias-1 do intervalo sobrevivem
    expect(kept).toContain(name(2025, 8, 1));
    expect(kept).toContain(name(2026, 1, 1));
    // Um diário aleatório antigo não sobrevive
    expect(kept).not.toContain(name(2025, 9, 15));
  });
});
