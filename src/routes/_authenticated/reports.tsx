import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAllActivitiesForReport, listParcels, listCatalog } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileBarChart, FileText, Filter } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reportes — SGIC" }] }),
  component: ReportsPage,
});

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ALL = "__all__";

function ReportsPage() {
  const acts = useQuery({ queryKey: ["report-acts"], queryFn: listAllActivitiesForReport });
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: listCatalog });

  const [parcelFilter, setParcelFilter] = useState<string>(ALL);
  const [cropFilter, setCropFilter] = useState<string>(ALL);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filtered = useMemo(() => {
    const list = (acts.data ?? []) as any[];
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 3600 * 1000 : null;
    return list.filter((a) => {
      const ts = new Date(a.performed_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      if (parcelFilter !== ALL && a.crops?.parcels?.name !== parcelFilter) return false;
      if (cropFilter !== ALL && a.crops?.crop_catalog?.name !== cropFilter) return false;
      return true;
    });
  }, [acts.data, from, to, parcelFilter, cropFilter]);

  const totalAct = filtered.length;
  const byKind = filtered.reduce<Record<string, number>>((acc, a: any) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + 1;
    return acc;
  }, {});

  const rows = filtered.map((a: any) => ({
    fecha: format(new Date(a.performed_at), "yyyy-MM-dd HH:mm"),
    tipo: a.kind,
    cultivo: a.crops?.crop_catalog?.name ?? "",
    parcela: a.crops?.parcels?.name ?? "",
    notas: a.notes ?? "",
  }));

  function exportCSV() {
    download(`actividades-${format(new Date(), "yyyyMMdd")}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = "SGIC — Reporte de Actividades";
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    const meta: string[] = [
      `Generado: ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
      `Parcela: ${parcelFilter === ALL ? "Todas" : parcelFilter}`,
      `Cultivo: ${cropFilter === ALL ? "Todos" : cropFilter}`,
      `Rango: ${from || "—"} a ${to || "—"}`,
      `Total: ${totalAct}`,
    ];
    doc.text(meta.join("   |   "), 14, 23);

    autoTable(doc, {
      startY: 28,
      head: [["Fecha", "Tipo", "Cultivo", "Parcela", "Notas"]],
      body: rows.map((r) => [r.fecha, r.tipo, r.cultivo, r.parcela, r.notas]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [34, 113, 56] },
      columnStyles: { 4: { cellWidth: 90 } },
    });

    let y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 180) { doc.addPage(); y = 16; }
    doc.setFontSize(12);
    doc.text("Resumen por tipo", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Tipo", "Cantidad"]],
      body: Object.entries(byKind).map(([k, v]) => [k, String(v)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 113, 56] },
      tableWidth: 80,
    });

    doc.save(`reporte-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  }

  function exportParcelsCSV() {
    const data = (parcels.data ?? []).map((p: any) => ({
      nombre: p.name,
      area_m2: p.area_m2,
      suelo: p.soil_types?.name ?? "",
      latitud: p.latitude ?? "",
      longitud: p.longitude ?? "",
    }));
    download(`parcelas-${format(new Date(), "yyyyMMdd")}.csv`, toCSV(data), "text/csv;charset=utf-8");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">Indicadores y exportación de datos.</p>
      </header>

      <section className="p-5 rounded-xl border border-border bg-card space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Filter className="size-4 text-primary" /> Filtros</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Parcela</Label>
            <Select value={parcelFilter} onValueChange={setParcelFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {(parcels.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de cultivo</Label>
            <Select value={cropFilter} onValueChange={setCropFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {(catalog.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={exportPDF}><FileText className="size-4 mr-1" /> Exportar PDF</Button>
          <Button variant="outline" onClick={exportCSV}><Download className="size-4 mr-1" /> Exportar CSV</Button>
          <Button variant="ghost" onClick={() => { setParcelFilter(ALL); setCropFilter(ALL); setFrom(""); setTo(""); }}>Limpiar filtros</Button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Parcelas</p>
          <p className="mt-2 text-3xl font-bold">{parcels.data?.length ?? 0}</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Actividades filtradas</p>
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
          {Object.keys(byKind).length === 0 && <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Otros exportes</h2>
        <Button variant="outline" onClick={exportParcelsCSV}><Download className="size-4 mr-1" /> Parcelas (CSV)</Button>
      </section>
    </div>
  );
}
