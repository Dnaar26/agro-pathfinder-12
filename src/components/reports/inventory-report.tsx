import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getMyInventoryReport } from "@/lib/queries";
import { generatePdfReport } from "@/lib/pdf-report";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Package,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Layers,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Loader2,
  ShieldAlert,
} from "lucide-react";

const formatCOP = (n: number) =>
  "$ " + n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const categoryColors: Record<string, string> = {
  Fertilizante: "bg-green-500/15 text-green-700 border-green-500/30",
  Plaguicida: "bg-red-500/15 text-red-700 border-red-500/30",
  Semilla: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  Herramienta: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  Combustible: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  Otro: "bg-slate-500/15 text-slate-700 border-slate-500/30",
};

export function InventoryReport() {
  const [exporting, setExporting] = useState(false);

  const inventoryQuery = useQuery({
    queryKey: ["my-inventory-report"],
    queryFn: getMyInventoryReport,
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

  const { items, movements, lowStock } = useMemo(() => {
    return inventoryQuery.data ?? { items: [], movements: [], lowStock: [] };
  }, [inventoryQuery.data]);

  const totalValue = useMemo(
    () => (items as any[]).reduce((s, i) => s + Number(i.stock_qty || 0) * Number(i.unit_cost || 0), 0),
    [items]
  );

  const byCategory = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    for (const i of items as any[]) {
      const cat = i.category || "Otro";
      if (!map[cat]) map[cat] = { count: 0, value: 0 };
      map[cat].count++;
      map[cat].value += Number(i.stock_qty || 0) * Number(i.unit_cost || 0);
    }
    return map;
  }, [items]);

  // ── Export PDF ──────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const farmerName = profileQuery.data?.fullName || "Agricultor";
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

      const itemsBody = (items as any[]).map((i) => [
        i.name,
        i.category || "—",
        `${Number(i.stock_qty).toFixed(2)} ${i.unit || ""}`,
        `${Number(i.min_stock).toFixed(2)} ${i.unit || ""}`,
        formatCOP(Number(i.unit_cost || 0)),
        formatCOP(Number(i.stock_qty || 0) * Number(i.unit_cost || 0)),
        Number(i.stock_qty) <= Number(i.min_stock) ? "⚠ Stock bajo" : "OK",
      ]);

      const movBody = (movements as any[]).slice(0, 30).map((m) => [
        m.created_at ? format(new Date(m.created_at), "dd/MM/yyyy HH:mm") : "—",
        m.inventory_items?.name || "—",
        m.kind === "ENTRADA" ? "Entrada" : "Salida",
        `${Number(m.qty).toFixed(2)} ${m.inventory_items?.unit || ""}`,
        m.notes || "—",
      ]);

      const lowBody = (lowStock as any[]).map((i) => [
        i.name,
        i.category || "—",
        `${Number(i.stock_qty).toFixed(2)} ${i.unit || ""}`,
        `${Number(i.min_stock).toFixed(2)} ${i.unit || ""}`,
      ]);

      const doc = await generatePdfReport({
        template: "resumen",
        title: `Reporte de Inventario — ${farmerName}`,
        subtitle: `Generado el ${dateStr} • SIGIC Agro-Pathfinder`,
        author: farmerName,
        orientation: "landscape",
        sections: [
          {
            title: "Resumen General del Inventario",
            head: ["Indicador", "Valor"],
            body: [
              ["Agricultor Titular", farmerName],
              ["Total de Ítems", String((items as any[]).length)],
              ["Valor Total del Inventario", formatCOP(totalValue)],
              ["Ítems con Stock Bajo", String((lowStock as any[]).length)],
              ["Movimientos Registrados (último reporte)", String((movements as any[]).length)],
              ["Categorías distintas", String(Object.keys(byCategory).length)],
            ],
          },
          {
            title: "Inventario Detallado de Insumos",
            head: ["Ítem", "Categoría", "Stock Actual", "Stock Mínimo", "Costo Unit.", "Valor Total", "Estado"],
            body: itemsBody,
            columnStyles: { 6: { cellWidth: 28 } },
          },
          ...(lowBody.length > 0
            ? [{
                title: "⚠ Ítems con Stock Bajo (Requieren Atención)",
                head: ["Ítem", "Categoría", "Stock Actual", "Mínimo Requerido"],
                body: lowBody,
              }]
            : []),
          {
            title: "Últimos Movimientos de Inventario",
            head: ["Fecha", "Ítem", "Tipo", "Cantidad", "Notas"],
            body: movBody,
            columnStyles: { 4: { cellWidth: 80 } },
          },
        ],
      });

      doc.save(`SIGIC-Inventario-${farmerName.replace(/\s+/g, "_")}-${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Reporte de inventario PDF descargado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar PDF");
    } finally {
      setExporting(false);
    }
  };

  // ── Export CSV ──────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    try {
      const farmerName = profileQuery.data?.fullName || "Agricultor";
      const rows = [
        ["Reporte de Inventario SIGIC"],
        [`Agricultor: ${farmerName}`],
        [`Fecha: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
        [`Valor Total Inventario: ${formatCOP(totalValue)}`],
        [],
        ["--- INVENTARIO DE INSUMOS ---"],
        ["Nombre", "Categoría", "Stock Actual", "Unidad", "Stock Mínimo", "Costo Unitario (COP)", "Valor Total (COP)", "Estado"],
        ...(items as any[]).map((i) => [
          i.name,
          i.category || "—",
          Number(i.stock_qty).toFixed(2),
          i.unit || "—",
          Number(i.min_stock).toFixed(2),
          Number(i.unit_cost || 0).toFixed(2),
          (Number(i.stock_qty || 0) * Number(i.unit_cost || 0)).toFixed(2),
          Number(i.stock_qty) <= Number(i.min_stock) ? "STOCK BAJO" : "OK",
        ]),
        [],
        ["--- MOVIMIENTOS DE INVENTARIO ---"],
        ["Fecha", "Ítem", "Tipo", "Cantidad", "Unidad", "Notas"],
        ...(movements as any[]).map((m) => [
          m.created_at ? format(new Date(m.created_at), "yyyy-MM-dd HH:mm") : "—",
          m.inventory_items?.name || "—",
          m.kind || "—",
          Number(m.qty).toFixed(2),
          m.inventory_items?.unit || "—",
          m.notes || "—",
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
      a.download = `inventario-${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV de inventario exportado");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  if (inventoryQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Cargando inventario...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-900/10 via-blue-600/5 to-transparent border border-blue-500/20 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-blue-600/15 text-blue-600 grid place-items-center">
            <Package className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Reporte de Inventario</h2>
            <p className="text-xs text-muted-foreground">
              {(items as any[]).length} ítems registrados •{" "}
              {(lowStock as any[]).length > 0 && (
                <span className="text-amber-600 font-semibold">
                  {(lowStock as any[]).length} con stock bajo
                </span>
              )}
              {(lowStock as any[]).length === 0 && "Stock en buen estado"}
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
        <Card className="p-4 border-border/70 hover:border-blue-500/40 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Ítems</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <Layers className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2">{(items as any[]).length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">insumos registrados</p>
        </Card>

        <Card className="p-4 border-border/70 hover:border-emerald-500/40 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Valor Total</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="text-xl font-bold mt-2 text-emerald-600">{formatCOP(totalValue)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">en inventario</p>
        </Card>

        <Card className={`p-4 border transition-all shadow-xs ${(lowStock as any[]).length > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border/70"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Stock Bajo</span>
            <div className={`p-2 rounded-lg ${(lowStock as any[]).length > 0 ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground"}`}>
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${(lowStock as any[]).length > 0 ? "text-amber-600" : "text-foreground"}`}>
            {(lowStock as any[]).length}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {(lowStock as any[]).length > 0 ? "requieren reposición" : "sin alertas"}
          </p>
        </Card>

        <Card className="p-4 border-border/70 hover:border-purple-500/40 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Movimientos</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2">{(movements as any[]).length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">entradas / salidas</p>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {(lowStock as any[]).length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <h3 className="text-sm font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-3">
            <ShieldAlert className="size-4" />
            Ítems con Stock Bajo — Requieren Reposición Urgente
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {(lowStock as any[]).map((i: any) => (
              <div key={i.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                <div>
                  <p className="font-semibold text-foreground">{i.name}</p>
                  <p className="text-muted-foreground">{i.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-600">{Number(i.stock_qty).toFixed(1)} {i.unit}</p>
                  <p className="text-[10px] text-muted-foreground">mín: {Number(i.min_stock).toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category Breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <Card className="p-5 border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Distribución por Categoría
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(byCategory).map(([cat, { count, value }]) => (
              <div key={cat} className={`p-3 rounded-xl border text-xs ${categoryColors[cat] ?? categoryColors.Otro}`}>
                <p className="font-semibold">{cat}</p>
                <p className="text-[11px] opacity-80">{count} ítem{count !== 1 ? "s" : ""}</p>
                <p className="font-bold mt-1">{formatCOP(value)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Items Table */}
      <Card className="p-4 border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Package className="size-4 text-primary" />
          Inventario Completo de Insumos
        </h3>
        {(items as any[]).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No tienes ítems registrados en inventario.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="py-2.5 px-3">Ítem</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Stock Actual</th>
                  <th className="py-2.5 px-3 text-right">Stock Mínimo</th>
                  <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                  <th className="py-2.5 px-3 text-right">Valor Total</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(items as any[]).map((i: any) => {
                  const isLow = Number(i.stock_qty) <= Number(i.min_stock);
                  return (
                    <tr key={i.id} className={`hover:bg-muted/30 ${isLow ? "bg-amber-500/5" : ""}`}>
                      <td className="py-2.5 px-3 font-semibold text-foreground">{i.name}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={`text-[10px] ${categoryColors[i.category] ?? categoryColors.Otro}`}>
                          {i.category || "—"}
                        </Badge>
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-bold ${isLow ? "text-amber-600" : "text-foreground"}`}>
                        {Number(i.stock_qty).toFixed(2)} {i.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {Number(i.min_stock).toFixed(2)} {i.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatCOP(Number(i.unit_cost || 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-emerald-600">
                        {formatCOP(Number(i.stock_qty || 0) * Number(i.unit_cost || 0))}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isLow ? (
                          <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-500/30">
                            ⚠ Bajo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                            ✓ OK
                          </Badge>
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

      {/* Movements History */}
      {(movements as any[]).length > 0 && (
        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingDown className="size-4 text-primary" />
            Historial de Movimientos de Inventario
          </h3>
          <div className="divide-y divide-border/50">
            {(movements as any[]).slice(0, 20).map((m: any, idx: number) => (
              <div key={idx} className="py-2.5 flex items-center gap-3 text-xs hover:bg-muted/20 px-2 rounded-lg transition-colors">
                <div className={`size-7 rounded-lg grid place-items-center shrink-0 ${m.kind === "ENTRADA" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}>
                  {m.kind === "ENTRADA" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">
                    {m.inventory_items?.name || "—"}
                    <span className={`ml-2 text-[10px] font-bold ${m.kind === "ENTRADA" ? "text-emerald-600" : "text-red-600"}`}>
                      {m.kind === "ENTRADA" ? "+" : "-"}{Number(m.qty).toFixed(2)} {m.inventory_items?.unit || ""}
                    </span>
                  </p>
                  {m.notes && <p className="text-muted-foreground truncate">{m.notes}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {m.created_at ? format(new Date(m.created_at), "dd MMM yyyy", { locale: es }) : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
