// Formatos de data e números. Fuso fixo (Brasília) para o servidor e o navegador mostrarem o mesmo texto.
const TZ = "America/Sao_Paulo";

const dateShort = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dateLong = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** "12 de nov. de 2026" */
export const formatDate = (iso: string | null | undefined) => (iso ? dateShort.format(new Date(iso)) : "");
/** "12 de novembro de 2026" */
export const formatDateLong = (iso: string | null | undefined) => (iso ? dateLong.format(new Date(iso)) : "");
/** "12 de novembro de 2026 às 14:30" */
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)).replace(", ", " às ") : "");

export const readingLabel = (minutes: number) => `${minutes} min de leitura`;
