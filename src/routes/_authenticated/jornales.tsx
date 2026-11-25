import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles, listAllCrops } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HardHat, Plus, Check, Download, DollarSign, Clock, Users, AlertTriangle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrencyInt } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jornales")({
  head: () => ({ meta: [{ title: "Jornales y Mano de Obra — SIGIC" }] }),
  component: FieldLaborPage,
});

const LABOR_TASKS = [
  "PREPARACION_SUELO",
  "SIEMBRA",
  "DESYERBE",
  "FERTILIZACION",
  "PODA",
  "CONTROL_FITOSANITARIO",
  "COSECHA_RECOLECCION",
  "POSTCOSECHA",
];

function exportPayrollCsv(rows: any[]) {
  const headers = ["fecha", "trabajador", "labor", "cultivo", "modalidad", "cantidad", "tarifa_cop", "total_cop", "estado_pago"];
  const lines = rows.map((r) =>
    [
      r.work_date,
      `"${String(r.worker_name || "").replace(/"/g, '""')}"`,
      r.task_kind,
      `"${String(r.crops?.crop_catalog?.name ?? "").replace(/"/g, '""')}"`,
      r.payment_mode,
      r.units_worked,
      r.rate_cop,
      r.total_cop,
      r.paid ? "PAGADO" : "PENDIENTE",
    ].join(",")
  );
  const blob = new Blob(["\uFEFF" + [headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planilla-jornales-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FieldLaborPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");

  const [cropId, setCropId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [taskKind, setTaskKind] = useState("COSECHA_RECOLECCION");
  const [paymentMode, setPaymentMode] = useState<"JORNAL_DIA" | "DESTAJO_KG">("JORNAL_DIA");
  const [unitsWorked, setUnitsWorked] = useState("1");
  const [rateCop, setRateCop] = useState("65000");
  const [workDate, setWorkDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [paidNow, setPaidNow] = useState(false);
  const [syncToCropCosts, setSyncToCropCosts] = useState(true);

  const rolesQuery = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const isReadOnlyTech =
    (rolesQuery.data ?? []).includes("tecnico") && !(rolesQuery.data ?? []).includes("admin");

  const cropsQuery = useQuery({ queryKey: ["crops"], queryFn: listAllCrops });

  const laborQuery = useQuery({
    queryKey: ["field-labor-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("field_labor_logs")
        .select("*, crops(id, crop_catalog(name), parcels(name))")
        .order("work_date", { ascending: false });
      if (error) {
        if (String(error.code) === "42P01" || String(error.code) === "PGRST205") {
          return { migrationPending: true, rows: [] as any[] };
        }
        throw error;
      }
      return { migrationPending: false, rows: (data ?? []) as any[] };
    },
  });

  const computedFormTotal = useMemo(
    () => Math.max(0, (Number(unitsWorked) || 0) * (Number(rateCop) || 0)),
    [unitsWorked, rateCop]
  );

  const addLabor = useMutation({
    mutationFn: async () => {
      if (!cropId) throw new Error("Selecciona el cultivo");
      if (!workerName.trim()) throw new Error("Ingresa el nombre del trabajador o cuadrilla");
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!uid) throw new Error("Sesión expirada");

      const qty = Math.max(0.1, Number(unitsWorked) || 1);
      const rate = Math.max(0, Number(rateCop) || 0);
      const total = Math.round(qty * rate * 100) / 100;

      let linkedCostId: string | null = null;
      if (syncToCropCosts && total > 0) {
        const { data: costRow, error: costErr } = await supabase
          .from("crop_costs")
          .insert({
            crop_id: cropId,
            kind: "MANO_DE_OBRA",
            description: `${workerName.trim()} — ${taskKind} (${paymentMode === "JORNAL_DIA" ? `${qty} jornal(es)` : `${qty} kg`})`,
            qty,
            unit: paymentMode === "JORNAL_DIA" ? "JORNAL" : "KG",
            unit_cost: rate,
            total,
          })
          .select("id")
          .single();
        if (!costErr && costRow?.id) {
          linkedCostId = costRow.id;
        }
      }

      const { error } = await (supabase as any).from("field_labor_logs").insert({
        owner_id: uid,
        crop_id: cropId,
        worker_name: workerName.trim(),
        task_kind: taskKind,
        payment_mode: paymentMode,
        units_worked: qty,
        rate_cop: rate,
        total_cop: total,
        work_date: workDate,
        paid: paidNow,
        linked_cost_id: linkedCostId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Jornal registrado y contabilizado en costos del cultivo");
      qc.invalidateQueries({ queryKey: ["field-labor-logs"] });
      qc.invalidateQueries({ queryKey: ["pnl"] });
      setOpen(false);
      setWorkerName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("field_labor_logs").update({ paid: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liquidación marcada como pagada");
      qc.invalidateQueries({ queryKey: ["field-labor-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("field_labor_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro eliminado");
      qc.invalidateQueries({ queryKey: ["field-labor-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = laborQuery.data?.rows ?? [];
  const filteredRows = useMemo(() => {
    if (statusFilter === "PENDING") return rows.filter((r: any) => !r.paid);
    if (statusFilter === "PAID") return rows.filter((r: any) => r.paid);
    return rows;
  }, [rows, statusFilter]);

  const totals = useMemo(() => {
    const totalCop = rows.reduce((s: number, r: any) => s + Number(r.total_cop || 0), 0);
    const pendingCop = rows.filter((r: any) => !r.paid).reduce((s: number, r: any) => s + Number(r.total_cop || 0), 0);
    const workersSet = new Set(rows.map((r: any) => String(r.worker_name || "").toLowerCase()));
    return { totalCop, pendingCop, workersCount: workersSet.size };
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HardHat className="size-7 text-primary" />
            Control de Jornales y Mano de Obra
          </h1>
          <p className="text-sm text-muted-foreground">
            Liquida cuadrillas por día o recolección al destajo (kg) sincronizando el gasto directo con la rentabilidad del cultivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={filteredRows.length === 0}
            onClick={() => exportPayrollCsv(filteredRows)}
            className="gap-1.5"
          >
            <Download className="size-4" /> Planilla CSV
          </Button>

          {!isReadOnlyTech && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> Registrar jornal
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Registrar Jornal o Destajo de Campo</DialogTitle>
                </DialogHeader>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addLabor.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Trabajador o cuadrilla *</Label>
                      <Input
                        placeholder="Ej: Cuadrilla Recolección Norte"
                        value={workerName}
                        onChange={(e) => setWorkerName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fecha trabajada</Label>
                      <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cultivo *</Label>
                      <Select value={cropId} onValueChange={setCropId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Elegir cultivo…" />
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
                      <Label className="text-xs">Labor ejecutada</Label>
                      <Select value={taskKind} onValueChange={setTaskKind}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LABOR_TASKS.map((tk) => (
                            <SelectItem key={tk} value={tk}>
                              {tk.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs">Modalidad</Label>
                      <Select
                        value={paymentMode}
                        onValueChange={(v) => {
                          const mode = v as "JORNAL_DIA" | "DESTAJO_KG";
                          setPaymentMode(mode);
                          setRateCop(mode === "JORNAL_DIA" ? "65000" : "700");
                        }}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="JORNAL_DIA">Jornal (Día)</SelectItem>
                          <SelectItem value="DESTAJO_KG">Destajo (KG)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{paymentMode === "JORNAL_DIA" ? "N° Jornales" : "Kilos (KG)"}</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0.1"
                        value={unitsWorked}
                        onChange={(e) => setUnitsWorked(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tarifa ($ COP)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="500"
                        min="0"
                        value={rateCop}
                        onChange={(e) => setRateCop(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total a liquidar:</span>
                      <span className="text-base font-bold text-foreground">
                        {formatCurrencyInt(computedFormTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                      <span>Cargar automáticamente en Costos del Cultivo</span>
                      <Switch checked={syncToCropCosts} onCheckedChange={setSyncToCropCosts} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Marcar como pagado hoy</span>
                      <Switch checked={paidNow} onCheckedChange={setPaidNow} />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={addLabor.isPending}>
                      Guardar registro
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="size-4 text-primary" /> Mano de obra acumulada
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrencyInt(totals.totalCop)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-4 text-warning-text" /> Pendiente por liquidar
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-warning-text">
            {formatCurrencyInt(totals.pendingCop)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="size-4 text-primary" /> Trabajadores / Cuadrillas
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totals.workersCount}</p>
        </Card>
      </div>

      {laborQuery.data?.migrationPending && (
        <Card className="p-4 border-warning/40 bg-warning/10 text-xs flex items-start gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-warning-text mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Migración de base de datos v5 pendiente</p>
            <p className="text-muted-foreground">
              Ejecuta <code className="rounded bg-background px-1.5 py-0.5">npx supabase db push</code> para activar <code className="rounded bg-background px-1.5 py-0.5">public.field_labor_logs</code>.
            </p>
          </div>
        </Card>
      )}

      <div className="flex gap-1.5">
        {[
          { id: "ALL", label: "Todos" },
          { id: "PENDING", label: "Pendientes de pago" },
          { id: "PAID", label: "Pagados" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id as any)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <Card className="p-10 text-center border-dashed space-y-2">
          <HardHat className="size-10 mx-auto text-muted-foreground" />
          <p className="font-semibold">Sin registros de jornales en esta vista</p>
          <p className="text-xs text-muted-foreground">
            Registra días trabajados o kilos recolectados para controlar la nómina rural y el costo real por cultivo.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredRows.map((r: any) => (
            <Card key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm">{r.worker_name}</span>
                  <Badge variant="outline" className="text-[11px]">
                    {r.task_kind.replace(/_/g, " ")}
                  </Badge>
                  <Badge
                    className={
                      r.paid
                        ? "bg-success/15 text-success border-success/30 text-[11px]"
                        : "bg-warning/15 text-warning-text border-warning/30 text-[11px]"
                    }
                  >
                    {r.paid ? "Pagado" : "Pendiente"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.crops?.crop_catalog?.name ?? "Cultivo"} ({r.crops?.parcels?.name ?? "Parcela"}) · Fecha: {r.work_date} ·{" "}
                  {r.units_worked} {r.payment_mode === "JORNAL_DIA" ? "jornal(es)" : "kg"} × {formatCurrencyInt(Number(r.rate_cop))}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2.5">
                <span className="text-base font-bold font-mono">{formatCurrencyInt(Number(r.total_cop))}</span>
                {!isReadOnlyTech && !r.paid && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => markPaid.mutate(r.id)}
                    className="h-8 text-xs gap-1"
                  >
                    <Check className="size-3.5 text-success" /> Liquidar
                  </Button>
                )}
                {!isReadOnlyTech && (
                  <button
                    type="button"
                    onClick={() => deleteLog.mutate(r.id)}
                    aria-label="Eliminar jornal"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
