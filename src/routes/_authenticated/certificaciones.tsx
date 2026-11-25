import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, getMyRoles, listAllCrops } from "@/lib/queries";
import { ProducerScopeBar, FarmGroupSection, useProducerScope } from "@/components/admin/producer-scope-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Award, CheckCircle2, AlertTriangle, Plus, Download, ShieldCheck, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { exportBpaCertificatePdf } from "@/lib/pdf-certificate";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/certificaciones")({
  head: () => ({ meta: [{ title: "Certificación BPA & GLOBALG.A.P. — SIGIC" }] }),
  component: BpaCertificationsPage,
});

const BPA_CHECKLIST_ITEMS = [
  { id: "seed_cert", label: "1. Semilla o material vegetal certificado y con registro de origen" },
  { id: "agro_log", label: "2. Bitácora actualizada de todas las aplicaciones fitosanitarias y fertilizantes" },
  { id: "phi_respected", label: "3. Cumplimiento estricto del Período de Carencia (PC) antes de cosecha" },
  { id: "storage_safe", label: "4. Bodega de insumos ventilada, señalizada, bajo llave y sin derrames" },
  { id: "triple_wash", label: "5. Triple lavado, perforado y entrega segura de envases vacíos" },
  { id: "ppe_used", label: "6. Uso completo de Equipo de Protección Personal (EPP) por operarios" },
  { id: "water_safe", label: "7. Fuentes de agua protegidas con franja de seguridad libre de agroquímicos" },
  { id: "harvest_hygiene", label: "8. Canastillas, herramientas y acopio limpios y desinfectados (inocuidad)" },
  { id: "worker_welfare", label: "9. Botiquín de primeros auxilios, agua potable y bienestar laboral en campo" },
  { id: "ipm_plan", label: "10. Monitoreo de plagas documentado bajo Manejo Integrado (MIP)" },
] as const;

async function downloadOfficialBpaPdf(ev: any) {
  try {
    const cropName = ev.crops?.crop_catalog?.name ?? "Cultivo";
    const parcelName = ev.crops?.parcels?.name ?? "Parcela";
    const ownerName = ev.crops?.parcels?.profiles?.full_name || ev.evaluator_name || "Productor SIGIC";
    const batchCode = ev.batches?.batch_code || undefined;
    const score = Number(ev.compliance_score || 0);
    const approved = ev.status === "APROBADO_BPA" || score >= 80;
    const qrSvg = batchCode
      ? (document.querySelector(`svg[data-bpa-qr="${ev.id}"]`) as SVGSVGElement | null)
      : null;

    await exportBpaCertificatePdf({
      folio: `BPA-${String(ev.id || "").slice(0, 8).toUpperCase()}`,
      farmName: `Unidad Productiva ${ownerName}`,
      producerName: ownerName,
      parcelName,
      cropName,
      batchCode,
      score,
      approved,
      evaluatedAt: new Date(ev.evaluated_at).toLocaleDateString("es-CO"),
      evaluatorName: `${ev.evaluator_name} (${ev.evaluator_role})`,
      globalGapCertified: approved && Boolean(batchCode),
      observations: ev.notes || undefined,
      qrSvgElement: qrSvg,
      verifyUrl:
        batchCode && typeof window !== "undefined"
          ? `${window.location.origin}/trace/${batchCode}`
          : undefined,
      checklist: BPA_CHECKLIST_ITEMS.map((c, idx) => ({
        code: `BPA-${String(idx + 1).padStart(2, "0")}`,
        label: c.label.replace(/^\d+\.\s*/, ""),
        compliant: Boolean(ev.checks?.[c.id]),
      })),
    });
    toast.success("Certificado oficial BPA con logos descargado en PDF");
  } catch (err: any) {
    toast.error(err?.message ?? "No se pudo exportar el certificado PDF");
  }
}

function BpaCertificationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedCropId, setSelectedCropId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("__none__");
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BPA_CHECKLIST_ITEMS.map((i) => [i.id, true]))
  );
  const [notes, setNotes] = useState("");
  const { isStaff, producerId, setProducerId, groupByFarm, setGroupByFarm, producers } = useProducerScope();

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const rolesQuery = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const cropsQuery = useQuery({ queryKey: ["crops"], queryFn: listAllCrops });

  const batchesQuery = useQuery({
    queryKey: ["bpa-crop-batches", selectedCropId],
    queryFn: async () => {
      if (!selectedCropId) return [];
      const { data } = await supabase
        .from("batches")
        .select("id, batch_code, harvest_date, globalgap_cert")
        .eq("crop_id", selectedCropId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: Boolean(selectedCropId),
  });

  const evaluationsQuery = useQuery({
    queryKey: ["bpa-evaluations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bpa_evaluations")
        .select("*, crops(id, crop_catalog(name), parcels(name, owner_id, profiles!owner_id(full_name))), batches(batch_code)")
        .order("evaluated_at", { ascending: false });
      if (error) {
        if (String(error.code) === "42P01" || String(error.code) === "PGRST205") {
          return { migrationPending: true, rows: [] as any[] };
        }
        throw error;
      }
      return { migrationPending: false, rows: (data ?? []) as any[] };
    },
  });

  const scorePct = useMemo(() => {
    const passed = BPA_CHECKLIST_ITEMS.filter((it) => checkedMap[it.id]).length;
    return Math.round((passed / BPA_CHECKLIST_ITEMS.length) * 100);
  }, [checkedMap]);

  const primaryRole = useMemo(() => {
    const r = rolesQuery.data ?? [];
    if (r.includes("admin")) return "admin";
    if (r.includes("tecnico")) return "tecnico";
    return "agricultor";
  }, [rolesQuery.data]);

  const saveEvaluation = useMutation({
    mutationFn: async () => {
      if (!selectedCropId) throw new Error("Selecciona el cultivo a evaluar");
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sesión expirada");

      const status = scorePct >= 80 ? "APROBADO_BPA" : "CON_HALLAZGOS";
      const evaluatorName = profileQuery.data?.full_name || user.email || "Evaluador SIGIC";
      const batchIdVal = selectedBatchId && selectedBatchId !== "__none__" ? selectedBatchId : null;

      const { error } = await (supabase as any).from("bpa_evaluations").insert({
        crop_id: selectedCropId,
        batch_id: batchIdVal,
        evaluator_id: user.id,
        evaluator_name: evaluatorName,
        evaluator_role: primaryRole,
        checks: checkedMap,
        compliance_score: scorePct,
        status,
        notes: notes.trim() || null,
      });
      if (error) throw error;

      // Si aprobó BPA (>= 80%) y vinculó un lote de cosecha, certificar el lote para el QR público
      if (scorePct >= 80 && batchIdVal) {
        await (supabase as any).rpc("certify_batch_from_bpa", { p_batch_id: batchIdVal });
      }
    },
    onSuccess: () => {
      toast.success(
        scorePct >= 80
          ? "Evaluación BPA aprobada y sello de trazabilidad sincronizado"
          : "Autoevaluación guardada con hallazgos por corregir"
      );
      qc.invalidateQueries({ queryKey: ["bpa-evaluations"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      setOpen(false);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="size-7 text-primary" />
            Auditoría BPA & Certificación GLOBALG.A.P.
          </h1>
          <p className="text-sm text-muted-foreground">
            Verifica los 10 puntos críticos de inocuidad agrícola y respalda con evidencia el sello QR de tus lotes cosechados.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="size-4" /> Nueva evaluación BPA
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lista de Chequeo Oficial BPA / GLOBALG.A.P.</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEvaluation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cultivo auditado *</Label>
                  <Select
                    value={selectedCropId}
                    onValueChange={(v) => {
                      setSelectedCropId(v);
                      setSelectedBatchId("__none__");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cultivo…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(cropsQuery.data ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.crop_catalog?.name ?? "Cultivo"} — {c.parcels?.name ?? "Parcela"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Lote QR a certificar (opcional)</Label>
                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId} disabled={!selectedCropId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin lote específico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Solo cultivo general</SelectItem>
                      {(batchesQuery.data ?? []).map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.batch_code} {b.globalgap_cert ? "✓" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Puntaje de cumplimiento BPA (mínimo 80% para certificar):</span>
                  <span className={`font-bold text-sm ${scorePct >= 80 ? "text-success" : "text-warning-text"}`}>
                    {scorePct}%
                  </span>
                </div>
                <Progress value={scorePct} className="h-2" />
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {BPA_CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-xs cursor-pointer hover:border-primary/40"
                  >
                    <Checkbox
                      checked={Boolean(checkedMap[item.id])}
                      onCheckedChange={(val) =>
                        setCheckedMap((prev) => ({ ...prev, [item.id]: Boolean(val) }))
                      }
                      className="mt-0.5"
                    />
                    <span className="leading-relaxed">{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Plan de mejora / Firma o matrícula profesional</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Verificado en visita técnica · Envases entregados a CampoLimpio…"
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saveEvaluation.isPending}>
                  Registrar auditoría ({scorePct}%)
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {evaluationsQuery.data?.migrationPending && (
        <Card className="p-4 border-warning/40 bg-warning/10 text-xs flex items-start gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-warning-text mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Migración de base de datos v5 pendiente</p>
            <p className="text-muted-foreground">
              Ejecuta <code className="rounded bg-background px-1.5 py-0.5">npx supabase db push</code> para activar <code className="rounded bg-background px-1.5 py-0.5">public.bpa_evaluations</code>.
            </p>
          </div>
        </Card>
      )}

      <ProducerScopeBar
        isStaff={isStaff}
        producerId={producerId}
        onProducerChange={setProducerId}
        groupByFarm={groupByFarm}
        onGroupByFarmChange={setGroupByFarm}
        producers={producers}
        recordLabel="evaluaciones BPA"
      />

      {(() => {
        const allEvs = evaluationsQuery.data?.rows ?? [];
        const visibleEvs = isStaff && producerId
          ? allEvs.filter((ev: any) => ev.crops?.parcels?.owner_id === producerId)
          : allEvs;

        if (visibleEvs.length === 0) {
          return (
        <Card className="p-10 text-center space-y-3 border-dashed">
          <ShieldCheck className="size-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">Sin auditorías BPA registradas aún</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Evalúa tus cultivos con la lista oficial de 10 puntos para habilitar el sello verificado en los códigos QR de cosecha.
          </p>
        </Card>
          );
        }

        if (isStaff && !producerId && groupByFarm) {
          const map = new Map<string, { ownerId: string; ownerName: string; items: any[] }>();
          for (const ev of visibleEvs) {
            const oid = ev.crops?.parcels?.owner_id || "unknown";
            const oName = ev.crops?.parcels?.profiles?.full_name || "Productor sin nombre";
            if (!map.has(oid)) map.set(oid, { ownerId: oid, ownerName: oName, items: [] });
            map.get(oid)!.items.push(ev);
          }
          const groups = Array.from(map.values()).sort((a, b) => a.ownerName.localeCompare(b.ownerName));
          return (
            <div className="space-y-5">
              {groups.map((g) => (
                <FarmGroupSection
                  key={g.ownerId}
                  ownerId={g.ownerId}
                  ownerName={g.ownerName}
                  badgeText={`${g.items.length} auditoría${g.items.length !== 1 ? "s" : ""}`}
                  subtitle="Evaluaciones de Buenas Prácticas Agrícolas (BPA)"
                  onFocusProducer={setProducerId}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {g.items.map((ev: any) => {
                      const approved = ev.status === "APROBADO_BPA";
                      return (
                        <Card key={ev.id} className="p-4 space-y-2.5 bg-background">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-sm">{ev.crops?.crop_catalog?.name ?? "Cultivo"} — {ev.crops?.parcels?.name ?? "Parcela"}</h3>
                              <p className="text-xs text-muted-foreground">Evaluador: {ev.evaluator_name} · {new Date(ev.evaluated_at).toLocaleDateString("es-CO")}</p>
                            </div>
                            <Badge className={approved ? "border-success/30 bg-success/15 text-success" : "border-warning/40 bg-warning/15 text-warning-text"}>
                              {Number(ev.compliance_score).toFixed(0)}%
                            </Badge>
                          </div>
                          {ev.batches?.batch_code && (
                            <div className="hidden">
                              <QRCodeSVG
                                value={typeof window !== "undefined" ? `${window.location.origin}/trace/${ev.batches.batch_code}` : ev.batches.batch_code}
                                size={140}
                                level="M"
                                data-bpa-qr={ev.id}
                              />
                            </div>
                          )}
                          <div className="flex justify-end">
                            <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => void downloadOfficialBpaPdf(ev)}>
                              <Download className="size-3.5" /> Certificado PDF Oficial
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </FarmGroupSection>
              ))}
            </div>
          );
        }

        return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleEvs.map((ev: any) => {
            const approved = ev.status === "APROBADO_BPA";
            return (
              <Card key={ev.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-base">
                      {ev.crops?.crop_catalog?.name ?? "Cultivo"} — {ev.crops?.parcels?.name ?? "Parcela"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Evaluado por {ev.evaluator_name} ({ev.evaluator_role}) ·{" "}
                      {new Date(ev.evaluated_at).toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <Badge
                    className={
                      approved
                        ? "border-success/30 bg-success/15 text-success"
                        : "border-warning/40 bg-warning/15 text-warning-text"
                    }
                  >
                    {approved ? (
                      <CheckCircle2 className="size-3.5 mr-1" />
                    ) : (
                      <AlertTriangle className="size-3.5 mr-1" />
                    )}
                    {Number(ev.compliance_score).toFixed(0)}% · {approved ? "Aprobado BPA" : "Con hallazgos"}
                  </Badge>
                </div>

                {ev.batches?.batch_code && (
                  <p className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-mono">
                    <QrCode className="size-3.5 text-primary" />
                    Lote certificado: {ev.batches.batch_code}
                  </p>
                )}

                {ev.notes && <p className="text-xs text-muted-foreground">{ev.notes}</p>}

                {ev.batches?.batch_code && (
                  <div className="hidden">
                    <QRCodeSVG
                      value={typeof window !== "undefined" ? `${window.location.origin}/trace/${ev.batches.batch_code}` : ev.batches.batch_code}
                      size={140}
                      level="M"
                      data-bpa-qr={ev.id}
                    />
                  </div>
                )}
                <div className="pt-2 border-t border-border/60 flex justify-end">
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => void downloadOfficialBpaPdf(ev)}>
                    <Download className="size-3.5" />
                    Descargar Certificado PDF Oficial
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        );
      })()}
    </div>
  );
}
