import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { executeWithOfflineFallback } from "@/lib/services/offline-sync";
import { fetchWeatherForecast } from "@/lib/services/weather";
import { coordsOrDefault } from "@/lib/geo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertTriangle,
  Wind,
  Droplets,
  Plus,
  Wheat,
  DollarSign,
  ClipboardCheck,
  Send,
  Stethoscope,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface RoleFieldWorkspaceProps {
  isStaff: boolean;
  parcels: any[];
  onSelectFarmer?: (farmerId: string) => void;
}

export function RoleFieldWorkspace({
  isStaff,
  parcels,
  onSelectFarmer,
}: RoleFieldWorkspaceProps) {
  const qc = useQueryClient();

  // Estados de modales rápidos del Agricultor
  const [quickMode, setQuickMode] = useState<"activity" | "harvest" | "cost" | null>(null);
  const [selectedCropId, setSelectedCropId] = useState<string>("");
  const [actKind, setActKind] = useState<string>("RIEGO");
  const [actNotes, setActNotes] = useState<string>("");
  const [harvestQty, setHarvestQty] = useState<string>("");
  const [harvestPrice, setHarvestPrice] = useState<string>("");
  const [costKind, setCostKind] = useState<string>("INSUMOS");
  const [costAmount, setCostAmount] = useState<string>("");
  const [costDesc, setCostDesc] = useState<string>("");

  // Estados de modal de Receta / Aviso Técnico
  const [rxOpen, setRxOpen] = useState(false);
  const [rxRecipientId, setRxRecipientId] = useState("");
  const [rxKind, setRxKind] = useState("FERTILIZACION");
  const [rxTitle, setRxTitle] = useState("");
  const [rxBody, setRxBody] = useState("");

  // Cultivos activos del productor para el Cuaderno Rápido
  const farmerCropsQuery = useQuery({
    queryKey: ["workspace-active-crops"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crops")
        .select("id, status, crop_catalog(name), parcels(name)")
        .in("status", ["PLANEADO", "SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO", "COSECHA"])
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !isStaff,
  });

  // Clima de la primera parcela para el Semáforo de Aplicación Foliar/Fertilización
  const firstParcel = parcels[0];
  const coords = useMemo(
    () => coordsOrDefault(firstParcel?.latitude, firstParcel?.longitude),
    [firstParcel?.latitude, firstParcel?.longitude]
  );

  const weatherQuery = useQuery({
    queryKey: ["weather-forecast", Number(coords.lat.toFixed(3)), Number(coords.lng.toFixed(3))],
    queryFn: () => fetchWeatherForecast(coords.lat, coords.lng),
    enabled: !isStaff && parcels.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const sprayWindow = useMemo(() => {
    const today = weatherQuery.data?.daily?.[0];
    if (!today) return null;
    if (today.tempMin < 3) {
      return {
        tone: "danger" as const,
        title: "Riesgo térmico / helada hoy",
        detail: `Mínima de ${Math.round(today.tempMin)}°C: evita podas severas o aplicaciones estresantes.`,
      };
    }
    if (today.precipProb > 65 || today.wind > 18) {
      return {
        tone: "danger" as const,
        title: "Evitar fumigación o aplicación foliar hoy",
        detail:
          today.precipProb > 65
            ? `Probabilidad de lluvia del ${today.precipProb}% (${today.precip} mm): alto riesgo de lavado del insumo.`
            : `Viento fuerte (${Math.round(today.wind)} km/h): alto riesgo de deriva fuera del lote.`,
      };
    }
    if (today.precipProb >= 40 || today.wind >= 12) {
      return {
        tone: "warn" as const,
        title: "Ventana de aplicación con precaución",
        detail: `Lluvia ${today.precipProb}% · Viento ${Math.round(today.wind)} km/h. Aplica temprano en la mañana o usa adherente.`,
      };
    }
    return {
      tone: "ok" as const,
      title: "Ventana climática óptima para labores y aplicaciones",
      detail: `Baja lluvia (${today.precipProb}%) y viento favorable (${Math.round(today.wind)} km/h) en ${firstParcel?.name ?? "tu finca"}.`,
    };
  }, [weatherQuery.data, firstParcel?.name]);

  // Datos para el Radar Técnico (solo Técnico / Admin)
  const recipientsQuery = useQuery({
    queryKey: ["manual-alert-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_manual_alert_recipients");
      if (error) return [];
      return data ?? [];
    },
    enabled: isStaff,
  });

  const urgentPestsQuery = useQuery({
    queryKey: ["staff-urgent-pests-radar"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pest_incidents")
        .select("id, pest_name, severity, date, crops(crop_catalog(name), parcels(owner_id, name, profiles!owner_id(full_name)))")
        .in("severity", ["ALTA", "CRITICA"])
        .order("date", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: isStaff,
  });

  const openQuickModal = (mode: "activity" | "harvest" | "cost") => {
    if (!selectedCropId && farmerCropsQuery.data?.[0]?.id) {
      setSelectedCropId(farmerCropsQuery.data[0].id);
    }
    setQuickMode(mode);
  };

  const quickSaveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCropId) throw new Error("Selecciona el cultivo primero");
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!uid) throw new Error("Sesión expirada");

      if (quickMode === "activity") {
        const payload = {
          crop_id: selectedCropId,
          responsible_id: uid,
          kind: actKind as any,
          performed_at: new Date().toISOString(),
          notes: actNotes.trim() || null,
          photo_urls: [] as string[],
        };
        const outcome = await executeWithOfflineFallback({
          offlineMutation: { table: "activities", action: "INSERT", data: payload },
          onlineRunner: async () => {
            const { error } = await supabase.from("activities").insert(payload);
            if (error) throw error;
          },
        });
        return outcome.queuedOffline
          ? "Sin señal: labor guardada en cola offline para sincronizar al reconectar"
          : "Labor registrada en la bitácora del cultivo";
      }

      if (quickMode === "harvest") {
        const qty = Number(harvestQty);
        const price = Number(harvestPrice) || 0;
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Ingresa una cantidad cosechada válida");
        const payload = {
          crop_id: selectedCropId,
          harvested_qty: qty,
          unit: "KG",
          sale_price: price > 0 ? price : null,
          total_revenue: price > 0 ? Math.round(qty * price) : null,
          performed_at: new Date().toISOString(),
        };
        const outcome = await executeWithOfflineFallback({
          offlineMutation: { table: "crop_harvests", action: "INSERT", data: payload },
          onlineRunner: async () => {
            const { error } = await supabase.from("crop_harvests").insert(payload);
            if (error) throw error;
          },
        });
        return outcome.queuedOffline
          ? "Sin señal: cosecha guardada en cola offline"
          : "Cosecha registrada y sumada a tus ingresos";
      }

      const amount = Number(costAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Ingresa un monto válido");
      const costPayload = {
        crop_id: selectedCropId,
        kind: costKind,
        description: costDesc.trim() || `Registro rápido (${costKind})`,
        qty: 1,
        unit: "GLOBAL",
        unit_cost: amount,
        total: amount,
      };
      const outcome = await executeWithOfflineFallback({
        offlineMutation: { table: "crop_costs", action: "INSERT", data: costPayload },
        onlineRunner: async () => {
          const { error } = await supabase.from("crop_costs").insert(costPayload);
          if (error) throw error;
        },
      });
      return outcome.queuedOffline
        ? "Sin señal: gasto guardado en cola offline"
        : "Gasto registrado en la contabilidad del cultivo";
    },
    onSuccess: (msg) => {
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["pnl"] });
      qc.invalidateQueries({ queryKey: ["monthly-yield"] });
      qc.invalidateQueries({ queryKey: ["crop-health"] });
      setQuickMode(null);
      setActNotes("");
      setHarvestQty("");
      setHarvestPrice("");
      setCostAmount("");
      setCostDesc("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendPrescriptionMutation = useMutation({
    mutationFn: async () => {
      if (!rxRecipientId) throw new Error("Selecciona el agricultor destinatario");
      if (!rxTitle.trim()) throw new Error("Escribe el título de la recomendación");
      const { error } = await supabase.rpc("create_manual_alert", {
        p_recipient_id: rxRecipientId,
        p_kind: rxKind as any,
        p_title: rxTitle.trim(),
        p_body: rxBody.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recomendación técnica enviada al agricultor");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setRxOpen(false);
      setRxTitle("");
      setRxBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isStaff) {
    const hasActiveCrops = (farmerCropsQuery.data ?? []).length > 0;

    return (
      <>
        <Card className="p-4 sm:p-5 border-border bg-card space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Semáforo de Ventana Climática de Aplicación */}
            <div className="flex items-start gap-3">
              {sprayWindow?.tone === "danger" ? (
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
              ) : sprayWindow?.tone === "warn" ? (
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/20 text-warning-text">
                  <Wind className="size-5" />
                </div>
              ) : (
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-5" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">
                    {sprayWindow ? sprayWindow.title : "Cuaderno Rápido de Campo"}
                  </h2>
                  {sprayWindow && (
                    <Badge
                      variant="outline"
                      className={
                        sprayWindow.tone === "danger"
                          ? "border-destructive/40 text-destructive text-[10px]"
                          : sprayWindow.tone === "warn"
                            ? "border-warning/40 text-warning-text text-[10px]"
                            : "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px]"
                      }
                    >
                      Guía de aplicación hoy
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sprayWindow
                    ? sprayWindow.detail
                    : "Registra labores realizadas, kilos cosechados o gastos operativos en segundos sin salir del inicio."}
                </p>
              </div>
            </div>

            {/* Botones Express de 1 Clic para el Agricultor */}
            {hasActiveCrops && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openQuickModal("activity")}
                  className="gap-1.5 text-xs"
                >
                  <ClipboardCheck className="size-3.5" /> + Labor hoy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openQuickModal("harvest")}
                  className="gap-1.5 text-xs"
                >
                  <Wheat className="size-3.5 text-primary" /> + Cosecha
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openQuickModal("cost")}
                  className="gap-1.5 text-xs"
                >
                  <DollarSign className="size-3.5 text-warning-text" /> + Gasto
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Dialog open={quickMode !== null} onOpenChange={(o) => !o && setQuickMode(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {quickMode === "activity"
                  ? "Registrar Labor Rápida en Campo"
                  : quickMode === "harvest"
                    ? "Registrar Cosecha del Día"
                    : "Registrar Gasto Operativo Rápido"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                quickSaveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Cultivo *</Label>
                <Select value={selectedCropId} onValueChange={setSelectedCropId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir cultivo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(farmerCropsQuery.data ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.crop_catalog?.name ?? "Cultivo"} — {c.parcels?.name ?? "Parcela"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {quickMode === "activity" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de labor</Label>
                    <Select value={actKind} onValueChange={setActKind}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RIEGO">💧 Riego</SelectItem>
                        <SelectItem value="FERTILIZACION">🌱 Fertilización</SelectItem>
                        <SelectItem value="CONTROL_PLAGAS">🛡️ Control de plagas</SelectItem>
                        <SelectItem value="PODA">✂️ Poda / Desyerbe</SelectItem>
                        <SelectItem value="MONITOREO">👁️ Monitoreo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notas rápidas (opcional)</Label>
                    <Textarea
                      rows={2}
                      placeholder="Ej: Riego sector norte 2 horas sin novedad…"
                      value={actNotes}
                      onChange={(e) => setActNotes(e.target.value)}
                    />
                  </div>
                </>
              )}

              {quickMode === "harvest" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cantidad recolectada (KG) *</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="any"
                      placeholder="Ej: 350"
                      value={harvestQty}
                      onChange={(e) => setHarvestQty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Precio venta ($ COP/KG)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="50"
                      placeholder="Ej: 2400"
                      value={harvestPrice}
                      onChange={(e) => setHarvestPrice(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {quickMode === "cost" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rubro</Label>
                      <Select value={costKind} onValueChange={setCostKind}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INSUMOS">Insumos</SelectItem>
                          <SelectItem value="MANO_DE_OBRA">Mano de obra</SelectItem>
                          <SelectItem value="TRANSPORTE">Transporte / Flete</SelectItem>
                          <SelectItem value="RIEGO">Agua / Energía</SelectItem>
                          <SelectItem value="OTROS">Otros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor total ($ COP) *</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="100"
                        step="500"
                        placeholder="Ej: 85000"
                        value={costAmount}
                        onChange={(e) => setCostAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Concepto</Label>
                    <Input
                      placeholder="Ej: Compra de abono foliar / Flete municipal"
                      value={costDesc}
                      onChange={(e) => setCostDesc(e.target.value)}
                    />
                  </div>
                </>
              )}

              <DialogFooter>
                <Button type="submit" disabled={quickSaveMutation.isPending}>
                  Guardar ahora
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // PANEL OPERATIVO DEL TÉCNICO AGRÓNOMO / ADMIN
  const urgentCases = urgentPestsQuery.data ?? [];

  return (
    <>
      <Card className="p-4 sm:p-5 border-primary/25 bg-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Stethoscope className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                Estación de Asistencia Técnica y Recetario Agronómico
                {urgentCases.length > 0 && (
                  <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                    {urgentCases.length} foco(s) prioritario(s)
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitorea alertas fitosanitarias críticas de tus productores asignados y envíales prescripciones técnicas directas.
              </p>
            </div>
          </div>

          <Button type="button" size="sm" onClick={() => setRxOpen(true)} className="gap-1.5 text-xs shrink-0">
            <Send className="size-3.5" /> Enviar receta / recomendación
          </Button>
        </div>

        {urgentCases.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {urgentCases.slice(0, 3).map((inc: any) => {
              const farmerName = inc.crops?.parcels?.profiles?.full_name ?? "Productor";
              const ownerId = inc.crops?.parcels?.owner_id;
              return (
                <div
                  key={inc.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-destructive flex items-center gap-1 truncate">
                      <ShieldAlert className="size-3.5 shrink-0" />
                      {inc.pest_name} ({inc.severity})
                    </p>
                    <p className="text-foreground truncate">
                      {farmerName} · {inc.crops?.crop_catalog?.name ?? "Cultivo"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Lote: {inc.crops?.parcels?.name ?? "—"}
                    </p>
                  </div>
                  {ownerId && onSelectFarmer && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px] shrink-0 bg-card"
                      onClick={() => onSelectFarmer(ownerId)}
                    >
                      Inspeccionar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={rxOpen} onOpenChange={setRxOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Prescripción / Recomendación Técnica Oficial</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendPrescriptionMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Productor destinatario *</Label>
              <Select value={rxRecipientId} onValueChange={setRxRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar agricultor asignado…" />
                </SelectTrigger>
                <SelectContent>
                  {(recipientsQuery.data ?? [])
                    .filter((p: any) => p.role === "agricultor")
                    .map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoría agronómica</Label>
              <Select value={rxKind} onValueChange={setRxKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FERTILIZACION">Fertilización y Enmiendas</SelectItem>
                  <SelectItem value="RIEGO">Riego y Drenaje</SelectItem>
                  <SelectItem value="CLIMA">Manejo Fitosanitario / Clima</SelectItem>
                  <SelectItem value="COSECHA">Cosecha y Poscosecha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Título de la pauta *</Label>
              <Input
                placeholder="Ej: Aplicación preventiva contra Roya en Lote Mirador"
                value={rxTitle}
                onChange={(e) => setRxTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Dosis, producto e instrucciones</Label>
              <Textarea
                rows={3}
                placeholder="Indica ingrediente activo, dosis por hectárea/bomba, carencia y EPP…"
                value={rxBody}
                onChange={(e) => setRxBody(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={sendPrescriptionMutation.isPending}>
                Enviar al agricultor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
