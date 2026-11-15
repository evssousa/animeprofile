// Constantes do robô de notícias (portadas do site antigo: ai-news/constants.ts, anime-quota.ts e LISTICLE_RE).

/** O robô nunca publica fora destas categorias (nome igual a categories.name). */
export const ALLOWED_AI_CATEGORIES = ["Animes e Mangás", "Apps", "Filmes e Séries", "Eventos", "Games"] as const;

/** Modelos permitidos (lista fechada: nunca um id vindo de configuração livre). A cota grátis é por modelo. */
export const ALLOWED_GEMINI_MODELS = ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-2.5-flash"] as const;
export type GeminiModel = (typeof ALLOWED_GEMINI_MODELS)[number];
export const DEFAULT_GEMINI_MODEL: GeminiModel = "gemini-3-flash-preview";
export const isAllowedGeminiModel = (m: unknown): m is GeminiModel => typeof m === "string" && (ALLOWED_GEMINI_MODELS as readonly string[]).includes(m);

// ---------- equilíbrio de assunto ----------
export const ANIME_CATEGORY_SLUG = "animes-e-mangas";
export const DEFAULT_NON_ANIME_MAX_PCT = 33;
export const ANIME_PRIORITY_BOOST = 20;
export const isAnimeCategory = (slug: string | null | undefined) => slug === ANIME_CATEGORY_SLUG;

/** Quantas notícias fora de anime cabem por dia (pelo menos 1, se a cota não for 0). */
export function nonAnimeDailyLimit(dailyCap: number, maxPct: number): number {
  if (maxPct <= 0) return 0;
  return Math.max(1, Math.floor((dailyCap * Math.min(100, maxPct)) / 100));
}

export const nonAnimeAllowed = (o: { dailyCap: number; maxPct: number; nonAnimeToday: number }) => o.nonAnimeToday < nonAnimeDailyLimit(o.dailyCap, o.maxPct);

const ANIME_RE =
  /\b(anime|animes|mang[aá]s?|light novel|crunchyroll|funimation|toei|mappa|ufotable|shonen|shounen|shojo|seinen|isekai|jump|kodansha|shueisha|otaku|cosplay|dublagem|temporada|epis[oó]dios?|season|episode|studio|est[uú]dio)\b/i;
const NON_ANIME_RE =
  /\b(xbox|playstation|ps5|nintendo|switch|steam|game pass|marvel|dc comics|batman|superman|homem-aranha|spider-man|star wars|netflix series|live-action|hbo|disney\+|filme da marvel|trailer do filme)\b/i;

/** Palpite antes de gerar o texto (só título e resumo): parece notícia de anime/mangá? */
export const looksLikeAnime = (text: string) => ANIME_RE.test(text) && !NON_ANIME_RE.test(text);

// ---------- listas ("Top 5", "As 10 melhores") não são notícia ----------
const LISTICLE_NOUNS =
  "animes?|mangás?|mangas?|momentos?|personagens?|cenas?|episódios?|episodios?|" +
  "filmes?|séries?|series?|temporadas?|teorias?|fatos?|segredos?|easter\\s*eggs?|" +
  "vilões?|viloes?|heróis?|herois?|protagonistas?|frases?|músicas?|musicas?|" +
  "openings?|endings?|aberturas?|encerramentos?|lutas?|batalhas?|mortes?|" +
  "transformações?|transformacoes?|poderes?|técnicas?|tecnicas?|arcos?|" +
  "capítulos?|capitulos?|jogos?|games?|estúdios?|estudios?|obras?|" +
  "melhores|piores|maiores|menores|dicas|motivos|razões|razoes|curiosidades|" +
  "coisas|formas|maneiras|truques|exemplos|provas|sinais|detalhes|" +
  "referências|referencias|spoilers?|surpresas|reviravoltas|crossovers?";
export const LISTICLE_RE = new RegExp("(?:^|[\\s:\\-—–|·•])(?:top\\s*\\d+|(?:os|as)\\s+\\d+\\s+\\p{L}+|\\d{1,3}\\s+(?:" + LISTICLE_NOUNS + "))\\b", "iu");

/** Limites de tempo e de ritmo da rodada. */
export const RUN_BUDGET_MS = 9 * 60_000;
export const MIN_TIME_FOR_CANDIDATE_MS = 150_000;
export const RUN_LOCK_MINUTES = 20;
export const BACKUP_POOL = 3;
export const MAX_QUALITY_ATTEMPTS = 2;
export const RSS_CONCURRENCY = 4;
export const BOT_UA = "Mozilla/5.0 (compatible; AnimeProfileBot/1.0; +https://animeprofile.com.br)";
