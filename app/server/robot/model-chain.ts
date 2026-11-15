// Fila de modelos do Gemini. A cota grátis é por modelo: quando um esgota (429) ou não existe (404), o próximo assume.
// Um modelo também sai da fila quando já fez `chamadasDiaPorModelo` chamadas nas últimas 24 h (ver `canUse`).
import { ALLOWED_GEMINI_MODELS, type GeminiModel } from "./constants";
import { GeminiError, generateWithGemini, type GeminiResult, type UsageRecorder } from "./gemini.server";

export function newsModelChain(main: GeminiModel): GeminiModel[] {
  return [main, ...ALLOWED_GEMINI_MODELS.filter((m) => m !== main)];
}

type Generate = typeof generateWithGemini;

/** Estado de uma rodada: modelos sem cota nesta rodada. Nasce vazio a cada rodada (nada fica entre rodadas). */
export class ModelChain {
  private unavailable = new Set<string>();
  constructor(
    readonly models: readonly GeminiModel[],
    private opts: { canUse?: (m: GeminiModel) => Promise<boolean>; record?: UsageRecorder; generate?: Generate; log?: (msg: string) => void } = {},
  ) {}

  /** Todos os modelos já esgotaram nesta rodada: não vale pegar o próximo pedido. */
  exhausted = () => this.models.every((m) => this.unavailable.has(m));

  async generate(input: { system: string; user: string }): Promise<GeminiResult & { model: GeminiModel }> {
    const gen = this.opts.generate ?? generateWithGemini;
    let last: GeminiError | null = null;
    for (const model of this.models) {
      if (this.unavailable.has(model)) continue;
      if (this.opts.canUse && !(await this.opts.canUse(model))) {
        this.unavailable.add(model);
        this.opts.log?.(`Modelo ${model} no limite diário configurado; pulando.`);
        continue;
      }
      try {
        const res = await gen({ model, system: input.system, user: input.user, record: this.opts.record });
        return { ...res, model };
      } catch (e) {
        if (!(e instanceof GeminiError && (e.status === 429 || e.status === 404))) throw e;
        this.unavailable.add(model);
        last = e;
        this.opts.log?.(`Modelo ${model} indisponível (${e.status === 404 ? "não encontrado" : "cota esgotada"}); tentando o próximo.`);
      }
    }
    throw last ?? new GeminiError("Gemini 429: todos os modelos da fila estão sem cota nesta rodada.", 429, true);
  }
}
