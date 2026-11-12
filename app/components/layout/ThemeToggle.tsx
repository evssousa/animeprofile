import { Moon, Sun } from "lucide-react";

const KEY = "ap-theme";

/**
 * Roda no <head> antes da página aparecer: aplica o tema salvo (ou o do sistema) sem piscar.
 * Mesma chave do site antigo (ap-theme), então a escolha de quem já usava o site continua valendo.
 */
export const themeBootstrap = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // modo privado: vale só nesta visita
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-sunken hover:text-ink ${className}`}
      aria-label="Alternar tema claro e escuro"
      title="Alternar tema"
    >
      <Moon className="size-5 dark:hidden" aria-hidden />
      <Sun className="hidden size-5 dark:block" aria-hidden />
    </button>
  );
}
