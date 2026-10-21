import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAllPestIncidentsGlobal, getGlobalProductivityRanking, getGlobalInventoryConsolidated, listTechnicalAssistance } from "@/lib/queries";
import { generatePdfReport } from "@/lib/pdf-report";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Bug, Trophy, Package, Wrench, Download, FileSpreadsheet, Layers, DollarSign, TrendingUp, MapPin, AlertTriangle, User, Activity, Loader2, Wheat } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrencyInt } from "@/lib/currency";
import { CHART_COLORS } from "@/lib/chart-colors";
import { severityClass, severityLabel } from "@/lib/status-styles";

const formatCOP = formatCurrencyInt;

type SummaryChartPoint = { label: string; value: number };

function SummaryBarChart({ title, data, loading, formatValue = (value) => value.toLocaleString("es-CO"), color = CHART_COLORS[0] }: { title: string; data: SummaryChartPoint[]; loading: boolean; formatValue?: (value: number) => string; color?: string }) {
  return (
    <Card className="p-4 border-border">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          Cargando resumen...
        </div>
      ) : data.length === 0 ? (
        <p className="h-48 flex items-center justify-center text-sm text-muted-foreground">Aún no hay datos para graficar.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(210, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value))} />
            <YAxis type="category" dataKey="label" width={112} tick={{ fontSize: 10 }} interval={0} />
            <Tooltip formatter={(value: number) => [formatValue(value), title]} />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function StaffReportsPanel({ userRole }: { userRole: "tecnico" | "admin" }) {
  const [activeTab, setActiveTab] = useState(userRole === "tecnico" ? "plagas-zonales" : "ranking");
  const [exporting, setExporting] = useState(false);
  const [pestSearch, setPestSearch] = useState("");
  const [pestSeverityFilter, setPestSeverityFilter] = useState("ALL");

  // 1. Monitoreo Fitosanitario Zonal
  const pestsQuery = useQuery({
    queryKey: ["global-pests"],
    queryFn: listAllPestIncidentsGlobal,
  });

  // 2. Ranking de Productividad
  const rankingQuery = useQuery({
    queryKey: ["global-ranking"],
    queryFn: getGlobalProductivityRanking,
  });

  // 3. Inventario Global Consolidado
  const inventoryQuery = useQuery({
    queryKey: ["global-inventory"],
    queryFn: getGlobalInventoryConsolidated,
  });

  // 4. Asistencias Técnicas
  const visitsQuery = useQuery({
    queryKey: ["technical-visits"],
    queryFn: listTechnicalAssistance,
  });

  // Ranking data aggregation
  const rankingData = useMemo(() => {
    const harvests = rankingQuery.data?.harvests ?? [];
    const costs = rankingQuery.data?.costs ?? [];

    const map: Record<
      string,
      {
        cropName: string;
        farmerName: string;
        parcelName: string;
        areaM2: number;
        harvestedQty: number;
        totalRevenue: number;
        totalCost: number;
        unit: string;
      }
    > = {};

    for (const h of harvests) {
      const crop = h.crops?.crop_catalog?.name || "Cultivo";
      const farmer = h.crops?.parcels?.profiles?.full_name || "Productor";
      const parcel = h.crops?.parcels?.name || "—";
      const area = Number(h.crops?.parcels?.area_m2 || 0);
      const key = String(h.crops?.id ?? `${farmer}\u0000${crop}\u0000${parcel}`);

      if (!map[key]) {
        map[key] = {
          cropName: crop,
          farmerName: farmer,
          parcelName: parcel,
          areaM2: area,
          harvestedQty: 0,
          totalRevenue: 0,
          totalCost: 0,
          unit: h.unit || "KG",
        };
      }
      map[key].harvestedQty += Number(h.harvested_qty || 0);
      map[key].totalRevenue += Number(h.total_revenue || 0);
    }

    for (const c of costs) {
      const crop = c.crops?.crop_catalog?.name || "Cultivo";
      const farmer = c.crops?.parcels?.profiles?.full_name || "Productor";
      const parcel = c.crops?.parcels?.name || "—";
      const key = String(c.crops?.id ?? `${farmer}\u0000${crop}\u0000${parcel}`);
      if (!map[key]) {
        map[key] = {
          cropName: crop,
          farmerName: farmer,
          parcelName: parcel,
          areaM2: Number(c.crops?.parcels?.area_m2 || 0),
          harvestedQty: 0,
          totalRevenue: 0,
          totalCost: 0,
          unit: "KG",
        };
      }
      map[key].totalCost += Number(c.total || 0);
    }

    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [rankingQuery.data]);

  // Inventory consolidation
  const inventoryData = useMemo(() => {
    const items = inventoryQuery.data ?? [];
    let totalVal = 0;
    const byCategory: Record<string, { count: number; value: number }> = {};

    for (const i of items) {
      const val = Number(i.stock_qty || 0) * Number(i.unit_cost || 0);
      totalVal += val;
      const cat = i.category || "Otro";
      if (!byCategory[cat]) byCategory[cat] = { count: 0, value: 0 };
      byCategory[cat].count++;
      byCategory[cat].value += val;
    }

    return { items, totalVal, byCategory };
  }, [inventoryQuery.data]);

  const visiblePests = useMemo(() => {
    const query = pestSearch.trim().toLocaleLowerCase("es-CO");
    const severityRank: Record<string, number> = {
      CRITICA: 0,
      ALTA: 1,
      MEDIA: 2,
      BAJA: 3,
    };
    return [...(pestsQuery.data ?? [])]
      .filter((pest: any) => {
        const matchesSeverity = pestSeverityFilter === "ALL" || pest.severity === pestSeverityFilter;
        const searchText = [pest.pest_name, pest.crops?.crop_catalog?.name, pest.crops?.parcels?.name, pest.crops?.parcels?.profiles?.full_name].filter(Boolean).join(" ").toLocaleLowerCase("es-CO");
        return matchesSeverity && (!query || searchText.includes(query));
      })
      .sort((a: any, b: any) => (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4) || new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [pestsQuery.data, pestSearch, pestSeverityFilter]);

  const pestSeverityChart = useMemo(() => {
    const severityOrder = ["CRITICA", "ALTA", "MEDIA", "BAJA"];
    const counts = new Map<string, number>();
    for (const pest of visiblePests) counts.set(pest.severity || "SIN CLASIFICAR", (counts.get(pest.severity || "SIN CLASIFICAR") ?? 0) + 1);
    return [...severityOrder, ...[...counts.keys()].filter((severity) => !severityOrder.includes(severity))]
      .map((severity) => ({
        label: severity === "CRITICA" ? "Crítica" : severity === "SIN CLASIFICAR" ? "Sin clasificar" : `${severity[0]}${severity.slice(1).toLowerCase()}`,
        value: counts.get(severity) ?? 0,
      }))
      .filter((point) => point.value > 0);
  }, [visiblePests]);

  const priorityPestCount = visiblePests.filter((pest: any) => ["CRITICA", "ALTA"].includes(pest.severity)).length;

  const rankingChart = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rankingData) totals.set(row.farmerName, (totals.get(row.farmerName) ?? 0) + row.totalRevenue);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({
        label: label.length > 20 ? `${label.slice(0, 19)}…` : label,
        value,
      }));
  }, [rankingData]);

  const inventoryChart = useMemo(
    () =>
      Object.entries(inventoryData.byCategory)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 8)
        .map(([label, values]) => ({ label, value: values.value })),
    [inventoryData.byCategory],
  );

  const visitChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const visit of visitsQuery.data ?? []) counts.set(visit.kind || "Sin clasificar", (counts.get(visit.kind || "Sin clasificar") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [visitsQuery.data]);

  // ── Exportadores por Pestaña ─────────────────────────────────────────────

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const dateStr = format(new Date(), "dd/MM/yyyy", { locale: es });

      if (activeTab === "plagas-zonales") {
        const pests = visiblePests;
        const doc = await generatePdfReport({
          template: "resumen",
          title: "Monitoreo Fitosanitario y Epidemiológico Zonal",
          subtitle: `Generado el ${dateStr} • SIGIC Staff Report`,
          orientation: "landscape",
          summary: [
            { label: "Incidencias filtradas", value: String(pests.length) },
            {
              label: "Severidad crítica/alta",
              value: String(priorityPestCount),
            },
            {
              label: "Parcelas afectadas",
              value: String(new Set(pests.map((p: any) => p.crops?.parcels?.id).filter(Boolean)).size),
            },
          ],
          charts: [
            {
              title: "Incidencias por severidad (vista filtrada)",
              data: pestSeverityChart,
              color: [180, 83, 9],
            },
          ],
          sections: [
            {
              title: "Incidencias Reportadas por Lote y Productor",
              head: ["Fecha", "Plaga", "Severidad", "Cultivo", "Parcela", "Productor", "Coordenadas", "Tratamiento"],
              body: pests.map((p: any) => [p.date ? format(new Date(p.date), "dd/MM/yyyy") : "—", p.pest_name || "—", p.severity || "—", p.crops?.crop_catalog?.name || "—", p.crops?.parcels?.name || "—", p.crops?.parcels?.profiles?.full_name || "—", p.crops?.parcels?.latitude != null && p.crops?.parcels?.longitude != null ? `${p.crops.parcels.latitude}, ${p.crops.parcels.longitude}` : "—", p.treatment || "—"]),
            },
          ],
        });
        doc.save(`SIGIC-Plagas-Zonal-${format(new Date(), "yyyyMMdd")}.pdf`);
      } else if (activeTab === "ranking") {
        const doc = await generatePdfReport({
          template: "resumen",
          title: "Ranking de Productividad y Rentabilidad por Finca",
          subtitle: `Generado el ${dateStr} • SIGIC Staff Report`,
          orientation: "landscape",
          summary: [
            {
              label: "Productores",
              value: String(new Set(rankingData.map((row) => row.farmerName)).size),
            },
            {
              label: "Ingresos",
              value: formatCOP(rankingData.reduce((sum, row) => sum + row.totalRevenue, 0)),
            },
            {
              label: "Costos",
              value: formatCOP(rankingData.reduce((sum, row) => sum + row.totalCost, 0)),
            },
            {
              label: "Margen",
              value: formatCOP(rankingData.reduce((sum, row) => sum + row.totalRevenue - row.totalCost, 0)),
            },
          ],
          charts: [
            {
              title: "Ingresos por productor · Top 8",
              data: rankingChart,
              valueFormatter: formatCOP,
            },
          ],
          sections: [
            {
              title: "Productores y Rendimiento de Cultivos",
              head: ["Productor", "Cultivo", "Parcela", "Área (ha)", "Cosecha", "Ingresos", "Costos", "Margen"],
              body: rankingData.map((r) => [r.farmerName, r.cropName, r.parcelName, (r.areaM2 / 10000).toFixed(2), `${r.harvestedQty.toFixed(1)} ${r.unit}`, formatCOP(r.totalRevenue), formatCOP(r.totalCost), formatCOP(r.totalRevenue - r.totalCost)]),
            },
          ],
        });
        doc.save(`SIGIC-Ranking-Productividad-${format(new Date(), "yyyyMMdd")}.pdf`);
      } else if (activeTab === "inventario-global") {
        const doc = await generatePdfReport({
          template: "resumen",
          title: "Inventario Consolidado de Insumos de la Plataforma",
          subtitle: `Generado el ${dateStr} • Valor Total: ${formatCOP(inventoryData.totalVal)}`,
          orientation: "landscape",
          summary: [
            {
              label: "Insumos registrados",
              value: String(inventoryData.items.length),
            },
            {
              label: "Categorías",
              value: String(Object.keys(inventoryData.byCategory).length),
            },
            { label: "Valor total", value: formatCOP(inventoryData.totalVal) },
          ],
          charts: [
            {
              title: "Valor por categoría · Top 8",
              data: inventoryChart,
              valueFormatter: formatCOP,
              color: [3, 105, 161],
            },
          ],
          sections: [
            {
              title: "Listado Agregado de Insumos",
              head: ["Insumo", "Categoría", "Productor", "Stock", "Costo Unit.", "Valor Total"],
              body: inventoryData.items.map((i: any) => [i.name, i.category || "—", i.profiles?.full_name || "—", `${Number(i.stock_qty).toFixed(2)} ${i.unit || ""}`, formatCOP(Number(i.unit_cost || 0)), formatCOP(Number(i.stock_qty || 0) * Number(i.unit_cost || 0))]),
            },
          ],
        });
        doc.save(`SIGIC-Inventario-Consolidado-${format(new Date(), "yyyyMMdd")}.pdf`);
      } else {
        const visits = visitsQuery.data ?? [];
        const doc = await generatePdfReport({
          template: "resumen",
          title: "Bitácora de Asistencias Técnicas y Monitoreos en Campo",
          subtitle: `Generado el ${dateStr} • SIGIC Staff Report`,
          orientation: "landscape",
          summary: [
            {
              label: "Asistencias",
              value: String(visitsQuery.data?.length ?? 0),
            },
            {
              label: "Técnicos",
              value: String(new Set((visitsQuery.data ?? []).map((v: any) => v.profiles?.full_name).filter(Boolean)).size),
            },
            {
              label: "Productores atendidos",
              value: String(new Set((visitsQuery.data ?? []).map((v: any) => v.crops?.parcels?.profiles?.full_name).filter(Boolean)).size),
            },
          ],
          charts: [
            {
              title: "Asistencias por tipo de labor",
              data: visitChart,
              color: [3, 105, 161],
            },
          ],
          sections: [
            {
              title: "Visitas e Intervenciones Registradas",
              head: ["Fecha", "Labor", "Técnico Responsable", "Productor", "Parcela", "Notas"],
              body: visits.map((v: any) => [v.performed_at ? format(new Date(v.performed_at), "dd/MM/yyyy") : "—", v.kind || "—", v.profiles?.full_name || "Técnico", v.crops?.parcels?.profiles?.full_name || "—", v.crops?.parcels?.name || "—", v.notes || "—"]),
            },
          ],
        });
        doc.save(`SIGIC-Asistencias-Tecnicas-${format(new Date(), "yyyyMMdd")}.pdf`);
      }

      toast.success("Reporte especializado descargado en PDF");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    try {
      let rows: (string | number)[][] = [];
      let filename = "reporte";

      if (activeTab === "plagas-zonales") {
        filename = "plagas-zonales";
        rows = [["Monitoreo Fitosanitario Zonal SIGIC"], [`Registros incluidos: ${visiblePests.length}`], ["Fecha", "Plaga", "Severidad", "Cultivo", "Parcela", "Productor", "Latitud", "Longitud", "Tratamiento", "Notas"], ...visiblePests.map((p: any) => [p.date || "", p.pest_name || "", p.severity || "", p.crops?.crop_catalog?.name || "", p.crops?.parcels?.name || "", p.crops?.parcels?.profiles?.full_name || "", p.crops?.parcels?.latitude ?? "", p.crops?.parcels?.longitude ?? "", p.treatment || "", p.notes || ""])];
      } else if (activeTab === "ranking") {
        filename = "ranking-productividad";
        rows = [["Ranking de Productividad y Rentabilidad SIGIC"], ["Productor", "Cultivo", "Parcela", "Área (ha)", "Cantidad Cosechada", "Unidad", "Ingresos (COP)", "Costos (COP)", "Margen (COP)"], ...rankingData.map((r) => [r.farmerName, r.cropName, r.parcelName, (r.areaM2 / 10000).toFixed(2), r.harvestedQty.toFixed(2), r.unit, r.totalRevenue.toFixed(2), r.totalCost.toFixed(2), (r.totalRevenue - r.totalCost).toFixed(2)])];
      } else if (activeTab === "inventario-global") {
        filename = "inventario-consolidado";
        rows = [["Inventario Consolidado de Insumos SIGIC"], ["Insumo", "Categoría", "Productor", "Stock", "Unidad", "Costo Unitario (COP)", "Valor Total (COP)"], ...inventoryData.items.map((i: any) => [i.name, i.category || "", i.profiles?.full_name || "", Number(i.stock_qty).toFixed(2), i.unit || "", Number(i.unit_cost || 0).toFixed(2), (Number(i.stock_qty || 0) * Number(i.unit_cost || 0)).toFixed(2)])];
      } else {
        filename = "asistencias-tecnicas";
        rows = [["Bitácora de Asistencias Técnicas SIGIC"], ["Fecha", "Labor", "Técnico", "Productor", "Parcela", "Notas"], ...(visitsQuery.data ?? []).map((v: any) => [v.performed_at ? format(new Date(v.performed_at), "yyyy-MM-dd") : "", v.kind || "", v.profiles?.full_name || "", v.crops?.parcels?.profiles?.full_name || "", v.crops?.parcels?.name || "", v.notes || ""])];
      }

      const csvContent =
        "\uFEFF" +
        rows
          .map((r) =>
            r
              .map((val: unknown) => {
                let s = String(val ?? "");
                if (typeof val === "string" && /^[\t\r ]*[=+@-]/.test(s)) s = `'${s}`;
                s = s.replace(/"/g, '""');
                return /[",\n]/.test(s) ? `"${s}"` : s;
              })
              .join(","),
          )
          .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV especializado exportado con éxito");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Staff */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Reportes Especializados — Rol {userRole === "admin" ? "Administrador" : "Técnico"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Módulos analíticos para supervisión agronómica, sanidad zonal y productividad.</p>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 w-full sm:w-auto grid grid-cols-2 sm:inline-flex h-auto gap-1">
          <TabsTrigger value="plagas-zonales" className="text-xs gap-1.5 py-1.5">
            <Bug className="size-3.5" />
            Sanidad Zonal
          </TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs gap-1.5 py-1.5">
            <Trophy className="size-3.5" />
            Ranking Productividad
          </TabsTrigger>
          <TabsTrigger value="inventario-global" className="text-xs gap-1.5 py-1.5">
            <Package className="size-3.5" />
            Inventario Consolidado
          </TabsTrigger>
          <TabsTrigger value="visitas" className="text-xs gap-1.5 py-1.5">
            <Wrench className="size-3.5" />
            Asistencias Técnicas
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Sanidad Zonal */}
        <TabsContent value="plagas-zonales" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1 text-xs font-medium">
              Buscar plaga, cultivo, parcela o productor
              <input type="search" value={pestSearch} onChange={(event) => setPestSearch(event.target.value)} placeholder="Escribe para filtrar" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="space-y-1 text-xs font-medium sm:w-52">
              Severidad
              <select value={pestSeverityFilter} onChange={(event) => setPestSeverityFilter(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="ALL">Todas</option>
                <option value="CRITICA">Crítica</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </label>
          </div>
          <SummaryBarChart title="Incidencias por severidad" data={pestSeverityChart} loading={pestsQuery.isLoading} color={CHART_COLORS[2]} />
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${priorityPestCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20"}`} aria-live="polite">
            <AlertTriangle className={`size-4 shrink-0 ${priorityPestCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <span>
              <strong>{priorityPestCount}</strong> registros con severidad crítica o alta entre {visiblePests.length} coincidencias. La lista se ordena primero por mayor severidad.
            </span>
          </div>
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bug className="size-4 text-primary" />
              Incidencias Fitosanitarias Monitoreadas en la Zona ({visiblePests.length})
            </h3>
            {pestsQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Cargando incidencias zonales...
              </div>
            ) : pestsQuery.isError ? (
              <div role="alert" className="py-6 text-center text-sm text-destructive">
                No se pudieron cargar las incidencias.{" "}
                <Button variant="link" size="sm" onClick={() => void pestsQuery.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : visiblePests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No hay incidencias que coincidan con los filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Plaga</th>
                      <th className="py-2 px-3">Severidad</th>
                      <th className="py-2 px-3">Cultivo</th>
                      <th className="py-2 px-3">Parcela</th>
                      <th className="py-2 px-3">Productor</th>
                      <th className="py-2 px-3">Ubicación</th>
                      <th className="py-2 px-3">Tratamiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {visiblePests.map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{p.date ? format(new Date(p.date), "dd/MM/yyyy") : "—"}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">{p.pest_name}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={`text-[10px] ${severityClass(p.severity)}`}>
                            {severityLabel(p.severity)}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{p.crops?.crop_catalog?.name ?? "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{p.crops?.parcels?.name ?? "—"}</td>
                        <td className="py-2 px-3 font-medium">{p.crops?.parcels?.profiles?.full_name ?? "—"}</td>
                        <td className="py-2 px-3">
                          {p.crops?.parcels?.latitude != null && p.crops?.parcels?.longitude != null ? (
                            <a href={`https://www.google.com/maps?q=${p.crops.parcels.latitude},${p.crops.parcels.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline" aria-label={`Abrir ubicación de ${p.crops?.parcels?.name ?? "la parcela"} en mapa`}>
                              <MapPin className="size-3.5" /> Mapa
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sin coordenadas</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">{p.treatment || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Ranking de Productividad */}
        <TabsContent value="ranking" className="space-y-4">
          <SummaryBarChart title="Ingresos por productor · Top 8" data={rankingChart} loading={rankingQuery.isLoading} formatValue={formatCOP} />
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="size-4 text-warning-text" />
              Ranking de Productores por Ingresos y Cosecha
            </h3>
            {rankingQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Consolidando rendimiento...
              </div>
            ) : rankingQuery.isError ? (
              <div role="alert" className="py-6 text-center text-sm text-destructive">
                No se pudo consolidar el ranking.{" "}
                <Button variant="link" size="sm" onClick={() => void rankingQuery.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : rankingData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No hay datos de cosecha registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Productor</th>
                      <th className="py-2 px-3">Cultivo</th>
                      <th className="py-2 px-3">Parcela</th>
                      <th className="py-2 px-3 text-right">Área</th>
                      <th className="py-2 px-3 text-right">Cosecha Total</th>
                      <th className="py-2 px-3 text-right">Ingresos</th>
                      <th className="py-2 px-3 text-right">Costos</th>
                      <th className="py-2 px-3 text-right">Margen Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rankingData.map((r, idx) => {
                      const net = r.totalRevenue - r.totalCost;
                      return (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-bold text-muted-foreground">#{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-foreground">{r.farmerName}</td>
                          <td className="py-2 px-3">{r.cropName}</td>
                          <td className="py-2 px-3 text-muted-foreground">{r.parcelName}</td>
                          <td className="py-2 px-3 text-right">{(r.areaM2 / 10000).toFixed(2)} ha</td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">
                            {r.harvestedQty.toFixed(1)} {r.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-success tabular-nums">{formatCOP(r.totalRevenue)}</td>
                          <td className="py-2 px-3 text-right text-destructive tabular-nums">{formatCOP(r.totalCost)}</td>
                          <td className={`py-2 px-3 text-right font-bold tabular-nums ${net >= 0 ? "text-success" : "text-destructive"}`}>
                            {net >= 0 ? "+" : ""}
                            {formatCOP(net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 3: Inventario Consolidado */}
        <TabsContent value="inventario-global" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 border-border/70 shadow-xs">
              <span className="text-xs text-muted-foreground">Valorización Global</span>
              <p className="text-xl font-bold mt-1 text-success">{formatCOP(inventoryData.totalVal)}</p>
            </Card>
            <Card className="p-4 border-border/70 shadow-xs">
              <span className="text-xs text-muted-foreground">Total Insumos Registrados</span>
              <p className="text-xl font-bold mt-1">{inventoryData.items.length}</p>
            </Card>
            <Card className="p-4 border-border/70 shadow-xs">
              <span className="text-xs text-muted-foreground">Categorías Activas</span>
              <p className="text-xl font-bold mt-1">{Object.keys(inventoryData.byCategory).length}</p>
            </Card>
          </div>

          <SummaryBarChart title="Valor del inventario por categoría · Top 8" data={inventoryChart} loading={inventoryQuery.isLoading} formatValue={formatCOP} color={CHART_COLORS[5]} />

          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="size-4 text-primary" />
              Inventario Agregado de Productores
            </h3>
            {inventoryQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Consolidando insumos...
              </div>
            ) : inventoryQuery.isError ? (
              <div role="alert" className="py-6 text-center text-sm text-destructive">
                No se pudo cargar el inventario global.{" "}
                <Button variant="link" size="sm" onClick={() => void inventoryQuery.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : inventoryData.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No hay insumos registrados en el sistema.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="py-2 px-3">Insumo</th>
                      <th className="py-2 px-3">Categoría</th>
                      <th className="py-2 px-3">Productor</th>
                      <th className="py-2 px-3 text-right">Stock</th>
                      <th className="py-2 px-3 text-right">Costo Unit.</th>
                      <th className="py-2 px-3 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {inventoryData.items.map((i: any) => (
                      <tr key={i.id} className="hover:bg-muted/30">
                        <td className="py-2 px-3 font-semibold text-foreground">{i.name}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {i.category || "—"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{i.profiles?.full_name ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">
                          {Number(i.stock_qty).toFixed(2)} {i.unit}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatCOP(Number(i.unit_cost || 0))}</td>
                        <td className="py-2 px-3 text-right font-bold text-success tabular-nums">{formatCOP(Number(i.stock_qty || 0) * Number(i.unit_cost || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Asistencias Técnicas */}
        <TabsContent value="visitas" className="space-y-4">
          <SummaryBarChart title="Asistencias por tipo de labor" data={visitChart} loading={visitsQuery.isLoading} color={CHART_COLORS[5]} />
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              Bitácora de Asistencias Técnicas y Monitoreos en Campo ({(visitsQuery.data ?? []).length})
            </h3>
            {visitsQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Cargando visitas...
              </div>
            ) : visitsQuery.isError ? (
              <div role="alert" className="py-6 text-center text-sm text-destructive">
                No se pudieron cargar las asistencias.{" "}
                <Button variant="link" size="sm" onClick={() => void visitsQuery.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : (visitsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No hay asistencias técnicas registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Labor</th>
                      <th className="py-2 px-3">Técnico / Responsable</th>
                      <th className="py-2 px-3">Productor</th>
                      <th className="py-2 px-3">Parcela</th>
                      <th className="py-2 px-3">Observaciones / Recomendaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(visitsQuery.data ?? []).map((v: any) => (
                      <tr key={v.id} className="hover:bg-muted/30">
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{v.performed_at ? format(new Date(v.performed_at), "dd/MM/yyyy") : "—"}</td>
                        <td className="py-2 px-3 font-semibold text-foreground">{v.kind}</td>
                        <td className="py-2 px-3 text-primary font-medium">{v.profiles?.full_name || "Técnico"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{v.crops?.parcels?.profiles?.full_name || "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{v.crops?.parcels?.name || "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground max-w-[280px]">{v.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
