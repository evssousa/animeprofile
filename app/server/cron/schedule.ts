// Expressões de cron (5 campos) no horário de Brasília. Sem dependências: o suficiente para a agenda
// do site (números, *, */n, a-b, a-b/n e listas com vírgula). Dia da semana: 0 ou 7 = domingo.
//
// Quando dia do mês e dia da semana são restritos, vale o cron clássico: basta um dos dois bater.

export const TZ = "America/Sao_Paulo";

type Field = Set<number>;
export type Cron = { min: Field; hour: Field; dom: Field; mon: Field; dow: Field; domAny: boolean; dowAny: boolean };

function parseField(src: string, lo: number, hi: number): Field {
  const out = new Set<number>();
  for (const part of src.split(",")) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`cron inválido: "${src}"`);
    const step = m[2] ? Number(m[2]) : 1;
    let a = lo;
    let b = hi;
    if (m[1] !== "*") {
      const [x, y] = m[1].split("-").map(Number);
      a = x;
      b = y ?? (m[2] ? hi : x);
    }
    if (a < lo || b > hi || a > b || step < 1) throw new Error(`cron fora do intervalo: "${src}"`);
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return out;
}

export function parseCron(expr: string): Cron {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) throw new Error(`cron precisa de 5 campos: "${expr}"`);
  const dow = parseField(f[4], 0, 7);
  if (dow.has(7)) dow.add(0);
  return {
    min: parseField(f[0], 0, 59),
    hour: parseField(f[1], 0, 23),
    dom: parseField(f[2], 1, 31),
    mon: parseField(f[3], 1, 12),
    dow,
    domAny: f[2] === "*",
    dowAny: f[4] === "*",
  };
}

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
});
const WEEK: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type Wall = { month: number; day: number; hour: number; minute: number; dow: number };

function wall(d: Date): Wall {
  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(d)) p[type] = value;
  return { month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, dow: WEEK[p.weekday] };
}

function matches(c: Cron, w: Wall): boolean {
  if (!c.min.has(w.minute) || !c.hour.has(w.hour) || !c.mon.has(w.month)) return false;
  const domOk = c.dom.has(w.day);
  const dowOk = c.dow.has(w.dow);
  if (c.domAny && c.dowAny) return true;
  if (c.domAny) return dowOk;
  if (c.dowAny) return domOk;
  return domOk || dowOk;
}

/** Próximo minuto, estritamente depois de `after`, em que a expressão bate (procura até ~1 ano). */
export function nextRun(expr: string | Cron, after: Date): Date {
  const c = typeof expr === "string" ? parseCron(expr) : expr;
  const t = new Date(after);
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(t.getUTCMinutes() + 1);
  const limit = t.getTime() + 370 * 24 * 60 * 60_000;
  while (t.getTime() <= limit) {
    // Pula horas inteiras que não batem (deixa a busca de um mês inteiro rápida).
    const w = wall(t);
    if (!c.hour.has(w.hour) || !c.mon.has(w.month)) {
      t.setUTCMinutes(t.getUTCMinutes() + (60 - w.minute));
      continue;
    }
    if (matches(c, w)) return t;
    t.setUTCMinutes(t.getUTCMinutes() + 1);
  }
  throw new Error(`cron sem próxima execução em um ano: "${typeof expr === "string" ? expr : "?"}"`);
}
