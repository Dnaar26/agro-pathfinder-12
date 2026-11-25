import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listParcels } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  FlaskConical,
  Plus,
  CalendarPlus,
  PackageSearch,
  Bot,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suelos")({
  head: () => ({ meta: [{ title: "Análisis de Suelos — SIGIC" }] }),
  component: SoilAnalysisPage,
});

const TEXTURE_OPTIONS = [
  "Franco",
  "Franco arcilloso",
  "Franco arenoso",
  "Arcilloso",
  "Arenoso",
  "Limoso",
];

function evaluateSoilSample(sample: any, areaM2: number) {
  const ph = Number(sample.ph || 0);
  const mo = Number(sample.organic_matter_pct || 0);
  const p = Number(sample.phosphorus_ppm || 0);
  const k = Number(sample.potassium_cmol || 0);
  const cec = Math.max(0.1, Number(sample.cec_cmol || 10));
  const al = Number(sample.aluminum_cmol || 0);
  const areaHa = Math.max(0.05, Number(areaM2 || 10000) / 10000);

  const alSaturationPct = Math.min(100, (al / cec) * 100);
  // Fórmula agronómica estándar tropical (Cochrane / Kamprath): ~1.5 ton/ha CaCO3 por cada cmol(+) de Al intercambiable cuando pH < 5.5
  const limeTonPerHa =
    ph < 5.6 && al > 0.3
      ? Math.round(al * 1.5 * 100) / 100
      : ph < 5.2
        ? 1.0
        : 0;
  const totalLimeKg = Math.round(limeTonPerHa * 1000 * areaHa);

  const phStatus =
    ph < 5.0
      ? { label: "Fuertemente ácido", tone: "destructive" as const }
      : ph < 5.6
        ? { label: "Moderadamente ácido", tone: "warning" as const }
        : ph <= 6.8
          ? { label: "Óptimo agrícola", tone: "success" as const }
          : { label: "Alcalino", tone: "warning" as const };

  const moStatus = mo < 2 ? "Baja (<2%)" : mo <= 5 ? "Media-Óptima" : "Alta (>5%)";
  const pStatus = p < 15 ? "Deficiente (<15 ppm)" : p <= 40 ? "Adecuado" : "Alto (>40 ppm)";
  const kStatus = k < 0.2 ? "Bajo (<0.2 cmol)" : k <= 0.6 ? "Óptimo" : "Alto (>0.6 cmol)";

  return {
    areaHa,
    alSaturationPct: Math.round(alSaturationPct * 10) / 10,
    limeTonPerHa,
    totalLimeKg,
    phStatus,
    moStatus,
    pStatus,
    kStatus,
  };
}

function isMissingRelationError(err: any): boolean {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || msg.includes("soil_analyses");
}

function SoilAnalysisPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [parcelFilter, setParcelFilter] = useState<string>("__all__");

  const [formParcelId, setFormParcelId] = useState<string>("");
  const [sampleDate, setSampleDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [ph, setPh] = useState("5.2");
  const [organicMatter, setOrganicMatter] = useState("3.4");
  const [phosphorus, setPhosphorus] = useState("12");
  const [potassium, setPotassium] = useState("0.28");
  const [cec, setCec] = useState("11.5");
  const [aluminum, setAluminum] = useState("1.4");
  const [texture, setTexture] = useState("Franco");
  const [labName, setLabName] = useState("");
  const [notes, setNotes] = useState("");

  const parcelsQuery = useQuery({
    queryKey: ["parcels"],
    queryFn: listParcels,
  });

  const samplesQuery = useQuery({
    queryKey: ["soil-analyses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("soil_analyses")
        .select("*, parcels(id, name, area_m2)")
        .order("sample_date", { ascending: false });
      if (error) {
        if (isMissingRelationError(error)) {
          return { migrationPending: true, rows: [] as any[] };
        }
        throw error;
      }
      return { migrationPending: false, rows: (data ?? []) as any[] };
    },
  });

  const createSample = useMutation({
    mutationFn: async () => {
      if (!formParcelId) throw new Error("Selecciona una parcela");
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!uid) throw new Error("Sesión expirada");

      const { error } = await (supabase as any).from("soil_analyses").insert({
        parcel_id: formParcelId,
        sample_date: sampleDate,
        ph: Number(ph),
        organic_matter_pct: Number(organicMatter),
        phosphorus_ppm: Number(phosphorus),
        potassium_cmol: Number(potassium),
        cec_cmol: Math.max(0.5, Number(cec)),
        aluminum_cmol: Math.max(0, Number(aluminum)),
        texture,
        lab_name: labName.trim() || null,
        notes: notes.trim() || null,
        created_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Análisis de suelo registrado con éxito");
      qc.invalidateQueries({ queryKey: ["soil-analyses"] });
      setOpen(false);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSample = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("soil_analyses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Muestra eliminada");
      qc.invalidateQueries({ queryKey: ["soil-analyses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredRows = useMemo(() => {
    const all = samplesQuery.data?.rows ?? [];
    if (parcelFilter === "__all__") return all;
    return all.filter((r: any) => r.parcel_id === parcelFilter);
  }, [samplesQuery.data?.rows, parcelFilter]);

  const previewEval = useMemo(() => {
    const p = (parcelsQuery.data ?? []).find((x: any) => x.id === formParcelId);
    return evaluateSoilSample(
      {
        ph: Number(ph),
        organic_matter_pct: Number(organicMatter),
        phosphorus_ppm: Number(phosphorus),
        potassium_cmol: Number(potassium),
        cec_cmol: Number(cec),
        aluminum_cmol: Number(aluminum),
      },
      Number(p?.area_m2 || 10000)
    );
  }, [formParcelId, ph, organicMatter, phosphorus, potassium, cec, aluminum, parcelsQuery.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="size-7 text-primary" />
            Laboratorio e Interpretación de Suelos
          </h1>
          <p className="text-sm text-muted-foreground">
            Registra muestras fisicoquímicas (pH, MO, P, K, CIC y Aluminio) para calcular encalado exacto y agendar labores en 1 clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={parcelFilter} onValueChange={setParcelFilter}>
            <SelectTrigger className="w-48">
              <MapPin className="mr-1.5 size-4 text-primary" />
              <SelectValue placeholder="Todas las parcelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las parcelas</SelectItem>
              {(parcelsQuery.data ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5">
                <Plus className="size-4" /> Nueva muestra
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Análisis Fisicoquímico de Suelo</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createSample.mutate();
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Parcela muestreada *</Label>
                    <Select value={formParcelId} onValueChange={setFormParcelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Elegir parcela…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(parcelsQuery.data ?? []).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({(Number(p.area_m2) / 10000).toFixed(2)} ha)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha de muestreo</Label>
                    <Input type="date" value={sampleDate} onChange={(e) => setSampleDate(e.target.value)} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">pH del suelo</Label>
                    <Input type="number" inputMode="decimal" step="0.1" min="3" max="10" value={ph} onChange={(e) => setPh(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Materia Orgánica (%)</Label>
                    <Input type="number" inputMode="decimal" step="0.1" min="0" value={organicMatter} onChange={(e) => setOrganicMatter(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fósforo Bray II (ppm)</Label>
                    <Input type="number" inputMode="decimal" step="0.5" min="0" value={phosphorus} onChange={(e) => setPhosphorus(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Potasio (cmol/kg)</Label>
                    <Input type="number" inputMode="decimal" step="0.05" min="0" value={potassium} onChange={(e) => setPotassium(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CIC Efectiva (cmol/kg)</Label>
                    <Input type="number" inputMode="decimal" step="0.5" min="0.5" value={cec} onChange={(e) => setCec(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Aluminio Al³⁺ (cmol/kg)</Label>
                    <Input type="number" inputMode="decimal" step="0.1" min="0" value={aluminum} onChange={(e) => setAluminum(e.target.value)} required />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Clase textural</Label>
                    <Select value={texture} onValueChange={setTexture}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEXTURE_OPTIONS.map((tx) => (
                          <SelectItem key={tx} value={tx}>
                            {tx}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Laboratorio (opcional)</Label>
                    <Input placeholder="Ej: AGROSAVIA / IGAC" value={labName} onChange={(e) => setLabName(e.target.value)} />
                  </div>
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-xs space-y-1.5">
                  <p className="font-semibold text-primary">Diagnóstico preliminar en vivo:</p>
                  <p className="text-foreground">
                    Estado de acidez: <strong>{previewEval.phStatus.label}</strong> · Saturación de Aluminio:{" "}
                    <strong>{previewEval.alSaturationPct}%</strong>
                  </p>
                  {previewEval.limeTonPerHa > 0 ? (
                    <p className="text-warning-text font-medium">
                      Requerimiento estimado de Cal Dolomítica: {previewEval.limeTonPerHa} ton/ha ({previewEval.totalLimeKg.toLocaleString("es-CO")} kg para el lote).
                    </p>
                  ) : (
                    <p className="text-success font-medium">No requiere encalado correctivo inmediato.</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observaciones</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Profundidad 0-20 cm, lote ladera…" />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createSample.isPending}>
                    Guardar análisis
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {samplesQuery.data?.migrationPending && (
        <Card className="p-4 border-warning/40 bg-warning/10 text-xs flex items-start gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-warning-text mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Migración de base de datos v5 pendiente</p>
            <p className="text-muted-foreground">
              Ejecuta <code className="rounded bg-background px-1.5 py-0.5">npx supabase db push</code> para activar el almacenamiento permanente de muestras en <code className="rounded bg-background px-1.5 py-0.5">public.soil_analyses</code>.
            </p>
          </div>
        </Card>
      )}

      {samplesQuery.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando historial de suelos…</p>
      ) : filteredRows.length === 0 ? (
        <Card className="p-10 text-center space-y-3 border-dashed">
          <FlaskConical className="size-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">Aún no hay análisis de suelo registrados</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Registra los resultados de laboratorio de tus parcelas para calcular automáticamente dosis de cal agrícola y planes nutricionales.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRows.map((row: any) => {
            const parcelName = row.parcels?.name ?? "Parcela";
            const diag = evaluateSoilSample(row, Number(row.parcels?.area_m2 || 10000));
            return (
              <Card key={row.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base">{parcelName}</h2>
                      <Badge variant="outline" className="text-xs">
                        {diag.areaHa.toFixed(2)} ha · {row.texture}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Muestreo: {row.sample_date} {row.lab_name ? `· Lab: ${row.lab_name}` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteSample.mutate(row.id)}
                    aria-label="Eliminar muestra"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <span className="text-muted-foreground">pH</span>
                    <p className="text-lg font-bold tabular-nums">{Number(row.ph).toFixed(1)}</p>
                    <span className="text-[11px] font-medium text-primary">{diag.phStatus.label}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <span className="text-muted-foreground">Sat. Aluminio</span>
                    <p className={`text-lg font-bold tabular-nums ${diag.alSaturationPct > 25 ? "text-destructive" : "text-success"}`}>
                      {diag.alSaturationPct}%
                    </p>
                    <span className="text-[11px] text-muted-foreground">CIC: {row.cec_cmol} cmol</span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <span className="text-muted-foreground">Mat. Orgánica</span>
                    <p className="text-lg font-bold tabular-nums">{Number(row.organic_matter_pct).toFixed(1)}%</p>
                    <span className="text-[11px] text-muted-foreground">{diag.moStatus}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2.5 py-1">P (Bray II): <strong className="text-foreground">{row.phosphorus_ppm} ppm</strong> ({diag.pStatus})</span>
                  <span className="rounded-md bg-muted px-2.5 py-1">K: <strong className="text-foreground">{row.potassium_cmol} cmol</strong> ({diag.kStatus})</span>
                </div>

                {diag.limeTonPerHa > 0 ? (
                  <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs space-y-1">
                    <p className="font-semibold text-warning-text flex items-center gap-1.5">
                      <AlertTriangle className="size-4 shrink-0" />
                      Recomendación de Encalado: {diag.limeTonPerHa} ton/ha ({diag.totalLimeKg.toLocaleString("es-CO")} kg totales)
                    </p>
                    <p className="text-muted-foreground">
                      Incorporar Cal Dolomítica 20–30 días antes de la fertilización NPK con suelo húmedo.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-success/30 bg-success/10 p-3 text-xs flex items-center gap-2 text-success font-medium">
                    <CheckCircle2 className="size-4 shrink-0" />
                    Acidez y aluminio bajo control agronómico. Listo para plan nutricional directo.
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
                  {diag.totalLimeKg > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs gap-1.5"
                      onClick={() =>
                        navigate({
                          to: "/calendar",
                          search: {
                            openNew: true,
                            title: `Encalado correctivo (${parcelName})`,
                            description: `Aplicar ${diag.totalLimeKg} kg de Cal Dolomítica (${diag.limeTonPerHa} ton/ha) según análisis de suelo pH ${row.ph} y Al ${row.aluminum_cmol} cmol/kg.`,
                            itemQuery: "Cal",
                            qty: diag.totalLimeKg,
                          },
                        })
                      }
                    >
                      <CalendarPlus className="size-3.5 text-primary" />
                      Agendar encalado ({diag.totalLimeKg} kg)
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs gap-1.5"
                    onClick={() =>
                      navigate({
                        to: "/inventory",
                        search: { q: diag.totalLimeKg > 0 ? "Cal" : "NPK" },
                      })
                    }
                  >
                    <PackageSearch className="size-3.5 text-primary" />
                    Ver insumo en Inventario
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 text-xs gap-1.5"
                    onClick={() => navigate({ to: "/chat" })}
                  >
                    <Bot className="size-3.5 text-primary" />
                    Consultar IA
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
