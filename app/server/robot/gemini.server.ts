// Chamada REST ao Gemini (sem SDK). A chave vai no cabeçalho e NUNCA aparece em log nem em mensagem de erro.
import { ARTICLE_JSON_SCHEMA } from "./contract";

export type GeminiUsage = { inputTokens: number; outputTokens: number };
export type GeminiResult = { text: string; usage: GeminiUsage };
/** Chamado a cada resposta (inclusive 429), para contar o uso do dia por modelo. */
export type UsageRecorder = (u: { model: string; status: number; inputTokens: number; outputTokens: number }) => void | Promise<void>;

type GeminiBody = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; totalTokenCount?: number };
  error?: { message?: string; details?: { "@type"?: string; retryDelay?: string; violations?: { quotaMetric?: string; quotaId?: string }[] }[] };
};

const RETRY_WAITS_MS = [20_000, 60_000];
/** Se o Google mandar esperar mais que isso (cota diária), desiste até a próxima rodada em vez de dormir. */
export const MAX_RETRY_WAIT_MS = 90_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryDelayMs(b: GeminiBody): number | null {
  const raw = b.error?.details?.find((d) => d.retryDelay)?.retryDelay;
  const m = raw?.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(parseFloat(m[1]) * 1000) : null;
}

function quotaId(b: GeminiBody): string | null {
  const q = b.error?.details?.find((d) => d["@type"]?.includes("QuotaFailure"));
  return q?.violations?.[0]?.quotaId ?? q?.violations?.[0]?.quotaMetric ?? null;
}

export class GeminiError extends Error {
  constructor(message: string, public status: number, public retryable: boolean) {
    super(message);
    this.name = "GeminiError";
  }
}

/** generateContent com esquema JSON; repete em 429/5xx (nunca em 400/403, que são erro de configuração). */
export async function generateWithGemini(opts: {
  model: string;
  system: string;
  user: string;
  jsonSchema?: object;
  apiKey?: string;
  record?: UsageRecorder;
  /** Para testes. */
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<GeminiResult> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente.");
  const doFetch = opts.fetchImpl ?? fetch;
  const wait = opts.sleepImpl ?? sleep;

  for (let attempt = 0; ; attempt++) {
    const res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: opts.jsonSchema ?? ARTICLE_JSON_SCHEMA },
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      await opts.record?.({ model: opts.model, status: res.status, inputTokens: 0, outputTokens: 0 });
      const body = (await res.json().catch(() => ({}))) as GeminiBody;
      const retryable = res.status === 429 || res.status >= 500;
      const delay = retryDelayMs(body) ?? RETRY_WAITS_MS[attempt] ?? 0;
      if (retryable && attempt < RETRY_WAITS_MS.length && delay <= MAX_RETRY_WAIT_MS) {
        await wait(delay);
        continue;
      }
      const q = quotaId(body);
      const suffix = q ? ` [quota: ${q}]` : "";
      if (retryable && delay > MAX_RETRY_WAIT_MS) {
        throw new GeminiError(`Gemini ${res.status}: pediu para esperar ${Math.round(delay / 60_000)} min${suffix}; tenta na próxima rodada.`, res.status, true);
      }
      throw new GeminiError(`Gemini ${res.status}: ${body.error?.message ?? res.statusText}${suffix}`.slice(0, 500), res.status, retryable);
    }

    const json = (await res.json()) as GeminiBody;
    const input = json.usageMetadata?.promptTokenCount ?? 0;
    const output = Math.max(0, (json.usageMetadata?.totalTokenCount ?? input) - input);
    await opts.record?.({ model: opts.model, status: 200, inputTokens: input, outputTokens: output });
    const candidate = json.candidates?.[0];
    if (!candidate || candidate.finishReason !== "STOP") {
      throw new GeminiError(`Gemini finishReason inesperado: ${candidate?.finishReason ?? "desconhecido"}`, 200, false);
    }
    const text = (candidate.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
    return { text, usage: { inputTokens: input, outputTokens: output } };
  }
}
