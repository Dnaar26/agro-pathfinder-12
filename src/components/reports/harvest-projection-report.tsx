import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getMyUpcomingHarvestsAndTasks } from "@/lib/queries";
import { generatePdfReport } from "@/lib/pdf-report";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  Clock,
  AlertTriangle,
  Wheat,
  BellRing,
  Loader2,
  CheckCircle2,
  Droplet,
} from "lucide-react";

export function HarvestProjectionReport() {
  const [exporting, setExporting] = useState(false);

  const dataQuery = useQuery({
    queryKey: ["my-harvest-projections"],
    queryFn: getMyUpcomingHarvestsAndTasks,
  });

  const profileQuery = useQuery({
    queryKey: ["farmer-report-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      return { fullName: data?.full_name || "Agricultor" };
    },
  });

  const { crops, alerts, upcomingActivities } = useMemo(() => {
    return dataQuery.data ?? { crops: [], alerts: [], upcomingActivities: [] };
  }, [dataQuery.data]);

  // Calculations on upcoming harvests
  const harvestStats = useMemo(() => {
    let next15Days = 0;
    let next30Days = 0;
    let overdue = 0;

    for (const c of crops) {
      if (!c.estimated_harvest_date) continue;
      const diff = differenceInDays(new Date(c.estimated_harvest_date), new Date());
      if (diff < 0) overdue++;
      else if (diff <= 15) next15Days++;
      else if (diff <= 30) next30Days++;
    }

    return { total: crops.length, next15Days, next30Days, overdue };
  }, [crops]);

  // Exportar PDF
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const farmerName = profileQuery.data?.fullName || "Agricultor";
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

      const harvestRows = crops.map((c) => {
        const diff = c.estimated_harvest_date
          ? differenceInDays(new Date(c.estimated_harvest_date), new Date())
          : null;
        const statusText =
          diff !== null
            ? diff < 0
              ? `Vencida (${Math.abs(diff)}d)`
              : diff === 0
              ? "Hoy"
              : `En ${diff} días`
            : "Sin fecha";

        return [
          c.crop_catalog?.name || "Cultivo",
          c.parcels?.name || "—",
          c.status || "—",
          c.planting_date ? format(new Date(c.planting_date), "dd/MM/yyyy") : "—",
          c.estimated_harvest_date ? format(new Date(c.estimated_harvest_date), "dd/MM/yyyy") : "—",
          statusText,
        ];
      });

      const alertRows = alerts.map((a: any) => [
        a.scheduled_at ? format(new Date(a.scheduled_at), "dd/MM/yyyy") : "—",
        a.kind || "—",
        a.title || "—",
        a.body || "Sin descripción",
      ]);

      const doc = await generatePdfReport({
        template: "resumen",
        title: `Proyección de Cosechas y Labores — ${farmerName}`,
        subtitle: `Generado el ${dateStr} • SIGIC Agro-Pathfinder`,
        author: farmerName,
        orientation: "landscape",
        sections: [
          {
            title: "Resumen de Cosechas Próximas",
            head: ["Horizonte de Tiempo", "Cultivos Proyectados"],
            body: [
              ["Cosechas en los próximos 15 días", String(harvestStats.next15Days)],
              ["Cosechas entre 16 y 30 días", String(harvestStats.next30Days)],
              ["Cosechas con fecha superada", String(harvestStats.overdue)],
              ["Total Cultivos en Campo", String(harvestStats.total)],
              ["Alertas de Labores Pendientes", String(alerts.length)],
            ],
          },
          {
            title: "Cronograma Proyectado de Cosechas",
            head: ["Cultivo", "Parcela", "Estado Actual", "Fecha Siembra", "Cosecha Estimada", "Plazo Restante"],
            body: harvestRows,
          },
          ...(alertRows.length > 0
            ? [{
                title: "Labores y Alertas Pendientes en Campo",
                head: ["Fecha Programada", "Tipo de Labor", "Título", "Detalles"],
                body: alertRows,
                columnStyles: { 3: { cellWidth: 70 } },
              }]
            : []),
        ],
      });

      doc.save(`SIGIC-Proyeccion-Cosechas-${farmerName.replace(/\s+/g, "_")}-${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Reporte de proyección descargado en PDF");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar PDF");
    } finally {
      setExporting(false);
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    try {
      const farmerName = profileQuery.data?.fullName || "Agricultor";
      const rows = [
        ["Reporte de Proyección de Cosechas y Labores SIGIC"],
        [`Agricultor: ${farmerName}`],
        [`Fecha: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
        [],
        ["--- CULTIVOS Y COSECHAS ESTIMADAS ---"],
        ["Cultivo", "Parcela", "Estado", "Fecha Siembra", "Cosecha Estimada", "Días Restantes"],
        ...crops.map((c) => {
          const diff = c.estimated_harvest_date
            ? differenceInDays(new Date(c.estimated_harvest_date), new Date())
            : "";
          return [
            c.crop_catalog?.name || "",
            c.parcels?.name || "",
            c.status || "",
            c.planting_date ? format(new Date(c.planting_date), "yyyy-MM-dd") : "",
            c.estimated_harvest_date ? format(new Date(c.estimated_harvest_date), "yyyy-MM-dd") : "",
            diff !== "" ? String(diff) : "",
          ];
        }),
        [],
        ["--- ALERTAS Y LABORES PENDIENTES ---"],
        ["Fecha", "Tipo", "Título", "Detalle"],
        ...alerts.map((a: any) => [
          a.scheduled_at ? format(new Date(a.scheduled_at), "yyyy-MM-dd") : "",
          a.kind || "",
          a.title || "",
          a.body || "",
        ]),
      ];

      const csvContent =
        "\uFEFF" +
        rows
          .map((r) =>
            r
              .map((val: unknown) => {
                const s = String(val ?? "").replace(/"/g, '""');
                return /[",\n]/.test(s) ? `"${s}"` : s;
              })
              .join(",")
          )
          .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proyeccion-cosechas-${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV de proyecciones exportado");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  if (dataQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Calculando proyecciones de cosecha...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-900/10 via-amber-600/5 to-transparent border border-amber-500/20 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-amber-600/15 text-amber-600 grid place-items-center">
            <CalendarClock className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Proyección de Cosechas y Labores</h2>
            <p className="text-xs text-muted-foreground">
              {crops.length} cultivos en campo • {alerts.length} labores programadas pendientes
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
            <FileSpreadsheet className="size-3.5 text-primary" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-1.5 text-xs">
            <Download className="size-3.5" />
            {exporting ? "Generando..." : "Descargar PDF"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cosecha en ≤ 15 días</span>
            <Wheat className="size-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600">{harvestStats.next15Days}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">preparar logística</p>
        </Card>

        <Card className="p-4 border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cosecha 16 a 30 días</span>
            <Clock className="size-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-blue-600">{harvestStats.next30Days}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">fase de llenado</p>
        </Card>

        <Card className={`p-4 border shadow-xs ${harvestStats.overdue > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border/70"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Fecha Cumplida</span>
            <AlertTriangle className={`size-4 ${harvestStats.overdue > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${harvestStats.overdue > 0 ? "text-amber-600" : "text-foreground"}`}>
            {harvestStats.overdue}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">revisar madurez</p>
        </Card>

        <Card className="p-4 border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Alertas Activas</span>
            <BellRing className="size-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-purple-600">{alerts.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">riegos y fertilización</p>
        </Card>
      </div>

      {/* Crops Projection Table */}
      <Card className="p-4 border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Wheat className="size-4 text-primary" />
          Proyección Fenológica y Fechas Estimadas
        </h3>
        {crops.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No tienes cultivos activos en campo en este momento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="py-2.5 px-3">Cultivo</th>
                  <th className="py-2.5 px-3">Parcela</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Siembra</th>
                  <th className="py-2.5 px-3">Cosecha Estimada</th>
                  <th className="py-2.5 px-3 text-right">Días Restantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {crops.map((c: any) => {
                  const diff = c.estimated_harvest_date
                    ? differenceInDays(new Date(c.estimated_harvest_date), new Date())
                    : null;
                  return (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {c.crop_catalog?.name ?? "Cultivo"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {c.parcels?.name ?? "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {c.planting_date ? format(new Date(c.planting_date), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {c.estimated_harvest_date ? format(new Date(c.estimated_harvest_date), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                        {diff !== null ? (
                          diff < 0 ? (
                            <span className="text-amber-600">Vencida hace {Math.abs(diff)}d</span>
                          ) : diff <= 15 ? (
                            <span className="text-emerald-600 font-bold">{diff} días (Próxima)</span>
                          ) : (
                            <span className="text-foreground">{diff} días</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending Alerts / Tasks */}
      {alerts.length > 0 && (
        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BellRing className="size-4 text-purple-600" />
            Labores y Alertas Programadas para los Próximos Días
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {alerts.map((a: any) => (
              <div key={a.id} className="p-3 rounded-xl border border-border bg-muted/20 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    {a.kind}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {a.scheduled_at ? format(new Date(a.scheduled_at), "dd MMM", { locale: es }) : "—"}
                  </span>
                </div>
                <p className="font-semibold text-foreground pt-1">{a.title}</p>
                {a.body && <p className="text-muted-foreground text-[11px] line-clamp-2">{a.body}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
