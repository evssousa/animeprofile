import { describe, expect, it } from "vitest";
import { nextRun, parseCron } from "~/server/cron/schedule";

// Brasília é UTC-3 (sem horário de verão desde 2019): 04:30 em Brasília = 07:30 UTC.
const utc = (s: string) => new Date(`${s}Z`);

describe("nextRun (horário de Brasília)", () => {
  it("diária: mesmo dia se ainda não passou, senão o dia seguinte", () => {
    expect(nextRun("30 4 * * *", utc("2026-11-12T06:00:00")).toISOString()).toBe("2026-11-12T07:30:00.000Z");
    expect(nextRun("30 4 * * *", utc("2026-11-12T07:30:00")).toISOString()).toBe("2026-11-13T07:30:00.000Z");
  });

  it("é sempre estritamente depois do momento dado", () => {
    expect(nextRun("*/5 * * * *", utc("2026-11-12T10:05:00")).toISOString()).toBe("2026-11-12T10:10:00.000Z");
    expect(nextRun("*/5 * * * *", utc("2026-11-12T10:05:59")).toISOString()).toBe("2026-11-12T10:10:00.000Z");
  });

  it("de hora em hora num minuto fixo", () => {
    expect(nextRun("7 * * * *", utc("2026-11-12T10:08:00")).toISOString()).toBe("2026-11-12T11:07:00.000Z");
  });

  it("semanal: segunda-feira às 02:50 (2026-11-16 é segunda)", () => {
    expect(nextRun("50 2 * * 1", utc("2026-11-12T12:00:00")).toISOString()).toBe("2026-11-16T05:50:00.000Z");
  });

  it("mensal: dia 1 ao meio-dia, atravessando o mês", () => {
    expect(nextRun("0 12 1 * *", utc("2026-11-12T12:00:00")).toISOString()).toBe("2026-12-01T15:00:00.000Z");
  });

  it("domingo aceita 0 e 7; listas e intervalos", () => {
    const a = nextRun("0 9 * * 0", utc("2026-11-12T00:00:00")).toISOString();
    const b = nextRun("0 9 * * 7", utc("2026-11-12T00:00:00")).toISOString();
    expect(a).toBe("2026-11-15T12:00:00.000Z");
    expect(b).toBe(a);
    expect(nextRun("0 8-10/2 * * *", utc("2026-11-12T11:30:00")).toISOString()).toBe("2026-11-12T13:00:00.000Z");
    expect(nextRun("15,45 * * * *", utc("2026-11-12T10:20:00")).toISOString()).toBe("2026-11-12T10:45:00.000Z");
  });

  it("dia do mês e da semana restritos: basta um dos dois (cron clássico)", () => {
    // dia 13 ou sexta-feira: 2026-11-13 é sexta, então o próximo depois dele é o dia 20 (sexta).
    expect(nextRun("0 0 13 * 5", utc("2026-11-13T04:00:00")).toISOString()).toBe("2026-11-20T03:00:00.000Z");
  });

  it("rejeita expressões inválidas", () => {
    expect(() => parseCron("* * *")).toThrow();
    expect(() => parseCron("60 * * * *")).toThrow();
    expect(() => parseCron("a * * * *")).toThrow();
    expect(() => parseCron("0 0 31 2 *")).not.toThrow();
    expect(() => nextRun("0 0 31 2 *", utc("2026-01-01T00:00:00"))).toThrow();
  });
});
