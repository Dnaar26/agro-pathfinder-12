import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getCrop, listPestIncidents, getCropPhotoUrls } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Droplet, Sprout, Bug, Scissors, Package, Wheat, Eye, ImagePlus, X, DollarSign, TrendingUp, Images, ShieldAlert, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { NdviViewer } from "@/components/ndvi/ndvi-viewer";
import { WeatherForecast } from "@/components/weather/weather-forecast";
import { BatchQR } from "@/components/traceability/batch-qr";
import { exportCostsToExcel } from "@/lib/services/excel-export";

export const Route = createFileRoute("/_authenticated/crops/$id")({
  head: () => ({ meta: [{ title: "Cultivo — SIGIC" }] }),
  component: CropDetail,
});

const KINDS = [
  { value: "RIEGO", label: "Riego", icon: Droplet },
  { value: "FERTILIZACION", label: "Fertilización", icon: Sprout },
  { value: "CONTROL_PLAGAS", label: "Control de plagas", icon: Bug },
  { value: "PODA", label: "Poda", icon: Scissors },
  { value: "INSUMOS", label: "Aplicación de insumos", icon: Package },
  { value: "COSECHA", label: "Cosecha", icon: Wheat },
  { value: "MONITOREO", label: "Monitoreo", icon: Eye },
] as const;

const STATUSES = ["PLANEADO","SEMBRADO","CRECIMIENTO","MANTENIMIENTO","COSECHA","POSTCOSECHA","FINALIZADO"] as const;

const activitySchema = z.object({
  kind: z.enum(["RIEGO","FERTILIZACION","CONTROL_PLAGAS","PODA","INSUMOS","COSECHA","MONITOREO"]),
  performed_at: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

const costSchema = z.object({
  id: z.string().optional(),
  kind: z.string().min(1),
  description: z.string().max(500).optional(),
  qty: z.number().positive().optional(),
  unit: z.string().optional(),
  unit_cost: z.number().positive(),
  total: z.number().positive().optional(),
});

const harvestSchema = z.object({
  harvested_qty: z.number().positive(),
  unit: z.string().default("KG"),
  sale_price: z.number().positive().optional(),
  total_revenue: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
  performed_at: z.string().min(1),
});

async function detectImageType(file: File): Promise<{ mime: string; ext: string } | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) return { mime: "image/gif", ext: "gif" };
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

async function uploadEvidences(files: File[], cropId: string): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sesión expirada");
  const paths: string[] = [];
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} supera 5 MB`);
    const detected = await detectImageType(file);
    if (!detected) throw new Error(`El archivo ${file.name} no es una imagen válida`);
    const path = `${u.user.id}/${cropId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${detected.ext}`;
    const { error } = await supabase.storage.from("evidences").upload(path, file, {
      contentType: detected.mime,
      upsert: false,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

function CropDetail() {
  const { id } = useParams({ from: "/_authenticated/crops/$id" });
  const crop = useQuery({ queryKey: ["crop", id], queryFn: () => getCrop(id) });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [tab, setTab] = useState("activities");
  const [pestOpen, setPestOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: string; id?: string } | null>(null);

  const costs = useQuery({
    queryKey: ["crop-costs", id],
    queryFn: async () => {
      const { data } = await supabase.from("crop_costs").select("*").eq("crop_id", id).order("created_at");
      return data ?? [];
    },
  });

  const harvests = useQuery({
    queryKey: ["crop-harvests", id],
    queryFn: async () => {
      const { data } = await supabase.from("crop_harvests").select("*").eq("crop_id", id).order("performed_at");
      return data ?? [];
    },
  });

  const pests = useQuery({
    queryKey: ["pests", id],
    queryFn: () => listPestIncidents(id),
  });

  const allPhotos = useQuery({
    queryKey: ["crop-photos", id],
    queryFn: () => getCropPhotoUrls(id),
  });

  const addPest = useMutation({
    mutationFn: async (data: { pest_name: string; severity: string; treatment: string; date: string; notes: string }) => {
      const { error } = await supabase.from("pest_incidents").insert({ crop_id: id, ...data });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pests", id] }); setPestOpen(false); toast.success("Plaga registrada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePest = useMutation({
    mutationFn: async (pestId: string) => {
      const { error } = await supabase.from("pest_incidents").delete().eq("id", pestId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pests", id] }); toast.success("Registro eliminado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addActivity = useMutation({
    mutationFn: async (data: z.infer<typeof activitySchema>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const photo_urls = files.length > 0 ? await uploadEvidences(files, id) : [];
      const { error } = await supabase.from("activities").insert({
        crop_id: id,
        responsible_id: u.user.id,
        kind: data.kind,
        performed_at: new Date(data.performed_at).toISOString(),
        notes: data.notes ?? null,
        photo_urls,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Actividad registrada");
      qc.invalidateQueries({ queryKey: ["crop", id] });
      setOpen(false);
      setFiles([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCost = useMutation({
    mutationFn: async (data: z.infer<typeof costSchema>) => {
      const total = data.total ?? (data.qty && data.unit_cost ? data.qty * data.unit_cost : data.unit_cost);
      const { error } = await supabase.from("crop_costs").insert({ crop_id: id, ...data, total });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crop-costs", id] }); setCostOpen(false); toast.success("Costo registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const editCost = useMutation({
    mutationFn: async (data: z.infer<typeof costSchema>) => {
      if (!data.id) throw new Error("ID requerido");
      const total = data.total ?? (data.qty && data.unit_cost ? data.qty * data.unit_cost : data.unit_cost);
      const { error } = await supabase.from("crop_costs").update({ ...data, total }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crop-costs", id] }); setEditingCost(null); setCostOpen(false); toast.success("Costo actualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editingCost, setEditingCost] = useState<any>(null);
  const [editingHarvest, setEditingHarvest] = useState<any>(null);
  const [cropEditOpen, setCropEditOpen] = useState(false);
  const [costPreview, setCostPreview] = useState({ qty: "", unitCost: "" });
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const addHarvest = useMutation({
    mutationFn: async (data: z.infer<typeof harvestSchema>) => {
      const { error } = await supabase.from("crop_harvests").insert({
        crop_id: id,
        harvested_qty: data.harvested_qty,
        unit: data.unit || "KG",
        sale_price: data.sale_price ?? null,
        total_revenue: data.total_revenue ?? (data.sale_price ? data.harvested_qty * data.sale_price : null),
        notes: data.notes ?? null,
        performed_at: new Date(data.performed_at).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crop-harvests", id] }); setHarvestOpen(false); toast.success("Cosecha registrada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const editHarvest = useMutation({
    mutationFn: async (data: z.infer<typeof harvestSchema> & { id: string }) => {
      const { error } = await supabase.from("crop_harvests").update({
        harvested_qty: data.harvested_qty,
        unit: data.unit || "KG",
        sale_price: data.sale_price ?? null,
        total_revenue: data.total_revenue ?? (data.sale_price ? data.harvested_qty * data.sale_price : null),
        notes: data.notes ?? null,
        performed_at: new Date(data.performed_at).toISOString(),
      }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crop-harvests", id] }); setEditingHarvest(null); setHarvestOpen(false); toast.success("Cosecha actualizada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteActivity = useMutation({
    mutationFn: async (actId: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crop", id] }); toast.success("Actividad eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCost = useMutation({
    mutationFn: async (costId: string) => {
      const { error } = await supabase.from("crop_costs").delete().eq("id", costId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crop-costs", id] }); toast.success("Costo eliminado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteHarvest = useMutation({
    mutationFn: async (hId: string) => {
      const { error } = await supabase.from("crop_harvests").delete().eq("id", hId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crop-harvests", id] }); toast.success("Cosecha eliminada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCrop = useMutation({
    mutationFn: async (data: { crop_catalog_id?: number; planting_date?: string; estimated_harvest_date?: string; notes?: string }) => {
      const { error } = await supabase.from("crops").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cultivo actualizado");
      qc.invalidateQueries({ queryKey: ["crop", id] });
      setCropEditOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCrop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crops").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cultivo eliminado"); window.history.back(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("crops").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["crop", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmPlanting = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crops").update({
        status: "SEMBRADO",
        planting_confirmed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inicio de siembra confirmado");
      qc.invalidateQueries({ queryKey: ["crop", id] });
      qc.invalidateQueries({ queryKey: ["crops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activitySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = activitySchema.safeParse({
      kind: fd.get("kind"),
      performed_at: fd.get("performed_at"),
      notes: (fd.get("notes") as string) || undefined,
    });
    if (!parsed.success) return toast.error("Datos inválidos");
    addActivity.mutate(parsed.data);
  };

  function handleDelete() {
    if (!deleteConfirm) return;
    const { kind, id } = deleteConfirm;
    if (kind === "crop") deleteCrop.mutate();
    else if (kind === "activity") deleteActivity.mutate(id!);
    else if (kind === "cost") deleteCost.mutate(id!);
    else if (kind === "harvest") deleteHarvest.mutate(id!);
    else if (kind === "pest") deletePest.mutate(id!);
    setDeleteConfirm(null);
  }

  if (crop.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!crop.data) return <p>Cultivo no encontrado</p>;

  const activities = (crop.data as any).activities ?? [];
  const totalCost = costs.data?.reduce((s, c) => s + Number(c.total), 0) ?? 0;
  const totalRevenue = harvests.data?.reduce((s, h) => s + Number(h.total_revenue || 0), 0) ?? 0;
  const margin = totalRevenue - totalCost;

  return (
    <div className="space-y-6">
      <Link to="/parcels/$id" params={{ id: (crop.data as any).parcel_id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 mr-1" /> Parcela
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
            <div>
            <h1 className="text-3xl font-bold">{(crop.data as any).crop_catalog?.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sembrado el {format(new Date(crop.data.planting_date + "T12:00:00"), "dd MMM yyyy")} · Cosecha estimada {format(new Date(crop.data.estimated_harvest_date + "T12:00:00"), "dd MMM yyyy")}
            </p>
            {(crop.data as any).parcels?.profiles?.full_name && <p className="text-xs text-primary mt-1 flex items-center gap-1"><User className="size-3" /> Agricultor: {(crop.data as any).parcels.profiles.full_name}</p>}
          </div>
          <Button variant="ghost" size="icon" className="size-7 mt-1" onClick={() => setCropEditOpen(true)} title="Editar cultivo">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </Button>
          <Button variant="ghost" size="icon" className="size-7 mt-1 text-destructive" onClick={() => setDeleteConfirm({ kind: "crop" })} title="Eliminar cultivo">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </Button>
        </div>
         <div className="flex items-center gap-2">
           {crop.data.status === "PLANEADO" && !crop.data.planting_confirmed_at && crop.data.planting_date <= format(new Date(), "yyyy-MM-dd") && (
             <Button size="sm" onClick={() => confirmPlanting.mutate()} disabled={confirmPlanting.isPending}>
               Confirmar inicio
             </Button>
           )}
          <Select defaultValue={crop.data.status} onValueChange={(v) => { if (v !== crop.data.status && v !== "PLANEADO") setPendingStatus(v); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFiles([]); }}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Actividad</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar actividad</DialogTitle></DialogHeader>
              <form onSubmit={activitySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="kind">Tipo</Label>
                  <Select name="kind" required>
                    <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="performed_at">Fecha y hora</Label>
                  <Input id="performed_at" name="performed_at" type="datetime-local" required defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observaciones</Label>
                  <Textarea id="notes" name="notes" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><ImagePlus className="size-4" /> Foto-evidencias</Label>
                  <Input type="file" accept="image/*" multiple capture="environment" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                  {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} archivo(s) seleccionados (máx 5 MB c/u)</p>}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addActivity.isPending}>{addActivity.isPending ? "Guardando…" : "Guardar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Edit crop dialog */}
      <Dialog open={cropEditOpen} onOpenChange={setCropEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar cultivo</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); updateCrop.mutate({ planting_date: fd.get("planting_date") as string, estimated_harvest_date: fd.get("estimated_harvest_date") as string, notes: (fd.get("notes") as string) || undefined }); }} className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo de cultivo</Label>
              <p className="text-sm text-muted-foreground">{(crop.data as any).crop_catalog?.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="planting_date">Fecha de siembra</Label>
                <Input id="planting_date" name="planting_date" type="date" required defaultValue={format(new Date(crop.data.planting_date + "T12:00:00"), "yyyy-MM-dd")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_harvest_date">Cosecha estimada</Label>
                <Input id="estimated_harvest_date" name="estimated_harvest_date" type="date" required defaultValue={format(new Date(crop.data.estimated_harvest_date + "T12:00:00"), "yyyy-MM-dd")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={(crop.data as any).notes ?? ""} />
            </div>
            <DialogFooter><Button type="submit" disabled={updateCrop.isPending}>Guardar cambios</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Profitability summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Costo total</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-600">$ {totalCost.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Ingreso total</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-600">$ {totalRevenue.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Margen</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
            {margin >= 0 ? "+" : ""}$ {margin.toFixed(2)}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="activities">Actividades</TabsTrigger>
          <TabsTrigger value="costs"><DollarSign className="size-3.5 mr-1" />Costos</TabsTrigger>
          <TabsTrigger value="harvests"><TrendingUp className="size-3.5 mr-1" />Cosechas</TabsTrigger>
          <TabsTrigger value="weather"><Droplet className="size-3.5 mr-1" />Clima</TabsTrigger>
          <TabsTrigger value="ndvi"><Sprout className="size-3.5 mr-1" />NDVI</TabsTrigger>
          <TabsTrigger value="pests"><ShieldAlert className="size-3.5 mr-1" />Plagas</TabsTrigger>
          <TabsTrigger value="gallery"><Images className="size-3.5 mr-1" />Galería</TabsTrigger>
          <TabsTrigger value="trace">QR</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-4">
          {activities.length === 0 ? (
            <div className="p-8 border border-dashed border-border rounded-xl text-center">
              <p className="text-muted-foreground">Sin actividades registradas.</p>
            </div>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-4">
              {activities.sort((a: any, b: any) => +new Date(b.performed_at) - +new Date(a.performed_at)).map((a: any) => {
                const def = KINDS.find((k) => k.value === a.kind);
                const Icon = def?.icon ?? Sprout;
                return (
                  <li key={a.id} className="ml-6">
                    <span className="absolute -left-3 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                      <Icon className="size-3" />
                    </span>
                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between">
                            <span className="font-medium">{def?.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{format(new Date(a.performed_at), "dd MMM yyyy HH:mm")}</span>
                              <button onClick={() => setDeleteConfirm({ kind: "activity", id: a.id })} className="text-destructive hover:text-destructive/80 text-xs" title="Eliminar">×</button>
                            </div>
                      </div>
                      {a.notes && <p className="text-sm text-muted-foreground mt-1">{a.notes}</p>}
                      {Array.isArray(a.photo_urls) && a.photo_urls.length > 0 && <EvidenceGallery paths={a.photo_urls} />}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="costs" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Costos registrados ({costs.data?.length ?? 0})</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCostsToExcel(costs.data ?? [], harvests.data ?? [])}>Exportar CSV</Button>
              <Dialog open={costOpen} onOpenChange={(v) => { setCostOpen(v); if (!v) setEditingCost(null); }}>
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Agregar costo</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingCost ? "Editar costo" : "Registrar costo"}</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const qty = fd.get("qty") ? Number(fd.get("qty")) : undefined; const unit_cost = Number(fd.get("unit_cost")); const total = qty && unit_cost ? qty * unit_cost : unit_cost; const data = { id: editingCost?.id, kind: fd.get("kind") as string, description: (fd.get("description") as string) || undefined, qty, unit: (fd.get("unit") as string) || undefined, unit_cost, total }; if (editingCost) editCost.mutate(data); else addCost.mutate(data); }} className="space-y-3">
                    <Select name="kind" required defaultValue={editingCost?.kind ?? ""}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        {["INSUMOS", "MANO_OBRA", "MAQUINARIA", "TRANSPORTE", "OTROS"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input name="description" placeholder="Descripción (ej. Fertilizante foliar)" defaultValue={editingCost?.description ?? ""} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="qty" type="number" step="any" inputMode="decimal" placeholder="Cantidad" defaultValue={editingCost?.qty ?? ""} onInput={(e) => setCostPreview((p) => ({ ...p, qty: (e.target as HTMLInputElement).value }))} />
                      <Input name="unit" placeholder="Unidad (kg, ha, jornal)" defaultValue={editingCost?.unit ?? ""} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="unit_cost" type="number" step="any" inputMode="decimal" placeholder="Costo unitario $" required defaultValue={editingCost?.unit_cost ?? ""} onInput={(e) => setCostPreview((p) => ({ ...p, unitCost: (e.target as HTMLInputElement).value }))} />
                      <div className="flex items-center justify-end px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm font-medium tabular-nums">
                        Total: $ {(Number(costPreview.qty || editingCost?.qty || 0) * Number(costPreview.unitCost || editingCost?.unit_cost || 0)).toFixed(2) || "—"}
                      </div>
                    </div>
                    <DialogFooter><Button type="submit">{editingCost ? "Actualizar" : "Guardar"}</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {(costs.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin costos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-muted-foreground text-xs uppercase"><th className="text-left p-2">Tipo</th><th className="text-left p-2">Descripción</th><th className="text-right p-2">Cant.</th><th className="text-right p-2">Costo unit.</th><th className="text-right p-2">Total</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {costs.data?.map((c) => (
                    <tr key={c.id} className="border-b border-border"><td className="p-2">{c.kind}</td><td className="p-2 text-muted-foreground">{c.description || "—"}</td><td className="p-2 text-right">{c.qty ? `${c.qty} ${c.unit || ""}` : "—"}</td><td className="p-2 text-right">$ {Number(c.unit_cost).toFixed(2)}</td><td className="p-2 text-right font-medium">$ {Number(c.total).toFixed(2)}</td><td className="p-2 whitespace-nowrap"><button onClick={() => { setEditingCost(c); setCostOpen(true); }} className="text-primary hover:text-primary/80 text-xs mr-2">Editar</button><button onClick={() => setDeleteConfirm({ kind: "cost", id: c.id })} className="text-destructive hover:text-destructive/80 text-xs">×</button></td></tr>
                  ))}
                  <tr className="font-medium"><td colSpan={4} className="p-2 text-right">Total</td><td className="p-2 text-right">$ {totalCost.toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="harvests" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Cosechas registradas ({harvests.data?.length ?? 0})</p>
            <Dialog open={harvestOpen} onOpenChange={(v) => { setHarvestOpen(v); if (!v) setEditingHarvest(null); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Registrar cosecha</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingHarvest ? "Editar cosecha" : "Registrar cosecha"}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = { harvested_qty: Number(fd.get("harvested_qty")), unit: (fd.get("unit") as string) || "KG", sale_price: fd.get("sale_price") ? Number(fd.get("sale_price")) : undefined, total_revenue: fd.get("total_revenue") ? Number(fd.get("total_revenue")) : undefined, notes: (fd.get("notes") as string) || undefined, performed_at: fd.get("performed_at") as string }; if (editingHarvest) editHarvest.mutate({ ...data, id: editingHarvest.id }); else addHarvest.mutate(data); }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input name="harvested_qty" type="number" step="any" inputMode="decimal" placeholder="Cantidad cosechada" required defaultValue={editingHarvest?.harvested_qty ?? ""} />
                    <Select name="unit" defaultValue={editingHarvest?.unit ?? "KG"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="KG">KG</SelectItem><SelectItem value="TN">TN</SelectItem><SelectItem value="SACO">SACO</SelectItem></SelectContent></Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input name="sale_price" type="number" step="any" inputMode="decimal" placeholder="Precio venta unit. $" defaultValue={editingHarvest?.sale_price ?? ""} />
                    <Input name="total_revenue" type="number" step="any" inputMode="decimal" placeholder="Ingreso total $ (auto)" defaultValue={editingHarvest?.total_revenue ?? ""} />
                  </div>
                  <Input name="performed_at" type="date" required defaultValue={editingHarvest ? format(new Date(editingHarvest.performed_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} />
                  <Input name="notes" placeholder="Notas" defaultValue={editingHarvest?.notes ?? ""} />
                  <DialogFooter><Button type="submit">{editingHarvest ? "Actualizar" : "Guardar"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {(harvests.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cosechas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-muted-foreground text-xs uppercase"><th className="text-left p-2">Fecha</th><th className="text-right p-2">Cantidad</th><th className="text-right p-2">Precio venta</th><th className="text-right p-2">Ingreso</th><th className="text-left p-2">Notas</th><th className="p-2"></th></tr></thead>
                <tbody>
                  {harvests.data?.map((h) => (
                    <tr key={h.id} className="border-b border-border"><td className="p-2">{format(new Date(h.performed_at), "dd MMM yyyy")}</td><td className="p-2 text-right">{Number(h.harvested_qty).toFixed(1)} {h.unit}</td><td className="p-2 text-right">{h.sale_price ? `$ ${Number(h.sale_price).toFixed(2)}` : "—"}</td><td className="p-2 text-right font-medium text-green-600">$ {Number(h.total_revenue || 0).toFixed(2)}</td><td className="p-2 text-muted-foreground">{h.notes || "—"}</td><td className="p-2 whitespace-nowrap"><button onClick={() => { setEditingHarvest(h); setHarvestOpen(true); }} className="text-primary hover:text-primary/80 text-xs mr-2">Editar</button><button onClick={() => setDeleteConfirm({ kind: "harvest", id: h.id })} className="text-destructive hover:text-destructive/80 text-xs">×</button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="weather" className="mt-4">
          <Card className="p-4"><WeatherForecast lat={Number((crop.data as any).parcels?.latitude) || -16.5} lng={Number((crop.data as any).parcels?.longitude) || -68.15} parcelName={(crop.data as any).crop_catalog?.name} /></Card>
        </TabsContent>

        <TabsContent value="ndvi" className="mt-4">
          <NdviViewer parcelId={(crop.data as any).parcel_id} />
        </TabsContent>

        <TabsContent value="pests" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Incidencias de plagas ({pests.data?.length ?? 0})</p>
            <Dialog open={pestOpen} onOpenChange={setPestOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Registrar plaga</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar incidencia de plaga</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addPest.mutate({ pest_name: fd.get("pest_name") as string, severity: fd.get("severity") as string, treatment: (fd.get("treatment") as string) || "", date: fd.get("date") as string, notes: (fd.get("notes") as string) || "" }); }} className="space-y-3">
                    <Input name="pest_name" placeholder="Nombre de la plaga/enfermedad (ej. Roya, Oídio)" required />
                  <Select name="severity" defaultValue="MEDIA"><SelectTrigger><SelectValue placeholder="Severidad" /></SelectTrigger><SelectContent><SelectItem value="BAJA">Baja</SelectItem><SelectItem value="MEDIA">Media</SelectItem><SelectItem value="ALTA">Alta</SelectItem><SelectItem value="CRITICA">Crítica</SelectItem></SelectContent></Select>
                  <Input name="treatment" placeholder="Tratamiento aplicado" />
                  <Input name="date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} />
                  <Textarea name="notes" placeholder="Notas adicionales" rows={2} />
                  <DialogFooter><Button type="submit" disabled={addPest.isPending}>Guardar</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {(pests.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin incidencias registradas.</p>
          ) : (
            <div className="space-y-2">
              {pests.data?.map((p: any) => (
                <div key={p.id} className="p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-destructive" />
                      <span className="font-medium">{p.pest_name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.severity === "CRITICA" ? "bg-red-100 text-red-700" : p.severity === "ALTA" ? "bg-orange-100 text-orange-700" : p.severity === "MEDIA" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>{p.severity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(p.date + "T12:00:00"), "dd MMM yyyy")}</span>
                      <button onClick={() => setDeleteConfirm({ kind: "pest", id: p.id })} className="text-destructive hover:text-destructive/80 text-xs">×</button>
                    </div>
                  </div>
                  {p.treatment && <p className="text-sm text-muted-foreground mt-1">Tratamiento: {p.treatment}</p>}
                  {p.notes && <p className="text-sm text-muted-foreground mt-1">{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gallery" className="mt-4">
          <p className="text-sm font-medium mb-3">Fotos de actividades</p>
          {allPhotos.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (allPhotos.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin fotos aún. Las fotos se agregan al registrar actividades.</p>
          ) : (
            <PhotoGallery activities={allPhotos.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="trace" className="mt-4">
          <BatchQR cropId={id} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => { if (!o) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar estado del cultivo</AlertDialogTitle>
            <AlertDialogDescription>¿Cambiar estado de <strong>{(crop.data as any)?.crop_catalog?.name}</strong> a <strong>{pendingStatus}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingStatus) updateStatus.mutate(pendingStatus); setPendingStatus(null); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.kind === "crop" && "¿Eliminar este cultivo y todos sus datos? Esta acción no se puede deshacer."}
              {deleteConfirm?.kind === "activity" && "¿Eliminar esta actividad?"}
              {deleteConfirm?.kind === "cost" && "¿Eliminar este costo?"}
              {deleteConfirm?.kind === "harvest" && "¿Eliminar esta cosecha?"}
              {deleteConfirm?.kind === "pest" && "¿Eliminar este registro de plaga?"}
              {!deleteConfirm && "¿Estás seguro?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EvidenceGallery({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage.from("evidences").createSignedUrls(paths, 3600);
      if (cancelled || error) return;
      setUrls((data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u));
    })();
    return () => { cancelled = true; };
  }, [paths]);

  if (urls.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <button key={i} type="button" onClick={() => setPreview(u)} className="size-16 rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary transition">
            <img src={u} alt={`Evidencia ${i + 1}`} className="size-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          <button onClick={() => setPreview(null)} className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1"><X className="size-4" /></button>
          {preview && <img src={preview} alt="Evidencia ampliada" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PhotoGallery({ activities }: { activities: any[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  const allPaths = useMemo(() => activities.flatMap((a: any) => a.photo_urls ?? []).filter(Boolean), [activities]);

  return (
    <>
      <div className="columns-2 sm:columns-3 gap-3 space-y-3">
        {allPaths.map((path: string, i: number) => (
          <SignedImage key={path} path={path} index={i} onClick={setPreview} />
        ))}
      </div>
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          <button onClick={() => setPreview(null)} className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1"><X className="size-4" /></button>
          {preview && <img src={preview} alt="Foto" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SignedImage({ path, index, onClick }: { path: string; index: number; onClick: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage.from("evidences").createSignedUrl(path, 3600).then(({ data }) => { if (!cancelled && data) setUrl(data.signedUrl); });
    return () => { cancelled = true; };
  }, [path]);
  if (!url) return <div className="w-full h-24 rounded-lg bg-muted animate-pulse" />;
  return (
    <button type="button" onClick={() => onClick(url)} className="break-inside-avoid rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary transition block">
      <img src={url} alt={`Foto ${index + 1}`} className="w-full h-auto object-cover" loading="lazy" />
    </button>
  );
}
