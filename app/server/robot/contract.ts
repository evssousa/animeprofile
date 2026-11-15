// Validação do JSON que o Gemini devolve (o modelo pode ignorar o schema, então sempre revalidamos).
import { z } from "zod";

export const GeneratedArticle = z.object({
  title: z.string().min(10).max(80),
  titleVariants: z.array(z.string().min(10).max(80)).max(3).default([]),
  focusKeyword: z.string().min(2).max(60),
  metaDescription: z.string().min(60).max(170),
  excerpt: z.string().min(40).max(280),
  html: z.string().min(200).max(200_000),
  tags: z.array(z.string().min(1).max(60)).max(10),
  categorySlug: z.string().min(1),
  animeFocus: z.enum(["main", "mentioned", "none"]),
  /** Nome (inglês/romaji) do anime em foco, para a busca de confirmação no AniList. */
  animeTitle: z.string().min(2).max(120).nullable(),
  /** Game/filme/série/app com ligação ao universo otaku? Sem ligação, a publicação descarta. */
  otakuRelated: z.boolean().default(true),
});
export type GeneratedArticle = z.infer<typeof GeneratedArticle>;

/** Esquema enviado ao Gemini (responseJsonSchema). */
export const ARTICLE_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 10, maxLength: 80 },
    titleVariants: { type: "array", items: { type: "string", minLength: 10, maxLength: 80 }, maxItems: 3 },
    focusKeyword: { type: "string", minLength: 2, maxLength: 60 },
    metaDescription: { type: "string", minLength: 60, maxLength: 170 },
    excerpt: { type: "string", minLength: 40, maxLength: 280 },
    html: { type: "string", minLength: 200 },
    tags: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 10 },
    categorySlug: { type: "string" },
    animeFocus: { type: "string", enum: ["main", "mentioned", "none"] },
    animeTitle: { type: ["string", "null"], minLength: 2, maxLength: 120 },
    otakuRelated: { type: "boolean" },
  },
  required: ["title", "focusKeyword", "metaDescription", "excerpt", "html", "tags", "categorySlug", "animeFocus", "animeTitle", "otakuRelated"],
} as const;

/** Extrai o objeto JSON da resposta (tira cercas ```json etc.). */
export function parseGeminiJson(text: string): unknown {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}
