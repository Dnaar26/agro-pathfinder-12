import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { listParcels, listAlerts, getMyProfile, getMyRoles, getMonthlyYield, getTotalPandL, getUpcomingActivities, getTotalInventoryValue } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, BellRing, Sprout, ArrowRight, TrendingUp, DollarSign, CalendarDays, Warehouse, Sun, User, FileSpreadsheet, Plus, Download, Droplet, Package, Bug, Scissors, Wheat, Eye } from "lucide-react";
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

const MarketPrices = lazy(() => import("@/components/dashboard/market-prices").then((m) => ({ default: m.MarketPrices })));

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Inicio — SIGIC" }] }),
  component: Dashboard,
});

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
  const yields = useQuery({
    queryKey: ["monthly-yield", farmerFilter],
    queryFn: () => getMonthlyYield(farmerParam),
  });
  const pnl = useQuery({
    queryKey: ["pnl", farmerFilter],
    queryFn: () => getTotalPandL(farmerParam),
  });
  const upcoming = useQuery({
    queryKey: ["upcoming", farmerFilter],
    queryFn: () => getUpcomingActivities(7, farmerParam),
  });
  const invValue = useQuery({
    queryKey: ["inv-value", farmerFilter],
    queryFn: () => getTotalInventoryValue(farmerParam),
  });

  const farmers = useQuery({
    queryKey: ["farmers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data ?? [];
    },
    enabled: isStaff,
  });

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
        return { id: p.id, name: p.full_name, parcels: info?.count ?? 0, area: info?.area ?? 0, crops: totalCrops, active: totalActive, activities: totalActivities };
      });
    },
    enabled: isStaff,
  });

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
  const name = profile.data?.full_name || "Agricultor";

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
    const invVal = (invValue.data ?? 0).toFixed(0);
    const costs = (pnl.data?.totalCost ?? 0).toFixed(2);
    const revenues = (pnl.data?.totalRevenue ?? 0).toFixed(2);
    const margin = ((pnl.data?.totalRevenue ?? 0) - (pnl.data?.totalCost ?? 0)).toFixed(2);
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
            ["Valor inventario", `$ ${invVal}`],
            ["Costos totales", `$ ${costs}`],
            ["Ingresos totales", `$ ${revenues}`],
            ["Margen", `$ ${margin}`],
          ],
        },
      ],
    });
    doc.save(`reporte-${selectedFarmer ? selectedFarmer.full_name.replace(/\s+/g, "_") : "general"}.pdf`);
  };

  return (
    <div className="space-y-6">
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
        <RoleGate roles={["tecnico", "admin"]}>
          <div className="mt-3 flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
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
                  <Download className="size-3.5 mr-1" /> Excel completo
                </Button>
              </>
            )}
          </div>
        </RoleGate>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Parcelas" value={filteredParcels.length} icon={MapPin} to="/parcels" />
        <StatCard label="Cultivos activos" value={activeCrops} icon={Sprout} to="/cultivos?status=activos" />
        <StatCard label="Alertas" value={pendingAlerts.length} icon={BellRing} to="/alerts" highlight={pendingAlerts.length > 0} />
        <StatCard label="Valor inventario" value={invValue.isError ? "Error" : `$ ${invValue.data?.toFixed(0) ?? "—"}`} icon={Warehouse} to="/inventory" />
      </div>

      <PredictiveAlerts />

      <RoleGate roles={["admin"]}>
        <CropHealthWidget />
      </RoleGate>

      {/* Farmer comparison table */}
      <RoleGate roles={["tecnico", "admin"]}>
        {farmersWithStats.data && farmersWithStats.data.length > 0 && farmerFilter === "__all__" && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Comparativa entre agricultores</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-4">Agricultor</th>
                    <th className="text-right py-2 px-2">Parcelas</th>
                    <th className="text-right py-2 px-2">Área (ha)</th>
                    <th className="text-right py-2 px-2">Cultivos</th>
                    <th className="text-right py-2 px-2">Activos</th>
                    <th className="text-right py-2 px-2">Actividades</th>
                  </tr>
                </thead>
                <tbody>
                  {(farmersWithStats.data ?? []).map((f: any) => (
                    <tr key={f.id} className="border-b border-border/50 hover:bg-muted/40 cursor-pointer" onClick={() => setFarmerFilter(f.id)}>
                      <td className="py-2 pr-4 font-medium">{f.name}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{f.parcels}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{(f.area / 10000).toFixed(1)}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{f.crops}</td>
                      <td className="text-right py-2 px-2 tabular-nums text-green-600">{f.active}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{f.activities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </RoleGate>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Costos totales</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-red-600">{pnl.isError ? "Error" : `$ ${pnl.data?.totalCost.toFixed(2) ?? "—"}`}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingresos totales</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-green-600">{pnl.isError ? "Error" : `$ ${pnl.data?.totalRevenue.toFixed(2) ?? "—"}`}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Margen</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${pnl.isError ? "" : (pnl.data?.totalRevenue ?? 0) - (pnl.data?.totalCost ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
            {pnl.isError ? "Error" : `${((pnl.data?.totalRevenue ?? 0) - (pnl.data?.totalCost ?? 0)) >= 0 ? "+" : ""}$ ${((pnl.data?.totalRevenue ?? 0) - (pnl.data?.totalCost ?? 0)).toFixed(2)}`}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Rendimiento de cosecha</h3>
            </div>
            {yields.isError ? (
              <p className="text-sm text-destructive">Error al cargar rendimiento.</p>
            ) : yieldByMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de cosecha aún.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={yieldByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v} KG`, "Cosecha"]} />
                  <Line type="monotone" dataKey="qty" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Mis parcelas</h2>
              <div className="flex gap-2">
                <RoleGate roles={["tecnico", "admin"]}>
                  <Button asChild size="sm" variant="outline"><Link to="/cultivos"><Plus className="size-3.5 mr-1" /> Nuevo cultivo</Link></Button>
                </RoleGate>
                <Button asChild size="sm"><Link to="/parcels">Ver todas <ArrowRight className="size-4 ml-1" /></Link></Button>
              </div>
            </div>
          {parcels.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : parcels.isError ? (
            <p className="text-sm text-destructive">Error al cargar parcelas.</p>
          ) : (parcels.data ?? []).length === 0 ? (
            <div className="p-8 border border-dashed border-border rounded-xl text-center">
              <p className="text-muted-foreground">Aún no has registrado parcelas.</p>
              <Button asChild className="mt-4"><Link to="/parcels">Crear primera parcela</Link></Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredParcels.slice(0, 4).map((p: any) => (
                <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} className="block p-4 rounded-xl border border-border bg-card hover:border-primary transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.area_m2} m² · {(p as any).soil_types?.name ?? "—"}</p>
                      {isStaff && (p as any).profiles?.full_name && <p className="text-xs text-primary mt-0.5">👤 {(p as any).profiles.full_name}</p>}
                    </div>
                    <MapPin className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><CalendarDays className="size-4 text-primary" /> Próximas actividades</h3>
            {upcoming.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
            ) : upcoming.isError ? (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                Error al cargar actividades.
              </div>
            ) : (upcoming.data ?? []).length === 0 ? (
              <div className="py-6 text-center">
                <CalendarDays className="size-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Sin actividades para los próximos 7 días.</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {(upcoming.data ?? []).slice(0, 5).map((a: any) => {
                  const Icon = getKindIcon(a.kind);
                  return (
                    <li key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {kindLabels[a.kind as keyof typeof kindLabels] ?? a.kind}
                          {a.crops?.crop_catalog?.name && <span className="text-muted-foreground font-normal"> — {a.crops.crop_catalog.name}</span>}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span>{format(new Date(a.performed_at), "EEEE d MMM", { locale: es })}</span>
                          {a.crops?.parcels?.profiles?.full_name && (
                            <>
                              <span className="text-border/40">·</span>
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
            <Button asChild variant="ghost" size="sm" className="w-full mt-2 text-xs"><Link to="/calendar">Ver calendario</Link></Button>
          </Card>

          {/* Multi-weather: show all parcels weather when filtering by farmer */}
          {isStaff && farmerFilter !== "__all__" && filteredParcels.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Sun className="size-4 text-primary" /> Clima por parcela</h3>
              <div className="space-y-2">
                {filteredParcels.slice(0, 6).map((p: any) => (
                  <Card key={p.id} className="p-3">
                    <p className="text-xs font-medium mb-1">{p.name}</p>
                    <WeatherForecast lat={Number(p.latitude) || -16.5} lng={Number(p.longitude) || -68.15} parcelName="" />
                  </Card>
                ))}
              </div>
            </div>
          ) : firstParcel ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Sun className="size-4 text-primary" /> Clima hoy</h3>
              <WeatherForecast lat={Number(firstParcel.latitude) || -16.5} lng={Number(firstParcel.longitude) || -68.15} parcelName={firstParcel.name} />
            </Card>
          ) : null}

          <Suspense fallback={<div className="h-32 rounded-xl bg-muted animate-pulse" />}>
            <MarketPrices />
          </Suspense>
        </aside>
      </section>

      {/* Farmer detail modal */}
      <Dialog open={!!farmerModal} onOpenChange={(o) => { if (!o) setFarmerModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{farmerModal?.full_name}</DialogTitle>
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

  if (detail.isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!detail.data) return <p className="text-sm text-muted-foreground">Sin datos</p>;

  const d = detail.data;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="text-xs text-muted-foreground">Teléfono</p>
          <p className="font-medium">{d.profile?.phone ?? "—"}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="text-xs text-muted-foreground">Área total</p>
          <p className="font-medium">{(d.area / 10000).toFixed(2)} ha</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="text-xs text-muted-foreground">Parcelas</p>
          <p className="font-medium">{d.parcels.length}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/40">
          <p className="text-xs text-muted-foreground">Cultivos</p>
          <p className="font-medium">{d.activeCrops}/{d.totalCrops} activos</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium mb-2">Parcelas</p>
        <div className="space-y-1.5">
          {d.parcels.map((p: any) => (
            <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} className="block p-2 rounded-lg border border-border hover:bg-muted/40 text-xs">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground ml-2">{(Number(p.area_m2) / 10000).toFixed(2)} ha</span>
              {p.soil_types?.name && <span className="text-muted-foreground ml-1">· {p.soil_types.name}</span>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, to, highlight }: { label: string; value: number | string; icon: any; to: string; highlight?: boolean }) {
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
