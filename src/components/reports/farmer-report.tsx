import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, MapPin, Sprout, DollarSign, BellRing, Wheat, TrendingUp, FileText, Leaf, Activity } from "lucide-react";
import { generatePdfReport } from "@/lib/pdf-report";
import { toast } from "sonner";

const formatCOP = (n: number) => '$ ' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function FarmerReport() {
  const [exporting, setExporting] = useState(false);

  // Perfil del agricultor
  const profile = useQuery({
    queryKey: ["farmer-report-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", u.user.id).maybeSingle();
      return { ...data, email: u.user.email };
    },
  });

  // Parcelas
  const parcels = useQuery({
    queryKey: ["farmer-report-parcels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("parcels")
        .select("id, name, area_m2, soil_types(name), crops(id, status, crop_catalog(name), planting_date, estimated_harvest_date)")
        .order("name");
      return data ?? [];
    },
  });

  // Actividades últimos 30 días
  const activities = useQuery({
    queryKey: ["farmer-report-activities"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("activities")
        .select("id, kind, performed_at, notes, crops!inner(parcel_id, crop_catalog(name), parcels(name))")
        .gte("performed_at", since.toISOString())
        .order("performed_at", { ascending: false });
      return data ?? [];
    },
  });

  // Costos e ingresos
  const financials = useQuery({
    queryKey: ["farmer-report-financials"],
    queryFn: async () => {
      const [costsRes, harvestsRes] = await Promise.all([
        supabase.from("crop_costs").select("total, kind, created_at, crops!inner(crop_catalog(name))").order("created_at", { ascending: false }),
        supabase.from("crop_harvests").select("harvested_qty, unit, sale_price, total_revenue, performed_at, crops!inner(crop_catalog(name))").order("performed_at", { ascending: false }),
      ]);
      return {
        costs: costsRes.data ?? [],
        harvests: harvestsRes.data ?? [],
      };
    },
  });

  // Alertas pendientes
  const alerts = useQuery({
    queryKey: ["farmer-report-alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("id, message, status, created_at").eq("status", "PENDIENTE").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const totalCost = useMemo(() => (financials.data?.costs ?? []).reduce((s, c: any) => s + Number(c.total || 0), 0), [financials.data]);
  const totalRevenue = useMemo(() => (financials.data?.harvests ?? []).reduce((s, h: any) => s + Number(h.total_revenue || 0), 0), [financials.data]);
  const margin = totalRevenue - totalCost;
  const activeCrops = useMemo(() => (parcels.data ?? []).reduce((s: number, p: any) =>
    s + (p.crops ?? []).filter((c: any) => ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)).length, 0),
    [parcels.data]);

  const kindLabels: Record<string, string> = {
    RIEGO: "Riego", FERTILIZACION: "Fertilización", CONTROL_PLAGAS: "Control de plagas",
    PODA: "Poda", INSUMOS: "Insumos", COSECHA: "Cosecha", MONITOREO: "Monitoreo",
  };

  async function exportPDF() {
    setExporting(true);
    try {
      const name = profile.data?.full_name ?? "Agricultor";
      const parcelRows = (parcels.data ?? []).map((p: any) => [
        p.name,
        `${(Number(p.area_m2) / 10000).toFixed(2)} ha`,
        p.soil_types?.name ?? "—",
        String((p.crops ?? []).filter((c: any) => ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)).length),
      ]);
      const actRows = (activities.data ?? []).slice(0, 20).map((a: any) => [
        format(new Date(a.performed_at), "dd/MM/yyyy"),
        kindLabels[a.kind] ?? a.kind,
        a.crops?.crop_catalog?.name ?? "—",
        a.crops?.parcels?.name ?? "—",
        a.notes ?? "—",
      ]);
      const harvestRows = (financials.data?.harvests ?? []).slice(0, 10).map((h: any) => [
        h.crops?.crop_catalog?.name ?? "—",
        `${Number(h.harvested_qty).toFixed(1)} ${h.unit ?? ""}`,
        formatCOP(Number(h.sale_price || 0)),
        formatCOP(Number(h.total_revenue || 0)),
        h.performed_at ? format(new Date(h.performed_at), "dd/MM/yyyy") : "—",
      ]);

      const doc = await generatePdfReport({
        template: "resumen",
        title: `Reporte Personal — ${name}`,
        subtitle: `Generado el ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
        author: name,
        orientation: "portrait",
        sections: [
          {
            title: "Resumen General",
            head: ["Indicador", "Valor"],
            body: [
              ["Parcelas registradas", String(parcels.data?.length ?? 0)],
              ["Cultivos activos", String(activeCrops)],
              ["Actividades (últimos 30 días)", String(activities.data?.length ?? 0)],
              ["Alertas pendientes", String(alerts.data?.length ?? 0)],
              ["Costos totales", formatCOP(totalCost)],
              ["Ingresos totales", formatCOP(totalRevenue)],
              ["Margen bruto", formatCOP(margin)],
            ],
          },
          { title: "Mis Parcelas", head: ["Nombre", "Área", "Suelo", "Cultivos activos"], body: parcelRows },
          { title: "Actividades Recientes (30 días)", head: ["Fecha", "Tipo", "Cultivo", "Parcela", "Notas"], body: actRows },
          { title: "Cosechas Recientes", head: ["Cultivo", "Cantidad", "Precio unit.", "Total", "Fecha"], body: harvestRows },
        ],
      });
      doc.save(`mi-reporte-${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Reporte descargado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  const loading = parcels.isLoading || activities.isLoading || financials.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Leaf className="size-6 text-primary" />
            Mi Reporte Personal
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Resumen de tu actividad agrícola • {format(new Date(), "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <Button onClick={exportPDF} disabled={exporting || loading} className="gap-2">
          <Download className="size-4" />
          {exporting ? "Exportando..." : "Descargar PDF"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/10 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Parcelas</span>
            <MapPin className="size-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-green-700 dark:text-green-400">{loading ? "—" : parcels.data?.length ?? 0}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cultivos activos</span>
            <Sprout className="size-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-700 dark:text-emerald-400">{loading ? "—" : activeCrops}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Actividades (30d)</span>
            <Activity className="size-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-blue-700 dark:text-blue-400">{loading ? "—" : activities.data?.length ?? 0}</p>
        </Card>
        <Card className={`p-4 bg-gradient-to-br border ${
          (alerts.data?.length ?? 0) > 0
            ? "from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10 border-red-200 dark:border-red-800"
            : "from-slate-50 to-slate-100/50 dark:from-slate-950/30 dark:to-slate-900/10 border-slate-200 dark:border-slate-800"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Alertas</span>
            <BellRing className={`size-4 ${(alerts.data?.length ?? 0) > 0 ? "text-red-600" : "text-slate-400"}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${(alerts.data?.length ?? 0) > 0 ? "text-red-700 dark:text-red-400" : "text-slate-600"}`}>{loading ? "—" : alerts.data?.length ?? 0}</p>
        </Card>
      </div>

      {/* Financiero */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-900">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Costos totales</p>
          <p className="mt-1 text-lg font-bold text-red-600">{formatCOP(totalCost)}</p>
        </div>
        <div className="p-4 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/10 dark:border-green-900">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingresos totales</p>
          <p className="mt-1 text-lg font-bold text-green-600">{formatCOP(totalRevenue)}</p>
        </div>
        <div className={`p-4 rounded-xl border ${
          margin >= 0 ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/10 dark:border-emerald-900" : "border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-900"
        }`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Margen bruto</p>
          <p className={`mt-1 text-lg font-bold ${margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>{margin >= 0 ? "+" : ""}{formatCOP(margin)}</p>
        </div>
      </div>

      {/* Parcelas */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="size-4 text-primary" /> Mis Parcelas</h3>
        {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
          <div className="space-y-2">
            {(parcels.data ?? []).map((p: any) => {
              const active = (p.crops ?? []).filter((c: any) => ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)).length;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{(Number(p.area_m2) / 10000).toFixed(2)} ha · {p.soil_types?.name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={active > 0 ? "default" : "outline"} className="text-xs">
                      {active} activos
                    </Badge>
                  </div>
                </div>
              );
            })}
            {(parcels.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin parcelas registradas.</p>}
          </div>
        )}
      </Card>

      {/* Actividades recientes */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="size-4 text-primary" /> Actividades (últimos 30 días)</h3>
        {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
          <div className="space-y-1.5">
            {(activities.data ?? []).slice(0, 8).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{kindLabels[a.kind] ?? a.kind}</Badge>
                  <span className="text-sm">{a.crops?.crop_catalog?.name ?? "—"}</span>
                  {a.crops?.parcels?.name && <span className="text-xs text-muted-foreground">· {a.crops.parcels.name}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(a.performed_at), "dd MMM", { locale: es })}</span>
              </div>
            ))}
            {(activities.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin actividades en los últimos 30 días.</p>}
          </div>
        )}
      </Card>

      {/* Cosechas recientes */}
      {(financials.data?.harvests ?? []).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Wheat className="size-4 text-primary" /> Cosechas Recientes</h3>
          <div className="space-y-1.5">
            {(financials.data?.harvests ?? []).slice(0, 5).map((h: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{h.crops?.crop_catalog?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{Number(h.harvested_qty).toFixed(1)} {h.unit ?? ""} · {h.performed_at ? format(new Date(h.performed_at), "dd MMM yyyy", { locale: es }) : "—"}</p>
                </div>
                <p className="text-sm font-semibold text-green-600">{formatCOP(Number(h.total_revenue || 0))}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Alertas */}
      {(alerts.data ?? []).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BellRing className="size-4 text-destructive" /> Alertas Pendientes</h3>
          <div className="space-y-2">
            {(alerts.data ?? []).map((a: any) => (
              <div key={a.id} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                {a.message}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
