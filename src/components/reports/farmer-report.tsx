import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Download,
  MapPin,
  Sprout,
  DollarSign,
  BellRing,
  Wheat,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Leaf,
  Activity,
  Sparkles,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Droplet,
  Package,
  Scissors,
  Bug,
  Eye,
} from "lucide-react";
import { generatePdfReport } from "@/lib/pdf-report";
import { chatWithGroq } from "@/lib/api/groq-chat.server";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const formatCOP = (n: number) =>
  "$ " +
  n.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const kindLabels: Record<string, string> = {
  RIEGO: "Riego",
  FERTILIZACION: "Fertilización",
  CONTROL_PLAGAS: "Control de plagas",
  PODA: "Poda",
  INSUMOS: "Insumos",
  COSECHA: "Cosecha",
  MONITOREO: "Monitoreo",
};

const kindIcons: Record<string, any> = {
  RIEGO: Droplet,
  FERTILIZACION: Package,
  CONTROL_PLAGAS: Bug,
  PODA: Scissors,
  INSUMOS: Package,
  COSECHA: Wheat,
  MONITOREO: Eye,
};

export function FarmerReport() {
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("resumen");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Perfil del agricultor
  const profile = useQuery({
    queryKey: ["farmer-report-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", u.user.id)
        .maybeSingle();
      return {
        fullName: data?.full_name || u.user.user_metadata?.full_name || "Agricultor",
        phone: data?.phone || u.user.user_metadata?.phone || "—",
        email: u.user.email,
      };
    },
  });

  // Parcelas y cultivos
  const parcels = useQuery({
    queryKey: ["farmer-report-parcels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcels")
        .select("id, name, area_m2, soil_types(name), crops(id, status, planting_date, estimated_harvest_date, crop_catalog(name, cycle_days))")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Actividades últimos 60 días
  const activities = useQuery({
    queryKey: ["farmer-report-activities"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data, error } = await supabase
        .from("activities")
        .select("id, kind, performed_at, notes, crops(id, crop_catalog(name), parcels(name))")
        .gte("performed_at", since.toISOString())
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Costos y Cosechas
  const financials = useQuery({
    queryKey: ["farmer-report-financials"],
    queryFn: async () => {
      const [costsRes, harvestsRes] = await Promise.all([
        supabase
          .from("crop_costs")
          .select("id, total, kind, description, created_at, crops(crop_catalog(name))")
          .order("created_at", { ascending: false }),
        supabase
          .from("crop_harvests")
          .select("id, harvested_qty, unit, sale_price, total_revenue, performed_at, crops(crop_catalog(name))")
          .order("performed_at", { ascending: false }),
      ]);
      return {
        costs: costsRes.data ?? [],
        harvests: harvestsRes.data ?? [],
      };
    },
  });

  // Alertas
  const alerts = useQuery({
    queryKey: ["farmer-report-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("id, message, status, kind, created_at")
        .eq("status", "PENDIENTE")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Cálculos estadísticos
  const totalAreaHa = useMemo(() => {
    const m2 = (parcels.data ?? []).reduce((acc, p: any) => acc + Number(p.area_m2 || 0), 0);
    return (m2 / 10000).toFixed(2);
  }, [parcels.data]);

  const activeCropsCount = useMemo(() => {
    return (parcels.data ?? []).reduce((s: number, p: any) => {
      const active = (p.crops ?? []).filter((c: any) =>
        ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)
      );
      return s + active.length;
    }, 0);
  }, [parcels.data]);

  const totalCost = useMemo(
    () => (financials.data?.costs ?? []).reduce((s, c: any) => s + Number(c.total || 0), 0),
    [financials.data]
  );

  const totalRevenue = useMemo(
    () => (financials.data?.harvests ?? []).reduce((s, h: any) => s + Number(h.total_revenue || 0), 0),
    [financials.data]
  );

  const netMargin = totalRevenue - totalCost;

  // Datos para gráfico mensual (Ingresos vs Costos)
  const monthlyChartData = useMemo(() => {
    const map: Record<string, { month: string; ingresos: number; costos: number }> = {};

    (financials.data?.harvests ?? []).forEach((h: any) => {
      if (!h.performed_at) return;
      const m = format(new Date(h.performed_at), "yyyy-MM");
      if (!map[m]) map[m] = { month: m, ingresos: 0, costos: 0 };
      map[m].ingresos += Number(h.total_revenue || 0);
    });

    (financials.data?.costs ?? []).forEach((c: any) => {
      if (!c.created_at) return;
      const m = format(new Date(c.created_at), "yyyy-MM");
      if (!map[m]) map[m] = { month: m, ingresos: 0, costos: 0 };
      map[m].costos += Number(c.total || 0);
    });

    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [financials.data]);

  // Diagnóstico con IA Agrónoma
  const requestAiDiagnosis = async () => {
    setAiLoading(true);
    try {
      const parcelsList = (parcels.data ?? [])
        .map((p: any) => `${p.name} (${(Number(p.area_m2) / 10000).toFixed(1)} ha, suelo ${p.soil_types?.name ?? "estándar"})`)
        .join("; ");
      const cropsList = (parcels.data ?? [])
        .flatMap((p: any) => (p.crops ?? []).map((c: any) => `${c.crop_catalog?.name ?? "Cultivo"} (${c.status})`))
        .join(", ");
      const pendingAlertsList = (alerts.data ?? []).map((a: any) => a.message).join("; ");

      const prompt = `Como Asistente Agronómico Oficial de SIGIC, realiza una evaluación ejecutiva y accionable de mi finca con los siguientes datos actuales:
- Mis Parcelas: ${parcelsList || "No registradas"}
- Mis Cultivos en Campo: ${cropsList || "Sin cultivos"}
- Actividades realizadas recientes: ${activities.data?.length ?? 0}
- Alertas o problemas fitosanitarios: ${pendingAlertsList || "Ninguna alerta"}
- Balance financiero: Ingresos ${formatCOP(totalRevenue)}, Costos ${formatCOP(totalCost)}, Margen ${formatCOP(netMargin)}.

Estructura tu respuesta en 3 secciones breves:
1. Estado y Sanidad de los Cultivos (análisis rápido).
2. Tareas Agronómicas Prioritarias (riego, fertilización o monitoreo de plagas para los próximos días).
3. Eficiencia y Rentabilidad (consejo para optimizar costos de insumos).
Sé profesional, cálido y enfocado en la realidad de un agricultor de campo.`;

      const response = await chatWithGroq({
        data: {
          messages: [
            {
              role: "system",
              content: "Eres el Asistente Agronómico de SIGIC. Aplica tus reglas estrictas de dominio agrícola.",
            },
            { role: "user", content: prompt },
          ],
          model: "gemini-2.0-flash",
          max_tokens: 700,
        },
      });

      setAiAnalysis(response);
      toast.success("Diagnóstico agronómico generado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar el diagnóstico");
    } finally {
      setAiLoading(false);
    }
  };

  // Exportar PDF oficial
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const farmerName = profile.data?.fullName || "Agricultor";
      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

      const parcelRows = (parcels.data ?? []).map((p: any) => {
        const crops = (p.crops ?? [])
          .map((c: any) => `${c.crop_catalog?.name ?? "Cultivo"} (${c.status})`)
          .join(", ") || "Sin cultivo activo";
        return [
          p.name,
          `${(Number(p.area_m2) / 10000).toFixed(2)} ha`,
          p.soil_types?.name ?? "Estándar",
          crops,
        ];
      });

      const actRows = (activities.data ?? []).slice(0, 25).map((a: any) => [
        format(new Date(a.performed_at), "dd/MM/yyyy"),
        kindLabels[a.kind] ?? a.kind,
        a.crops?.crop_catalog?.name ?? "—",
        a.crops?.parcels?.name ?? "—",
        a.notes || "Sin notas",
      ]);

      const harvestRows = (financials.data?.harvests ?? []).slice(0, 15).map((h: any) => [
        h.crops?.crop_catalog?.name ?? "—",
        `${Number(h.harvested_qty).toFixed(1)} ${h.unit || "KG"}`,
        formatCOP(Number(h.sale_price || 0)),
        formatCOP(Number(h.total_revenue || 0)),
        h.performed_at ? format(new Date(h.performed_at), "dd/MM/yyyy") : "—",
      ]);

      const doc = await generatePdfReport({
        template: "resumen",
        title: `Reporte Agrícola — ${farmerName}`,
        subtitle: `Generado el ${dateStr} • SIGIC Agro-Pathfinder`,
        author: farmerName,
        orientation: "portrait",
        sections: [
          {
            title: "Indicadores Generales de la Finca",
            head: ["Indicador", "Valor Registrado"],
            body: [
              ["Agricultor Titular", farmerName],
              ["Total de Parcelas", String(parcels.data?.length ?? 0)],
              ["Superficie Total", `${totalAreaHa} hectáreas`],
              ["Cultivos en Desarrollo", String(activeCropsCount)],
              ["Labores Realizadas (60d)", String(activities.data?.length ?? 0)],
              ["Alertas Pendientes", String(alerts.data?.length ?? 0)],
              ["Ingresos por Cosecha", formatCOP(totalRevenue)],
              ["Costos Operativos", formatCOP(totalCost)],
              ["Margen Bruto", formatCOP(netMargin)],
            ],
          },
          {
            title: "Inventario de Parcelas y Cultivos",
            head: ["Parcela", "Área", "Tipo de Suelo", "Cultivos Actuales"],
            body: parcelRows,
          },
          {
            title: "Bitácora de Labores Agrícolas Recientes",
            head: ["Fecha", "Labor", "Cultivo", "Parcela", "Observaciones"],
            body: actRows,
          },
          {
            title: "Registro de Cosechas y Ventas",
            head: ["Cultivo", "Cantidad", "Precio Unitario", "Ingreso Total", "Fecha Cosecha"],
            body: harvestRows,
          },
        ],
      });

      doc.save(`SIGIC-Reporte-${farmerName.replace(/\s+/g, "_")}-${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Reporte PDF descargado con éxito");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar PDF");
    } finally {
      setExporting(false);
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    try {
      const rows = [
        ["Reporte Agrícola SIGIC"],
        [`Agricultor: ${profile.data?.fullName || "Agricultor"}`],
        [`Fecha: ${format(new Date(), "yyyy-MM-dd")}`],
        [],
        ["--- MIS PARCELAS ---"],
        ["Parcela", "Área (ha)", "Tipo de Suelo", "Cultivos"],
        ...(parcels.data ?? []).map((p: any) => [
          p.name,
          (Number(p.area_m2) / 10000).toFixed(2),
          p.soil_types?.name ?? "—",
          (p.crops ?? []).map((c: any) => `${c.crop_catalog?.name ?? "Cultivo"}(${c.status})`).join("; "),
        ]),
        [],
        ["--- BITÁCORA DE LABORES RECIENTES ---"],
        ["Fecha", "Labor", "Cultivo", "Parcela", "Notas"],
        ...(activities.data ?? []).map((a: any) => [
          format(new Date(a.performed_at), "yyyy-MM-dd HH:mm"),
          kindLabels[a.kind] ?? a.kind,
          a.crops?.crop_catalog?.name ?? "—",
          a.crops?.parcels?.name ?? "—",
          a.notes ?? "",
        ]),
        [],
        ["--- REGISTRO DE COSECHAS ---"],
        ["Cultivo", "Cantidad", "Unidad", "Precio Unitario (COP)", "Ingreso Total (COP)", "Fecha"],
        ...(financials.data?.harvests ?? []).map((h: any) => [
          h.crops?.crop_catalog?.name ?? "—",
          h.harvested_qty,
          h.unit || "KG",
          h.sale_price || 0,
          h.total_revenue || 0,
          h.performed_at ? format(new Date(h.performed_at), "yyyy-MM-dd") : "—",
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
      a.download = `reporte-finca-${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Archivo CSV exportado");
    } catch {
      toast.error("Error al exportar CSV");
    }
  };

  const loading = parcels.isLoading || activities.isLoading || financials.isLoading;

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-900/10 via-emerald-600/5 to-transparent border border-emerald-500/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-emerald-600/15 text-emerald-600 grid place-items-center font-bold">
              <Leaf className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Mi Reporte Agrícola
              </h1>
              <p className="text-xs text-muted-foreground">
                Agricultor: <span className="font-semibold text-foreground">{profile.data?.fullName}</span> • {format(new Date(), "MMMM yyyy", { locale: es })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={requestAiDiagnosis}
            disabled={aiLoading || loading}
            className="gap-1.5 text-xs bg-card hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
          >
            {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-emerald-600" />}
            {aiLoading ? "Analizando finca..." : "Diagnóstico IA Finca"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <FileSpreadsheet className="size-3.5 text-primary" />
            Exportar CSV
          </Button>

          <Button
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting || loading}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Download className="size-3.5" />
            {exporting ? "Generando..." : "Descargar PDF"}
          </Button>
        </div>
      </div>

      {/* Banner de Diagnóstico IA si se generó */}
      {aiAnalysis && (
        <Card className="p-5 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-4" /> Diagnóstico Agronómico Personalizado (IA SIGIC)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiAnalysis(null)}
              className="h-6 px-2 text-xs text-muted-foreground"
            >
              Ocultar
            </Button>
          </div>
          <div className="p-4 rounded-xl bg-card border border-emerald-500/20 text-xs leading-relaxed text-foreground whitespace-pre-line">
            {aiAnalysis}
          </div>
        </Card>
      )}

      {/* Tarjetas de Métricas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-4.5 bg-card border-border/70 hover:border-emerald-500/40 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Mis Parcelas</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <MapPin className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {loading ? "—" : parcels.data?.length ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalAreaHa} hectáreas totales
          </p>
        </Card>

        <Card className="p-4.5 bg-card border-border/70 hover:border-emerald-500/40 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cultivos en Campo</span>
            <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
              <Sprout className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {loading ? "—" : activeCropsCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            En fase de crecimiento/producción
          </p>
        </Card>

        <Card className="p-4.5 bg-card border-border/70 hover:border-emerald-500/40 transition-all shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Labores (60 días)</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <Activity className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {loading ? "—" : activities.data?.length ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Riegos, fertilizaciones y podas
          </p>
        </Card>

        <Card
          className={`p-4.5 bg-card border transition-all shadow-xs ${
            (alerts.data?.length ?? 0) > 0
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Alertas Fitosanitarias</span>
            <div
              className={`p-2 rounded-lg ${
                (alerts.data?.length ?? 0) > 0
                  ? "bg-amber-500/20 text-amber-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <BellRing className="size-4" />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mt-2 ${
              (alerts.data?.length ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
            }`}
          >
            {loading ? "—" : alerts.data?.length ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {(alerts.data?.length ?? 0) > 0 ? "Requieren tu atención" : "Sin incidencias graves"}
          </p>
        </Card>
      </div>

      {/* Resumen Financiero en COP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl border border-red-500/20 bg-card shadow-xs">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Costos de Insumos y Labores
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-red-600">
            {formatCOP(totalCost)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Gastos registrados</p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/20 bg-card shadow-xs">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ingresos por Cosechas
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-600">
            {formatCOP(totalRevenue)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Ventas registradas</p>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-xs bg-card ${
            netMargin >= 0 ? "border-emerald-500/30" : "border-red-500/30"
          }`}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Margen Operativo Neto
          </p>
          <p
            className={`mt-1.5 text-2xl font-bold tabular-nums flex items-center gap-1.5 ${
              netMargin >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {netMargin >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
            {formatCOP(netMargin)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {netMargin >= 0 ? "Balance positivo" : "Déficit en el periodo"}
          </p>
        </div>
      </div>

      {/* Pestañas detalladas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 w-full sm:w-auto grid grid-cols-2 sm:inline-flex h-auto gap-1">
          <TabsTrigger value="resumen" className="text-xs gap-1.5 py-1.5">
            <DollarSign className="size-3.5" />
            Finanzas y Gráficos
          </TabsTrigger>
          <TabsTrigger value="parcelas" className="text-xs gap-1.5 py-1.5">
            <MapPin className="size-3.5" />
            Mis Parcelas ({parcels.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="actividades" className="text-xs gap-1.5 py-1.5">
            <Activity className="size-3.5" />
            Labores ({activities.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="cosechas" className="text-xs gap-1.5 py-1.5">
            <Wheat className="size-3.5" />
            Cosechas ({financials.data?.harvests?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Finanzas y Gráficos */}
        <TabsContent value="resumen" className="space-y-4">
          <Card className="p-5 border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Evolución Mensual: Ingresos vs Costos
                </h3>
                <p className="text-xs text-muted-foreground">Valores expresados en pesos colombianos (COP)</p>
              </div>
            </div>

            {monthlyChartData.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs border border-dashed rounded-lg bg-muted/20">
                Aún no hay suficientes registros mensuales de cosechas o costos para graficar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(v: any) => [formatCOP(Number(v)), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar dataKey="ingresos" name="Ingresos por Cosecha" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costos" name="Costos Operativos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Mis Parcelas y Cultivos */}
        <TabsContent value="parcelas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(parcels.data ?? []).map((p: any) => {
              const parcelCrops = p.crops ?? [];
              const activeCount = parcelCrops.filter((c: any) =>
                ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)
              ).length;

              return (
                <Card key={p.id} className="p-5 border-border hover:border-primary/40 transition-all space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        {p.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(Number(p.area_m2) / 10000).toFixed(2)} ha • Suelo: {p.soil_types?.name ?? "Estándar"}
                      </p>
                    </div>
                    <Badge variant={activeCount > 0 ? "default" : "outline"} className="text-xs">
                      {activeCount} activo{activeCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cultivos en esta parcela:
                    </p>
                    {parcelCrops.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin cultivos registrados actualmente.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {parcelCrops.map((c: any) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs"
                          >
                            <span className="font-medium text-foreground">
                              {c.crop_catalog?.name ?? "Cultivo"}
                            </span>
                            <div className="flex items-center gap-2">
                              {c.planting_date && (
                                <span className="text-[11px] text-muted-foreground">
                                  Siembra: {format(new Date(c.planting_date), "dd/MM/yy")}
                                </span>
                              )}
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {c.status?.toLowerCase() ?? "activo"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
            {(parcels.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
                No tienes parcelas registradas en el sistema.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Bitácora de Labores */}
        <TabsContent value="actividades" className="space-y-4">
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Labores Realizadas en Campo (Últimos 60 días)
            </h3>

            {(activities.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No hay actividades registradas en los últimos 60 días.
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {(activities.data ?? []).map((a: any) => {
                  const Icon = kindIcons[a.kind] ?? Activity;
                  return (
                    <div key={a.id} className="py-3 flex items-start gap-3 hover:bg-muted/20 px-2 rounded-lg transition-colors">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-foreground">
                            {kindLabels[a.kind] ?? a.kind}
                            {a.crops?.crop_catalog?.name && (
                              <span className="font-normal text-muted-foreground ml-1.5">
                                • {a.crops.crop_catalog.name}
                              </span>
                            )}
                          </p>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {format(new Date(a.performed_at), "dd MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        {a.crops?.parcels?.name && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Parcela: {a.crops.parcels.name}
                          </p>
                        )}
                        {a.notes && (
                          <p className="text-xs text-muted-foreground mt-1 bg-muted/40 p-2 rounded-md">
                            {a.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 4: Cosechas y Ventas */}
        <TabsContent value="cosechas" className="space-y-4">
          <Card className="p-4 border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Wheat className="size-4 text-primary" />
              Historial de Cosechas y Ventas Realizadas
            </h3>

            {(financials.data?.harvests ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No hay cosechas registradas aún en tus parcelas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Cultivo</th>
                      <th className="py-2.5 px-3 text-right">Cantidad Cosechada</th>
                      <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                      <th className="py-2.5 px-3 text-right">Ingreso Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(financials.data?.harvests ?? []).map((h: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {h.performed_at ? format(new Date(h.performed_at), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {h.crops?.crop_catalog?.name ?? "Cultivo"}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {Number(h.harvested_qty).toFixed(1)} {h.unit || "KG"}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatCOP(Number(h.sale_price || 0))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">
                          {formatCOP(Number(h.total_revenue || 0))}
                        </td>
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
