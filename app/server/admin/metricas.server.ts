// Métricas do painel (/admin/retention): audiência e conteúdo com dado real (visitas sem cookie, matérias, quiz), retrato semanal
// e registro de decisões. As métricas de contas (ativação, retenção, NPS, pagamento) só nascem quando o cadastro abrir.
// Datas em Brasília (`diaBrasilia`); a semana começa na segunda-feira. Docs: docs/plano-telas-painel.md, tela 2.
import { exec, query } from "../db.server";
import { diaBrasilia, ddmm, somarDias } from "~/visitas/core/dia";

const num = (v: unknown) => Number(v ?? 0) || 0;

// ───────────── Datas ─────────────

/** Segunda-feira (Brasília) da semana do dia dado. */
export function segundaDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7; // segunda = 0
  return somarDias(dia, -wd);
}

/** Segunda-feira da última semana COMPLETA (a de sempre que a tarefa de segunda 9h30 grava). */
export const ultimaSemanaCompleta = (hoje: string) => somarDias(segundaDe(hoje), -7);

/** Início (inclusive) e fim (exclusive) de um intervalo de dias de Brasília, em UTC, para comparar com colunas DATETIME em UTC. */
const utc = (dia: string) => `${dia} 03:00:00`; // Brasília = UTC−3, sem horário de verão

// ───────────── Números de um período ─────────────

export type Retrato = {
  v: 1;
  visitantesDia: number;
  paginasPorVisita: number | null;
  buscaPct: number | null;
  quizConclusaoPct: number | null;
  procuraContas: number;
  publicadas: { robo: number; agenda: number; painel: number; old: number };
  entradasPorOrigem: Record<string, number>;
};

/** Os números dos dias `de` a `ate` (inclusive). */
export async function calcularPeriodo(de: string, ate: string): Promise<Retrato> {
  const dias = Math.max(1, Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000) + 1);
  const fim = somarDias(ate, 1);
  const [[d], origens, [quiz], [vquiz], [contas], pubs] = await Promise.all([
    query<{ vi: number; pv: number; en: number }>("SELECT SUM(visitors) AS vi, SUM(pageviews) AS pv, SUM(entries) AS en FROM visit_daily WHERE day BETWEEN ? AND ?", [de, ate]),
    query<{ value: string; n: number }>("SELECT value, SUM(n) AS n FROM visit_dims WHERE dim = 'origem' AND day BETWEEN ? AND ? GROUP BY value", [de, ate]),
    query<{ n: number }>("SELECT COUNT(*) AS n FROM quiz_plays WHERE created_at >= ? AND created_at < ?", [utc(de), utc(fim)]),
    query<{ v: number }>("SELECT SUM(views) AS v FROM visit_pages WHERE kind = 'quiz' AND day BETWEEN ? AND ?", [de, ate]),
    query<{ v: number }>("SELECT SUM(views) AS v FROM visit_pages WHERE kind = 'contas' AND day BETWEEN ? AND ?", [de, ate]),
    query<{ cls: string; n: number }>(
      `SELECT CASE WHEN source_url LIKE 'agenda de animes%' THEN 'agenda' WHEN origin = 'robo' THEN 'robo' WHEN origin = 'old' THEN 'old' ELSE 'painel' END AS cls, COUNT(*) AS n
       FROM posts WHERE status = 'published' AND published_at >= ? AND published_at < ? GROUP BY cls`,
      [utc(de), utc(fim)],
    ),
  ]);
  const porOrigem: Record<string, number> = {};
  for (const o of origens) if (o.value !== "interno") porOrigem[o.value] = num(o.n);
  const totalEntradas = Object.values(porOrigem).reduce((a, b) => a + b, 0);
  const pub = { robo: 0, agenda: 0, painel: 0, old: 0 };
  for (const p of pubs) if (p.cls in pub) pub[p.cls as keyof typeof pub] = num(p.n);
  const vq = num(vquiz?.v);
  return {
    v: 1,
    visitantesDia: Math.round(num(d?.vi) / dias),
    paginasPorVisita: num(d?.en) > 0 ? Math.round((num(d?.pv) / num(d?.en)) * 10) / 10 : null,
    buscaPct: totalEntradas > 0 ? Math.round(((porOrigem.busca ?? 0) / totalEntradas) * 100) : null,
    quizConclusaoPct: vq > 0 ? Math.round((num(quiz?.n) / vq) * 100) : null,
    procuraContas: num(contas?.v),
    publicadas: pub,
    entradasPorOrigem: porOrigem,
  };
}

// ───────────── Os 5 cartões ─────────────

export type CartaoMetrica = {
  id: string;
  rotulo: string;
  valor: number | null;
  formato: "int" | "dec" | "pct";
  /** Variação contra a semana anterior: em % (contagens) ou em pontos (porcentagens). `null` = sem base para comparar. */
  delta: number | null;
  unidadeDelta: "%" | "pts" | "abs";
  sub: string;
  piorar: string;
};

function variacao(atual: number | null, antes: number | null, tipo: "pct" | "pts" | "abs"): number | null {
  if (atual === null || antes === null) return null;
  if (tipo === "pts") return Math.round(atual - antes);
  if (tipo === "abs") return Math.round((atual - antes) * 10) / 10;
  return antes > 0 ? Math.round(((atual - antes) / antes) * 100) : null;
}

export function montarCartoes(a: Retrato, b: Retrato): CartaoMetrica[] {
  return [
    { id: "visitantes", rotulo: "Visitantes por dia", valor: a.visitantesDia, formato: "int", delta: variacao(a.visitantesDia, b.visitantesDia, "pct"), unidadeDelta: "%", sub: "média dos últimos 7 dias", piorar: "ver em Visitas qual origem caiu antes de mudar o conteúdo." },
    { id: "paginas", rotulo: "Páginas por visita", valor: a.paginasPorVisita, formato: "dec", delta: variacao(a.paginasPorVisita, b.paginasPorVisita, "abs"), unidadeDelta: "abs", sub: "páginas vistas ÷ entradas", piorar: "revisar os links internos e a lateral das matérias." },
    { id: "busca", rotulo: "Vindas da busca", valor: a.buscaPct, formato: "pct", delta: variacao(a.buscaPct, b.buscaPct, "pts"), unidadeDelta: "pts", sub: "das entradas no site", piorar: "conferir o Search Console (cobertura e títulos)." },
    { id: "quiz", rotulo: "Conclusão do quiz", valor: a.quizConclusaoPct, formato: "pct", delta: variacao(a.quizConclusaoPct, b.quizConclusaoPct, "pts"), unidadeDelta: "pts", sub: "partidas ÷ páginas de quiz vistas", piorar: "olhar o quiz com mais saída e encurtar." },
    { id: "contas", rotulo: "Procura pelas contas", valor: a.procuraContas, formato: "int", delta: variacao(a.procuraContas, b.procuraContas, "pct"), unidadeDelta: "%", sub: "páginas de login e contas vistas", piorar: "é gente querendo entrar: sinal para priorizar a fase 2." },
  ];
}

// ───────────── Rendimento do conteúdo ─────────────

export type Rendimento = {
  porOrigem: { origem: "robo" | "agenda" | "painel" | "old"; materias: number; mediaVistas: number }[];
  topEntradas: { path: string; titulo: string; entradas: number }[];
};

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Vistas por matéria nos 7 primeiros dias (só matérias publicadas há 7+ dias e nos últimos 60) e as que mais trouxeram entradas em 30 dias. */
export async function rendimento(hoje: string): Promise<Rendimento> {
  const limiteNovo = utc(somarDias(hoje, -7));
  const desde = utc(somarDias(hoje, -60));
  const posts = await query<{ slug: string; post_type: string; cls: string; dia: string }>(
    `SELECT slug, post_type, CASE WHEN source_url LIKE 'agenda de animes%' THEN 'agenda' WHEN origin = 'robo' THEN 'robo' WHEN origin = 'old' THEN 'old' ELSE 'painel' END AS cls,
            DATE_FORMAT(DATE_SUB(published_at, INTERVAL 3 HOUR), '%Y-%m-%d') AS dia
     FROM posts WHERE status = 'published' AND published_at >= ? AND published_at <= ?`,
    [desde, limiteNovo],
  );
  const caminho = (p: { slug: string; post_type: string }) => `/${p.post_type === "article" ? "artigos" : "noticias"}/${p.slug}`;
  const vistas = new Map<string, Map<string, number>>(); // path -> dia -> views
  for (const parte of chunk(posts.map(caminho), 200)) {
    if (!parte.length) continue;
    const rows = await query<{ path: string; dia: string; v: number }>(
      `SELECT path, DATE_FORMAT(day, '%Y-%m-%d') AS dia, views AS v FROM visit_pages WHERE path IN (${parte.map(() => "?").join(",")}) AND day >= ?`,
      [...parte, somarDias(hoje, -67)],
    );
    for (const r of rows) (vistas.get(r.path) ?? vistas.set(r.path, new Map()).get(r.path)!).set(r.dia, num(r.v));
  }
  const soma = new Map<string, { n: number; total: number }>();
  for (const p of posts) {
    const dias = vistas.get(caminho(p));
    let total = 0;
    for (let i = 0; i < 7; i++) total += dias?.get(somarDias(p.dia, i)) ?? 0;
    const s = soma.get(p.cls) ?? { n: 0, total: 0 };
    soma.set(p.cls, { n: s.n + 1, total: s.total + total });
  }
  const ordem = ["robo", "agenda", "painel", "old"] as const;
  const porOrigem = ordem.filter((o) => soma.has(o)).map((o) => ({ origem: o, materias: soma.get(o)!.n, mediaVistas: Math.round(soma.get(o)!.total / soma.get(o)!.n) }));

  const top = await query<{ path: string; e: number }>(
    "SELECT path, SUM(entries) AS e FROM visit_pages WHERE kind = 'materia' AND day BETWEEN ? AND ? GROUP BY path HAVING e > 0 ORDER BY e DESC, path LIMIT 5",
    [somarDias(hoje, -29), hoje],
  );
  const slugs = top.map((t) => t.path.split("/")[2]).filter(Boolean);
  const nomes = slugs.length ? await query<{ slug: string; title: string }>(`SELECT slug, title FROM posts WHERE slug IN (${slugs.map(() => "?").join(",")})`, slugs) : [];
  const titulo = new Map(nomes.map((n) => [n.slug, n.title]));
  return { porOrigem, topEntradas: top.map((t) => ({ path: t.path, titulo: titulo.get(t.path.split("/")[2]) ?? t.path, entradas: num(t.e) })) };
}

// ───────────── De onde vêm, semana a semana ─────────────

export type SemanaOrigem = { semana: string; rotulo: string; total: number; valores: Record<string, number> };

/** As últimas 8 semanas (a atual, parcial, é a última). */
export async function origensSemanais(hoje: string): Promise<SemanaOrigem[]> {
  const atual = segundaDe(hoje);
  const inicio = somarDias(atual, -49);
  const rows = await query<{ dia: string; value: string; n: number }>(
    "SELECT DATE_FORMAT(day, '%Y-%m-%d') AS dia, value, n FROM visit_dims WHERE dim = 'origem' AND value <> 'interno' AND day BETWEEN ? AND ?",
    [inicio, hoje],
  );
  const semanas: SemanaOrigem[] = Array.from({ length: 8 }, (_, i) => {
    const s = somarDias(inicio, i * 7);
    return { semana: s, rotulo: ddmm(s), total: 0, valores: {} };
  });
  for (const r of rows) {
    const s = semanas.find((x) => r.dia >= x.semana && r.dia <= somarDias(x.semana, 6));
    if (!s) continue;
    s.valores[r.value] = (s.valores[r.value] ?? 0) + num(r.n);
    s.total += num(r.n);
  }
  return semanas;
}

// ───────────── Histórico semanal e decisões (tabelas da migration 014) ─────────────

const SEM_TABELA = "ER_NO_SUCH_TABLE";
const faltaTabela = (e: unknown) => (e as { code?: string })?.code === SEM_TABELA;

const lerJson = <T,>(v: unknown): T | null => {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
};

export type LinhaHistorico = { semana: string; dados: Retrato };

/** Os últimos retratos. `null` = a migration 014 ainda não rodou. */
export async function historico(limite = 12): Promise<LinhaHistorico[] | null> {
  try {
    const rows = await query<{ w: string; data: unknown }>("SELECT DATE_FORMAT(week, '%Y-%m-%d') AS w, data FROM metrics_snapshots ORDER BY week DESC LIMIT ?", [limite]);
    return rows.flatMap((r) => {
      const dados = lerJson<Retrato>(r.data);
      return dados ? [{ semana: r.w, dados }] : [];
    });
  } catch (e) {
    if (faltaTabela(e)) return null;
    throw e;
  }
}

/** Grava (ou refaz) o retrato da semana que começa na segunda-feira `segunda`. */
export async function gravarRetrato(segunda: string): Promise<Retrato> {
  const dados = await calcularPeriodo(segunda, somarDias(segunda, 6));
  await exec("INSERT INTO metrics_snapshots (week, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)", [segunda, JSON.stringify(dados)]);
  return dados;
}

export type Decisao = { id: number; problema: string; decisao: string; motivo: string | null; quem: string | null; revisarEm: string | null; discordancia: string | null; status: "aberta" | "revista"; criadaEm: string; vencida: boolean };

export async function decisoes(hoje: string): Promise<Decisao[] | null> {
  try {
    const rows = await query<{ id: number; problem: string; decision: string; reason: string | null; owner: string | null; review: string | null; dissent: string | null; status: string; criada: string }>(
      "SELECT id, problem, decision, reason, owner, DATE_FORMAT(review_at, '%Y-%m-%d') AS review, dissent, status, DATE_FORMAT(created_at, '%Y-%m-%d') AS criada FROM metrics_decisions ORDER BY status ASC, COALESCE(review_at, '9999-12-31') ASC, id DESC LIMIT 50",
    );
    return rows.map((r) => ({
      id: num(r.id),
      problema: r.problem,
      decisao: r.decision,
      motivo: r.reason,
      quem: r.owner,
      revisarEm: r.review,
      discordancia: r.dissent,
      status: r.status === "revista" ? "revista" : "aberta",
      criadaEm: r.criada,
      vencida: r.status !== "revista" && !!r.review && r.review <= hoje,
    }));
  } catch (e) {
    if (faltaTabela(e)) return null;
    throw e;
  }
}

export type NovaDecisao = { problema: string; decisao: string; motivo?: string; quem?: string; revisarEm?: string; discordancia?: string };

/** Registra a decisão junto com os números do momento (últimos 7 dias). */
export async function registrarDecisao(d: NovaDecisao, hoje: string): Promise<void> {
  const retrato = await calcularPeriodo(somarDias(hoje, -7), somarDias(hoje, -1));
  await exec("INSERT INTO metrics_decisions (problem, decision, reason, owner, review_at, dissent, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    d.problema,
    d.decisao,
    d.motivo || null,
    d.quem || null,
    d.revisarEm || null,
    d.discordancia || null,
    JSON.stringify(retrato),
  ]);
}

export async function marcarRevista(id: number): Promise<void> {
  await exec("UPDATE metrics_decisions SET status = 'revista' WHERE id = ?", [id]);
}

// ───────────── Tudo da tela ─────────────

export async function resumoMetricas(hoje = diaBrasilia()) {
  const [a, b, rend, semanas, hist, decs] = await Promise.all([
    calcularPeriodo(somarDias(hoje, -7), somarDias(hoje, -1)),
    calcularPeriodo(somarDias(hoje, -14), somarDias(hoje, -8)),
    rendimento(hoje),
    origensSemanais(hoje),
    historico(),
    decisoes(hoje),
  ]);
  return { hoje, cartoes: montarCartoes(a, b), rendimento: rend, semanas, historico: hist, decisoes: decs, semBase: a.visitantesDia === 0 && b.visitantesDia === 0 };
}
