import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listParcels, listParcelsPage, listSoils } from "@/lib/queries";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Search, Ruler, Sprout, ExternalLink, MoreHorizontal, Edit, Trash2, User, LoaderCircle } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/parcels")({
  head: () => ({ meta: [{ title: "Parcelas — SIGIC" }] }),
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
  const [page, setPage] = useState(1);
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const parcelsPage = useQuery({ queryKey: ["parcels", "page", page], queryFn: () => listParcelsPage({ page, pageSize: 18 }) });
  const soils = useQuery({ queryKey: ["soils"], queryFn: listSoils });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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

  const updateParcel = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof parcelSchema> }) => {
      const { error } = await supabase.from("parcels").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela actualizada");
      qc.invalidateQueries({ queryKey: ["parcels"] });
      setEditOpen(false); setEditingParcel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteParcel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parcels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Parcela eliminada"); qc.invalidateQueries({ queryKey: ["parcels"] }); },
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

  function requestGps(setter: (lat: number, lng: number) => void) {
    setGpsLoading(true);
    if (!navigator.geolocation) { setGpsLoading(false); return toast.error("GPS no disponible"); }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setter(pos.coords.latitude, pos.coords.longitude); setGpsLoading(false); },
      (err) => { setGpsLoading(false); toast.error(err.message); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
    if (!open) return;
    requestGps((lat, lng) => {
      const latEl = document.getElementById("latitude") as HTMLInputElement;
      const lngEl = document.getElementById("longitude") as HTMLInputElement;
      if (latEl && lngEl) { latEl.value = String(lat.toFixed(6)); lngEl.value = String(lng.toFixed(6)); }
    });
  }, [open]);

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
                  <Input id="area_m2" name="area_m2" type="number" min="1" step="any" inputMode="decimal" placeholder="ej. 5000" required onInput={(e) => { const ha = document.getElementById("areaHa"); if (ha) ha.textContent = ((Number((e.target as HTMLInputElement).value) || 0) / 10000).toFixed(2); }} />
                  <p className="text-xs text-muted-foreground">= <span id="areaHa">0.00</span> ha</p>
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
                  <Input id="latitude" name="latitude" type="number" step="any" inputMode="decimal" placeholder="-16.5 a -17.5 (aprox.)" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitud</Label>
                  <Input id="longitude" name="longitude" type="number" step="any" inputMode="decimal" placeholder="-68.0 a -69.0 (aprox.)" />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={gpsLoading} onClick={() => requestGps((lat, lng) => {
                const lats = document.getElementById("latitude") as HTMLInputElement;
                const lngs = document.getElementById("longitude") as HTMLInputElement;
                if (lats && lngs) { lats.value = String(lat.toFixed(6)); lngs.value = String(lng.toFixed(6)); }
              })}>
                {gpsLoading ? <LoaderCircle className="size-4 mr-1 animate-spin" /> : <MapPin className="size-4 mr-1" />} {gpsLoading ? "Obteniendo…" : "Usar mi ubicación"}
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

      <ParcelSummary data={parcels.data ?? []} />

      <ParcelGrid data={parcelsPage.data?.data ?? parcels.data ?? []} loading={parcels.isLoading} onEdit={(p) => { setEditingParcel(p); setEditOpen(true); }} onDelete={(id) => setDeleteConfirmId(id)} />
      {parcelsPage.data && <PaginationBar page={parcelsPage.data.page} totalPages={parcelsPage.data.totalPages} onPageChange={setPage} />}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar parcela</DialogTitle></DialogHeader>
          {editingParcel && (
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const parsed = parcelSchema.safeParse({ name: fd.get("name"), area_m2: Number(fd.get("area_m2")), soil_type_id: fd.get("soil_type_id") ? Number(fd.get("soil_type_id")) : undefined, latitude: fd.get("latitude") ? Number(fd.get("latitude")) : undefined, longitude: fd.get("longitude") ? Number(fd.get("longitude")) : undefined, notes: (fd.get("notes") as string) || undefined }); if (!parsed.success) return toast.error(parsed.error.issues[0].message); updateParcel.mutate({ id: editingParcel.id, data: parsed.data }); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input name="name" defaultValue={editingParcel.name} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Área (m²)</Label>
                  <Input name="area_m2" type="number" inputMode="decimal" min="1" step="any" defaultValue={editingParcel.area_m2} required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de suelo</Label>
                  <Select name="soil_type_id" defaultValue={editingParcel.soil_type_id ? String(editingParcel.soil_type_id) : ""}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(soils.data ?? []).map((s) => (<SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Latitud</Label>
                  <Input name="latitude" type="number" inputMode="decimal" step="any" defaultValue={editingParcel.latitude ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Longitud</Label>
                  <Input name="longitude" type="number" inputMode="decimal" step="any" defaultValue={editingParcel.longitude ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea name="notes" rows={2} defaultValue={editingParcel.notes ?? ""} />
              </div>
              <DialogFooter><Button type="submit" disabled={updateParcel.isPending}>Guardar cambios</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar parcela</AlertDialogTitle>
            <AlertDialogDescription>Esta acción eliminará la parcela y todos sus cultivos, actividades, costos y cosechas asociados. No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteConfirmId) { deleteParcel.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ParcelSummary({ data }: { data: any[] }) {
  const totalArea = data.reduce((s, p) => s + Number(p.area_m2 || 0), 0);
  const totalCrops = data.reduce((s, p) => s + (p.crops?.length ?? 0), 0);
  const activeCrops = data.reduce(
    (s, p) => s + (p.crops ?? []).filter((c: any) => ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)).length,
    0,
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SummaryStat icon={MapPin} label="Parcelas" value={data.length} />
      <SummaryStat icon={Ruler} label="Área total" value={`${(totalArea / 10000).toFixed(2)} ha`} sub={`${totalArea.toLocaleString()} m²`} />
      <SummaryStat icon={Sprout} label="Cultivos" value={totalCrops} />
      <SummaryStat icon={Sprout} label="Cultivos activos" value={activeCrops} />
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="size-4 text-primary" /> {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ParcelGrid({ data, loading, onEdit, onDelete }: { data: any[]; loading: boolean; onEdit?: (p: any) => void; onDelete?: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "area" | "crops">("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = data.filter((p) => !q || p.name.toLowerCase().includes(q));
    const sorted = [...arr];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "area") sorted.sort((a, b) => Number(b.area_m2) - Number(a.area_m2));
    if (sort === "crops") sorted.sort((a, b) => (b.crops?.length ?? 0) - (a.crops?.length ?? 0));
    return sorted;
  }, [data, query, sort]);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (data.length === 0) {
    return (
      <div className="p-10 border border-dashed border-border rounded-xl text-center">
        <MapPin className="size-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-muted-foreground">No tienes parcelas registradas.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar parcela…" className="pl-8" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="name">Nombre A–Z</SelectItem>
            <SelectItem value="area">Mayor área</SelectItem>
            <SelectItem value="crops">Más cultivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">Sin resultados.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const cropsCount = p.crops?.length ?? 0;
            const activeCount = (p.crops ?? []).filter((c: any) =>
              ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"].includes(c.status)
            ).length;
            const hasGPS = p.latitude && p.longitude;
            return (
              <div key={p.id} className="group relative p-5 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all">
                <Link to="/parcels/$id" params={{ id: p.id }} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{p.name}</h3>
                    <MapPin className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{(Number(p.area_m2) / 10000).toFixed(2)} ha</Badge>
                    {p.soil_types?.name && <Badge variant="outline">{p.soil_types.name}</Badge>}
                    {cropsCount > 0 && (
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        {activeCount}/{cropsCount} activos
                      </Badge>
                    )}
                  </div>
                  {(p as any).profiles?.full_name && <p className="text-xs text-primary mt-2 flex items-center gap-1"><User className="size-3" /> {(p as any).profiles.full_name}</p>}
                  <dl className="mt-2 text-xs text-muted-foreground space-y-1">
                    <div>{Number(p.area_m2).toLocaleString()} m²</div>
                    {hasGPS && (
                      <div className="flex items-center gap-1">
                        <span>{Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}</span>
                        <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-0.5">Mapa <ExternalLink className="size-3" /></a>
                      </div>
                    )}
                  </dl>
                </Link>
                {(onEdit || onDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && <DropdownMenuItem onClick={() => onEdit(p)}><Edit className="size-3.5 mr-2" /> Editar</DropdownMenuItem>}
                      {onDelete && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => onDelete(p.id)}><Trash2 className="size-3.5 mr-2" /> Eliminar</DropdownMenuItem></>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

