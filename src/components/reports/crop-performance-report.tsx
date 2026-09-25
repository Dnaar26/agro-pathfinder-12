import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getMyCropPerformanceReport } from "@/lib/queries";
import { generatePdfReport } from "@/lib/pdf-report";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Sprout,
  Download,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  Wheat,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

const formatCOP = (n: number) =>
  "$ " + n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const statusLabel: Record<string, string> = {
  PLANEADO: "Planeado",
  SEMBRADO: "Sembrado",
  CRECIMIENTO: "En crecimiento",
  MANTENIMIENTO: "Mantenimiento",
  COSECHA: "En cosecha",
  POSTCOSECHA: "Post-cosecha",
  FINALIZADO: "Finalizado",
};

const statusColors: Record<string, string> = {
  PLANEADO: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  SEMBRADO: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  CRECIMIENTO: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  MANTENIMIENTO: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  COSECHA: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  POSTCOSECHA: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  FINALIZADO: "bg-muted/50 text-muted-foreground border-border",
};

export function CropPerformanceReport() {
  const [exporting, setExporting] = useState(false);

  const cropsQuery = useQuery({
    queryKey: ["my-crop-performance-report"],
    queryFn: getMyCropPerformanceReport,
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

  const crops = useMemo(() => (cropsQuery.data ?? []) as any[], [cropsQuery.data]);

  // Aggregate metrics per crop
  const cropMetrics = useMemo(() => {
    return crops.map((c: any) => {
      const totalCost = (c.crop_costs ?? []).reduce((s: number, x: any) => s + Number(x.total || 0), 0);
      const totalRevenue = (c.crop_harvests ?? []).reduce((s: number, x: any) => s + Number(x.total_revenue || 0), 0);
      const totalHarvested = (c.crop_harvests ?? []).reduce((s: number, x: any) => s + Number(x.harvested_qty || 0), 0);
      const activityCount = (c.activities ?? []).length;
      const daysInField = c.planting_date ? differenceInDays(new Date(), new Date(c.planting_date)) : 0;
      const daysToHarvest = c.estimated_harvest_date
        ? differenceInDays(new Date(c.estimated_harvest_date), new Date())
        : null;
      return { ...c, totalCost, totalRevenue, netMargin: totalRevenue - totalCost, totalHarvested, activityCount, daysInField, daysToHarvest };
    });
  }, [crops]);

  const globalCost = useMemo(() => cropMetrics.reduce((s, c) => s + c.totalCost, 0), [cropMetrics]);
  const globalRevenue = useMemo(() => cropMetrics.reduce((s, c) => s + c.totalRevenue, 0), [cropMetrics]);
  const activeCrops = useMemo(() => cropMetrics.filter((c) => ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)).length, [cropMetrics]);

  // ── Export PDF ─────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const farmerName = profileQuery.data?.fullName || "Agricultor";
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

      const summaryBody = cropMetrics.map((c) => [
        c.crop_catalog?.name ?? "—",
        c.parcels?.name ?? "—",
        statusLabel[c.status] ?? c.status,
        c.planting_date ? format(new Date(c.planting_date), "dd/MM/yyyy") : "—",
        c.estimated_harvest_date ? format(new Date(c.estimated_harvest_date), "dd/MM/yyyy") : "—",
        String(c.activityCount),
        formatCOP(c.totalCost),
        formatCOP(c.totalRevenue),
        c.totalRevenue > 0 || c.totalCost > 0 ? (c.netMargin >= 0 ? `+${formatCOP(c.netMargin)}` : formatCOP(c.netMargin)) : "—",
      ]);

      const doc = await generatePdfReport({
        template: "resumen",
        title: `Reporte de Rendimiento de Cultivos — ${farmerName}`,
        subtitle: `Generado el ${dateStr} • SIGIC Agro-Pathfinder`,
        author: farmerName,
        orientation: "landscape",
        sections: [
          {
            title: "Resumen Ejecutivo de Cultivos",
            head: ["Indicador", "Valor"],
            body: [
              ["Agricultor Titular", farmerName],
              ["Total de Cultivos Registrados", String(cropMetrics.length)],
              ["Cultivos Activos en Campo", String(activeCrops)],
              ["Costo Total Acumulado", formatCOP(globalCost)],
              ["Ingresos Totales por Cosecha", formatCOP(globalRevenue)],
              ["Margen Bruto Global", globalRevenue - globalCost >= 0 ? `+${formatCOP(globalRevenue - globalCost)}` : formatCOP(globalRevenue - globalCost)],
            ],
          },
          {
            title: "Rendimiento por Cultivo",
            head: ["Cultivo", "Parcela", "Estado", "Siembra", "Cosecha Est.", "Actividades", "Costo Total", "Ingreso Total", "Margen"],
            body: summaryBody,
          },
        ],
      });

      doc.save(`SIGIC-Cultivos-${farmerName.replace(/\s+/g, "_")}-${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Reporte de cultivos PDF descargado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar PDF");
    } finally {
      setExporting(false);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    try {
      const farmerName = profileQuery.data?.fullName || "Agricultor";
      const rows = [
        ["Reporte de Rendimiento de Cultivos SIGIC"],
        [`Agricultor: ${farmerName}`],
        [`Fecha: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
        [],
        ["Cultivo", "Parcela", "Estado", "Fecha Siembra", "Cosecha Estimada", "Días en Campo", "Días Para Cosecha", "N° Actividades", "Costo Total (COP)", "Ingreso Total (COP)", "Margen Neto (COP)"],
        ...cropMetrics.map((c) => [
          c.crop_catalog?.name ?? "—",
          c.parcels?.name ?? "—",
          statusLabel[c.status] ?? c.status,
          c.planting_date ? format(new Date(c.planting_date), "yyyy-MM-dd") : "—",
          c.estimated_harvest_date ? format(new Date(c.estimated_harvest_date), "yyyy-MM-dd") : "—",
          c.daysInField,
          c.daysToHarvest !== null ? c.daysToHarvest : "—",
          c.activityCount,
          c.totalCost.toFixed(2),
          c.totalRevenue.toFixed(2),
          c.netMargin.toFixed(2),
        ]),
      ];

      const csvContent =
        "\uFEFF" +
        rows
          .map((r) =>
            r
              .map((val) => {
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
      a.download = `cultivos-rendimiento-${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV de rendimiento exportado");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  if (cropsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Cargando rendimiento de cultivos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-green-900/10 via-green-600/5 to-transparent border border-green-500/20 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-green-600/15 text-green-600 grid place-items-center">
            <Sprout className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Rendimiento de Cultivos</h2>
            <p className="text-xs text-muted-foreground">
              {cropMetrics.length} cultivos registrados • {activeCrops} activos en campo
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
            <span className="text-xs text-muted-foreground">Cultivos Totales</span>
            <Sprout className="size-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold mt-2">{cropMetrics.length}</p>
        </Card>
        <Card className="p-4 border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Activos</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600">{activeCrops}</p>
        </Card>
        <Card className="p-4 border-red-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Costos Totales</span>
            <DollarSign className="size-4 text-red-600" />
          </div>
          <p className="text-lg font-bold mt-2 text-red-600">{formatCOP(globalCost)}</p>
        </Card>
        <Card className={`p-4 shadow-xs border ${globalRevenue - globalCost >= 0 ? "border-emerald-500/30" : "border-red-500/30"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Margen Bruto</span>
            <TrendingUp className={`size-4 ${globalRevenue - globalCost >= 0 ? "text-emerald-600" : "text-red-600"}`} />
          </div>
          <p className={`text-lg font-bold mt-2 ${globalRevenue - globalCost >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {globalRevenue - globalCost >= 0 ? "+" : ""}{formatCOP(globalRevenue - globalCost)}
          </p>
        </Card>
      </div>

      {/* Crop Cards */}
      {cropMetrics.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Sprout className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tienes cultivos registrados aún.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cropMetrics.map((c) => (
            <Card key={c.id} className="p-5 border-border hover:border-primary/40 transition-all space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Wheat className="size-4 text-primary" />
                    {c.crop_catalog?.name ?? "Cultivo"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Parcela: <span className="font-medium text-foreground">{c.parcels?.name ?? "—"}</span>
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${statusColors[c.status] ?? ""}`}>
                  {statusLabel[c.status] ?? c.status}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Actividades</p>
                  <p className="text-lg font-bold">{c.activityCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">Días en campo</p>
                  <p className="text-lg font-bold">{c.daysInField}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-muted-foreground">
                    {c.daysToHarvest !== null && c.daysToHarvest >= 0 ? "Días p/ cosecha" : "Cosecha"}
                  </p>
                  <p className={`text-lg font-bold ${c.daysToHarvest !== null && c.daysToHarvest <= 7 && c.daysToHarvest >= 0 ? "text-amber-600" : ""}`}>
                    {c.daysToHarvest !== null ? (c.daysToHarvest < 0 ? "Vencida" : c.daysToHarvest) : "—"}
                  </p>
                </div>
              </div>

              {(c.totalCost > 0 || c.totalRevenue > 0) && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Costo</p>
                    <p className="text-sm font-bold text-red-600">{formatCOP(c.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Ingreso</p>
                    <p className="text-sm font-bold text-emerald-600">{formatCOP(c.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Margen</p>
                    <p className={`text-sm font-bold ${c.netMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {c.netMargin >= 0 ? "+" : ""}{formatCOP(c.netMargin)}
                    </p>
                  </div>
                </div>
              )}

              {c.estimated_harvest_date && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  Cosecha est.: {format(new Date(c.estimated_harvest_date), "dd MMM yyyy", { locale: es })}
                  {c.daysToHarvest !== null && c.daysToHarvest < 0 && (
                    <span className="flex items-center gap-1 text-red-600 font-semibold">
                      <AlertTriangle className="size-3" /> Fecha vencida
                    </span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
