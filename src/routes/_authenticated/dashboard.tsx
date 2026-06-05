import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listParcels, listAlerts, getMyProfile, getMyRoles } from "@/lib/queries";
import { MapPin, BellRing, Sprout, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Inicio — SGIC" }] }),
  component: Dashboard,
});

function Dashboard() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const roles = useQuery({ queryKey: ["roles"], queryFn: getMyRoles });
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });

  const pendingAlerts = (alerts.data ?? []).filter((a) => a.status === "PENDIENTE");
  const totalCrops = 0; // computed when needed
  const name = profile.data?.full_name || "Agricultor";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-3xl font-bold mt-1">Hola, {name} 👋</h1>
        {roles.data && roles.data.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            {roles.data.map((r) => (
              <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-primary-soft text-primary font-medium capitalize">{r}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Parcelas" value={parcels.data?.length ?? 0} icon={MapPin} to="/parcels" />
        <StatCard label="Cultivos activos" value={totalCrops} icon={Sprout} to="/parcels" />
        <StatCard label="Alertas pendientes" value={pendingAlerts.length} icon={BellRing} to="/alerts" highlight={pendingAlerts.length > 0} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Mis parcelas</h2>
          <Button asChild size="sm"><Link to="/parcels">Ver todas <ArrowRight className="size-4 ml-1" /></Link></Button>
        </div>
        {parcels.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (parcels.data ?? []).length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center">
            <p className="text-muted-foreground">Aún no has registrado parcelas.</p>
            <Button asChild className="mt-4"><Link to="/parcels">Crear primera parcela</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(parcels.data ?? []).slice(0, 4).map((p) => (
              <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} className="block p-4 rounded-xl border border-border bg-card hover:border-primary transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.area_m2} m² · {(p as any).soil_types?.name ?? "—"}</p>
                  </div>
                  <MapPin className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, to, highlight }: { label: string; value: number; icon: any; to: string; highlight?: boolean }) {
  return (
    <Link to={to} className={`p-5 rounded-xl border bg-card transition-colors block ${highlight ? "border-warning" : "border-border hover:border-primary"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${highlight ? "text-warning" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </Link>
  );
}
