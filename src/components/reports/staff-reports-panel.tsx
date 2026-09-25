import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listAllPestIncidentsGlobal,
  getGlobalProductivityRanking,
  getGlobalInventoryConsolidated,
  listTechnicalAssistance,
} from "@/lib/queries";
import { generatePdfReport } from "@/lib/pdf-report";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Bug,
  Trophy,
  Package,
  Wrench,
  Download,
  FileSpreadsheet,
  Layers,
  DollarSign,
  TrendingUp,
  MapPin,
  AlertTriangle,
  User,
  Activity,
  Loader2,
  Wheat,
} from "lucide-react";

const formatCOP = (n: number) =>
  "$ " + n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const severityColors: Record<string, string> = {
  BAJA: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  MEDIA: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  ALTA: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  CRITICA: "bg-red-500/15 text-red-700 border-red-500/30 font-bold",
};

export function StaffReportsPanel({ userRole }: { userRole: "tecnico" | "admin" }) {
  const [activeTab, setActiveTab] = useState(userRole === "tecnico" ? "plagas-zonales" : "ranking");
  const [exporting, setExporting] = useState(false);

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

    const map: Record<string, {
      cropName: string;
      farmerName: string;
      parcelName: string;
      areaM2: number;
      harvestedQty: number;
      totalRevenue: number;
      totalCost: number;
      unit: string;
    }> = {};

    for (const h of harvests) {
      const crop = h.crops?.crop_catalog?.name || "Cultivo";
      const farmer = h.crops?.parcels?.profiles?.full_name || "Productor";
      const parcel = h.crops?.parcels?.name || "—";
      const area = Number(h.crops?.parcels?.area_m2 || 0);
      const key = `${farmer}-${crop}-${parcel}`;

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
      const key = `${farmer}-${crop}-${parcel}`;

      if (map[key]) {
        map[key].totalCost += Number(c.total || 0);
      }
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

  // ── Exportadores por Pestaña ─────────────────────────────────────────────

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const dateStr = format(new Date(), "dd/MM/yyyy", { locale: es });

      if (activeTab === "plagas-zonales") {
        const pests = pestsQuery.data ?? [];
        const doc = await generatePdfReport({
          template: "resumen",
          title: "Monitoreo Fitosanitario y Epidemiológico Zonal",
          subtitle: `Generado el ${dateStr} • SIGIC Staff Report`,
          orientation: "landscape",
          sections: [
            {
              title: "Incidencias Reportadas por Lote y Productor",
              head: ["Fecha", "Plaga", "Severidad", "Cultivo", "Parcela", "Productor", "Tratamiento"],
              body: pests.map((p: any) => [
                p.date ? format(new Date(p.date), "dd/MM/yyyy") : "—",
                p.pest_name || "—",
                p.severity || "—",
                p.crops?.crop_catalog?.name || "—",
                p.crops?.parcels?.name || "—",
                p.crops?.parcels?.profiles?.full_name || "—",
                p.treatment || "—",
              ]),
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
          sections: [
            {
              title: "Productores y Rendimiento de Cultivos",
              head: ["Productor", "Cultivo", "Parcela", "Área (ha)", "Cosecha", "Ingresos", "Costos", "Margen"],
              body: rankingData.map((r) => [
                r.farmerName,
                r.cropName,
                r.parcelName,
                (r.areaM2 / 10000).toFixed(2),
                `${r.harvestedQty.toFixed(1)} ${r.unit}`,
                formatCOP(r.totalRevenue),
                formatCOP(r.totalCost),
                formatCOP(r.totalRevenue - r.totalCost),
              ]),
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
          sections: [
            {
              title: "Listado Agregado de Insumos",
              head: ["Insumo", "Categoría", "Productor", "Stock", "Costo Unit.", "Valor Total"],
              body: inventoryData.items.map((i: any) => [
                i.name,
                i.category || "—",
                i.profiles?.full_name || "—",
                `${Number(i.stock_qty).toFixed(2)} ${i.unit || ""}`,
                formatCOP(Number(i.unit_cost || 0)),
                formatCOP(Number(i.stock_qty || 0) * Number(i.unit_cost || 0)),
              ]),
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
          sections: [
            {
              title: "Visitas e Intervenciones Registradas",
              head: ["Fecha", "Labor", "Técnico Responsable", "Productor", "Parcela", "Notas"],
              body: visits.map((v: any) => [
                v.performed_at ? format(new Date(v.performed_at), "dd/MM/yyyy") : "—",
                v.kind || "—",
                v.profiles?.full_name || "Técnico",
                v.crops?.parcels?.profiles?.full_name || "—",
                v.crops?.parcels?.name || "—",
                v.notes || "—",
              ]),
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
        rows = [
          ["Monitoreo Fitosanitario Zonal SIGIC"],
          ["Fecha", "Plaga", "Severidad", "Cultivo", "Parcela", "Productor", "Tratamiento", "Notas"],
          ...(pestsQuery.data ?? []).map((p: any) => [
            p.date || "",
            p.pest_name || "",
            p.severity || "",
            p.crops?.crop_catalog?.name || "",
            p.crops?.parcels?.name || "",
            p.crops?.parcels?.profiles?.full_name || "",
            p.treatment || "",
            p.notes || "",
          ]),
        ];
      } else if (activeTab === "ranking") {
        filename = "ranking-productividad";
        rows = [
          ["Ranking de Productividad y Rentabilidad SIGIC"],
          ["Productor", "Cultivo", "Parcela", "Área (ha)", "Cantidad Cosechada", "Unidad", "Ingresos (COP)", "Costos (COP)", "Margen (COP)"],
          ...rankingData.map((r) => [
            r.farmerName,
            r.cropName,
            r.parcelName,
            (r.areaM2 / 10000).toFixed(2),
            r.harvestedQty.toFixed(2),
            r.unit,
            r.totalRevenue.toFixed(2),
            r.totalCost.toFixed(2),
            (r.totalRevenue - r.totalCost).toFixed(2),
          ]),
        ];
      } else if (activeTab === "inventario-global") {
        filename = "inventario-consolidado";
        rows = [
          ["Inventario Consolidado de Insumos SIGIC"],
          ["Insumo", "Categoría", "Productor", "Stock", "Unidad", "Costo Unitario (COP)", "Valor Total (COP)"],
          ...inventoryData.items.map((i: any) => [
            i.name,
            i.category || "",
            i.profiles?.full_name || "",
            Number(i.stock_qty).toFixed(2),
            i.unit || "",
            Number(i.unit_cost || 0).toFixed(2),
            (Number(i.stock_qty || 0) * Number(i.unit_cost || 0)).toFixed(2),
          ]),
        ];
      } else {
        filename = "asistencias-tecnicas";
        rows = [
          ["Bitácora de Asistencias Técnicas SIGIC"],
          ["Fecha", "Labor", "Técnico", "Productor", "Parcela", "Notas"],
          ...(visitsQuery.data ?? []).map((v: any) => [
            v.performed_at ? format(new Date(v.performed_at), "yyyy-MM-dd") : "",
            v.kind || "",
            v.profiles?.full_name || "",
            v.crops?.parcels?.profiles?.full_name || "",
            v.crops?.parcels?.name || "",
            v.notes || "",
          ]),
        ];
      }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-primary/5 to-transparent border border-primary/20 shadow-xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Reportes Especializados — Rol {userRole === "admin" ? "Administrador" : "Técnico"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Módulos analíticos para supervisión agronómica, sanidad zonal y productividad.
          </p>
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
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bug className="size-4 text-primary" />
              Incidencias Fitosanitarias Monitoreadas en la Zona ({(pestsQuery.data ?? []).length})
            </h3>
            {pestsQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Cargando incidencias zonales...
              </div>
            ) : (pestsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No hay plagas reportadas en la zona.</p>
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
                      <th className="py-2 px-3">Tratamiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(pestsQuery.data ?? []).map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                          {p.date ? format(new Date(p.date), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground">{p.pest_name}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={`text-[10px] ${severityColors[p.severity] ?? ""}`}>
                            {p.severity}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{p.crops?.crop_catalog?.name ?? "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{p.crops?.parcels?.name ?? "—"}</td>
                        <td className="py-2 px-3 font-medium">{p.crops?.parcels?.profiles?.full_name ?? "—"}</td>
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
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              Ranking de Productores por Ingresos y Cosecha
            </h3>
            {rankingQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Consolidando rendimiento...
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
                          <td className="py-2 px-3 text-right font-bold text-emerald-600 tabular-nums">
                            {formatCOP(r.totalRevenue)}
                          </td>
                          <td className="py-2 px-3 text-right text-red-600 tabular-nums">
                            {formatCOP(r.totalCost)}
                          </td>
                          <td className={`py-2 px-3 text-right font-bold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {net >= 0 ? "+" : ""}{formatCOP(net)}
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
              <p className="text-xl font-bold mt-1 text-emerald-600">{formatCOP(inventoryData.totalVal)}</p>
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

          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="size-4 text-primary" />
              Inventario Agregado de Productores
            </h3>
            {inventoryQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Consolidando insumos...
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
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 tabular-nums">
                          {formatCOP(Number(i.stock_qty || 0) * Number(i.unit_cost || 0))}
                        </td>
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
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              Bitácora de Asistencias Técnicas y Monitoreos en Campo ({(visitsQuery.data ?? []).length})
            </h3>
            {visitsQuery.isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Cargando visitas...
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
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                          {v.performed_at ? format(new Date(v.performed_at), "dd/MM/yyyy") : "—"}
                        </td>
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
