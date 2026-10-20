import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "sigic-theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Tema del sistema", light: "Tema claro", dark: "Tema oscuro" };
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className }: { className?: string }) {
  // "system" en el primer render para que SSR e hidratación coincidan
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => { setTheme(readStored()); }, []);

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const Icon = ICON[theme];
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* modo privado */ }
      }}
      title={`${LABEL[theme]} — clic para cambiar a ${LABEL[next].toLowerCase()}`}
      aria-label={`${LABEL[theme]}. Cambiar a ${LABEL[next].toLowerCase()}`}
      className={cn(
        "grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

/** Script inline que aplica la clase .dark antes del primer pintado (evita el destello blanco). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||((t!=='light')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
