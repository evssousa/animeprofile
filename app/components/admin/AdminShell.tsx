// Casca do painel /admin: topo escuro simples (logo, selo "Painel", tema, ver o site, sair). Específico do animeprofile.
import { Form } from "react-router";
import { ExternalLink, LogOut } from "lucide-react";
import { Logo } from "~/components/layout/Logo";
import { ThemeToggle } from "~/components/layout/ThemeToggle";

export function AdminShell({ children, aqui }: { children: React.ReactNode; aqui?: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="bg-night text-night-ink">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 text-night-ink">
            <Logo />
            <span className="rounded-full border border-glow/40 px-2 py-0.5 text-[0.7rem] font-bold tracking-[0.08em] text-glow uppercase">Painel</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {aqui}
            <ThemeToggle />
            <a href="/" target="_blank" rel="noreferrer" className="hidden h-11 items-center gap-1.5 rounded-full px-3 text-[0.85rem] font-semibold text-night-ink/80 hover:text-night-ink sm:inline-flex">
              Ver o site <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <Form method="post" action="/admin/sair">
              <button type="submit" className="inline-flex size-11 items-center justify-center gap-1.5 rounded-full text-night-ink/80 hover:text-night-ink sm:w-auto sm:px-3" aria-label="Sair do painel">
                <LogOut className="size-4" aria-hidden />
                <span className="hidden text-[0.85rem] font-semibold sm:inline">Sair</span>
              </button>
            </Form>
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
