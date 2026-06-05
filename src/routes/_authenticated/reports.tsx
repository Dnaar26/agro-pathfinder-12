import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAllActivitiesForReport, listParcels } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Download, FileBarChart } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reportes — SGIC" }] }),
  component: ReportsPage,
});

function toCSV(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const acts = useQuery({ queryKey: ["report-acts"], queryFn: listAllActivitiesForReport });
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });

  const totalAct = acts.data?.length ?? 0;
  const byKind = (acts.data ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + 1;
    return acc;
  }, {});

  function exportActivities() {
    const rows = (acts.data ?? []).map((a: any) => ({
      fecha: format(new Date(a.performed_at), "yyyy-MM-dd HH:mm"),
      tipo: a.kind,
      cultivo: a.crops?.crop_catalog?.name ?? "",
      parcela: a.crops?.parcels?.name ?? "",
      notas: a.notes ?? "",
    }));
    download(`actividades-${format(new Date(), "yyyyMMdd")}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  }

  function exportParcels() {
    const rows = (parcels.data ?? []).map((p: any) => ({
      nombre: p.name,
      area_m2: p.area_m2,
      suelo: p.soil_types?.name ?? "",
      latitud: p.latitude ?? "",
      longitud: p.longitude ?? "",
    }));
    download(`parcelas-${format(new Date(), "yyyyMMdd")}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">Indicadores y exportación de datos.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Parcelas</p>
          <p className="mt-2 text-3xl font-bold">{parcels.data?.length ?? 0}</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Actividades registradas</p>
          <p className="mt-2 text-3xl font-bold">{totalAct}</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Tipos distintos</p>
          <p className="mt-2 text-3xl font-bold">{Object.keys(byKind).length}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><FileBarChart className="size-5 text-primary" /> Actividades por tipo</h2>
        <div className="space-y-2">
          {Object.entries(byKind).map(([k, v]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-40 text-sm">{k}</span>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, (v / Math.max(1, totalAct)) * 100)}%` }} />
              </div>
              <span className="text-sm w-10 text-right text-muted-foreground">{v}</span>
            </div>
          ))}
          {Object.keys(byKind).length === 0 && <p className="text-sm text-muted-foreground">Sin datos.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Exportar</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={exportActivities}><Download className="size-4 mr-1" /> Actividades (CSV)</Button>
          <Button variant="outline" onClick={exportParcels}><Download className="size-4 mr-1" /> Parcelas (CSV)</Button>
        </div>
      </section>
    </div>
  );
}
