// Regras de imagem que valem no servidor e no navegador.

/** Largura mínima para uma capa ocupar a largura da tela (capa da home, topo da matéria). */
export const HERO_MIN_WIDTH = 1280;

/** A capa tem resolução boa para a área grande? Se não, ela aparece desfocada como fundo. */
export const isWideImage = (p: { image: string | null; imageWidth: number | null }) => Boolean(p.image && p.imageWidth && p.imageWidth >= HERO_MIN_WIDTH);
