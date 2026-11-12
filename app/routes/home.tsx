// Página provisória do esqueleto (fase 2). Vira a home de verdade quando as notícias chegarem.
import { SITE } from "~/lib/site";

export function meta() {
  return [{ title: `${SITE.name} — nova versão em construção` }];
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <img src="/favicon.png" alt="" width={64} height={64} className="rounded-2xl" />
      <h1 className="mt-6 text-4xl font-extrabold sm:text-5xl">{SITE.name}</h1>
      <p className="mt-4 text-lg text-muted">
        Esta é a nova versão do Anime Profile, em construção. O site de sempre continua em{" "}
        <a href="https://animeprofile.com.br" className="font-semibold text-brand underline-offset-4 hover:underline">
          animeprofile.com.br
        </a>
        .
      </p>
    </main>
  );
}
