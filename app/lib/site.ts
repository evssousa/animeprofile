// Configuração geral do site (vale no servidor e no navegador).
export const SITE = {
  name: "Anime Profile",
  url: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://animeprofile.com.br",
  email: "contato@animeprofile.com.br",
};

export const absoluteUrl = (path: string) => `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
