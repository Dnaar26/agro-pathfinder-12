import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getMyPestIncidentsSummary } from "@/lib/queries";
import { generatePdfReport } from "@/lib/pdf-report";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Bug,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Calendar,
  Activity,
} from "lucide-react";

const severityColors: Record<string, string> = {
  BAJA: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  MEDIA: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  ALTA: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  CRITICA: "bg-red-500/15 text-red-700 border-red-500/30 font-bold",
};

export function PestReport() {
  const [exporting, setExporting] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  const pestsQuery = useQuery({
    queryKey: ["my-pests-report"],
    queryFn: getMyPestIncidentsSummary,
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

  const pests = useMemo(() => (pestsQuery.data ?? []) as any[], [pestsQuery.data]);

  const filteredPests = useMemo(() => {
    if (filterSeverity === "ALL") return pests;
    return pests.filter((p) => p.severity === filterSeverity);
  }, [pests, filterSeverity]);

  const stats = useMemo(() => {
    let baja = 0;
    let media = 0;
    let alta = 0;
    let critica = 0;

    for (const p of pests) {
      if (p.severity === "BAJA") baja++;
      else if (p.severity === "MEDIA") media++;
      else if (p.severity === "ALTA") alta++;
      else if (p.severity === "CRITICA") critica++;
    }

    return { total: pests.length, baja, media, alta, critica };
  }, [pests]);

  // Exportar PDF
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const farmerName = profileQuery.data?.fullName || "Agricultor";
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

      const bodyRows = filteredPests.map((p) => [
        p.date ? format(new Date(p.date), "dd/MM/yyyy") : "—",
        p.pest_name || "—",
        p.severity || "—",
        p.crops?.crop_catalog?.name || "—",
        p.crops?.parcels?.name || "—",
        p.treatment || "Sin tratamiento registrado",
        p.notes || "—",
      ]);

      const doc = await generatePdfReport({
        template: "resumen",
        title: `Reporte Fitosanitario y Control de Plagas — ${farmerName}`,
        subtitle: `Generado el ${dateStr} • SIGIC Agro-Pathfinder`,
        author: farmerName,
        orientation: "landscape",
        sections: [
          {
            title: "Resumen de Incidencias Fitosanitarias",
            head: ["Nivel de Severidad", "Cantidad Registrada"],
            body: [
              ["Total Incidentes", String(stats.total)],
              ["Severidad Crítica", String(stats.critica)],
              ["Severidad Alta", String(stats.alta)],
              ["Severidad Media", String(stats.media)],
              ["Severidad Baja", String(stats.baja)],
            ],
          },
          {
            title: "Detalle Histórico de Plagas y Tratamientos",
            head: ["Fecha", "Plaga / Enfermedad", "Severidad", "Cultivo", "Parcela", "Tratamiento", "Observaciones"],
            body: bodyRows,
            columnStyles: { 5: { cellWidth: 50 }, 6: { cellWidth: 50 } },
          },
        ],
      });

      doc.save(`SIGIC-Sanidad-Plagas-${farmerName.replace(/\s+/g, "_")}-${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Reporte fitosanitario descargado en PDF");
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
        ["Reporte de Sanidad y Control de Plagas SIGIC"],
        [`Agricultor: ${farmerName}`],
        [`Fecha: ${format(new Date(), "yyyy-MM-dd HH:mm")}`],
        [],
        ["Fecha", "Plaga o Incidente", "Severidad", "Cultivo", "Parcela", "Tratamiento Aplicado", "Notas"],
        ...filteredPests.map((p) => [
          p.date || "—",
          p.pest_name || "—",
          p.severity || "—",
          p.crops?.crop_catalog?.name || "—",
          p.crops?.parcels?.name || "—",
          p.treatment || "",
          p.notes || "",
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
      a.download = `sanidad-plagas-${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV fitosanitario exportado con éxito");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  if (pestsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Cargando incidencias de plagas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-red-900/10 via-amber-600/5 to-transparent border border-red-500/20 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-red-600/15 text-red-600 grid place-items-center">
            <Bug className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Reporte de Sanidad y Plagas</h2>
            <p className="text-xs text-muted-foreground">
              {stats.total} incidencias registradas •{" "}
              {stats.critica + stats.alta > 0 ? (
                <span className="text-red-600 font-semibold">
                  {stats.critica + stats.alta} de atención prioritaria
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold">Bajo control fitosanitario</span>
              )}
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
            <span className="text-xs text-muted-foreground">Total Incidencias</span>
            <Activity className="size-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-2">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">monitoreadas</p>
        </Card>

        <Card className={`p-4 border shadow-xs ${stats.critica > 0 ? "border-red-500/40 bg-red-500/5" : "border-border/70"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Críticas</span>
            <ShieldAlert className={`size-4 ${stats.critica > 0 ? "text-red-600" : "text-muted-foreground"}`} />
          </div>
          <p className={`text-2xl font-bold mt-2 ${stats.critica > 0 ? "text-red-600" : "text-foreground"}`}>{stats.critica}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">intervención inmediata</p>
        </Card>

        <Card className="p-4 border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Alta Severidad</span>
            <AlertTriangle className="size-4 text-orange-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-orange-600">{stats.alta}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">en tratamiento</p>
        </Card>

        <Card className="p-4 border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Baja / Media</span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600">{stats.baja + stats.media}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">control preventivo</p>
        </Card>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filtrar por severidad:</span>
        {["ALL", "CRITICA", "ALTA", "MEDIA", "BAJA"].map((sev) => (
          <Button
            key={sev}
            variant={filterSeverity === sev ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSeverity(sev)}
            className="text-xs h-7 px-2.5"
          >
            {sev === "ALL" ? "Todas" : sev}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="p-4 border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Bug className="size-4 text-primary" />
          Historial Cronológico de Plagas y Tratamientos
        </h3>

        {filteredPests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            <ShieldCheck className="size-8 mx-auto mb-2 text-emerald-500 opacity-60" />
            No hay incidencias registradas para el filtro seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Plaga / Enfermedad</th>
                  <th className="py-2.5 px-3">Severidad</th>
                  <th className="py-2.5 px-3">Cultivo & Parcela</th>
                  <th className="py-2.5 px-3">Tratamiento</th>
                  <th className="py-2.5 px-3">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredPests.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {p.date ? format(new Date(p.date), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-foreground">
                      {p.pest_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={`text-[10px] ${severityColors[p.severity] ?? ""}`}>
                        {p.severity}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-foreground">{p.crops?.crop_catalog?.name ?? "Cultivo"}</p>
                      <p className="text-[11px] text-muted-foreground">Parcela: {p.crops?.parcels?.name ?? "—"}</p>
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px]">
                      {p.treatment ? (
                        <span className="p-1.5 rounded bg-muted/60 text-[11px] text-foreground block">
                          {p.treatment}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Sin tratamiento</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-[220px] text-muted-foreground">
                      {p.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
