// Constantes do painel do robô que servem ao servidor e à tela (a tela não pode importar módulos .server).
export const STATUS_CANDIDATO = ["pending", "selected", "rehearsal", "draft", "published", "discarded", "failed"] as const;
export type StatusCandidato = (typeof STATUS_CANDIDATO)[number];
