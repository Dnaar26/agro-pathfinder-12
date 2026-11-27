import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyInt } from "@/lib/currency";
import { isLikelyOfflineNetworkError, queueMutation } from "@/lib/services/offline-sync";
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
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Trash2,
  Upload,
  Download,
  UserPlus,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export interface CrewSheetRow {
  rowId: string;
  workerName: string;
  unitsWorked: string;
  rateCop: string;
  paid: boolean;
  notes: string;
}

const LABOR_TASKS = [
  "COSECHA_RECOLECCION",
  "DESYERBE",
  "FERTILIZACION",
  "PODA",
  "CONTROL_FITOSANITARIO",
  "PREPARACION_SUELO",
  "SIEMBRA",
  "POSTCOSECHA",
] as const;

const CREW_CSV_TEMPLATE = [
  "trabajador,documento_opcional,cantidad,tarifa_cop,pagado,notas",
  "José Albeiro Muñoz,1083901234,145,750,NO,Recolección café cereza lote alto",
  "María del Carmen Rojas,1083887412,162,750,NO,Recolección café cereza selectiva",
  "Luis Eduardo Samboní,12278901,138,750,SI,Anticipo liquidado en efectivo",
  "Duván Felipe Ordóñez,1084221980,154,750,NO,Recolección sector mirador",
  "Rosa Elvira Chicangana,36289104,149,750,NO,Recolección sin frutos verdes",
  "Carlos Arturo Bolaños,1083776510,130,750,NO,Apoyo pesaje y recolección",
].join("\n");

function makeEmptyRow(defaultRate: string, defaultPaid = false, defaultUnits = "1"): CrewSheetRow {
  return {
    rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workerName: "",
    unitsWorked: defaultUnits,
    rateCop: defaultRate,
    paid: defaultPaid,
    notes: "",
  };
}

function downloadTemplateCsv(filename: string, text: string) {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseCrewCsvRows(rawText: string, fallbackRate: string): CrewSheetRow[] {
  const cleaned = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = (lines[0].match(/;/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  const headers = lines[0]
    .split(delimiter)
    .map((h) =>
      h
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
    );

  const findIdx = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const idxWorker = findIdx(["trabajador", "operario", "recolector", "nombre", "worker"]);
  const idxDoc = findIdx(["documento", "cedula", "cc", "dni"]);
  const idxQty = findIdx(["cantidad", "kilos", "kg", "jornal", "unidades", "units"]);
  const idxRate = findIdx(["tarifa", "valor", "precio", "rate"]);
  const idxPaid = findIdx(["pagado", "estado", "paid"]);
  const idxNotes = findIdx(["nota", "observacion", "concepto"]);

  if (idxWorker === -1) return [];

  const parsedRows: CrewSheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
    const name = cols[idxWorker] ?? "";
    if (name.length < 2) continue;

    const docStr = idxDoc !== -1 && cols[idxDoc] ? `C.C. ${cols[idxDoc]}` : "";
    const rawQty = idxQty !== -1 ? cols[idxQty]?.replace(",", ".") : "1";
    const qtyNum = Number(rawQty);
    const validQty = Number.isFinite(qtyNum) && qtyNum > 0 ? String(qtyNum) : "1";

    const rawRate = idxRate !== -1 ? cols[idxRate]?.replace(/[$\s]/g, "").replace(",", ".") : fallbackRate;
    const rateNum = Number(rawRate);
    const validRate = Number.isFinite(rateNum) && rateNum >= 0 ? String(rateNum) : fallbackRate;

    const paidStr = idxPaid !== -1 ? (cols[idxPaid] ?? "").toLowerCase() : "";
    const isPaid = paidStr === "si" || paidStr === "sí" || paidStr === "pagado" || paidStr === "true" || paidStr === "1";

    const extraNotes = [docStr, idxNotes !== -1 ? cols[idxNotes] : ""].filter(Boolean).join(" · ");

    parsedRows.push({
      rowId: `csv-${i}-${Math.random().toString(36).slice(2, 6)}`,
      workerName: name.slice(0, 115),
      unitsWorked: validQty,
      rateCop: validRate,
      paid: isPaid,
      notes: extraNotes.slice(0, 450),
    });
  }

  return parsedRows.slice(0, 120);
}

export interface CrewPayrollSheetDialogProps {
  crops: any[];
  frequentWorkers: string[];
  targetOwnerId?: string;
}

export function CrewPayrollSheetDialog({
  crops,
  frequentWorkers,
  targetOwnerId,
}: CrewPayrollSheetDialogProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const [cropId, setCropId] = useState<string>("");
  const [workDate, setWorkDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [taskKind, setTaskKind] = useState<string>("COSECHA_RECOLECCION");
  const [paymentMode, setPaymentMode] = useState<"JORNAL_DIA" | "DESTAJO_KG">("DESTAJO_KG");
  const [baseRateCop, setBaseRateCop] = useState<string>("750");
  const [syncToCropCosts, setSyncToCropCosts] = useState<boolean>(true);
  const [markAllPaid, setMarkAllPaid] = useState<boolean>(false);

  const [rows, setRows] = useState<CrewSheetRow[]>(() => [
    makeEmptyRow("750", false, "100"),
    makeEmptyRow("750", false, "100"),
    makeEmptyRow("750", false, "100"),
  ]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && !cropId && crops[0]?.id) {
      setCropId(crops[0].id);
    }
  };

  const applyRateToAll = (newRate: string) => {
    setRows((prev) => prev.map((r) => ({ ...r, rateCop: newRate })));
  };

  const toggleAllPaid = (checked: boolean) => {
    setMarkAllPaid(checked);
    setRows((prev) => prev.map((r) => ({ ...r, paid: checked })));
  };

  const handleModeChange = (mode: "JORNAL_DIA" | "DESTAJO_KG") => {
    setPaymentMode(mode);
    const suggestedRate = mode === "JORNAL_DIA" ? "65000" : "750";
    const suggestedUnits = mode === "JORNAL_DIA" ? "1" : "100";
    setBaseRateCop(suggestedRate);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        rateCop: suggestedRate,
        unitsWorked: !r.workerName.trim() ? suggestedUnits : r.unitsWorked,
      }))
    );
  };

  const handleLoadFrequentWorkers = () => {
    if (frequentWorkers.length === 0) {
      toast.info("Aún no tienes trabajadores frecuentes en el historial.");
      return;
    }
    const existingNames = new Set(rows.map((r) => r.workerName.trim().toLowerCase()).filter(Boolean));
    const defaultUnits = paymentMode === "JORNAL_DIA" ? "1" : "100";
    const toAdd = frequentWorkers
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .slice(0, 40)
      .map((name) => ({
        rowId: `freq-${Math.random().toString(36).slice(2, 8)}`,
        workerName: name,
        unitsWorked: defaultUnits,
        rateCop: baseRateCop,
        paid: markAllPaid,
        notes: "",
      }));

    if (toAdd.length === 0) {
      toast.info("Todos tus trabajadores frecuentes ya están en la tabla.");
      return;
    }

    setRows((prev) => {
      const nonEmpty = prev.filter((r) => r.workerName.trim().length > 0);
      return [...nonEmpty, ...toAdd];
    });
    toast.success(`${toAdd.length} trabajador(es) frecuentes cargados en la planilla`);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const imported = parseCrewCsvRows(text, baseRateCop);
    if (imported.length === 0) {
      toast.error("No se encontraron filas válidas en el CSV. Verifica la columna 'trabajador'.");
      return;
    }
    setRows(imported);
    toast.success(`${imported.length} operarios cargados desde ${file.name}`);
  };

  const validFilledRows = useMemo(() => {
    return rows.filter(
      (r) =>
        r.workerName.trim().length >= 2 &&
        Number(r.unitsWorked) > 0 &&
        Number(r.rateCop) >= 0
    );
  }, [rows]);

  const sheetSummary = useMemo(() => {
    let totalUnits = 0;
    let totalCop = 0;
    for (const r of validFilledRows) {
      const u = Math.max(0, Number(r.unitsWorked) || 0);
      const rate = Math.max(0, Number(r.rateCop) || 0);
      totalUnits += u;
      totalCop += u * rate;
    }
    return {
      workersCount: validFilledRows.length,
      totalUnits: Math.round(totalUnits * 100) / 100,
      totalCop: Math.round(totalCop),
    };
  }, [validFilledRows]);

  const saveCrewMutation = useMutation({
    mutationFn: async () => {
      if (!cropId) throw new Error("Selecciona el cultivo donde trabajó la cuadrilla");
      if (validFilledRows.length === 0) {
        throw new Error("Completa al menos un trabajador con cantidad mayor a cero");
      }

      const { data: s } = await supabase.auth.getSession();
      const callerId = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!callerId) throw new Error("Sesión expirada");

      const ownerId = targetOwnerId || callerId;
      const unitLabel = paymentMode === "JORNAL_DIA" ? "JORNAL" : "KG";
      const costDescription = `Planilla cuadrilla (${validFilledRows.length} operarios · ${sheetSummary.totalUnits} ${unitLabel}) — ${taskKind}`;

      const enqueueAllOffline = async () => {
        if (syncToCropCosts && sheetSummary.totalCop > 0) {
          await queueMutation({
            table: "crop_costs",
            action: "INSERT",
            data: {
              crop_id: cropId,
              kind: "MANO_DE_OBRA",
              description: costDescription,
              qty: sheetSummary.totalUnits,
              unit: unitLabel,
              unit_cost:
                sheetSummary.totalUnits > 0
                  ? Math.round((sheetSummary.totalCop / sheetSummary.totalUnits) * 100) / 100
                  : sheetSummary.totalCop,
              total: sheetSummary.totalCop,
            },
          });
        }

        for (const r of validFilledRows) {
          const qty = Math.round(Number(r.unitsWorked) * 100) / 100;
          const rate = Math.round(Number(r.rateCop) * 100) / 100;
          await queueMutation({
            table: "field_labor_logs",
            action: "INSERT",
            data: {
              owner_id: ownerId,
              crop_id: cropId,
              worker_name: r.workerName.trim(),
              task_kind: taskKind,
              payment_mode: paymentMode,
              units_worked: qty,
              rate_cop: rate,
              total_cop: Math.round(qty * rate * 100) / 100,
              work_date: workDate,
              paid: r.paid,
              notes: r.notes.trim() || null,
            },
          });
        }
        return { queuedOffline: true, count: validFilledRows.length };
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return enqueueAllOffline();
      }

      try {
        let linkedCostId: string | null = null;
        if (syncToCropCosts && sheetSummary.totalCop > 0) {
          const { data: costRow, error: costErr } = await supabase
            .from("crop_costs")
            .insert({
              crop_id: cropId,
              kind: "MANO_DE_OBRA",
              description: costDescription,
              qty: sheetSummary.totalUnits,
              unit: unitLabel,
              unit_cost:
                sheetSummary.totalUnits > 0
                  ? Math.round((sheetSummary.totalCop / sheetSummary.totalUnits) * 100) / 100
                  : sheetSummary.totalCop,
              total: sheetSummary.totalCop,
            })
            .select("id")
            .single();
          if (!costErr && costRow?.id) {
            linkedCostId = costRow.id;
          }
        }

        const batchPayload = validFilledRows.map((r) => {
          const qty = Math.round(Number(r.unitsWorked) * 100) / 100;
          const rate = Math.round(Number(r.rateCop) * 100) / 100;
          return {
            owner_id: ownerId,
            crop_id: cropId,
            worker_name: r.workerName.trim(),
            task_kind: taskKind,
            payment_mode: paymentMode,
            units_worked: qty,
            rate_cop: rate,
            total_cop: Math.round(qty * rate * 100) / 100,
            work_date: workDate,
            paid: r.paid,
            linked_cost_id: linkedCostId,
            notes: r.notes.trim() || null,
          };
        });

        const { error } = await (supabase as any).from("field_labor_logs").insert(batchPayload);
        if (error) throw error;

        return { queuedOffline: false, count: batchPayload.length };
      } catch (err) {
        if (isLikelyOfflineNetworkError(err)) {
          return enqueueAllOffline();
        }
        throw err;
      }
    },
    onSuccess: (res) => {
      if (res.queuedOffline) {
        toast.success(
          `Sin señal: planilla de ${res.count} operario(s) guardada en cola offline para sincronizar.`
        );
      } else {
        toast.success(
          `Planilla registrada: ${res.count} operario(s) guardados y contabilizados (${formatCurrencyInt(sheetSummary.totalCop)}).`
        );
      }
      void qc.invalidateQueries({ queryKey: ["field-labor-logs"] });
      void qc.invalidateQueries({ queryKey: ["crop-costs"] });
      void qc.invalidateQueries({ queryKey: ["pnl"] });
      setOpen(false);
      const defUnits = paymentMode === "JORNAL_DIA" ? "1" : "100";
      setRows([
        makeEmptyRow(baseRateCop, false, defUnits),
        makeEmptyRow(baseRateCop, false, defUnits),
        makeEmptyRow(baseRateCop, false, defUnits),
      ]);
      setMarkAllPaid(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al guardar la planilla de cuadrilla");
    },
  });

  const updateRow = (rowId: string, patch: Partial<CrewSheetRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.rowId !== rowId)));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="default" className="gap-1.5 shadow-xs">
          <Users className="size-4" /> Planilla de cuadrilla
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Planilla Rápida Multi-Trabajador (Liquidación de Cuadrilla)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Configuración compartida del lote y tarifa base */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-border bg-muted/25 p-3.5">
            <div className="space-y-1">
              <Label className="text-xs">Cultivo y Parcela *</Label>
              <Select value={cropId} onValueChange={setCropId}>
                <SelectTrigger className="h-9 text-xs bg-card">
                  <SelectValue placeholder="Elegir cultivo…" />
                </SelectTrigger>
                <SelectContent>
                  {crops.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.crop_catalog?.name ?? "Cultivo"} — {c.parcels?.name ?? "Parcela"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Fecha de la planilla</Label>
              <Input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="h-9 text-xs bg-card"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Labor de la cuadrilla</Label>
              <Select value={taskKind} onValueChange={setTaskKind}>
                <SelectTrigger className="h-9 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABOR_TASKS.map((tk) => (
                    <SelectItem key={tk} value={tk} className="text-xs">
                      {tk.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Modalidad y tarifa base</Label>
              <div className="flex gap-1.5">
                <Select
                  value={paymentMode}
                  onValueChange={(v) => handleModeChange(v as "JORNAL_DIA" | "DESTAJO_KG")}
                >
                  <SelectTrigger className="h-9 w-28 text-xs bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESTAJO_KG" className="text-xs">
                      Destajo (KG)
                    </SelectItem>
                    <SelectItem value="JORNAL_DIA" className="text-xs">
                      Jornal (Día)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="100"
                  value={baseRateCop}
                  onChange={(e) => setBaseRateCop(e.target.value)}
                  className="h-9 flex-1 text-xs bg-card"
                  title="Tarifa base en pesos COP"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 bg-card"
                  title="Aplicar esta tarifa a todas las filas"
                  onClick={() => applyRateToAll(baseRateCop)}
                >
                  <RefreshCw className="size-3.5 text-primary" />
                </Button>
              </div>
            </div>
          </div>

          {/* Barra de atajos: Trabajadores frecuentes + Plantilla/Carga CSV */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    makeEmptyRow(baseRateCop, markAllPaid, paymentMode === "JORNAL_DIA" ? "1" : "100"),
                  ])
                }
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="size-3.5 text-primary" /> Agregar fila
              </Button>

              {frequentWorkers.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadFrequentWorkers}
                  className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <UserPlus className="size-3.5" /> Cargar cuadrilla frecuente ({frequentWorkers.length})
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  downloadTemplateCsv("plantilla-planilla-cuadrilla-sigic.csv", CREW_CSV_TEMPLATE)
                }
                className="h-8 text-xs gap-1"
              >
                <Download className="size-3.5 text-primary" /> Plantilla CSV
              </Button>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
                <Upload className="size-3.5 text-primary" />
                Cargar CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
              </label>
            </div>
          </div>

          {/* Autocompletado nativo de trabajadores frecuentes */}
          <datalist id="sigic-frequent-workers-list">
            {frequentWorkers.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>

          {/* Tabla editable rápida de cuadrilla */}
          <div className="rounded-xl border border-border overflow-x-auto max-h-[42dvh]">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="p-2.5 w-9 text-center">#</th>
                  <th className="p-2.5 min-w-[190px]">Trabajador / Recolector *</th>
                  <th className="p-2.5 w-28 text-right">
                    {paymentMode === "JORNAL_DIA" ? "Jornales" : "Kilos (KG)"}
                  </th>
                  <th className="p-2.5 w-32 text-right">Tarifa ($ COP)</th>
                  <th className="p-2.5 w-32 text-right">Subtotal</th>
                  <th className="p-2.5 min-w-[140px]">Notas / C.C.</th>
                  <th className="p-2.5 w-20 text-center">Pagado</th>
                  <th className="p-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row, idx) => {
                  const rowSubtotal = Math.max(
                    0,
                    (Number(row.unitsWorked) || 0) * (Number(row.rateCop) || 0)
                  );
                  return (
                    <tr key={row.rowId} className="hover:bg-muted/20">
                      <td className="p-2 text-center font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">
                        <Input
                          list="sigic-frequent-workers-list"
                          placeholder="Nombre completo…"
                          value={row.workerName}
                          onChange={(e) => updateRow(row.rowId, { workerName: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0.1"
                          step="any"
                          value={row.unitsWorked}
                          onChange={(e) => updateRow(row.rowId, { unitsWorked: e.target.value })}
                          className="h-8 text-xs text-right tabular-nums"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="100"
                          value={row.rateCop}
                          onChange={(e) => updateRow(row.rowId, { rateCop: e.target.value })}
                          className="h-8 text-xs text-right tabular-nums"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-foreground tabular-nums">
                        {formatCurrencyInt(rowSubtotal)}
                      </td>
                      <td className="p-2">
                        <Input
                          placeholder="Opcional…"
                          value={row.notes}
                          onChange={(e) => updateRow(row.rowId, { notes: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.paid}
                          onChange={(e) => updateRow(row.rowId, { paid: e.target.checked })}
                          aria-label={`Marcar pagado a ${row.workerName || `fila ${idx + 1}`}`}
                          className="size-4 accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.rowId)}
                          disabled={rows.length <= 1}
                          aria-label="Quitar fila"
                          className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen financiero en vivo e interruptores contables */}
          <Card className="p-3.5 border-primary/25 bg-primary/5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span>
                  Operarios válidos: <strong className="text-foreground">{sheetSummary.workersCount}</strong>
                </span>
                <span>
                  Total {paymentMode === "JORNAL_DIA" ? "jornales" : "kilos"}:{" "}
                  <strong className="text-foreground">
                    {sheetSummary.totalUnits.toLocaleString("es-CO")}{" "}
                    {paymentMode === "JORNAL_DIA" ? "jornal(es)" : "KG"}
                  </strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground mr-2">Total planilla cuadrilla:</span>
                <span className="text-base sm:text-lg font-bold font-mono text-primary">
                  {formatCurrencyInt(sheetSummary.totalCop)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/60">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={syncToCropCosts} onCheckedChange={setSyncToCropCosts} />
                <span>Contabilizar asiento consolidado en Costos del Cultivo (MANO_DE_OBRA)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={markAllPaid} onCheckedChange={toggleAllPaid} />
                <span>Marcar toda la cuadrilla como pagada hoy</span>
              </label>
            </div>
          </Card>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={sheetSummary.workersCount === 0 || saveCrewMutation.isPending}
              onClick={() => saveCrewMutation.mutate()}
              className="gap-1.5"
            >
              {saveCrewMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Guardando cuadrilla…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" /> Guardar planilla ({sheetSummary.workersCount} operarios)
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
