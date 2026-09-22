import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAllActivitiesForReport, listParcels, listCatalog, listAlerts, getMyRoles, getYearOverYearComparison, listScheduledReports, createScheduledReport, toggleScheduledReport, deleteScheduledReport } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Download, FileBarChart, FileText, Filter, FileSpreadsheet, TrendingUp, TrendingDown, AlertTriangle, DollarSign, BarChart3, CalendarClock, Plus, Trash2, Clock, Mail, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { generatePdfReport, type PdfReportTemplate } from "@/lib/pdf-report";
import { supabase } from "@/integrations/supabase/client";
import { exportParcelsToExcel } from "@/lib/services/excel-export";
import { useTranslation } from "react-i18next";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { Card } from "@/components/ui/card";
import { AiReportInsights } from "@/components/reports/ai-insights";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reportes — SIGIC" }] }),
  beforeLoad: async () => {
    const roles = await getMyRoles();
    if (!roles.some((role) => role === "tecnico" || role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ReportsPage,
});

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return "\uFEFF" + [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const ALL = "__all__";

const kindColors: Record<string, string> = {
  RIEGO: "#2563eb",
  FERTILIZACION: "#16a34a",
  MONITOREO: "#ca8a04",
  COSECHA: "#dc2626",
  PODA: "#7c3aed",
  APLICACION: "#ea580c",
  SIEMBRA: "#059669",
};

const CHART_COLORS = ["#2563eb", "#16a34a", "#ca8a04", "#dc2626", "#7c3aed", "#ea580c", "#059669", "#0891b2"];

function SkeletonCard() {
  return (
    <div className="p-5 rounded-xl border border-border bg-card animate-pulse">
      <div className="h-3 w-24 bg-muted rounded mb-3" />
      <div className="h-8 w-16 bg-muted rounded" />
    </div>
  );
}

function ReportsPage() {
  const { t } = useTranslation();
  const acts = useQuery({ queryKey: ["report-acts"], queryFn: listAllActivitiesForReport });
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: listCatalog });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const yoyCmp = useQuery({ queryKey: ["yoy"], queryFn: getYearOverYearComparison });
  const schedReports = useQuery({ queryKey: ["sched-reports"], queryFn: listScheduledReports });

  const costsQuery = useQuery({
    queryKey: ["report-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crop_costs")
        .select("id, crop_id, kind, description, qty, unit_cost, total, created_at, crops!inner(crop_catalog(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const harvestsQuery = useQuery({
    queryKey: ["report-harvests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crop_harvests")
        .select("id, crop_id, harvested_qty, unit, sale_price, total_revenue, performed_at, crops!inner(crop_catalog(name))")
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [template, setTemplate] = useState<PdfReportTemplate>("actividades");
  const [parcelFilter, setParcelFilter] = useState<string>(ALL);
  const [cropFilter, setCropFilter] = useState<string>(ALL);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [chartYear, setChartYear] = useState<string>(new Date().getFullYear().toString());
  const dateError = from && to && new Date(from) > new Date(to) ? "La fecha 'Desde' no puede ser mayor que 'Hasta'" : null;

  const [schedDialog, setSchedDialog] = useState(false);
  const [schedTemplate, setSchedTemplate] = useState<PdfReportTemplate>("actividades");
  const [schedRecipients, setSchedRecipients] = useState("");
  const [schedFreq, setSchedFreq] = useState("weekly");
  const [schedCreating, setSchedCreating] = useState(false);
  const schedMut = async () => {
    if (!schedRecipients.trim()) return;
    setSchedCreating(true);
    try {
      await createScheduledReport({
        template: schedTemplate,
        recipients: schedRecipients.split(",").map((e) => e.trim()).filter(Boolean),
        schedule: schedFreq,
      });
      schedReports.refetch();
      setSchedDialog(false);
      setSchedRecipients("");
    } finally { setSchedCreating(false); }
  };

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

  const filteredParcels = useMemo(() => {
    const list = (parcels.data ?? []) as any[];
    return parcelFilter === ALL ? list : list.filter((p) => p.name === parcelFilter);
  }, [parcels.data, parcelFilter]);

  const actRows = filtered.map((a: any) => ({
    fecha: format(new Date(a.performed_at), "yyyy-MM-dd HH:mm"),
    tipo: a.kind,
    cultivo: a.crops?.crop_catalog?.name ?? "",
    parcela: a.crops?.parcels?.name ?? "",
    notas: a.notes ?? "",
  }));

  const totalCost = useMemo(() => {
    return (costsQuery.data ?? []).reduce((s: number, c: any) => {
      if (!c.created_at) return s;
      if (chartYear && format(new Date(c.created_at), "yyyy") !== chartYear) return s;
      return s + Number(c.total || 0);
    }, 0);
  }, [costsQuery.data, chartYear]);

  const totalRevenue = useMemo(() => {
    return (harvestsQuery.data ?? []).reduce((s: number, h: any) => {
      if (!h.performed_at) return s;
      if (chartYear && format(new Date(h.performed_at), "yyyy") !== chartYear) return s;
      return s + Number(h.total_revenue || 0);
    }, 0);
  }, [harvestsQuery.data, chartYear]);

  const costsByKind = useMemo(() => {
    const map: Record<string, number> = {};
    (costsQuery.data ?? []).forEach((c: any) => {
      if (!c.created_at) return;
      if (chartYear && format(new Date(c.created_at), "yyyy") !== chartYear) return;
      const k = c.kind || "Otros";
      map[k] = (map[k] ?? 0) + Number(c.total || 0);
    });
    return map;
  }, [costsQuery.data, chartYear]);

  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    (harvestsQuery.data ?? []).forEach((h: any) => {
      if (!h.performed_at) return;
      if (chartYear && format(new Date(h.performed_at), "yyyy") !== chartYear) return;
      const m = format(new Date(h.performed_at), "yyyy-MM");
      map[m] = (map[m] ?? 0) + Number(h.total_revenue || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, ingresos]) => ({ month, ingresos }));
  }, [harvestsQuery.data, chartYear]);

  const pendingAlerts = useMemo(() => {
    return (alerts.data ?? []).filter((a: any) => a.status === "PENDIENTE").length;
  }, [alerts.data]);

  const activityTrend = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a: any) => {
      if (!a.performed_at) return;
      const m = format(new Date(a.performed_at), "yyyy-MM");
      map[m] = (map[m] ?? 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
  }, [filtered]);

  function exportCSV() {
    download(`actividades-${format(new Date(), "yyyyMMdd")}.csv`, toCSV(actRows), "text/csv;charset=utf-8");
  }

  async function exportPDF() {
    const { data: u } = await supabase.auth.getUser();
    const author = u.user?.email ?? undefined;
    const filters = {
      Parcela: parcelFilter === ALL ? "Todas" : parcelFilter,
      Cultivo: cropFilter === ALL ? "Todos" : cropFilter,
      Desde: from || "—",
      Hasta: to || "—",
    };

    let doc;
    if (template === "actividades") {
      doc = await generatePdfReport({
        template, author,
        title: "Bitácora de Actividades Agrícolas",
        subtitle: `${totalAct} registros encontrados`,
        filters,
        sections: [
          {
            title: "Detalle de actividades",
            head: ["Fecha", "Tipo", "Cultivo", "Parcela", "Notas"],
            body: actRows.map((r) => [r.fecha, r.tipo, r.cultivo, r.parcela, r.notas]),
            columnStyles: { 4: { cellWidth: 90 } },
          },
          {
            title: "Resumen por tipo",
            head: ["Tipo", "Cantidad"],
            body: Object.entries(byKind).map(([k, v]) => [k, v]),
          },
        ],
      });
    } else if (template === "parcelas") {
      doc = await generatePdfReport({
        template, author,
        title: "Inventario de Parcelas",
        subtitle: `${filteredParcels.length} parcelas`,
        filters: { Parcela: filters.Parcela },
        orientation: "portrait",
        sections: [
          {
            title: "Listado",
            head: ["Nombre", "Área (m²)", "Suelo", "Latitud", "Longitud"],
            body: filteredParcels.map((p: any) => [
              p.name, p.area_m2, p.soil_types?.name ?? "—",
              p.latitude ?? "—", p.longitude ?? "—",
            ]),
          },
        ],
      });
    } else {
      doc = await generatePdfReport({
        template, author,
        title: "Resumen Ejecutivo",
        subtitle: "Indicadores generales del periodo",
        filters,
        orientation: "portrait",
        sections: [
          {
            title: "Indicadores generales",
            head: ["Indicador", "Valor"],
            body: [
              ["Parcelas totales", parcels.data?.length ?? 0],
              ["Parcelas filtradas", filteredParcels.length],
              ["Actividades en periodo", totalAct],
              ["Tipos de actividad distintos", Object.keys(byKind).length],
              ["Alertas pendientes", pendingAlerts],
              ["Costo total ($)", `$ ${totalCost.toFixed(2)}`],
              ["Ingreso total ($)", `$ ${totalRevenue.toFixed(2)}`],
              ["Margen bruto ($)", `$ ${(totalRevenue - totalCost).toFixed(2)}`],
            ],
          },
          {
            title: "Distribución por tipo de actividad",
            head: ["Tipo", "Cantidad"],
            body: Object.entries(byKind).map(([k, v]) => [k, v]),
          },
          {
            title: "Costos por tipo",
            head: ["Tipo", "Total ($)"],
            body: Object.entries(costsByKind).map(([k, v]) => [k, `$ ${v.toFixed(2)}`]),
          },
          {
            title: "Cosechas recientes",
            head: ["Cultivo", "Cantidad", "Unit. ($)", "Total ($)", "Fecha"],
            body: (harvestsQuery.data ?? []).slice(0, 20).map((h: any) => [
              h.crops?.crop_catalog?.name ?? "—",
              `${h.harvested_qty} ${h.unit ?? ""}`,
              `$ ${Number(h.sale_price || 0).toFixed(2)}`,
              `$ ${Number(h.total_revenue || 0).toFixed(2)}`,
              h.performed_at ? format(new Date(h.performed_at), "yyyy-MM-dd") : "—",
            ]),
          },
        ],
      });
    }

    doc.save(`sgic-${template}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
  }

  const loading = acts.isLoading || parcels.isLoading || catalog.isLoading;
  const error = acts.isError || parcels.isError || catalog.isError;

  if (loading) {
    return (
      <div className="space-y-6">
        <header><h1 className="text-3xl font-bold">Reportes</h1></header>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <header><h1 className="text-3xl font-bold">Reportes</h1></header>
        <Card className="p-6 text-center">
          <AlertTriangle className="size-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-medium">Error al cargar datos</p>
          <p className="text-sm text-muted-foreground mt-1">Reintentá más tarde o contactá al administrador.</p>
          <Button variant="outline" className="mt-4" onClick={() => { acts.refetch(); parcels.refetch(); catalog.refetch(); }}>
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">Plantillas configurables con logo, encabezado y pie de página.</p>
      </header>

      <section className="p-5 rounded-xl border border-border bg-card space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Filter className="size-4 text-primary" /> Configuración del reporte</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs">Plantilla</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as PdfReportTemplate)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="actividades">Bitácora de actividades</SelectItem>
                <SelectItem value="parcelas">Inventario de parcelas</SelectItem>
                <SelectItem value="resumen">Resumen ejecutivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Parcela</Label>
            <Combobox
              value={parcelFilter}
              onChange={setParcelFilter}
              options={[
                { value: ALL, label: "Todas" },
                ...(parcels.data ?? []).map((p: any) => ({ value: p.name, label: p.name })),
              ]}
              placeholder="Todas"
              searchPlaceholder="Buscar parcela…"
            />
          </div>
          <div>
            <Label className="text-xs">Tipo de cultivo</Label>
            <Combobox
              value={cropFilter}
              onChange={setCropFilter}
              disabled={template === "parcelas"}
              options={[
                { value: ALL, label: "Todos" },
                ...(catalog.data ?? []).map((c: any) => ({ value: c.name, label: c.name })),
              ]}
              placeholder="Todos"
              searchPlaceholder="Buscar cultivo…"
            />
          </div>
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={template === "parcelas"} max={to || undefined} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={template === "parcelas"} min={from || undefined} />
          </div>
          <div>
            <Label className="text-xs">Año (gráficos)</Label>
            <Select value={chartYear} onValueChange={setChartYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {dateError && <p className="text-xs text-destructive">{dateError}</p>}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={exportPDF} disabled={!!dateError || acts.isRefetching}><FileText className="size-4 mr-1" /> Generar PDF</Button>
          <Button variant="outline" onClick={exportCSV} disabled={template !== "actividades"}>
            <Download className="size-4 mr-1" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => exportParcelsToExcel(parcels.data ?? [])} disabled={template !== "parcelas"}>
            <FileSpreadsheet className="size-4 mr-1" /> Exportar CSV
          </Button>
          <Button variant="ghost" onClick={() => { setParcelFilter(ALL); setCropFilter(ALL); setFrom(""); setTo(""); }}>
            Limpiar filtros
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Parcelas</p>
          <p className="mt-2 text-3xl font-bold">{parcels.data?.length ?? 0}</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Actividades filtradas</p>
          <p className="mt-2 text-3xl font-bold">{totalAct}</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Alertas pendientes</p>
          <p className="mt-2 text-3xl font-bold flex items-center gap-2">
            {pendingAlerts}
            {pendingAlerts > 0 && <AlertTriangle className="size-5 text-amber-500" />}
          </p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Margen bruto</p>
          <p className={cn("mt-2 text-3xl font-bold flex items-center gap-2", totalRevenue - totalCost < 0 ? "text-red-600" : "text-green-600")}>
            {totalRevenue - totalCost < 0 ? <TrendingDown className="size-5" /> : <TrendingUp className="size-5" />}
            $ {(totalRevenue - totalCost).toFixed(0)}
          </p>
        </div>
      </div>

      {revenueByMonth.length > 0 && (
        <section className="p-5 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><TrendingUp className="size-4 text-primary" /> Ingresos por mes</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$ ${v.toFixed(2)}`, "Ingresos"]} />
              <Line type="monotone" dataKey="ingresos" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {activityTrend.length > 1 && (
        <section className="p-5 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><BarChart3 className="size-4 text-primary" /> Actividades por mes</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activityTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-5 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><FileBarChart className="size-4 text-primary" /> Actividades por tipo</h2>
          <div className="space-y-2">
            {Object.entries(byKind).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 w-40 text-sm">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: kindColors[k] ?? "#6b7280" }} />
                  {k}
                </span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v / Math.max(1, totalAct)) * 100)}%`, backgroundColor: kindColors[k] ?? "#6b7280" }} />
                </div>
                <span className="text-sm w-10 text-right text-muted-foreground">{v}</span>
              </div>
            ))}
            {Object.keys(byKind).length === 0 && <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>}
          </div>
        </section>

        {Object.keys(costsByKind).length > 0 && (
          <section className="p-5 rounded-xl border border-border bg-card">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><DollarSign className="size-4 text-primary" /> Costos por tipo</h2>
            <div className="space-y-2">
              {Object.entries(costsByKind).map(([k, v], i) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-40 text-sm truncate">{k}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, (v / Math.max(1, totalCost)) * 100)}%`,
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }} />
                  </div>
                  <span className="text-sm w-24 text-right text-muted-foreground font-mono">$ {v.toFixed(0)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-right mt-2 font-mono">Total: $ {totalCost.toFixed(2)}</p>
          </section>
        )}
      </div>

      <section className="p-5 rounded-xl border border-border bg-card">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><DollarSign className="size-4 text-primary" /> Rentabilidad</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Costo total</p>
            <p className="text-xl font-bold font-mono text-red-600">$ {totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ingreso total</p>
            <p className="text-xl font-bold font-mono text-green-600">$ {totalRevenue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Margen bruto</p>
            <p className={cn("text-xl font-bold font-mono", totalRevenue - totalCost >= 0 ? "text-green-600" : "text-red-600")}>
              {totalRevenue - totalCost >= 0 ? "+" : ""}$ {(totalRevenue - totalCost).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rentabilidad</p>
            <p className={cn("text-xl font-bold font-mono", totalRevenue - totalCost >= 0 ? "text-green-600" : "text-red-600")}>
              {totalCost > 0 ? `${((totalRevenue - totalCost) / totalCost * 100).toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      </section>

      <AiReportInsights
        activities={filtered}
        parcels={parcels.data ?? []}
        totalCost={totalCost}
        totalRevenue={totalRevenue}
        pendingAlerts={pendingAlerts}
        costsByKind={costsByKind}
        byKind={byKind}
      />

      {yoyCmp.data && (
        <section className="p-5 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><BarChart3 className="size-4 text-primary" /> Comparativa anual</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Ingreso año anterior</p>
              <p className="text-lg font-bold font-mono">$ {yoyCmp.data.lastYear.revenue.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingreso año actual</p>
              <p className="text-lg font-bold font-mono">$ {yoyCmp.data.currentYear.revenue.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Variación ingresos</p>
              <p className={cn("text-lg font-bold font-mono flex items-center gap-1", yoyCmp.data.currentYear.revenue >= yoyCmp.data.lastYear.revenue ? "text-green-600" : "text-red-600")}>
                {yoyCmp.data.currentYear.revenue >= yoyCmp.data.lastYear.revenue ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {yoyCmp.data.lastYear.revenue > 0 ? `${(((yoyCmp.data.currentYear.revenue - yoyCmp.data.lastYear.revenue) / yoyCmp.data.lastYear.revenue) * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Variación costos</p>
              <p className={cn("text-lg font-bold font-mono flex items-center gap-1", yoyCmp.data.currentYear.costs <= yoyCmp.data.lastYear.costs ? "text-green-600" : "text-red-600")}>
                {yoyCmp.data.currentYear.costs <= yoyCmp.data.lastYear.costs ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {yoyCmp.data.lastYear.costs > 0 ? `${(((yoyCmp.data.currentYear.costs - yoyCmp.data.lastYear.costs) / yoyCmp.data.lastYear.costs) * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Reportes programados</h2>
          <Dialog open={schedDialog} onOpenChange={setSchedDialog}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="size-3.5 mr-1" /> Nuevo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Programar reporte</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Plantilla</Label>
                  <Select value={schedTemplate} onValueChange={(v) => setSchedTemplate(v as PdfReportTemplate)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actividades">Bitácora de actividades</SelectItem>
                      <SelectItem value="parcelas">Inventario de parcelas</SelectItem>
                      <SelectItem value="resumen">Resumen ejecutivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Correos (separados por coma)</Label>
                  <Input value={schedRecipients} onChange={(e) => setSchedRecipients(e.target.value)} placeholder="correo@ejemplo.com, otro@ejemplo.com" />
                </div>
                <div>
                  <Label className="text-xs">Frecuencia</Label>
                  <Select value={schedFreq} onValueChange={setSchedFreq}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={schedMut} disabled={schedCreating || !schedRecipients.trim()} className="w-full">
                  {schedCreating ? "Guardando..." : "Programar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {schedReports.isLoading ? (
          <div className="space-y-2">
            <SkeletonCard /><SkeletonCard />
          </div>
        ) : (schedReports.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay reportes programados todavía.</p>
        ) : (
          <div className="space-y-2">
            {(schedReports.data ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={cn("size-2 rounded-full", r.enabled ? "bg-green-500" : "bg-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium capitalize">{r.template}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" /> {r.schedule} &middot; <Mail className="size-3 ml-1" /> {r.recipients?.join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={async () => { await toggleScheduledReport(r.id, !r.enabled); schedReports.refetch(); }} title={r.enabled ? "Deshabilitar" : "Habilitar"}>
                    {r.enabled ? <CheckCircle2 className="size-4 text-green-600" /> : <XCircle className="size-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={async () => { await deleteScheduledReport(r.id); schedReports.refetch(); }} title="Eliminar">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
