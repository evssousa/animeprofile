/** Destino depois do login: só endereços do próprio site ("/algo"), nunca "//outro.com", "/\outro.com" nem "https://...". */
export function safeRedirect(valor: string | null | undefined, padrao = "/admin"): string {
  if (!valor || valor[0] !== "/" || valor[1] === "/" || valor[1] === "\\") return padrao;
  if (/[\u0000-\u001f\u007f]/.test(valor) || valor.length > 300) return padrao;
  return valor;
}
