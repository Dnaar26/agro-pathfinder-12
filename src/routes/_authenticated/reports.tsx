import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { listAllActivitiesForReport, listParcels, listCatalog, listAlerts, getMyRoles, listScheduledReports, createScheduledReport, toggleScheduledReport, deleteScheduledReport } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Download, FileBarChart, FileText, Filter, FileSpreadsheet, TrendingUp, TrendingDown, AlertTriangle, DollarSign, BarChart3, CalendarClock, Plus, Trash2, Clock, Mail, CheckCircle2, XCircle, Layers, Save } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { generatePdfReport, type PdfReportTemplate } from "@/lib/pdf-report";
import { supabase } from "@/integrations/supabase/client";
import { createYearComparison, isWithinPeriod } from "@/lib/financial-periods.js";
import { exportParcelsToExcel } from "@/lib/services/excel-export";
import { useTranslation } from "react-i18next";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import { AiReportInsights } from "@/components/reports/ai-insights";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FarmerReport } from "@/components/reports/farmer-report";
import { StaffReportsPanel } from "@/components/reports/staff-reports-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reportes — SIGIC" }] }),
  component: ReportsPage,
});

function toCSV(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0] ?? { fecha: "", tipo: "", cultivo: "", parcela: "", notas: "" });
  const esc = (v: unknown) => {
    if (v == null) return "";
    let value = String(v);
    if (typeof v === "string" && /^[\t\r ]*[=+@-]/.test(value)) value = `'${value}`;
    value = value.replace(/"/g, '""');
    return /[",\r\n]/.test(value) ? `"${value}"` : value;
  };
  return "\uFEFF" + [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ALL = "__all__";
const REPORT_FILTERS_KEY = "sigic:reports:filters";
const SAVED_REPORT_FILTERS_KEY = "sigic:reports:saved-filters";
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const formatCOP = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const formatCompactCOP = (value: number) => value >= 1000000 ? `$${(value / 1000000).toFixed(1)} M` : value >= 1000 ? `$${(value / 1000).toFixed(0)} mil` : `$${value.toFixed(0)}`;
const formatMonthLabel = (month: string) => format(new Date(`${month}-01T12:00:00`), "MMM yy", { locale: es });

type ReportFilterState = {
  template?: PdfReportTemplate;
  parcelFilter?: string;
  cropFilter?: string;
  from?: string;
  to?: string;
  chartYear?: string;
};

type SavedReportFilter = { id: string; name: string; filters: ReportFilterState };

function validChartYear(value?: string) {
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= currentYear - 4 && year <= currentYear ? String(year) : String(currentYear);
}

function readSavedReportFilters(): SavedReportFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(SAVED_REPORT_FILTERS_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is SavedReportFilter =>
      item && typeof item.id === "string" && item.id.length > 0 && typeof item.name === "string" &&
      item.name.trim().length > 0 && item.filters && typeof item.filters === "object",
    ).slice(0, 20);
  } catch {
    return [];
  }
}

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
  const [initialFilters] = useState<ReportFilterState>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(REPORT_FILTERS_KEY) ?? "{}") as ReportFilterState;
    } catch {
      return {};
    }
  });
  const [chartYear, setChartYear] = useState<string>(validChartYear(initialFilters.chartYear));
  const myRoles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const isStaff = (myRoles.data ?? []).some((r: string) => ["tecnico", "admin"].includes(r));
  const isAgricultor = !isStaff;
  const acts = useQuery({ queryKey: ["report-acts"], queryFn: listAllActivitiesForReport });
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: listCatalog });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const schedReports = useQuery({ queryKey: ["sched-reports"], queryFn: listScheduledReports });

  const costsQuery = useQuery({
    queryKey: ["report-costs", chartYear],
    queryFn: async () => {
      const rows: any[] = [];
      let totalRows: number | null = null;
      for (let start = 0; ; start += 1000) {
        const { data, error, count } = await supabase
          .from("crop_costs")
          .select("id, crop_id, kind, description, qty, unit_cost, total, created_at, crops!inner(crop_catalog(name), parcels(name))", { count: "exact" })
          .gte("created_at", `${Number(chartYear) - 1}-01-01`)
          .lt("created_at", `${Number(chartYear) + 1}-01-02`)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(start, start + 999);
        if (error) throw error;
        const page = data ?? [];
        totalRows ??= count;
        rows.push(...page);
        if (page.length === 0 || (totalRows !== null && rows.length >= totalRows)) return rows;
        if (totalRows === null && page.length < 1000) return rows;
      }
    },
  });

  const harvestsQuery = useQuery({
    queryKey: ["report-harvests", chartYear],
    queryFn: async () => {
      const rows: any[] = [];
      let totalRows: number | null = null;
      for (let start = 0; ; start += 1000) {
        const { data, error, count } = await supabase
          .from("crop_harvests")
          .select("id, crop_id, harvested_qty, unit, sale_price, total_revenue, performed_at, crops!inner(crop_catalog(name), parcels(name))", { count: "exact" })
          .gte("performed_at", `${Number(chartYear) - 1}-01-01`)
          .lt("performed_at", `${Number(chartYear) + 1}-01-02`)
          .order("performed_at", { ascending: true })
          .order("id", { ascending: true })
          .range(start, start + 999);
        if (error) throw error;
        const page = data ?? [];
        totalRows ??= count;
        rows.push(...page);
        if (page.length === 0 || (totalRows !== null && rows.length >= totalRows)) return rows;
        if (totalRows === null && page.length < 1000) return rows;
      }
    },
  });

  const [template, setTemplate] = useState<PdfReportTemplate>(initialFilters.template ?? "actividades");
  const [parcelFilter, setParcelFilter] = useState<string>(initialFilters.parcelFilter ?? ALL);
  const [cropFilter, setCropFilter] = useState<string>(initialFilters.cropFilter ?? ALL);
  const [from, setFrom] = useState<string>(initialFilters.from ?? "");
  const [to, setTo] = useState<string>(initialFilters.to ?? "");
  const [savedFilters, setSavedFilters] = useState<SavedReportFilter[]>(readSavedReportFilters);
  const [selectedSavedFilter, setSelectedSavedFilter] = useState("");
  const [savedFilterName, setSavedFilterName] = useState("");
  const dateError = from && to && new Date(from) > new Date(to) ? "La fecha 'Desde' no puede ser mayor que 'Hasta'" : null;
  const [staffView, setStaffView] = useState<string>("specialized");
  const userRole = (myRoles.data ?? []).includes("admin") ? "admin" : "tecnico";

  const [schedDialog, setSchedDialog] = useState(false);
  const [schedTemplate, setSchedTemplate] = useState<PdfReportTemplate>("actividades");
  const [schedRecipients, setSchedRecipients] = useState("");
  const [schedFreq, setSchedFreq] = useState("weekly");
  const [schedCreating, setSchedCreating] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(REPORT_FILTERS_KEY, JSON.stringify({ template, parcelFilter, cropFilter, from, to, chartYear } satisfies ReportFilterState));
    } catch {
      // El modo privado puede bloquear el almacenamiento local.
    }
  }, [template, parcelFilter, cropFilter, from, to, chartYear]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_REPORT_FILTERS_KEY, JSON.stringify(savedFilters));
    } catch {
      // El modo privado puede bloquear el almacenamiento local.
    }
  }, [savedFilters]);

  function applySavedFilter(id: string) {
    setSelectedSavedFilter(id);
    const saved = savedFilters.find((filter) => filter.id === id);
    if (!saved) return;
    const filters = saved.filters;
    setTemplate(filters.template === "parcelas" || filters.template === "resumen" ? filters.template : "actividades");
    setParcelFilter(typeof filters.parcelFilter === "string" ? filters.parcelFilter : ALL);
    setCropFilter(typeof filters.cropFilter === "string" ? filters.cropFilter : ALL);
    setFrom(typeof filters.from === "string" ? filters.from : "");
    setTo(typeof filters.to === "string" ? filters.to : "");
    setChartYear(validChartYear(filters.chartYear));
  }

  function saveCurrentFilter() {
    const name = savedFilterName.trim();
    if (!name) {
      toast.error("Escribe un nombre para el filtro");
      return;
    }
    const existing = savedFilters.find((filter) => filter.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!existing && savedFilters.length >= 20) {
      toast.error("Puedes guardar hasta 20 filtros");
      return;
    }
    const id = existing?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);
    const nextFilter: SavedReportFilter = { id, name, filters: { template, parcelFilter, cropFilter, from, to, chartYear } };
    setSavedFilters((current) => existing
      ? current.map((filter) => filter.id === existing.id ? nextFilter : filter)
      : [...current, nextFilter]);
    setSelectedSavedFilter(id);
    setSavedFilterName("");
    toast.success(existing ? "Filtro actualizado" : "Filtro guardado");
  }

  function deleteSelectedFilter() {
    setSavedFilters((current) => current.filter((filter) => filter.id !== selectedSavedFilter));
    setSelectedSavedFilter("");
    toast.success("Filtro eliminado");
  }

  const schedMut = async () => {
    if (!schedRecipients.trim()) return;
    const recipients = schedRecipients.split(",").map((e) => e.trim()).filter(Boolean);
    const invalidRecipients = recipients.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    if (invalidRecipients.length > 0) {
      toast.error(`Correo inválido: ${invalidRecipients[0]}`);
      return;
    }
    setSchedCreating(true);
    try {
      await createScheduledReport({
        template: schedTemplate,
        recipients,
        schedule: schedFreq,
      });
      await schedReports.refetch();
      setSchedDialog(false);
      setSchedRecipients("");
      toast.success("Reporte programado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo programar el reporte");
    } finally { setSchedCreating(false); }
  };

  async function handleToggleScheduledReport(id: string, enabled: boolean) {
    try {
      await toggleScheduledReport(id, enabled);
      await schedReports.refetch();
      toast.success(enabled ? "Reporte habilitado" : "Reporte deshabilitado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el reporte");
    }
  }

  async function handleDeleteScheduledReport(id: string) {
    try {
      await deleteScheduledReport(id);
      await schedReports.refetch();
      toast.success("Reporte eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el reporte");
    }
  }

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

  const financialComparison = useMemo(() => {
    const year = Number(chartYear);
    const today = new Date();
    const period = createYearComparison(year, today);
    const matchesFarmFilter = (row: any) =>
      (parcelFilter === ALL || row.crops?.parcels?.name === parcelFilter) &&
      (cropFilter === ALL || row.crops?.crop_catalog?.name === cropFilter);
    const costs = (costsQuery.data ?? []).filter(matchesFarmFilter);
    const harvests = (harvestsQuery.data ?? []).filter(matchesFarmFilter);
    const currentCosts = costs.filter((row: any) => isWithinPeriod(row.created_at, period.currentStart, period.currentEnd));
    const priorCosts = costs.filter((row: any) => isWithinPeriod(row.created_at, period.previousStart, period.previousEnd));
    const currentHarvests = harvests.filter((row: any) => isWithinPeriod(row.performed_at, period.currentStart, period.currentEnd));
    const priorHarvests = harvests.filter((row: any) => isWithinPeriod(row.performed_at, period.previousStart, period.previousEnd));
    const sum = (rows: any[], key: string) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
    const currentPeriodLabel = period.isYearToDate ? `1 ene – ${format(period.currentEnd, "d MMM yyyy", { locale: es })}` : `${year} completo`;
    const previousPeriodLabel = period.isYearToDate ? `1 ene – ${format(period.previousEnd, "d MMM yyyy", { locale: es })}` : `${year - 1} completo`;
    return {
      year: period.year,
      currentPeriodLabel,
      previousPeriodLabel,
      comparisonLabel: `${previousPeriodLabel} vs. ${currentPeriodLabel}`,
      costs: currentCosts,
      priorCosts,
      harvests: currentHarvests,
      priorHarvests,
      currentRevenue: sum(currentHarvests, "total_revenue"),
      previousRevenue: sum(priorHarvests, "total_revenue"),
      currentCosts: sum(currentCosts, "total"),
      previousCosts: sum(priorCosts, "total"),
    };
  }, [costsQuery.data, harvestsQuery.data, chartYear, parcelFilter, cropFilter]);

  const actRows = filtered.map((a: any) => ({
    fecha: format(new Date(a.performed_at), "yyyy-MM-dd HH:mm"),
    tipo: a.kind,
    cultivo: a.crops?.crop_catalog?.name ?? "",
    parcela: a.crops?.parcels?.name ?? "",
    notas: a.notes ?? "",
  }));

  const totalCost = financialComparison.currentCosts;
  const totalRevenue = financialComparison.currentRevenue;

  const costsByKind = useMemo(() => {
    const map: Record<string, number> = {};
    financialComparison.costs.forEach((c: any) => {
      const k = c.kind || "Otros";
      map[k] = (map[k] ?? 0) + Number(c.total || 0);
    });
    return map;
  }, [financialComparison.costs]);

  const financialByMonth = useMemo(() => {
    const rows = MONTH_LABELS.map((month) => ({ month, revenueCurrent: 0, revenuePrior: 0, costsCurrent: 0, costsPrior: 0 }));
    const add = (items: any[], dateKey: "created_at" | "performed_at", valueKey: "total" | "total_revenue", target: "revenueCurrent" | "revenuePrior" | "costsCurrent" | "costsPrior") => {
      items.forEach((item) => {
        const date = item[dateKey];
        if (!date) return;
        rows[new Date(date).getMonth()][target] += Number(item[valueKey] || 0);
      });
    };
    add(financialComparison.harvests, "performed_at", "total_revenue", "revenueCurrent");
    add(financialComparison.priorHarvests, "performed_at", "total_revenue", "revenuePrior");
    add(financialComparison.costs, "created_at", "total", "costsCurrent");
    add(financialComparison.priorCosts, "created_at", "total", "costsPrior");
    return rows;
  }, [financialComparison]);

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
      "Año de indicadores": chartYear,
    };

    let doc;
    if (template === "actividades") {
      doc = await generatePdfReport({
        template, author,
        title: "Bitácora de Actividades Agrícolas",
        subtitle: `${totalAct} registros encontrados`,
        filters,
        summary: [
          { label: "Actividades", value: totalAct.toLocaleString("es-CO") },
          { label: "Parcelas incluidas", value: filteredParcels.length.toLocaleString("es-CO") },
          { label: `Ingresos ${financialComparison.currentPeriodLabel}`, value: formatCOP(totalRevenue) },
          { label: `Costos ${financialComparison.currentPeriodLabel}`, value: formatCOP(totalCost) },
        ],
        charts: [{
          title: "Actividades por tipo",
          data: Object.entries(byKind).map(([label, value]) => ({ label, value })),
        }],
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
        summary: [
          { label: "Parcelas", value: filteredParcels.length.toLocaleString("es-CO") },
          { label: "Área total", value: `${(filteredParcels.reduce((sum: number, parcel: any) => sum + Number(parcel.area_m2 || 0), 0) / 10000).toFixed(2)} ha` },
        ],
        charts: [{
          title: "Parcelas por tipo de suelo",
          data: Object.entries(filteredParcels.reduce((soilCounts: Record<string, number>, parcel: any) => {
            const soil = parcel.soil_types?.name ?? "Sin especificar";
            soilCounts[soil] = (soilCounts[soil] ?? 0) + 1;
            return soilCounts;
          }, {})).map(([label, value]) => ({ label, value })),
        }],
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
        summary: [
          { label: "Actividades", value: totalAct.toLocaleString("es-CO") },
          { label: "Alertas pendientes", value: pendingAlerts.toLocaleString("es-CO") },
          { label: `Ingresos ${financialComparison.currentPeriodLabel}`, value: formatCOP(totalRevenue) },
          { label: `Margen ${financialComparison.currentPeriodLabel}`, value: formatCOP(totalRevenue - totalCost) },
        ],
        charts: [
          {
            title: "Ingresos mensuales",
            data: financialByMonth.filter((row) => row.revenueCurrent > 0).map((row) => ({ label: row.month, value: row.revenueCurrent })),
            maxItems: 12,
            valueFormatter: formatCOP,
          },
          {
            title: "Costos por tipo",
            data: Object.entries(costsByKind).map(([label, value]) => ({ label, value })),
            valueFormatter: formatCOP,
            color: [180, 83, 9],
          },
        ],
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
            body: [...financialComparison.harvests]
              .sort((a: any, b: any) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
              .slice(0, 20).map((h: any) => [
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

  if (myRoles.isLoading) {
    return (
      <div className="space-y-6">
        <header><h1 className="text-3xl font-bold">Reportes</h1></header>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  if (isAgricultor) {
    return (
      <div className="space-y-6">
        <FarmerReport />
      </div>
    );
  }

  const loading = acts.isLoading || parcels.isLoading || catalog.isLoading || alerts.isLoading || costsQuery.isLoading || harvestsQuery.isLoading;
  const error = acts.isError || parcels.isError || catalog.isError || alerts.isError || costsQuery.isError || harvestsQuery.isError;

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
          <Button variant="outline" className="mt-4" onClick={() => { acts.refetch(); parcels.refetch(); catalog.refetch(); alerts.refetch(); costsQuery.refetch(); harvestsQuery.refetch(); }}>
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={staffView} onValueChange={setStaffView} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centro de Reportes</h1>
            <p className="text-xs text-muted-foreground">
              Panel analítico e institucional para rol {userRole === "admin" ? "Administrador" : "Técnico"}.
            </p>
          </div>
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="specialized" className="text-xs gap-1.5 py-1.5">
              <Layers className="size-3.5" />
              Reportes Especializados por Rol
            </TabsTrigger>
            <TabsTrigger value="builder" className="text-xs gap-1.5 py-1.5">
              <Filter className="size-3.5" />
              Generador con Filtros & Plantillas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="specialized" className="space-y-6">
          <StaffReportsPanel userRole={userRole} />
        </TabsContent>

        <TabsContent value="builder" className="space-y-6">
          <header>
            <h2 className="text-xl font-bold">Generador de Reportes</h2>
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
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="w-full sm:w-56">
            <Label className="text-xs">Filtros guardados</Label>
            <Select value={selectedSavedFilter} onValueChange={applySavedFilter}>
              <SelectTrigger><SelectValue placeholder="Seleccionar filtro" /></SelectTrigger>
              <SelectContent>
                {savedFilters.map((filter) => <SelectItem key={filter.id} value={filter.id}>{filter.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-56">
            <Label htmlFor="saved-filter-name" className="text-xs">Guardar configuración actual</Label>
            <Input id="saved-filter-name" value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} maxLength={60} placeholder="Nombre del filtro" />
          </div>
          <Button type="button" variant="outline" onClick={saveCurrentFilter}><Save className="size-4 mr-1" /> Guardar</Button>
          <Button type="button" variant="ghost" size="icon" onClick={deleteSelectedFilter} disabled={!selectedSavedFilter} aria-label="Eliminar filtro guardado" title="Eliminar filtro guardado">
            <Trash2 className="size-4" />
          </Button>
        </div>
        {dateError && <p className="text-xs text-destructive">{dateError}</p>}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={exportPDF} disabled={!!dateError || acts.isRefetching}><FileText className="size-4 mr-1" /> Generar PDF</Button>
          <Button variant="outline" onClick={exportCSV} disabled={template !== "actividades"}>
            <Download className="size-4 mr-1" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => exportParcelsToExcel(parcels.data ?? [])} disabled={template !== "parcelas"}>
            <FileSpreadsheet className="size-4 mr-1" /> Exportar Excel
          </Button>
          <Button variant="ghost" onClick={() => { setParcelFilter(ALL); setCropFilter(ALL); setFrom(""); setTo(""); setChartYear(validChartYear()); setSelectedSavedFilter(""); }}>
            Limpiar filtros
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">Parcelas incluidas</p>
          <p className="mt-2 text-3xl font-bold">{filteredParcels.length}</p>
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
            {formatCOP(totalRevenue - totalCost)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="p-5 rounded-xl border border-border bg-card">
          <div className="mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Ingresos mensuales</h2>
            <p className="text-xs text-muted-foreground">{financialComparison.comparisonLabel} · COP</p>
          </div>
          {financialByMonth.some((row) => row.revenueCurrent > 0 || row.revenuePrior > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={financialByMonth} margin={{ left: 8, right: 12, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompactCOP} width={58} />
                <Tooltip formatter={(value: number, name: string) => [formatCOP(value), name]} />
                <Legend />
                <Line type="monotone" dataKey="revenuePrior" name={`Ingresos ${financialComparison.previousPeriodLabel}`} stroke="#64748b" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenueCurrent" name={`Ingresos ${financialComparison.currentPeriodLabel}`} stroke="#15803d" strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="py-10 text-center text-sm text-muted-foreground">Sin ingresos registrados en estos periodos.</p>}
        </section>
        <section className="p-5 rounded-xl border border-border bg-card">
          <div className="mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="size-4 text-primary" /> Costos mensuales</h2>
            <p className="text-xs text-muted-foreground">{financialComparison.comparisonLabel} · COP</p>
          </div>
          {financialByMonth.some((row) => row.costsCurrent > 0 || row.costsPrior > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={financialByMonth} margin={{ left: 8, right: 12, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompactCOP} width={58} />
                <Tooltip formatter={(value: number, name: string) => [formatCOP(value), name]} />
                <Legend />
                <Line type="monotone" dataKey="costsPrior" name={`Costos ${financialComparison.previousPeriodLabel}`} stroke="#b45309" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="costsCurrent" name={`Costos ${financialComparison.currentPeriodLabel}`} stroke="#c2410c" strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="py-10 text-center text-sm text-muted-foreground">Sin costos registrados en estos periodos.</p>}
        </section>
      </div>

      {activityTrend.length > 1 && (
        <section className="p-5 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><BarChart3 className="size-4 text-primary" /> Actividades por mes</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activityTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} tickFormatter={formatMonthLabel} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(month: string) => formatMonthLabel(month)} />
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

      {costsQuery.data && harvestsQuery.data && (
        <section className="p-5 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><BarChart3 className="size-4 text-primary" /> Comparación financiera: {financialComparison.comparisonLabel}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Ingresos {financialComparison.previousPeriodLabel}</p>
              <p className="text-lg font-bold font-mono">{formatCOP(financialComparison.previousRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingresos {financialComparison.currentPeriodLabel}</p>
              <p className="text-lg font-bold font-mono">{formatCOP(financialComparison.currentRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Variación ingresos</p>
              <p className={cn("text-lg font-bold font-mono flex items-center gap-1", financialComparison.currentRevenue >= financialComparison.previousRevenue ? "text-green-600" : "text-red-600")}>
                {financialComparison.currentRevenue >= financialComparison.previousRevenue ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {financialComparison.previousRevenue > 0 ? `${(((financialComparison.currentRevenue - financialComparison.previousRevenue) / financialComparison.previousRevenue) * 100).toFixed(1)}%` : financialComparison.currentRevenue > 0 ? "Nuevo" : "0%"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costos {financialComparison.previousPeriodLabel}</p>
              <p className="text-lg font-bold font-mono">{formatCOP(financialComparison.previousCosts)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costos {financialComparison.currentPeriodLabel}</p>
              <p className="text-lg font-bold font-mono">{formatCOP(financialComparison.currentCosts)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Variación costos</p>
              <p className={cn("text-lg font-bold font-mono flex items-center gap-1", financialComparison.currentCosts <= financialComparison.previousCosts ? "text-green-600" : "text-red-600")}>
                {financialComparison.currentCosts <= financialComparison.previousCosts ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                {financialComparison.previousCosts > 0 ? `${(((financialComparison.currentCosts - financialComparison.previousCosts) / financialComparison.previousCosts) * 100).toFixed(1)}%` : financialComparison.currentCosts > 0 ? "Nuevo" : "0%"}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Programaciones de reportes</h2>
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
        <p className="text-xs text-muted-foreground">Las frecuencias y destinatarios se guardan, pero el envío automático requiere configurar un proceso programado y un proveedor de correo.</p>
        {schedReports.isLoading ? (
          <div className="space-y-2">
            <SkeletonCard /><SkeletonCard />
          </div>
        ) : schedReports.isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm">
            <span className="text-destructive">No se pudieron cargar las programaciones.</span>
            <Button variant="outline" size="sm" onClick={() => void schedReports.refetch()}>Reintentar</Button>
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
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => void handleToggleScheduledReport(r.id, !r.enabled)} aria-label={r.enabled ? "Deshabilitar reporte" : "Habilitar reporte"} title={r.enabled ? "Deshabilitar" : "Habilitar"}>
                    {r.enabled ? <CheckCircle2 className="size-4 text-green-600" /> : <XCircle className="size-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => void handleDeleteScheduledReport(r.id)} aria-label="Eliminar reporte" title="Eliminar">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

