// Ficha de personagem (/animes/personagem/<id>): buscada no AniList na primeira visita e guardada por 7 dias.
import { FORMAT_PT } from "~/lib/anime";
import { exec, hasDatabase, iso, json, query } from "../db.server";
import { fetchCharacter, type AniCharacter } from "./anilist.server";
import { RemoteUnavailable } from "./remote-guard.server";

export type CharacterPage = {
  id: number;
  name: string;
  native: string | null;
  alternative: string[];
  image: string | null;
  /** Texto do AniList (em inglês) em trechos; os de spoiler ficam escondidos até o leitor pedir. */
  about: { text: string; spoiler: boolean }[];
  facts: [string, string][];
  appearances: { id: number; url: string; title: string; cover: string | null; color: string | null; detail: string; role: string }[];
  voices: { id: number; name: string; native: string | null; image: string | null }[];
};

const MAX_AGE_MS = 7 * 86400_000;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ROLE_PT: Record<string, string> = { MAIN: "Principal", SUPPORTING: "Coadjuvante", BACKGROUND: "Figurante" };
const GENDER_PT: Record<string, string> = { Male: "Masculino", Female: "Feminino", "Non-binary": "Não binário" };

/** Texto do AniList: marcações tiradas e spoilers (~! … !~) separados. */
export function splitAbout(description: string | null): CharacterPage["about"] {
  if (!description) return [];
  const clean = description
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const out: CharacterPage["about"] = [];
  let last = 0;
  for (const m of clean.matchAll(/~!([\s\S]*?)!~/g)) {
    if (m.index! > last) out.push({ text: clean.slice(last, m.index).trim(), spoiler: false });
    out.push({ text: m[1].trim(), spoiler: true });
    last = m.index! + m[0].length;
  }
  if (last < clean.length) out.push({ text: clean.slice(last).trim(), spoiler: false });
  return out.filter((s) => s.text);
}

export function toPage(c: AniCharacter): CharacterPage {
  const dob = c.dateOfBirth;
  const birthday = dob?.day && dob.month ? `${dob.day} de ${MONTHS[dob.month - 1]}${dob.year ? ` de ${dob.year}` : ""}` : null;
  const facts = [
    birthday && ["Aniversário", birthday],
    c.age && ["Idade", c.age],
    c.gender && ["Gênero", GENDER_PT[c.gender] ?? c.gender],
    c.bloodType && ["Tipo sanguíneo", c.bloodType],
    c.favourites && ["Favoritado por", `${c.favourites.toLocaleString("pt-BR")} pessoas no AniList`],
  ].filter(Boolean) as [string, string][];
  const edges = (c.media?.edges ?? []).filter((e) => !e.node.isAdult);
  const voices = new Map<number, CharacterPage["voices"][number]>();
  for (const e of edges) for (const v of e.voiceActors) voices.set(v.id, { id: v.id, name: v.name.full ?? "", native: v.name.native, image: v.image?.large ?? null });
  return {
    id: c.id,
    name: c.name.full ?? `Personagem ${c.id}`,
    native: c.name.native,
    alternative: (c.name.alternative ?? []).filter(Boolean).slice(0, 6),
    image: c.image?.large ?? null,
    about: splitAbout(c.description),
    facts,
    appearances: edges.map((e) => ({
      id: e.node.id,
      url: `/animes/${e.node.id}`,
      title: e.node.title.userPreferred ?? `Anime ${e.node.id}`,
      cover: e.node.coverImage?.large ?? null,
      color: e.node.coverImage?.color ?? null,
      detail: [e.node.seasonYear, e.node.format ? FORMAT_PT[e.node.format] ?? e.node.format : null].filter(Boolean).join(" · "),
      role: ROLE_PT[e.characterRole] ?? e.characterRole,
    })),
    voices: [...voices.values()],
  };
}

/** `remote: false` (robôs ou limite por minuto) usa só o que está guardado. Se o AniList falhar, mostra o guardado. */
export async function getCharacter(id: number, { remote = true }: { remote?: boolean } = {}): Promise<CharacterPage | null> {
  if (!hasDatabase() || !Number.isInteger(id) || id <= 0) return null;
  const [row] = await query<{ data: unknown; fetched_at: string }>("SELECT data, fetched_at FROM anime_characters WHERE id = ?", [id]);
  const fresh = row && Date.now() - new Date(iso(row.fetched_at)!).getTime() < MAX_AGE_MS;
  if (fresh || (!remote && row)) return json<CharacterPage | null>(row.data, null);
  if (!remote) throw new RemoteUnavailable();
  try {
    const c = await fetchCharacter(id);
    if (!c) return null;
    const page = toPage(c);
    await exec(
      `INSERT INTO anime_characters (id, name, data, fetched_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE name = VALUES(name), data = VALUES(data), fetched_at = VALUES(fetched_at)`,
      [id, page.name.slice(0, 200), JSON.stringify(page)],
    );
    return page;
  } catch (err) {
    console.error(`[anime] personagem ${id} no AniList falhou:`, (err as Error).message);
    if (row) return json<CharacterPage | null>(row.data, null);
    throw err;
  }
}
