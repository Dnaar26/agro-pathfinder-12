import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listAllCrops, listCatalog, listParcels } from "@/lib/queries";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { StatusBadge, CROP_STATUSES, isActive } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sprout, Search, Calendar, MapPin, Plus, Download, CheckSquare } from "lucide-react";
import { format, addDays, parse } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cultivos")({
  head: () => ({ meta: [{ title: "Cultivos — SIGIC" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    status: (s.status as string) || "all",
  }),
  component: CultivosPage,
});

const STATUS_GROUPS = [
  { value: "all", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
  ...CROP_STATUSES.map((s) => ({ value: s, label: s })),
];

const cropCreateSchema = z.object({
  parcel_id: z.string().min(1),
  catalog_id: z.number().int().positive(),
  planting_date: z.string().min(1),
});

function CultivosPage() {
  const search = useSearch({ from: "/_authenticated/cultivos" });
  const qc = useQueryClient();
  const crops = useQuery({ queryKey: ["crops"], queryFn: listAllCrops });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: listCatalog });
  const parcels = useQuery({ queryKey: ["parcels"], queryFn: listParcels });
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState(search.status || "all");
  const [filterParcel, setFilterParcel] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");

  const parcelOptions = useMemo(() => {
    const names = new Set((crops.data ?? []).map((c: any) => (c.parcels as any)?.name).filter(Boolean));
    return Array.from(names).sort();
  }, [crops.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (crops.data ?? []).filter((c: any) => {
      const name = (c.crop_catalog as any)?.name ?? "";
      const parcelName = (c.parcels as any)?.name ?? "";
      if (q && !name.toLowerCase().includes(q) && !parcelName.toLowerCase().includes(q)) return false;
      if (filterStatus === "activos" && !isActive(c.status)) return false;
      if (filterStatus === "inactivos" && isActive(c.status)) return false;
      if (filterStatus !== "all" && filterStatus !== "activos" && filterStatus !== "inactivos" && c.status !== filterStatus) return false;
      if (filterParcel !== "all" && parcelName !== filterParcel) return false;
      return true;
    });
  }, [crops.data, query, filterStatus, filterParcel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [query, filterStatus, filterParcel]);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const counts = useMemo(() => {
    const all = crops.data ?? [];
    return {
      total: all.length,
      activos: all.filter((c: any) => isActive(c.status)).length,
      planeado: all.filter((c: any) => c.status === "PLANEADO").length,
      sembrado: all.filter((c: any) => c.status === "SEMBRADO").length,
      crecimiento: all.filter((c: any) => c.status === "CRECIMIENTO").length,
      mantenimiento: all.filter((c: any) => c.status === "MANTENIMIENTO").length,
      cosecha: all.filter((c: any) => c.status === "COSECHA").length,
      postcosecha: all.filter((c: any) => c.status === "POSTCOSECHA").length,
      finalizado: all.filter((c: any) => c.status === "FINALIZADO").length,
    };
  }, [crops.data]);

  const createCrop = useMutation({
    mutationFn: async (input: z.infer<typeof cropCreateSchema>) => {
      const cat = catalog.data?.find((c: any) => c.id === input.catalog_id);
      if (!cat) throw new Error("Cultivo inválido");
      const planting = parse(input.planting_date, "yyyy-MM-dd", new Date());
      const harvest = addDays(planting, cat.cycle_days);
      const { error } = await supabase.from("crops").insert({
        parcel_id: input.parcel_id,
        catalog_id: input.catalog_id,
        planting_date: format(planting, "yyyy-MM-dd"),
        estimated_harvest_date: format(harvest, "yyyy-MM-dd"),
        // El trigger de BD es la fuente de verdad: futuro=PLANEADO, hoy/pasado=SEMBRADO.
        status: input.planting_date > format(new Date(), "yyyy-MM-dd") ? "PLANEADO" : "SEMBRADO",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cultivo creado con estado calculado según su fecha de siembra"); qc.invalidateQueries({ queryKey: ["crops"] }); setCreateOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase.from("crops").update({ status: status as any }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, vars) => { toast.success(`${vars.ids.length} cultivos actualizados a "${vars.status}"`); qc.invalidateQueries({ queryKey: ["crops"] }); setBulkOpen(false); setSelectedIds(new Set()); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c: any) => c.id)));
  };

  const exportCSV = () => {
    const headers = ["Cultivo,Parcela,Estado,Siembra,Cosecha est.,Días"];
    const rows = filtered.map((c: any) => {
      const name = (c.crop_catalog as any)?.name ?? "—";
      const parcelName = (c.parcels as any)?.name ?? "—";
                const planting = c.planting_date ? format(new Date(c.planting_date + "T12:00:00"), "yyyy-MM-dd") : "";
                const harvest = c.estimated_harvest_date ? format(new Date(c.estimated_harvest_date + "T12:00:00"), "yyyy-MM-dd") : "";
      return `${name},${parcelName},${c.status},${planting},${harvest},${c.crop_catalog?.cycle_days ?? ""}`;
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + headers.join("\n"), ...rows.map((r: any) => "\n" + r)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "cultivos.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cultivos</h1>
          <p className="text-sm text-muted-foreground">Todos los cultivos registrados en tus parcelas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}><Download className="size-3.5 mr-1" /> CSV</Button>
          {selectedIds.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}><CheckSquare className="size-3.5 mr-1" /> Cambiar estado ({selectedIds.size})</Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5 mr-1" /> Nuevo cultivo</Button>
        </div>
      </header>

      {/* Bulk status dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cambiar estado masivo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selectedIds.size} cultivos seleccionados</p>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
            <SelectContent>{CROP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (bulkStatus) bulkUpdate.mutate({ ids: Array.from(selectedIds), status: bulkStatus }); }} disabled={!bulkStatus || bulkUpdate.isPending}>Actualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create crop dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo cultivo</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const parsed = cropCreateSchema.safeParse({ parcel_id: fd.get("parcel_id"), catalog_id: Number(fd.get("catalog_id")), planting_date: fd.get("planting_date") }); if (!parsed.success) return toast.error("Datos inválidos"); createCrop.mutate(parsed.data); }} className="space-y-3">
            <div className="space-y-2">
              <Label>Parcela</Label>
              <Select name="parcel_id" required>
                <SelectTrigger><SelectValue placeholder="Seleccionar parcela" /></SelectTrigger>
                <SelectContent>
                  {(parcels.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de cultivo</Label>
              <Select name="catalog_id" required>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {(catalog.data ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.cycle_days} días)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planting_date">Fecha de siembra (futura: PLANEADO; hoy o anterior: SEMBRADO)</Label>
              <Input id="planting_date" name="planting_date" type="date" required defaultValue={format(new Date(), "yyyy-MM-dd")} />
            </div>
            <DialogFooter><Button type="submit" disabled={createCrop.isPending}>Crear cultivo</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status bar chart */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        <StatusCount label="Total" value={counts.total} color="bg-gray-500" />
        <StatusCount label="Planeado" value={counts.planeado} color="bg-gray-400" />
        <StatusCount label="Sembrado" value={counts.sembrado} color="bg-green-500" />
        <StatusCount label="Crecimiento" value={counts.crecimiento} color="bg-blue-500" />
        <StatusCount label="Mantenimiento" value={counts.mantenimiento} color="bg-amber-500" />
        <StatusCount label="Cosecha" value={counts.cosecha} color="bg-orange-500" />
        <StatusCount label="Finalizado" value={counts.finalizado} color="bg-red-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cultivo o parcela…" className="pl-8" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterParcel} onValueChange={setFilterParcel}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Parcela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las parcelas</SelectItem>
            {parcelOptions.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {crops.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-xl text-center">
          <Sprout className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No se encontraron cultivos.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground text-xs uppercase">
                <th className="p-3 w-8">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={selectAll} className="size-3.5" />
                </th>
                <th className="text-left p-3 font-medium">Cultivo</th>
                <th className="text-left p-3 font-medium">Parcela</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-left p-3 font-medium">Siembra</th>
                <th className="text-left p-3 font-medium">Cosecha est.</th>
                <th className="text-right p-3 font-medium">Días</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c: any) => {
                const name = c.crop_catalog?.name ?? "—";
                const parcelName = c.parcels?.name ?? "—";
                const planting = c.planting_date ? format(new Date(c.planting_date + "T12:00:00"), "dd MMM yyyy") : "—";
                const harvest = c.estimated_harvest_date ? format(new Date(c.estimated_harvest_date + "T12:00:00"), "dd MMM yyyy") : "—";
                const days = c.crop_catalog?.cycle_days ?? "—";
                return (
                  <tr key={c.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${selectedIds.has(c.id) ? "bg-primary/5" : ""}`}>
                    <td className="p-3"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="size-3.5" /></td>
                    <td className="p-3 font-medium">{name}</td>
                    <td className="p-3 text-muted-foreground">
                      <Link to="/parcels/$id" params={{ id: c.parcel_id }} className="hover:text-primary inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {parcelName}
                      </Link>
                    </td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                    <td className="p-3 text-muted-foreground"><span className="inline-flex items-center gap-1"><Calendar className="size-3" />{planting}</span></td>
                    <td className="p-3 text-muted-foreground">{harvest}</td>
                    <td className="p-3 text-right text-muted-foreground">{days}</td>
                    <td className="p-3 text-right">
                      <Link to="/crops/$id" params={{ id: c.id }} className="text-primary hover:underline text-xs font-medium">Ver</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > pageSize && <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

function StatusCount({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${value > 0 ? "text-foreground" : "text-muted-foreground/50"}`}>{value}</p>
    </div>
  );
}
