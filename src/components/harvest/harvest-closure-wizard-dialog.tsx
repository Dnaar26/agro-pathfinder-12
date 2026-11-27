import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatCurrencyInt } from "@/lib/currency";
import { exportTraceabilityCertificatePdf } from "@/lib/pdf-certificate";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QrCode,
  Scale,
  Award,
  Store,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  ExternalLink,
  Users,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

type CropStatus = Database["public"]["Enums"]["crop_status"];

export interface HarvestClosureWizardProps {
  /** Si se abre desde /crops/$id, preselecciona y fija ese cultivo */
  fixedCropId?: string;
  /** Lista opcional de cultivos ya cargados en la vista padre */
  cropsList?: any[];
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "secondary";
}

interface ClosureSuccessData {
  batchCode: string;
  verifyUrl: string;
  netKg: number;
  cropName: string;
  parcelName: string;
  producerName: string;
  harvestDate: string;
  bpaVerified: boolean;
  publishedToMarket: boolean;
}

function buildCleanBatchCode(cropName: string, cropId: string): string {
  const prefix = (cropName || "COSECHA")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || "LOTE";
  const dateCompact = format(new Date(), "yyMMdd");
  const suffix = `${cropId.slice(0, 3)}${Math.floor(100 + Math.random() * 900)}`.toUpperCase();
  return `LOTE-${prefix}-${dateCompact}-${suffix}`;
}

/**
 * Avanza el estado del cultivo respetando estrictamente la máquina de estados transaccional
 * definida en PostgreSQL (`confirm_crop_planting` y `transition_crop_status`).
 */
async function advanceCropStatusSafely(params: {
  cropId: string;
  currentStatus: CropStatus;
  plantingConfirmedAt: string | null;
  targetStatus: "KEEP" | "COSECHA" | "POSTCOSECHA" | "FINALIZADO";
}): Promise<void> {
  const { cropId, plantingConfirmedAt, targetStatus } = params;
  let cur = params.currentStatus;

  if (targetStatus === "KEEP" || cur === targetStatus || cur === "FINALIZADO") {
    return;
  }

  // 1. Si aún no tenía inicio confirmado o seguía PLANEADO, confirmar siembra primero
  if (cur === "PLANEADO" || !plantingConfirmedAt) {
    const { error: confErr } = await supabase.rpc("confirm_crop_planting", {
      p_crop_id: cropId,
    });
    if (!confErr) {
      cur = "SEMBRADO";
    }
  }

  // 2. Para llegar a COSECHA, POSTCOSECHA o FINALIZADO desde etapas vegetativas, pasar por COSECHA
  if (cur === "SEMBRADO" || cur === "CRECIMIENTO" || cur === "MANTENIMIENTO") {
    const { error: stepErr } = await supabase.rpc("transition_crop_status", {
      p_crop_id: cropId,
      p_status: "COSECHA",
    });
    if (stepErr) throw stepErr;
    cur = "COSECHA";
  }

  if (targetStatus === "COSECHA" || cur === targetStatus) return;

  // 3. De COSECHA puede pasar directo a POSTCOSECHA o FINALIZADO; de POSTCOSECHA a FINALIZADO
  if (cur === "COSECHA" && (targetStatus === "POSTCOSECHA" || targetStatus === "FINALIZADO")) {
    const { error: finalErr } = await supabase.rpc("transition_crop_status", {
      p_crop_id: cropId,
      p_status: targetStatus,
    });
    if (finalErr) throw finalErr;
    return;
  }

  if (cur === "POSTCOSECHA" && targetStatus === "FINALIZADO") {
    const { error: endErr } = await supabase.rpc("transition_crop_status", {
      p_crop_id: cropId,
      p_status: "FINALIZADO",
    });
    if (endErr) throw endErr;
  }
}

export function HarvestClosureWizardDialog({
  fixedCropId,
  cropsList,
  buttonLabel = "Cerrar cosecha + QR",
  buttonVariant = "outline",
}: HarvestClosureWizardProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedCropId, setSelectedCropId] = useState<string>(fixedCropId ?? "");

  const [grossKgInput, setGrossKgInput] = useState<string>("");
  const [shrinkagePct, setShrinkagePct] = useState<string>("0");
  const [salePriceCop, setSalePriceCop] = useState<string>("2800");
  const [harvestDate, setHarvestDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [batchCode, setBatchCode] = useState<string>("");
  const [recordInHarvests, setRecordInHarvests] = useState<boolean>(true);
  const [certifyGlobalGap, setCertifyGlobalGap] = useState<boolean>(false);
  const [publishInMarket, setPublishInMarket] = useState<boolean>(false);
  const [locationLabel, setLocationLabel] = useState<string>("Colombia");
  const [nextCropStatus, setNextCropStatus] = useState<"KEEP" | "COSECHA" | "POSTCOSECHA" | "FINALIZADO">("COSECHA");
  const [notes, setNotes] = useState<string>("");
  const [closureSuccess, setClosureSuccess] = useState<ClosureSuccessData | null>(null);

  useEffect(() => {
    if (fixedCropId) setSelectedCropId(fixedCropId);
  }, [fixedCropId]);

  // Cargar cultivos disponibles si no se suministró lista desde la vista padre
  const fallbackCropsQuery = useQuery({
    queryKey: ["closure-wizard-crops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crops")
        .select("id, status, planting_confirmed_at, crop_catalog(name), parcels(id, name, owner_id, profiles!owner_id(full_name, phone))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !cropsList && !fixedCropId,
  });

  const availableCrops = useMemo(() => {
    return cropsList ?? fallbackCropsQuery.data ?? [];
  }, [cropsList, fallbackCropsQuery.data]);

  useEffect(() => {
    if (open && !selectedCropId && availableCrops[0]?.id) {
      setSelectedCropId(availableCrops[0].id);
    }
  }, [open, selectedCropId, availableCrops]);

  // Cruce automático de 5 fuentes para el cultivo seleccionado: Cultivo + Jornales + Cosechas previas + Costos + BPA
  const reconciliationQuery = useQuery({
    queryKey: ["harvest-reconciliation", selectedCropId],
    queryFn: async () => {
      if (!selectedCropId) return null;

      const [cropRes, laborRes, harvestsRes, costsRes, bpaRes, profileRes] = await Promise.all([
        (supabase as any)
          .from("crops")
          .select("id, status, planting_date, planting_confirmed_at, crop_catalog(name), parcels(id, name, owner_id, profiles!owner_id(full_name, phone))")
          .eq("id", selectedCropId)
          .maybeSingle(),
        (supabase as any)
          .from("field_labor_logs")
          .select("id, worker_name, task_kind, payment_mode, units_worked, total_cop, paid, work_date")
          .eq("crop_id", selectedCropId)
          .then((r: any) => (r.error ? [] : r.data ?? []))
          .catch(() => []),
        supabase
          .from("crop_harvests")
          .select("id, harvested_qty, unit, total_revenue, performed_at")
          .eq("crop_id", selectedCropId),
        supabase
          .from("crop_costs")
          .select("id, total, kind")
          .eq("crop_id", selectedCropId),
        (supabase as any)
          .from("bpa_evaluations")
          .select("id, compliance_score, status, batch_id")
          .eq("crop_id", selectedCropId)
          .order("evaluated_at", { ascending: false })
          .limit(1)
          .then((r: any) => (r.error ? [] : r.data ?? []))
          .catch(() => []),
        supabase.auth.getSession().then(async ({ data: s }) => {
          const uid = s.session?.user?.id;
          if (!uid) return null;
          const { data } = await supabase.from("profiles").select("full_name, phone").eq("id", uid).maybeSingle();
          return data;
        }),
      ]);

      const laborRows = (laborRes ?? []) as any[];
      const destajoLogs = laborRows.filter((l) => l.payment_mode === "DESTAJO_KG");
      const harvestDayLogs = laborRows.filter(
        (l) => l.payment_mode === "JORNAL_DIA" && l.task_kind === "COSECHA_RECOLECCION"
      );

      const laborPickedKg = destajoLogs.reduce((sum, l) => sum + Number(l.units_worked || 0), 0);
      const harvestDaysWorked = harvestDayLogs.reduce((sum, l) => sum + Number(l.units_worked || 0), 0);
      const harvestLaborCostCop = laborRows
        .filter((l) => l.payment_mode === "DESTAJO_KG" || l.task_kind === "COSECHA_RECOLECCION")
        .reduce((sum, l) => sum + Number(l.total_cop || 0), 0);
      const unpaidHarvestLaborCop = laborRows
        .filter((l) => !l.paid && (l.payment_mode === "DESTAJO_KG" || l.task_kind === "COSECHA_RECOLECCION"))
        .reduce((sum, l) => sum + Number(l.total_cop || 0), 0);

      const collectorNames = new Set(
        laborRows
          .filter((l) => l.payment_mode === "DESTAJO_KG" || l.task_kind === "COSECHA_RECOLECCION")
          .map((l) => String(l.worker_name || "").trim().toLowerCase())
          .filter(Boolean)
      );

      const prevHarvestRows = harvestsRes.data ?? [];
      const alreadyLoggedKg = prevHarvestRows.reduce((sum, h) => {
        const q = Number(h.harvested_qty || 0);
        const u = String(h.unit || "KG").toUpperCase();
        return sum + (u === "TON" || u === "TN" ? q * 1000 : u === "SACO" ? q * 50 : q);
      }, 0);

      const unreconciledKg = Math.max(0, Math.round((laborPickedKg - alreadyLoggedKg) * 100) / 100);
      const totalAccumulatedCostsCop = (costsRes.data ?? []).reduce((s, c) => s + Number(c.total || 0), 0);
      const latestBpa = bpaRes?.[0] ?? null;
      const hasApprovedBpa = Boolean(
        latestBpa && (latestBpa.status === "APROBADO_BPA" || Number(latestBpa.compliance_score) >= 80)
      );

      return {
        crop: cropRes.data,
        callerProfile: profileRes,
        laborPickedKg: Math.round(laborPickedKg * 100) / 100,
        harvestDaysWorked: Math.round(harvestDaysWorked * 100) / 100,
        collectorsCount: collectorNames.size,
        harvestLaborCostCop: Math.round(harvestLaborCostCop),
        unpaidHarvestLaborCop: Math.round(unpaidHarvestLaborCop),
        alreadyLoggedKg: Math.round(alreadyLoggedKg * 100) / 100,
        unreconciledKg,
        totalAccumulatedCostsCop: Math.round(totalAccumulatedCostsCop),
        latestBpa,
        hasApprovedBpa,
      };
    },
    enabled: open && Boolean(selectedCropId),
  });

  // Autocompletar campos sugeridos al cargar la conciliación del cultivo elegido
  useEffect(() => {
    const rec = reconciliationQuery.data;
    if (!rec?.crop) return;

    const cropName = rec.crop.crop_catalog?.name ?? "Cosecha";
    setBatchCode(buildCleanBatchCode(cropName, rec.crop.id));
    setCertifyGlobalGap(rec.hasApprovedBpa);

    if (rec.unreconciledKg > 0) {
      setGrossKgInput(String(rec.unreconciledKg));
      setRecordInHarvests(true);
    } else if (rec.laborPickedKg > 0) {
      setGrossKgInput(String(rec.laborPickedKg));
      setRecordInHarvests(false);
    } else if (rec.alreadyLoggedKg > 0) {
      setGrossKgInput(String(rec.alreadyLoggedKg));
      setRecordInHarvests(false);
    } else {
      setGrossKgInput("500");
      setRecordInHarvests(true);
    }
  }, [reconciliationQuery.data]);

  const liveCalc = useMemo(() => {
    const grossKg = Math.max(0, Number(grossKgInput) || 0);
    const shrink = Math.min(90, Math.max(0, Number(shrinkagePct) || 0));
    const netKg = Math.round(grossKg * (1 - shrink / 100) * 100) / 100;
    const price = Math.max(0, Number(salePriceCop) || 0);
    const projectedRevenue = Math.round(netKg * price);

    const prevKg = reconciliationQuery.data?.alreadyLoggedKg ?? 0;
    const effectiveTotalHarvestKg = recordInHarvests ? prevKg + netKg : Math.max(prevKg, netKg);
    const totalCosts = reconciliationQuery.data?.totalAccumulatedCostsCop ?? 0;
    const unitCostPerKg = effectiveTotalHarvestKg > 0 ? Math.round(totalCosts / effectiveTotalHarvestKg) : 0;
    const netMarginPerKg = price - unitCostPerKg;

    return {
      grossKg,
      shrink,
      netKg,
      price,
      projectedRevenue,
      unitCostPerKg,
      netMarginPerKg,
    };
  }, [grossKgInput, shrinkagePct, salePriceCop, recordInHarvests, reconciliationQuery.data]);

  const executeClosureMutation = useMutation({
    mutationFn: async (): Promise<ClosureSuccessData> => {
      const rec = reconciliationQuery.data;
      if (!selectedCropId || !rec?.crop) {
        throw new Error("Selecciona un cultivo válido");
      }
      if (liveCalc.netKg <= 0) {
        throw new Error("El peso neto comercial del lote debe ser mayor a 0 KG");
      }
      if (!batchCode.trim()) {
        throw new Error("El código de lote trazable es obligatorio");
      }

      const { data: s } = await supabase.auth.getSession();
      const callerId = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!callerId) throw new Error("Sesión expirada");

      const cropObj = rec.crop;
      const cropName = cropObj.crop_catalog?.name ?? "Producto Agrícola";
      const parcelName = cropObj.parcels?.name ?? "Parcela";
      const ownerId = cropObj.parcels?.owner_id || callerId;
      const producerName =
        cropObj.parcels?.profiles?.full_name ||
        rec.callerProfile?.full_name ||
        "Productor SIGIC";
      const producerPhone =
        cropObj.parcels?.profiles?.phone || rec.callerProfile?.phone || null;

      const cleanCode = batchCode.trim().toUpperCase();
      const verifyUrl = `${window.location.origin}/trace/${encodeURIComponent(cleanCode)}`;
      const reconciliationSummary = [
        `Conciliación SIGIC: Bruto ${liveCalc.grossKg} KG (Merma ${liveCalc.shrink}% -> Neto ${liveCalc.netKg} KG).`,
        rec.collectorsCount > 0 ? `Cuadrilla: ${rec.collectorsCount} recolector(es).` : "",
        notes.trim(),
      ]
        .filter(Boolean)
        .join(" ");

      // 1. Registrar asiento en crop_harvests si corresponde conciliar kilos nuevos
      if (recordInHarvests) {
        const { error: harvErr } = await supabase.from("crop_harvests").insert({
          crop_id: selectedCropId,
          harvested_qty: liveCalc.netKg,
          unit: "KG",
          sale_price: liveCalc.price > 0 ? liveCalc.price : null,
          total_revenue: liveCalc.price > 0 ? liveCalc.projectedRevenue : null,
          notes: `[LOTE ${cleanCode}] ${reconciliationSummary}`.slice(0, 480),
          performed_at: new Date(`${harvestDate}T12:00:00`).toISOString(),
        });
        if (harvErr) throw harvErr;
      }

      // 2. Crear el lote oficial trazable QR en public.batches
      const { data: createdBatch, error: batchErr } = await supabase
        .from("batches")
        .insert({
          crop_id: selectedCropId,
          batch_code: cleanCode,
          harvest_date: harvestDate,
          qty: liveCalc.netKg,
          unit: "KG",
          globalgap_cert: certifyGlobalGap,
          qr_code: verifyUrl,
          notes: reconciliationSummary.slice(0, 480),
        })
        .select("id")
        .single();

      if (batchErr) {
        if (batchErr.code === "23505") {
          throw new Error("Ese código de lote ya existe. Pulsa regenerar o ajusta el sufijo.");
        }
        throw batchErr;
      }

      // Si había una auditoría BPA aprobada sin lote vinculado, asociarla al nuevo lote
      if (certifyGlobalGap && rec.latestBpa?.id && !rec.latestBpa.batch_id && createdBatch?.id) {
        await (supabase as any)
          .from("bpa_evaluations")
          .update({ batch_id: createdBatch.id })
          .eq("id", rec.latestBpa.id);
      }

      // 3. Publicar automáticamente en Vitrina Comercial (/mercado y /vitrina) si se activó
      let publishedToMarket = false;
      if (publishInMarket && liveCalc.price > 0) {
        const { error: mktErr } = await (supabase as any).from("harvest_listings").insert({
          owner_id: ownerId,
          crop_id: selectedCropId,
          batch_id: createdBatch?.id ?? null,
          farmer_display_name: producerName,
          product_name: cropName,
          available_qty: liveCalc.netKg,
          unit: "KG",
          min_order_qty: Math.max(1, Math.min(50, Math.round(liveCalc.netKg * 0.1))),
          price_per_unit: liveCalc.price,
          available_from: harvestDate,
          location_label: locationLabel.trim() || "Colombia",
          whatsapp_phone: producerPhone,
          bpa_verified: certifyGlobalGap,
          batch_code: cleanCode,
          status: "DISPONIBLE",
          notes: notes.trim() || `Cosecha fresca trazable (${cleanCode})`,
        });
        if (!mktErr) {
          publishedToMarket = true;
        }
      }

      // 4. Transicionar el estado fenológico del cultivo de forma segura
      try {
        await advanceCropStatusSafely({
          cropId: selectedCropId,
          currentStatus: cropObj.status as CropStatus,
          plantingConfirmedAt: cropObj.planting_confirmed_at ?? null,
          targetStatus: nextCropStatus,
        });
      } catch (statusErr: any) {
        toast.warning(`Lote QR creado, pero el estado no cambió: ${statusErr?.message ?? ""}`);
      }

      return {
        batchCode: cleanCode,
        verifyUrl,
        netKg: liveCalc.netKg,
        cropName,
        parcelName,
        producerName,
        harvestDate,
        bpaVerified: certifyGlobalGap,
        publishedToMarket,
      };
    },
    onSuccess: (res) => {
      setClosureSuccess(res);
      toast.success(`Cierre exitoso: Lote ${res.batchCode} generado (${res.netKg} KG)`);
      void qc.invalidateQueries({ queryKey: ["batches"] });
      void qc.invalidateQueries({ queryKey: ["crop-harvests"] });
      void qc.invalidateQueries({ queryKey: ["crop"] });
      void qc.invalidateQueries({ queryKey: ["crops"] });
      void qc.invalidateQueries({ queryKey: ["harvest-listings"] });
      void qc.invalidateQueries({ queryKey: ["public-vitrina"] });
      void qc.invalidateQueries({ queryKey: ["pnl"] });
      void qc.invalidateQueries({ queryKey: ["monthly-yield"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al ejecutar el cierre de cosecha");
    },
  });

  const handleDownloadPassportPdf = async () => {
    if (!closureSuccess) return;
    const svg = document.querySelector(
      `svg[data-closure-qr="${closureSuccess.batchCode}"]`
    ) as SVGSVGElement | null;

    await exportTraceabilityCertificatePdf({
      batchCode: closureSuccess.batchCode,
      cropName: closureSuccess.cropName,
      parcelName: closureSuccess.parcelName,
      farmName: `Unidad Productiva ${closureSuccess.producerName}`,
      producerName: closureSuccess.producerName,
      locationText: locationLabel || undefined,
      harvestDate: new Date(`${closureSuccess.harvestDate}T12:00:00`).toLocaleDateString("es-CO"),
      quantityText: `${closureSuccess.netKg.toLocaleString("es-CO")} KG`,
      bpaApproved: closureSuccess.bpaVerified,
      globalGapCertified: closureSuccess.bpaVerified,
      qrSvgElement: svg,
      verifyUrl: closureSuccess.verifyUrl,
    });
  };

  const resetWizard = () => {
    setClosureSuccess(null);
    setNotes("");
    setShrinkagePct("0");
  };

  const rec = reconciliationQuery.data;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetWizard();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={buttonVariant} className="gap-1.5 text-xs">
          <QrCode className="size-3.5 text-primary" />
          <span>{buttonLabel}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            Asistente de Cierre de Cosecha y Conciliación de Lote QR
          </DialogTitle>
        </DialogHeader>

        {!closureSuccess ? (
          <div className="space-y-4 text-xs">
            {/* Selector de cultivo si no viene fijo */}
            {!fixedCropId && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cultivo a conciliar y cerrar *</Label>
                <Select value={selectedCropId} onValueChange={setSelectedCropId}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Seleccionar cultivo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCrops.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.crop_catalog?.name ?? "Cultivo"} — {c.parcels?.name ?? "Parcela"} ({c.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Panel de Conciliación Automática Jornales <-> Cosechas <-> Costos <-> BPA */}
            {reconciliationQuery.isLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Cruzando planillas de jornales, cosechas previas y auditorías BPA…</span>
              </div>
            ) : rec ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <Card className="p-2.5 border-primary/25 bg-primary/5">
                    <p className="text-[10px] uppercase text-muted-foreground">Recolectado (Jornales)</p>
                    <p className="text-base font-bold text-primary mt-0.5 tabular-nums">
                      {rec.laborPickedKg.toLocaleString("es-CO")} KG
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Users className="size-3" /> {rec.collectorsCount} operario(s)
                    </p>
                  </Card>

                  <Card className="p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Ya asentado antes</p>
                    <p className="text-base font-bold mt-0.5 tabular-nums">
                      {rec.alreadyLoggedKg.toLocaleString("es-CO")} KG
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">En historial cosechas</p>
                  </Card>

                  <Card className="p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Saldo por conciliar</p>
                    <p className="text-base font-bold text-success mt-0.5 tabular-nums">
                      {rec.unreconciledKg.toLocaleString("es-CO")} KG
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Autocargado abajo</p>
                  </Card>

                  <Card className="p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Costo unit. real</p>
                    <p className="text-base font-bold mt-0.5 tabular-nums">
                      {liveCalc.unitCostPerKg > 0 ? `${formatCurrencyInt(liveCalc.unitCostPerKg)}/KG` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Acum: {formatCurrencyInt(rec.totalAccumulatedCostsCop)}
                    </p>
                  </Card>
                </div>

                {rec.unpaidHarvestLaborCop > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-warning-text font-medium">
                      <AlertTriangle className="size-4 shrink-0" />
                      Nota: Tienes {formatCurrencyInt(rec.unpaidHarvestLaborCop)} pendientes por pagar a recolectores de este cultivo.
                    </span>
                  </div>
                )}

                {/* Parámetros de Peso Bruto, Merma, Peso Neto y Precio */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Peso bruto campo (KG) *</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="any"
                      value={grossKgInput}
                      onChange={(e) => setGrossKgInput(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Merma / Selección (%)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="80"
                      step="0.5"
                      value={shrinkagePct}
                      onChange={(e) => setShrinkagePct(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-primary">Peso neto lote QR</Label>
                    <div className="flex h-9 items-center justify-end rounded-md border border-primary/30 bg-primary/10 px-3 font-mono font-bold text-sm text-primary tabular-nums">
                      {liveCalc.netKg.toLocaleString("es-CO")} KG
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Precio venta ($/KG)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="50"
                      value={salePriceCop}
                      onChange={(e) => setSalePriceCop(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Código único de lote QR *</Label>
                    <Input
                      value={batchCode}
                      onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Fecha oficial de cosecha</Label>
                    <Input
                      type="date"
                      value={harvestDate}
                      onChange={(e) => setHarvestDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Transición del cultivo</Label>
                    <Select
                      value={nextCropStatus}
                      onValueChange={(v) => setNextCropStatus(v as any)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COSECHA" className="text-xs">
                          En Cosecha (Continúan pases)
                        </SelectItem>
                        <SelectItem value="POSTCOSECHA" className="text-xs">
                          Pasar a Postcosecha / Beneficio
                        </SelectItem>
                        <SelectItem value="FINALIZADO" className="text-xs">
                          Finalizar ciclo del cultivo
                        </SelectItem>
                        <SelectItem value="KEEP" className="text-xs">
                          Mantener estado actual ({rec.crop?.status})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Interruptores de integración entre módulos */}
                <Card className="p-3.5 space-y-2.5 bg-muted/25">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <TrendingUp className="size-4 text-success" />
                      Ingreso proyectado del lote:{" "}
                      <strong className="text-success">{formatCurrencyInt(liveCalc.projectedRevenue)}</strong>
                    </span>
                    {liveCalc.unitCostPerKg > 0 && (
                      <Badge
                        variant="outline"
                        className={
                          liveCalc.netMarginPerKg >= 0
                            ? "border-success/40 text-success text-[10px]"
                            : "border-destructive/40 text-destructive text-[10px]"
                        }
                      >
                        Margen/KG: {liveCalc.netMarginPerKg >= 0 ? "+" : ""}
                        {formatCurrencyInt(liveCalc.netMarginPerKg)}
                      </Badge>
                    )}
                  </div>

                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span>
                      1. Registrar estos <strong>{liveCalc.netKg} KG</strong> en Cosechas e Ingresos del cultivo
                    </span>
                    <Switch checked={recordInHarvests} onCheckedChange={setRecordInHarvests} />
                  </label>

                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="flex items-center gap-1.5">
                      <Award className="size-3.5 text-emerald-600" />
                      2. Estampar sello BPA / GLOBALG.A.P. en el QR
                      {rec.hasApprovedBpa && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">
                          Auditoría BPA aprobada
                        </Badge>
                      )}
                    </span>
                    <Switch checked={certifyGlobalGap} onCheckedChange={setCertifyGlobalGap} />
                  </label>

                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="flex items-center gap-1.5">
                      <Store className="size-3.5 text-primary" />
                      3. Publicar oferta inmediata en Vitrina Comercial (/mercado y /vitrina)
                    </span>
                    <Switch checked={publishInMarket} onCheckedChange={setPublishInMarket} />
                  </label>

                  {publishInMarket && (
                    <div className="pt-1">
                      <Input
                        placeholder="Municipio / Departamento para compradores (ej: Pitalito, Huila)"
                        value={locationLabel}
                        onChange={(e) => setLocationLabel(e.target.value)}
                        className="h-8 text-xs bg-card"
                      />
                    </div>
                  )}
                </Card>
              </>
            ) : null}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!selectedCropId || liveCalc.netKg <= 0 || executeClosureMutation.isPending}
                onClick={() => executeClosureMutation.mutate()}
                className="gap-1.5"
              >
                {executeClosureMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Conciliando y generando QR…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Cerrar cosecha y generar lote QR
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="rounded-xl bg-white p-2.5 border border-border shrink-0 shadow-xs">
                <QRCodeSVG
                  value={closureSuccess.verifyUrl}
                  size={112}
                  level="M"
                  data-closure-qr={closureSuccess.batchCode}
                />
              </div>

              <div className="space-y-1.5 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Badge className="bg-success text-white text-[10px]">Lote Conciliado</Badge>
                  {closureSuccess.bpaVerified && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]">
                      <Award className="size-3 mr-1" /> BPA / GLOBALG.A.P.
                    </Badge>
                  )}
                  {closureSuccess.publishedToMarket && (
                    <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                      Publicado en Vitrina
                    </Badge>
                  )}
                </div>

                <p className="text-base font-bold font-mono text-foreground">
                  {closureSuccess.batchCode}
                </p>
                <p className="text-muted-foreground">
                  <strong>{closureSuccess.cropName}</strong> ({closureSuccess.parcelName}) · Peso neto certificado:{" "}
                  <strong>{closureSuccess.netKg.toLocaleString("es-CO")} KG</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleDownloadPassportPdf()}
                className="gap-1.5"
              >
                <Download className="size-4" /> Descargar Pasaporte PDF Oficial
              </Button>

              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/trace/$code" params={{ code: closureSuccess.batchCode }} target="_blank">
                  <ExternalLink className="size-3.5 text-primary" /> Ver página pública QR
                </Link>
              </Button>

              {closureSuccess.publishedToMarket && (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/vitrina" search={{}} target="_blank">
                    <Store className="size-3.5 text-primary" /> Abrir Vitrina
                  </Link>
                </Button>
              )}
            </div>

            <DialogFooter className="gap-2 border-t border-border/60 pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={resetWizard} className="gap-1.5 text-xs">
                <RotateCcw className="size-3.5" /> Conciliar otro lote
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
