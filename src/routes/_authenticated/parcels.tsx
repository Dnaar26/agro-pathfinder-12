import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listParcels, listSoils } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Search, Ruler, Sprout, ExternalLink } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/parcels")({
  head: () => ({ meta: [{ title: "Parcelas — SGIC" }] }),
  component: ParcelsPage,
});

const parcelSchema = z.object({
  name: z.string().trim().min(2).max(120),
  area_m2: z.number().positive().max(100_000_000),
  soil_type_id: z.number().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(1000).optional(),
});

function ParcelsPage() {
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const soils = useQuery({ queryKey: ["soils"], queryFn: listSoils });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async (data: z.infer<typeof parcelSchema>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const { error } = await supabase.from("parcels").insert({ ...data, owner_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela creada");
      qc.invalidateQueries({ queryKey: ["parcels"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = parcelSchema.safeParse({
      name: fd.get("name"),
      area_m2: Number(fd.get("area_m2")),
      soil_type_id: fd.get("soil_type_id") ? Number(fd.get("soil_type_id")) : undefined,
      latitude: fd.get("latitude") ? Number(fd.get("latitude")) : undefined,
      longitude: fd.get("longitude") ? Number(fd.get("longitude")) : undefined,
      notes: (fd.get("notes") as string) || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate(parsed.data);
  }

  function useGPS(setter: (lat: number, lng: number) => void) {
    if (!navigator.geolocation) return toast.error("GPS no disponible");
    navigator.geolocation.getCurrentPosition(
      (pos) => setter(pos.coords.latitude, pos.coords.longitude),
      (err) => toast.error(err.message),
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Parcelas</h1>
          <p className="text-sm text-muted-foreground">Gestiona las áreas de cultivo.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Nueva parcela</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva parcela</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="area_m2">Área (m²)</Label>
                  <Input id="area_m2" name="area_m2" type="number" min="1" step="any" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soil_type_id">Tipo de suelo</Label>
                  <Select name="soil_type_id">
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {(soils.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitud</Label>
                  <Input id="latitude" name="latitude" type="number" step="any" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitud</Label>
                  <Input id="longitude" name="longitude" type="number" step="any" />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => useGPS((lat, lng) => {
                const lats = document.getElementById("latitude") as HTMLInputElement;
                const lngs = document.getElementById("longitude") as HTMLInputElement;
                lats.value = String(lat); lngs.value = String(lng);
              })}>
                <MapPin className="size-4 mr-1" /> Usar mi ubicación
              </Button>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>Crear</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {parcels.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (parcels.data ?? []).length === 0 ? (
        <div className="p-10 border border-dashed border-border rounded-xl text-center">
          <MapPin className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No tienes parcelas registradas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(parcels.data ?? []).map((p) => (
            <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} className="p-5 rounded-xl border border-border bg-card hover:border-primary transition-colors">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <MapPin className="size-4 text-muted-foreground" />
              </div>
              <dl className="mt-3 text-sm space-y-1 text-muted-foreground">
                <div><span className="text-foreground font-medium">{Number(p.area_m2).toLocaleString()}</span> m²</div>
                <div>{(p as any).soil_types?.name ?? "Sin suelo"}</div>
                {p.latitude && p.longitude && (
                  <div className="text-xs">{Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}</div>
                )}
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
