// Monta o prompt do Gemini. O GUIA EDITORIAL (a "receita" do robô) NÃO fica no código: o repositório é público.
// Ele vem do banco (system_config 'robo.guia'), enviado pelo script importar-config-robo. Aqui ficam só as peças de montagem.

export type AnilistContextForPrompt = {
  title: string;
  format: string | null;
  episodes: number | null;
  statusLabel: string;
  seasonLabel: string | null;
  studio: string | null;
  streamers: string[];
};

/** A classificação de categoria vem antes da escolha do autor, então a geração usa este prompt neutro. */
export const NEUTRAL_EDITOR_PROMPT =
  "Você é um editor de notícias de anime e mangá, neutro e objetivo. Classifique o conteúdo na categoria " +
  "mais adequada com base no tema do artigo, não na fonte.";

export function buildSystemPrompt(guide: string): string {
  if (!guide.trim()) throw new Error("guia editorial não importado");
  return `${NEUTRAL_EDITOR_PROMPT}\n\n${guide.trim()}`;
}

export function buildRetryInstruction(issues: string[]): string {
  return (
    "A geração anterior falhou na checagem de qualidade. Gere de novo, corrigindo especificamente:\n" +
    issues.map((i) => `- ${i}`).join("\n") +
    "\n\nMantenha o mesmo formato de resposta (JSON com os mesmos campos)."
  );
}

export function buildUserPrompt(opts: {
  candidateTitle: string;
  candidateSummary: string | null;
  candidateContent: string | null;
  sourceUrl: string;
  categorySlugs: string[];
  trailer?: string;
  extraVideos: string[];
  bodyImages: string[];
  anilistContext: AnilistContextForPrompt | null;
  recentOpenings: string[];
}): string {
  const mediaHint = [
    opts.trailer ? `TRAILER PRINCIPAL (incorporar no topo): ${opts.trailer}` : "",
    opts.extraVideos.length ? `VÍDEOS EXTRAS DA FONTE (incorporar todos): ${opts.extraVideos.join(" | ")}` : "",
    opts.bodyImages.length ? `IMAGENS DA FONTE (incorporar TODAS as ${opts.bodyImages.length}, distribuídas pelo texto): ${opts.bodyImages.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const c = opts.anilistContext;
  const contextHint = c
    ? [
        "CONTEXTO VERIFICADO (AniList — use para o bloco 'Para o fã brasileiro' e o 'Mais sobre'; nunca contradiga):",
        `- Título oficial: ${c.title}`,
        c.format ? `- Formato: ${c.format}` : "",
        c.episodes ? `- Episódios: ${c.episodes}` : "",
        `- Status: ${c.statusLabel}`,
        c.seasonLabel ? `- Temporada: ${c.seasonLabel}` : "",
        c.studio ? `- Estúdio: ${c.studio}` : "",
        c.streamers.length ? `- Onde assistir (oficial): ${c.streamers.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "SEM CONTEXTO VERIFICADO — omita o bloco 'Para o fã brasileiro' e não invente onde assistir/dublagem/preço.";

  const openingsHint = opts.recentOpenings.length ? `NÃO repita a estrutura destas últimas notícias do mesmo autor:\n${opts.recentOpenings.map((o) => `- ${o}`).join("\n")}` : "";

  return [
    `NOTÍCIA ORIGINAL:`,
    `TÍTULO: ${opts.candidateTitle}`,
    `RESUMO: ${opts.candidateSummary ?? "(sem resumo)"}`,
    `CORPO: ${opts.candidateContent || "(sem corpo)"}`,
    `FONTE: ${opts.sourceUrl}`,
    "",
    `CATEGORIAS DISPONÍVEIS (escolha o slug mais adequado): ${opts.categorySlugs.join(", ")}`,
    "",
    mediaHint ? `MÍDIA DISPONÍVEL:\n${mediaHint}` : "",
    "",
    contextHint,
    "",
    openingsHint,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
