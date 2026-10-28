import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState, useEffect } from "react";
import { listParcels, listAlerts, getMyProfile, getMyRoles, getMonthlyYield, getTotalPandL, getUpcomingActivities, getTotalInventoryValue } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, BellRing, Sprout, ArrowRight, TrendingUp, DollarSign, CalendarDays, Warehouse, Sun, User, FileSpreadsheet, Plus, Download, Droplet, Package, Bug, Scissors, Wheat, Eye, ChevronUp, ChevronDown, Activity, TrendingDown, Zap, Map as MapIcon, BarChart, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WeatherForecast } from "@/components/weather/weather-forecast";
import { RoleGate } from "@/components/auth/role-gate";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { PredictiveAlerts } from "@/components/dashboard/predictive-alerts";
import { CropHealthWidget } from "@/components/dashboard/crop-health";
import { exportParcelsToExcel } from "@/lib/services/excel-export";
import { generatePdfReport } from "@/lib/pdf-report";
import { cn } from "@/lib/utils";
import { coordsOrDefault } from "@/lib/geo";

import { AiCropAdvisor } from "@/components/dashboard/ai-crop-advisor";
import { MarketPrices } from "@/components/dashboard/market-prices";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Inicio — SIGIC" }] }),
  component: Dashboard,
});

function useCollapsible(key: string, defaultValue = false) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(key) === 'true'; } catch { return defaultValue; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, String(collapsed)); } catch { /* almacenamiento no disponible */ }
  }, [collapsed, key]);
  const toggle = () => setCollapsed(v => !v);
  return { collapsed, toggle };
}

function CollapsibleSection({ title, icon: Icon, children, storageKey, defaultCollapsed = false, actions }: { title: string; icon: any; children: React.ReactNode; storageKey: string; defaultCollapsed?: boolean; actions?: React.ReactNode }) {
  const { collapsed, toggle } = useCollapsible(storageKey, defaultCollapsed);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Icon className="size-5 text-primary" aria-hidden="true" />{title}</h2>
        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Mostrar" : "Ocultar"} ${title}`}
            className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
          >
            {collapsed ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {!collapsed && children}
    </div>
  );
}

const formatCOP = (n: number) => '$ ' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function Dashboard() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const [farmerFilter, setFarmerFilter] = useState("__all__");
  const [farmerModal, setFarmerModal] = useState<any>(null);
  const isStaff = (roles.data ?? []).some((r) => ["tecnico", "admin"].includes(r));
  const farmerParam = isStaff && farmerFilter !== "__all__" ? farmerFilter : undefined;
  const kindLabels = { RIEGO: "Riego", FERTILIZACION: "Fertilización", CONTROL_PLAGAS: "Control de plagas", PODA: "Poda", INSUMOS: "Insumos", COSECHA: "Cosecha", MONITOREO: "Monitoreo" } as const;
  const getKindIcon = (kind: string) => ({ RIEGO: Droplet, FERTILIZACION: Package, CONTROL_PLAGAS: Bug, PODA: Scissors, INSUMOS: Package, COSECHA: Wheat, MONITOREO: Eye } as Record<string, any>)[kind] ?? CalendarDays;
  
  const yields = useQuery({ queryKey: ["monthly-yield", farmerFilter], queryFn: () => getMonthlyYield(farmerParam) });
  const pnl = useQuery({ queryKey: ["pnl", farmerFilter], queryFn: () => getTotalPandL(farmerParam) });
  const upcoming = useQuery({ queryKey: ["upcoming", farmerFilter], queryFn: () => getUpcomingActivities(7, farmerParam) });
  const invValue = useQuery({ queryKey: ["inv-value", farmerFilter], queryFn: () => getTotalInventoryValue(farmerParam) });

  const farmersWithStats = useQuery({
    queryKey: ["farmers-stats"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").order("full_name");
      const { data: pList } = await supabase.from("parcels").select("id, owner_id, area_m2");
      const { data: cList } = await supabase.from("crops").select("parcel_id, status");
      const { data: aList } = await supabase.from("activities").select("crop_id, crops!inner(parcel_id)");
      const parcelByOwner = new Map<string, { count: number; area: number }>();
      for (const p of pList ?? []) {
        const cur = parcelByOwner.get(p.owner_id) ?? { count: 0, area: 0 };
        cur.count++; cur.area += Number(p.area_m2 || 0);
        parcelByOwner.set(p.owner_id, cur);
      }
      const cropCountByParcel = new Map<string, number>();
      const activeByParcel = new Map<string, number>();
      for (const c of cList ?? []) {
        cropCountByParcel.set(c.parcel_id, (cropCountByParcel.get(c.parcel_id) ?? 0) + 1);
        if (["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)) {
          activeByParcel.set(c.parcel_id, (activeByParcel.get(c.parcel_id) ?? 0) + 1);
        }
      }
      const activityByCrop = new Map<string, number>();
      for (const a of aList ?? []) {
        const pid = (a as any).crops?.parcel_id;
        if (pid) activityByCrop.set(pid, (activityByCrop.get(pid) ?? 0) + 1);
      }
      return (profiles ?? []).map((p) => {
        const info = parcelByOwner.get(p.id);
        const pIds = (pList ?? []).filter((pl) => pl.owner_id === p.id).map((pl) => pl.id);
        const totalCrops = pIds.reduce((s, id) => s + (cropCountByParcel.get(id) ?? 0), 0);
        const totalActive = pIds.reduce((s, id) => s + (activeByParcel.get(id) ?? 0), 0);
        const totalActivities = pIds.reduce((s, id) => s + (activityByCrop.get(id) ?? 0), 0);
        return { id: p.id, name: p.full_name, full_name: p.full_name, parcels: info?.count ?? 0, area: info?.area ?? 0, crops: totalCrops, active: totalActive, activities: totalActivities };
      });
    },
    enabled: isStaff,
  });

  // Optimizado: se deriva de farmersWithStats (declarado previamente)
  const farmers = useMemo(() => ({
    data: (farmersWithStats.data ?? []).map((f) => ({ id: f.id, full_name: f.full_name ?? f.name })),
    isLoading: farmersWithStats.isLoading,
  }), [farmersWithStats.data, farmersWithStats.isLoading]);

  const selectedFarmer = useMemo(() => {
    if (!isStaff || farmerFilter === "__all__") return null;
    return farmers.data?.find((f: any) => f.id === farmerFilter);
  }, [farmers.data, farmerFilter, isStaff]);

  const filteredParcels = isStaff && farmerFilter !== "__all__"
    ? (parcels.data ?? []).filter((p: any) => p.owner_id === farmerFilter)
    : (parcels.data ?? []);

  const pendingAlerts = (alerts.data ?? []).filter((a) => a.status === "PENDIENTE");
  const activeCrops = filteredParcels.reduce((s, p) => s + (p.crops ?? []).filter((c: any) =>
    ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)
  ).length, 0);
  const firstName = (profile.data?.full_name || "").trim().split(/\s+/)[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const totalCrops = filteredParcels.reduce((s, p: any) => s + (p.crops ?? []).length, 0);
  const totalAreaHa = filteredParcels.reduce((s: number, p: any) => s + Number(p.area_m2 || 0), 0) / 10000;
  const upcomingCount = (upcoming.data ?? []).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const summary = pendingAlerts.length > 0
    ? `${plural(pendingAlerts.length, "alerta pendiente", "alertas pendientes")} por revisar.`
    : upcomingCount > 0
      ? `${plural(upcomingCount, "labor programada", "labores programadas")} para los próximos 7 días.`
      : "No hay alertas pendientes ni labores próximas.";

  const yieldByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const y of yields.data ?? []) {
      const m = format(new Date((y as any).performed_at), "yyyy-MM");
      map.set(m, (map.get(m) ?? 0) + Number((y as any).harvested_qty || 0));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, qty]) => ({ month, qty: Math.round(qty * 10) / 10 }));
  }, [yields.data]);

  const firstParcel = filteredParcels[0];

  const exportPDF = async () => {
    const areaHa = (filteredParcels.reduce((s: number, p: any) => s + Number(p.area_m2), 0) / 10000).toFixed(2);
    const invVal = invValue.data ?? 0;
    const costs = pnl.data?.totalCost ?? 0;
    const revenues = pnl.data?.totalRevenue ?? 0;
    const margin = revenues - costs;
    const author = profile.data?.full_name ?? undefined;
    const doc = await generatePdfReport({
      template: "resumen",
      title: selectedFarmer ? `Reporte - ${selectedFarmer.full_name}` : "Reporte General",
      subtitle: `Generado ${new Date().toLocaleDateString("es")}`,
      author,
      orientation: "portrait",
      sections: [
        {
          title: "Métricas principales",
          head: ["Métrica", "Valor"],
          body: [
            ["Parcelas", String(filteredParcels.length)],
            ["Cultivos activos", String(activeCrops)],
            ["Área total (ha)", areaHa],
            ["Alertas pendientes", String(pendingAlerts.length)],
            ["Valor inventario", formatCOP(invVal)],
            ["Costos totales", formatCOP(costs)],
            ["Ingresos totales", formatCOP(revenues)],
            ["Margen", formatCOP(margin)],
          ],
        },
      ],
    });
    doc.save(`reporte-${selectedFarmer ? selectedFarmer.full_name.replace(/\s+/g, "_") : "general"}.pdf`);
  };

  return (
    <div className="space-y-6">
      <header className="relative isolate overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground">
        <div aria-hidden="true" className="surcos-on-dark absolute inset-0 -z-10" />
        <div className="p-6 md:p-8">
          <p className="text-sm capitalize text-white/65">{new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 text-3xl font-bold text-white md:text-4xl">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
          <p className="mt-2 max-w-xl text-white/75">{summary}</p>
        </div>
      </header>

      <RoleGate roles={["tecnico", "admin"]}>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <User className="size-4 text-muted-foreground" aria-hidden="true" />
          <Combobox
            value={farmerFilter}
            onChange={setFarmerFilter}
            options={[
              { value: "__all__", label: "Todos los agricultores" },
              ...(farmers.data ?? []).map((f: any) => ({ value: f.id, label: f.full_name })),
            ]}
            placeholder="Todos los agricultores"
            searchPlaceholder="Buscar agricultor…"
            className="w-56"
          />
          {selectedFarmer && (
            <>
              <Button variant="outline" size="sm" onClick={() => setFarmerModal(selectedFarmer)}>
                <User className="size-3.5 mr-1" /> Ficha
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <FileSpreadsheet className="size-3.5 mr-1" /> Exportar PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportParcelsToExcel(filteredParcels)}>
                <Download className="size-3.5 mr-1" /> CSV
              </Button>
            </>
          )}
        </div>
      </RoleGate>

      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {parcels.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <Kpi label="Parcelas" value={String(filteredParcels.length)} hint={`${totalAreaHa.toLocaleString("es-CO", { maximumFractionDigits: 1 })} ha en total`} icon={MapPin} to="/parcels" />
            <Kpi label="Cultivos activos" value={String(activeCrops)} hint={`de ${totalCrops} registrados`} icon={Sprout} to="/cultivos" search={{ status: "activos" }} />
            <Kpi label="Alertas" value={String(pendingAlerts.length)} hint={pendingAlerts.length > 0 ? "requieren atención" : "todo al día"} icon={BellRing} to="/alerts" attention={pendingAlerts.length > 0} />
            <Kpi label="Valor del inventario" value={invValue.isError ? "Error" : formatCOP(invValue.data ?? 0)} hint="costo de lo que hay en bodega" icon={Warehouse} to="/inventory" />
          </>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        {isStaff ? (
          <>
            <Button asChild variant="outline" size="sm"><Link to="/parcels"><MapPin className="size-4 mr-1.5" /> Nueva parcela</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/cultivos"><Sprout className="size-4 mr-1.5" /> Nuevo cultivo</Link></Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" size="sm"><Link to="/parcels"><MapPin className="size-4 mr-1.5" /> Mis parcelas</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/cultivos"><Sprout className="size-4 mr-1.5" /> Mis cultivos</Link></Button>
          </>
        )}
        <Button asChild variant="outline" size="sm"><Link to="/mapa"><MapIcon className="size-4 mr-1.5" /> Ver mapa</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/chat"><Zap className="size-4 mr-1.5" /> Asistente IA</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/reports"><BarChart className="size-4 mr-1.5" /> Ver reportes</Link></Button>
      </div>

      <AiCropAdvisor />

      <PredictiveAlerts />

      <CollapsibleSection title="Salud de cultivos" icon={Activity} storageKey="dashboard-crop-health-collapsed">
        <CropHealthWidget />
      </CollapsibleSection>

      {/* Farmer comparison table */}
      <RoleGate roles={["tecnico", "admin"]}>
        {farmersWithStats.data && farmersWithStats.data.length > 0 && farmerFilter === "__all__" && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Comparativa entre agricultores</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium">Agricultor</th>
                    <th className="text-right py-2 px-2 font-medium">Parcelas</th>
                    <th className="text-right py-2 px-2 font-medium">Área (ha)</th>
                    <th className="text-right py-2 px-2 font-medium">Cultivos</th>
                    <th className="text-right py-2 px-2 font-medium">Activos</th>
                    <th className="text-right py-2 px-2 font-medium">Actividades</th>
                  </tr>
                </thead>
                <tbody>
                  {(farmersWithStats.data ?? []).map((f: any) => (
                    <tr key={f.id} className="border-b border-border/40 hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => setFarmerFilter(f.id)}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {f.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{f.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 tabular-nums">{f.parcels}</td>
                      <td className="text-right py-3 px-2 tabular-nums">{(f.area / 10000).toFixed(1)}</td>
                      <td className="text-right py-3 px-2 tabular-nums">{f.crops}</td>
                      <td className="text-right py-3 px-2 tabular-nums text-success font-medium">{f.active}</td>
                      <td className="text-right py-3 px-2 tabular-nums">{f.activities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </RoleGate>

      <CollapsibleSection title="Resumen Financiero" icon={DollarSign} storageKey="dashboard-pnl-collapsed">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground mb-1">Costos totales</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{pnl.isError ? "Error" : formatCOP(pnl.data?.totalCost ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground mb-1">Ingresos totales</p>
            <p className="text-2xl font-bold tabular-nums text-success">{pnl.isError ? "Error" : formatCOP(pnl.data?.totalRevenue ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground mb-1">Margen</p>
            <p className={`text-2xl font-bold tabular-nums flex items-center gap-1 ${pnl.isError ? "" : (pnl.data?.totalRevenue ?? 0) - (pnl.data?.totalCost ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
              {!pnl.isError && ((pnl.data?.totalRevenue ?? 0) - (pnl.data?.totalCost ?? 0) >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />)}
              {pnl.isError ? "Error" : formatCOP((pnl.data?.totalRevenue ?? 0) - (pnl.data?.totalCost ?? 0))}
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="size-4 text-primary" /> Rendimiento de cosecha</h3>
            </div>
            {yields.isError ? (
              <p className="text-sm text-destructive">Error al cargar rendimiento.</p>
            ) : yieldByMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de cosecha aún.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={yieldByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; }} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ stroke: "var(--color-muted)", strokeWidth: 2 }} contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-foreground)" }} formatter={(v: number) => [`${v} kg`, "Cosecha"]} />
                  <Line type="monotone" dataKey="qty" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--color-background)" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <CollapsibleSection title="Mis parcelas" icon={MapPin} storageKey="dashboard-parcels-collapsed" actions={
            <>
              <RoleGate roles={["tecnico", "admin"]}>
                <Button asChild size="sm" variant="outline"><Link to="/cultivos"><Plus className="size-3.5 mr-1" /> Nuevo cultivo</Link></Button>
              </RoleGate>
              <Button asChild size="sm" variant="ghost" className="text-primary hover:text-primary/80"><Link to="/parcels">Ver todas <ArrowRight className="size-4 ml-1" /></Link></Button>
            </>
          }>
            {parcels.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : parcels.isError ? (
              <p className="text-sm text-destructive">Error al cargar parcelas.</p>
            ) : (parcels.data ?? []).length === 0 ? (
              <div className="p-8 border border-dashed border-border rounded-xl text-center bg-muted/20">
                <p className="text-muted-foreground">Aún no has registrado parcelas.</p>
                <Button asChild className="mt-4"><Link to="/parcels">Crear primera parcela</Link></Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredParcels.slice(0, 4).map((p: any) => (
                  <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} className="group relative block h-36 overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary">
                    {p.image_url ? (
                      <div className="absolute inset-0 bg-cover bg-center " style={{ backgroundImage: `url(${p.image_url})` }}>
                        <div className="absolute inset-0 bg-black/45 transition-colors" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/5">
                        <MapPin className="size-12 text-primary/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className={cn("font-bold text-lg leading-tight", p.image_url ? "text-white drop-shadow-md" : "text-foreground")}>{p.name}</h3>
                          <p className={cn("text-xs mt-1 font-medium", p.image_url ? "text-white/90 drop-shadow-md" : "text-muted-foreground")}>{p.area_m2} m² · {(p as any).soil_types?.name ?? "—"}</p>
                        </div>
                      </div>
                      {isStaff && (p as any).profiles?.full_name && <p className={cn("text-xs font-semibold", p.image_url ? "text-white/95 drop-shadow-md" : "text-primary")}><User className="mr-1 inline size-3" aria-hidden="true" />{(p as any).profiles.full_name}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>

        <aside className="space-y-6">
          <CollapsibleSection title="Próximas actividades" icon={CalendarDays} storageKey="dashboard-activities-collapsed">
            <Card className="p-1">
              {upcoming.isLoading ? (
                <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
              ) : upcoming.isError ? (
                <div className="m-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  Error al cargar actividades.
                </div>
              ) : (upcoming.data ?? []).length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarDays className="size-10 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Sin actividades para los próximos 7 días.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {(upcoming.data ?? []).slice(0, 5).map((a: any) => {
                    const Icon = getKindIcon(a.kind);
                    return (
                      <li key={a.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="size-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground">
                            {a.title || kindLabels[a.kind as keyof typeof kindLabels] || "Labor"}
                            {a.crops?.crop_catalog?.name && <span className="text-muted-foreground font-normal ml-1">— {a.crops.crop_catalog.name}</span>}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                            <span className="font-medium text-primary/80">{format(new Date(a.startsAt), "EEEE d MMM", { locale: es })}</span>
                            {a.crops?.parcels?.profiles?.full_name && (
                              <>
                                <span className="text-border/60">·</span>
                                <span className="truncate">{a.crops.parcels.profiles.full_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="p-2 border-t border-border/50">
                <Button asChild variant="ghost" size="sm" className="w-full text-xs font-medium"><Link to="/calendar">Ver calendario completo</Link></Button>
              </div>
            </Card>
          </CollapsibleSection>

          <CollapsibleSection title="Clima" icon={Sun} storageKey="dashboard-weather-collapsed">
            {isStaff && farmerFilter !== "__all__" && filteredParcels.length > 0 ? (
              <div className="space-y-3">
                {filteredParcels.slice(0, 6).map((p: any) => (
                  <Card key={p.id} className="p-4 border-border hover:border-primary/50 transition-colors">
                    <p className="text-sm font-bold mb-2 flex items-center gap-2"><MapPin className="size-3 text-primary" />{p.name}</p>
                    <WeatherForecast {...coordsOrDefault(p.latitude, p.longitude)} parcelName="" />
                  </Card>
                ))}
              </div>
            ) : firstParcel ? (
              <Card className="p-4 border-border">
                <WeatherForecast {...coordsOrDefault(firstParcel.latitude, firstParcel.longitude)} parcelName={firstParcel.name} />
              </Card>
            ) : null}
          </CollapsibleSection>

          <Suspense fallback={<div className="h-40 rounded-xl bg-muted/50 animate-pulse border border-border" />}>
            <MarketPrices />
          </Suspense>
        </aside>
      </section>

      {/* Farmer detail modal */}
      <Dialog open={!!farmerModal} onOpenChange={(o) => { if (!o) setFarmerModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{farmerModal?.full_name}</DialogTitle>
          </DialogHeader>
          {farmerModal && (
            <FarmerDetail farmerId={farmerModal.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FarmerDetail({ farmerId }: { farmerId: string }) {
  const detail = useQuery({
    queryKey: ["farmer-detail", farmerId],
    queryFn: async () => {
      const [parcelsRes, profileRes] = await Promise.all([
        supabase.from("parcels").select("id, name, area_m2, soil_types(name), crops(id, status, crop_catalog(name))").eq("owner_id", farmerId),
        supabase.from("profiles").select("full_name, phone").eq("id", farmerId).maybeSingle(),
      ]);
      const parcels = parcelsRes.data ?? [];
      const active = parcels.reduce((s, p: any) => s + (p.crops ?? []).filter((c: any) => ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)).length, 0);
      const total = parcels.reduce((s, p: any) => s + (p.crops ?? []).length, 0);
      const area = parcels.reduce((s, p: any) => s + Number(p.area_m2), 0);
      return { profile: profileRes.data, parcels, totalCrops: total, activeCrops: active, area };
    },
  });

  if (detail.isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>;
  if (!detail.data) return <p className="text-sm text-muted-foreground">Sin datos</p>;

  const d = detail.data;
  return (
    <div className="space-y-5 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-sm text-muted-foreground mb-1">Teléfono</p>
          <p className="font-bold">{d.profile?.phone ?? "—"}</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-sm text-muted-foreground mb-1">Área total</p>
          <p className="font-bold">{(d.area / 10000).toFixed(2)} ha</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-sm text-muted-foreground mb-1">Parcelas</p>
          <p className="font-bold">{d.parcels.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-sm text-muted-foreground mb-1">Cultivos</p>
          <p className="font-bold text-success">{d.activeCrops} <span className="text-muted-foreground font-medium text-sm">/ {d.totalCrops} activos</span></p>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><MapPin className="size-4 text-primary" /> Parcelas registradas</h4>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
          {d.parcels.map((p: any) => (
            <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/20 transition-all group">
              <div>
                <span className="font-bold block text-sm group-hover:text-primary transition-colors">{p.name}</span>
                {p.soil_types?.name && <span className="text-xs text-muted-foreground">{p.soil_types.name}</span>}
              </div>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-md">{(Number(p.area_m2) / 10000).toFixed(2)} ha</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, to, search, attention }: {
  label: string; value: string; hint: string; icon: LucideIcon; to: string; search?: Record<string, string>; attention?: boolean;
}) {
  return (
    <li className="bg-card">
      <Link to={to} search={search as never} className="group block h-full p-5 transition-colors hover:bg-accent/60">
        <span className="flex items-center justify-between text-sm text-muted-foreground">
          {label}
          <Icon className={cn("size-4", attention ? "text-warning-foreground" : "text-primary")} aria-hidden="true" />
        </span>
        <span className={cn("mt-2 block font-display text-3xl font-bold tabular", attention && "text-destructive")}>{value}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      </Link>
    </li>
  );
}

function KpiSkeleton() {
  return (
    <li className="bg-card p-5" aria-hidden="true">
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 rounded bg-muted" />
          <div className="size-4 rounded bg-muted" />
        </div>
        <div className="h-9 w-16 rounded bg-muted" />
        <div className="h-3 w-32 rounded bg-muted" />
      </div>
    </li>
  );
}
