// Na navegação dentro do site (clique em link), o React Router busca os dados em "<endereço>.data"
// (ex.: /noticias.data). Loaders que leem o endereço precisam ignorar esse sufixo; sem isso, a página dava
// "não encontrada" só ao clicar e funcionava ao atualizar (mesmo erro no respawnou em 2026-11-12 e aqui em 2026-11-14).
// Regra: loader nunca lê new URL(request.url).pathname direto; usa routePath(request).
export function routePath(request: Request) {
  const path = new URL(request.url).pathname.replace(/\.data$/, "");
  return path === "/_" ? "/" : path;
}

/** Primeiro trecho do endereço ("/noticias/x" → "noticias"). */
export const firstSegment = (request: Request) => routePath(request).split("/")[1] ?? "";
