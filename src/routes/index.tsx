import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout, Leaf, CloudSun, BellRing, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIGIC — Gestión Inteligente de Cultivos" },
      { name: "description", content: "Plataforma para digitalizar y optimizar el ciclo productivo agrícola: parcelas, cultivos, actividades, calendario y alertas." },
      { property: "og:title", content: "SIGIC — Gestión Inteligente de Cultivos" },
      { property: "og:description", content: "Acompaña al agricultor en todo el ciclo productivo, incluso sin conexión." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Iniciar sesión</Link></Button>
            <Button asChild><Link to="/auth">Crear cuenta</Link></Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft text-primary px-3 py-1 text-xs font-medium">
            <Leaf className="size-3.5" /> AgriTech para pequeños agricultores
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Gestiona tus cultivos con <span className="text-primary">claridad</span> y <span className="text-accent">precisión</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            SIGIC acompaña al agricultor en todo el ciclo productivo: planeación, siembra, mantenimiento y cosecha. Registra actividades, recibe alertas y toma mejores decisiones.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Comenzar gratis</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Ver demo</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: MapPin, title: "Parcelas geolocalizadas", body: "Registra ubicación, área y tipo de suelo de cada parcela." },
            { icon: Calendar, title: "Calendario inteligente", body: "Programa riegos, fertilizaciones y cosechas con vista mensual." },
            { icon: BellRing, title: "Alertas oportunas", body: "Recibe avisos automáticos por actividades pendientes y clima." },
            { icon: Leaf, title: "Trazabilidad completa", body: "Cada actividad queda registrada con foto, fecha y responsable." },
            { icon: CloudSun, title: "Operación offline", body: "Diseñado para zonas rurales con conectividad limitada." },
            { icon: Sprout, title: "Reportes y KPIs", body: "Exporta tus datos y conoce el rendimiento real de tus cultivos." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="p-6 rounded-xl border border-border bg-card">
              <div className="size-10 rounded-lg bg-primary-soft text-primary grid place-items-center mb-4"><Icon className="size-5" /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SIGIC — Sistema de Gestión Inteligente de Cultivos
      </footer>
    </div>
  );
}
