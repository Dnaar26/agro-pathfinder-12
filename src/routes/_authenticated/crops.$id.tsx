import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getCrop } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Droplet, Sprout, Bug, Scissors, Package, Wheat, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/crops/$id")({
  head: () => ({ meta: [{ title: "Cultivo — SGIC" }] }),
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

function CropDetail() {
  const { id } = useParams({ from: "/_authenticated/crops/$id" });
  const crop = useQuery({ queryKey: ["crop", id], queryFn: () => getCrop(id) });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const addActivity = useMutation({
    mutationFn: async (data: z.infer<typeof activitySchema>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const { error } = await supabase.from("activities").insert({
        crop_id: id,
        responsible_id: u.user.id,
        kind: data.kind,
        performed_at: new Date(data.performed_at).toISOString(),
        notes: data.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Actividad registrada");
      qc.invalidateQueries({ queryKey: ["crop", id] });
      setOpen(false);
    },
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = activitySchema.safeParse({
      kind: fd.get("kind"),
      performed_at: fd.get("performed_at"),
      notes: (fd.get("notes") as string) || undefined,
    });
    if (!parsed.success) return toast.error("Datos inválidos");
    addActivity.mutate(parsed.data);
  }

  if (crop.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!crop.data) return <p>Cultivo no encontrado</p>;

  const activities = (crop.data as any).activities ?? [];
  const parcelId = (crop.data as any).parcels?.owner_id ? null : null; // unused; nav back below
  void parcelId;

  return (
    <div className="space-y-6">
      <Link to="/parcels/$id" params={{ id: (crop.data as any).parcel_id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 mr-1" /> Parcela
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{(crop.data as any).crop_catalog?.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sembrado el {format(new Date(crop.data.planting_date), "dd MMM yyyy")} · Cosecha estimada {format(new Date(crop.data.estimated_harvest_date), "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue={crop.data.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Actividad</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar actividad</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <DialogFooter>
                  <Button type="submit" disabled={addActivity.isPending}>Guardar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Historial de actividades</h2>
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
                      <span className="text-xs text-muted-foreground">{format(new Date(a.performed_at), "dd MMM yyyy HH:mm")}</span>
                    </div>
                    {a.notes && <p className="text-sm text-muted-foreground mt-1">{a.notes}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
