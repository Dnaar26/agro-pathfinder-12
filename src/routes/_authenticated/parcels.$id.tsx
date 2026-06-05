import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getParcel, listCatalog } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Sprout } from "lucide-react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/parcels/$id")({
  head: () => ({ meta: [{ title: "Parcela — SGIC" }] }),
  component: ParcelDetail,
});

const cropSchema = z.object({
  catalog_id: z.number().int().positive(),
  planting_date: z.string().min(1),
});

const STATUS_LABEL: Record<string, string> = {
  PLANEADO: "Planeado", SEMBRADO: "Sembrado", CRECIMIENTO: "Crecimiento",
  MANTENIMIENTO: "Mantenimiento", COSECHA: "Cosecha", POSTCOSECHA: "Postcosecha", FINALIZADO: "Finalizado",
};

function ParcelDetail() {
  const { id } = useParams({ from: "/_authenticated/parcels/$id" });
  const parcel = useQuery({ queryKey: ["parcel", id], queryFn: () => getParcel(id) });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: listCatalog });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const createCrop = useMutation({
    mutationFn: async (input: z.infer<typeof cropSchema>) => {
      const cat = catalog.data?.find((c) => c.id === input.catalog_id);
      if (!cat) throw new Error("Cultivo inválido");
      const planting = new Date(input.planting_date);
      const harvest = addDays(planting, cat.cycle_days);
      const { error } = await supabase.from("crops").insert({
        parcel_id: id,
        catalog_id: input.catalog_id,
        planting_date: format(planting, "yyyy-MM-dd"),
        estimated_harvest_date: format(harvest, "yyyy-MM-dd"),
        status: "SEMBRADO",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cultivo registrado");
      qc.invalidateQueries({ queryKey: ["parcel", id] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = cropSchema.safeParse({
      catalog_id: Number(fd.get("catalog_id")),
      planting_date: fd.get("planting_date"),
    });
    if (!parsed.success) return toast.error("Datos inválidos");
    createCrop.mutate(parsed.data);
  }

  if (parcel.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!parcel.data) return <p>Parcela no encontrada</p>;

  const crops = (parcel.data as any).crops ?? [];

  return (
    <div className="space-y-6">
      <Link to="/parcels" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 mr-1" /> Parcelas
      </Link>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{parcel.data.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {Number(parcel.data.area_m2).toLocaleString()} m² · {(parcel.data as any).soil_types?.name ?? "Sin suelo"}
          </p>
          {parcel.data.latitude && parcel.data.longitude && (
            <p className="text-xs text-muted-foreground mt-0.5">
              GPS: {Number(parcel.data.latitude).toFixed(5)}, {Number(parcel.data.longitude).toFixed(5)}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Nuevo cultivo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar cultivo</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="catalog_id">Tipo de cultivo</Label>
                <Select name="catalog_id" required>
                  <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                  <SelectContent>
                    {(catalog.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.cycle_days} días)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planting_date">Fecha de siembra</Label>
                <Input id="planting_date" name="planting_date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createCrop.isPending}>Crear cultivo</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Cultivos</h2>
        {crops.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center">
            <Sprout className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">No hay cultivos en esta parcela.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {crops.map((c: any) => (
              <Link key={c.id} to="/crops/$id" params={{ id: c.id }} className="p-4 rounded-xl border border-border bg-card hover:border-primary transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{c.crop_catalog?.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sembrado: {format(new Date(c.planting_date), "dd MMM yyyy")} · Cosecha est.: {format(new Date(c.estimated_harvest_date), "dd MMM yyyy")}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-soft text-primary font-medium">{STATUS_LABEL[c.status]}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
