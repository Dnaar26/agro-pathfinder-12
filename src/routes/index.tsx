import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Droplets, Leaf, MapPin, PackageCheck, QrCode, Smartphone, Sprout } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIGIC — Gestión Inteligente de Cultivos" },
      { name: "description", content: "Registra parcelas, siembras, labores y cosechas. SIGIC avisa cuándo toca cada labor, controla el inventario de insumos y funciona aunque se caiga la señal." },
      { property: "og:title", content: "SIGIC — Gestión Inteligente de Cultivos" },
      { property: "og:description", content: "El cuaderno de campo del agricultor, con calendario, alertas e inventario." },
    ],
  }),
  component: Landing,
});

const roles = [
  {
    title: "Agricultor",
    body: "Registra lo que hace en cada parcela y recibe avisos de las labores que se acercan. Ve el historial de cada cultivo y su rendimiento.",
  },
  {
    title: "Técnico",
    body: "Acompaña a los agricultores que tiene asignados, revisa su avance y les envía recomendaciones y avisos directamente.",
  },
  {
    title: "Administrador",
    body: "Gestiona usuarios y asignaciones, define los umbrales de las alertas automáticas y consulta el registro de auditoría.",
  },
];

const capabilities = [
  { icon: MapPin, title: "Parcelas en el mapa", body: "Dibuja el contorno del lote y guarda área, tipo de suelo y ubicación." },
  { icon: CalendarClock, title: "Calendario de labores", body: "Programa riegos, fertilizaciones, podas y cosechas. No deja programar en fechas pasadas por error." },
  { icon: PackageCheck, title: "Inventario de insumos", body: "Define un mínimo por insumo y recibe una alerta cuando el stock baja de ese nivel." },
  { icon: Droplets, title: "Clima por parcela", body: "Pronóstico de los próximos días según las coordenadas de cada lote." },
  { icon: QrCode, title: "Trazabilidad con QR", body: "Genera un código QR por lote cosechado; quien lo escanea ve de dónde viene." },
  { icon: Smartphone, title: "Se instala en el teléfono", body: "Agrégala a la pantalla de inicio desde el navegador y ábrela como cualquier otra app." },
];

function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link to="/" aria-label="SIGIC — Inicio"><Logo size="xs" variant="light" /></Link>
          <nav aria-label="Acceso" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle className="border-white/20 text-white/80 hover:bg-white/10 hover:text-white" />
            <Link to="/login" className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 sm:px-4 sm:text-sm">
              Iniciar sesión
            </Link>
            <Link to="/register" className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg bg-highlight px-2.5 text-xs font-semibold text-highlight-foreground transition-[filter] hover:brightness-95 sm:px-4 sm:text-sm">
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
          <div aria-hidden="true" className="surcos-on-dark absolute inset-0 -z-10" />
          <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-40 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h1 className="max-w-xl text-4xl font-bold leading-[1.05] text-white md:text-6xl">
                Cada parcela, cada labor y cada cosecha en un solo lugar
              </h1>
              <p className="mt-6 max-w-lg text-lg text-white/75">
                SIGIC es el cuaderno de campo del pequeño agricultor. Registra siembras, riegos y fertilizaciones, te avisa cuándo toca la siguiente labor y deja el historial listo para tu técnico.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/register" className="inline-flex min-h-12 items-center rounded-lg bg-highlight px-6 text-base font-semibold text-highlight-foreground transition-[filter] hover:brightness-95">
                  Crear cuenta gratis
                </Link>
                <Link to="/login" className="inline-flex min-h-12 items-center rounded-lg border border-white/30 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10">
                  Ya tengo cuenta
                </Link>
              </div>
            </div>

            {/* Ejemplo de la interfaz real: tarjeta de cultivo */}
            <figure aria-label="Ejemplo de cómo se ve un cultivo en SIGIC" className="relative">
              <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Parcela El Mamey</p>
                    <h2 className="mt-0.5 text-2xl font-bold">Plátano hartón</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
                    <Sprout className="size-4" aria-hidden="true" /> En crecimiento
                  </span>
                </div>

                <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-border py-4">
                  <div><dt className="text-xs text-muted-foreground">Sembrado</dt><dd className="mt-0.5 font-semibold tabular">hace 74 días</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Área</dt><dd className="mt-0.5 font-semibold tabular">1,8 ha</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Labores</dt><dd className="mt-0.5 font-semibold tabular">12 hechas</dd></div>
                </dl>

                <p className="mt-5 text-sm font-semibold">Lo que viene</p>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="flex items-center gap-3 rounded-lg bg-muted p-3">
                    <Leaf className="size-4 text-primary" aria-hidden="true" />
                    <span className="flex-1">Fertilización con urea</span>
                    <span className="text-muted-foreground tabular">jueves 22</span>
                  </li>
                  <li className="flex items-center gap-3 rounded-lg bg-highlight/20 p-3">
                    <PackageCheck className="size-4 text-earth" aria-hidden="true" />
                    <span className="flex-1">Stock de urea bajo el mínimo</span>
                    <span className="font-semibold tabular">8 kg</span>
                  </li>
                </ul>
              </div>
              <figcaption className="mt-3 text-center text-xs text-white/55">Datos de ejemplo</figcaption>
            </figure>
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
          <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">Pensado para quien siembra y para quien acompaña</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {roles.map((r) => (
              <article key={r.title} className="bg-card p-6 md:p-8">
                <h3 className="text-xl font-bold">{r.title}</h3>
                <p className="mt-3 text-muted-foreground">{r.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Capacidades */}
        <section className="border-y border-border bg-secondary/60">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
            <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">Lo que puedes hacer desde el primer día</h2>
            <ul className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cierre */}
        <section className="mx-auto max-w-6xl px-5 py-20 text-center md:px-8 md:py-24">
          <h2 className="mx-auto max-w-xl text-3xl font-bold md:text-4xl">Empieza registrando tu primera parcela</h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">Crear la cuenta toma un minuto.</p>
          <Link to="/register" className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-primary px-7 text-base font-semibold text-primary-foreground transition-[filter] hover:brightness-110">
            Crear cuenta gratis
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SIGIC — Sistema de Información de Gestión Integral y Control
      </footer>
    </div>
  );
}
