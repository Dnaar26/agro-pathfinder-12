import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listEvents } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Sprout, Wheat, Pencil, Trash2 } from "lucide-react";
import { addMonths, format, startOfMonth, startOfWeek, addDays, isSameDay, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendario — SIGIC" }] }),
  component: CalendarPage,
});

const eventSchema = z.object({
  title: z.string().trim().min(2, "El título debe tener al menos 2 caracteres").max(150),
  starts_at: z.string().min(1, "La fecha es obligatoria").refine(
    (val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      // Permitir margen de 2 minutos por desfases de reloj
      return d.getTime() >= Date.now() - 2 * 60 * 1000;
    },
    { message: "No se pueden programar eventos en fechas u horas pasadas" }
  ),
  description: z.string().max(500).optional(),
  crop_id: z.string().uuid().optional(),
});

function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date>(new Date());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [invItemId, setInvItemId] = useState("");
  const [invQty, setInvQty] = useState("");
  const [editInvItemId, setEditInvItemId] = useState("");
  const [editInvQty, setEditInvQty] = useState("");
  const qc = useQueryClient();

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const gridStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart]);
  const gridEnd = useMemo(() => addDays(gridStart, 42), [gridStart]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const events = useQuery({
    queryKey: ["events", monthStart.toISOString()],
    queryFn: () => listEvents(gridStart, gridEnd),
  });

  const inventoryItems = useQuery({
    queryKey: ["calendar-inventory"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_items").select("id, name, unit, stock_qty").order("name");
      return data ?? [];
    },
  });
  const crops = useQuery({
    queryKey: ["calendar-crops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crops")
        .select("id, crop_catalog(name), parcels(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cropEvents = useQuery({
    queryKey: ["crop-events", monthStart.toISOString()],
    queryFn: async () => {
      const s = gridStart.toISOString();
      const e = gridEnd.toISOString();
      const { data } = await supabase
        .from("crops")
        .select("id, planting_date, estimated_harvest_date, status, crop_catalog(name), parcels(name)")
        .or(`planting_date.gte.${s},planting_date.lte.${e},estimated_harvest_date.gte.${s},estimated_harvest_date.lte.${e}`)
        .not("planting_date", "is", null);
      return data ?? [];
    },
  });

  const activityEvents = useQuery({
    queryKey: ["activity-events", monthStart.toISOString()],
    queryFn: async () => {
      const s = gridStart.toISOString();
      const e = gridEnd.toISOString();
      const { data } = await supabase
        .from("activities")
        .select("id, kind, performed_at, notes, crops!inner(id, crop_catalog(name), parcels(name))")
        .gte("performed_at", s)
        .lte("performed_at", e)
        .order("performed_at");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: { event: z.infer<typeof eventSchema>; invItemId?: string; invQty?: number }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");

      const eventDate = new Date(payload.event.starts_at);
      if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 2 * 60 * 1000) {
        throw new Error("No se pueden programar eventos en fechas u horas pasadas");
      }
      
      // Verificar stock si hay insumo
      if (payload.invItemId && payload.invQty && payload.invQty > 0) {
        const { data: inv } = await supabase.from("inventory_items").select("stock_qty").eq("id", payload.invItemId).single();
        if (!inv || Number(inv.stock_qty) < payload.invQty) {
          throw new Error("Stock insuficiente para el insumo seleccionado");
        }
      }
      
      const { error } = await supabase.from("calendar_events").insert({
        user_id: u.user.id,
        title: payload.event.title,
        description: payload.event.description ?? null,
        crop_id: payload.event.crop_id ?? null,
        starts_at: eventDate.toISOString(),
      });
      if (error) throw error;
      
      // Descontar del inventario
      if (payload.invItemId && payload.invQty && payload.invQty > 0) {
        const { error: rpcErr } = await supabase.rpc("apply_inventory_movement", {
          p_item_id: payload.invItemId,
          p_kind: "SALIDA",
          p_qty: payload.invQty,
          p_notes: `Uso en evento: ${payload.event.title}`,
          p_delta: -payload.invQty,
        });
        if (rpcErr) throw new Error(rpcErr.message || "Error al descontar insumo del inventario");
      }
    },
    onSuccess: () => {
      toast.success("Evento creado");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["calendar-inventory"] });
      setOpen(false);
      setInvItemId("");
      setInvQty("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    deleteEvent.mutate(deleteConfirm);
    setDeleteConfirm(null);
  }

  const [editEvent, setEditEvent] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const updateEvent = useMutation({
    mutationFn: async (payload: { id: string; title: string; description?: string; starts_at: string; crop_id?: string; editInvItemId?: string; editInvQty?: number }) => {
      const eventDate = new Date(payload.starts_at);
      if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 2 * 60 * 1000) {
        throw new Error("No se pueden programar eventos en fechas u horas pasadas");
      }

      // Verificar stock si hay insumo
      if (payload.editInvItemId && payload.editInvQty && payload.editInvQty > 0) {
        const { data: inv } = await supabase.from("inventory_items").select("stock_qty").eq("id", payload.editInvItemId).single();
        if (!inv || Number(inv.stock_qty) < payload.editInvQty) {
          throw new Error("Stock insuficiente para el insumo seleccionado");
        }
      }

      const { error } = await supabase.from("calendar_events").update({ title: payload.title, description: payload.description ?? null, crop_id: payload.crop_id ?? null, starts_at: eventDate.toISOString() }).eq("id", payload.id);
      if (error) throw error;
      
      // Descontar del inventario
      if (payload.editInvItemId && payload.editInvQty && payload.editInvQty > 0) {
        const { error: rpcErr } = await supabase.rpc("apply_inventory_movement", {
          p_item_id: payload.editInvItemId,
          p_kind: "SALIDA",
          p_qty: payload.editInvQty,
          p_notes: `Uso en evento: ${payload.title}`,
          p_delta: -payload.editInvQty,
        });
        if (rpcErr) throw new Error(rpcErr.message || "Error al descontar insumo del inventario");
      }
    },
    onSuccess: () => { 
      toast.success("Evento actualizado"); 
      qc.invalidateQueries({ queryKey: ["events"] }); 
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["calendar-inventory"] });
      setEditOpen(false); 
      setEditEvent(null); 
      setEditInvItemId("");
      setEditInvQty("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").update({ done: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evento marcado como realizado"); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evento eliminado"); qc.invalidateQueries({ queryKey: ["events"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = eventSchema.safeParse({
      title: fd.get("title"),
      starts_at: fd.get("starts_at"),
      description: (fd.get("description") as string) || undefined,
      crop_id: (fd.get("crop_id") as string) || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate({ 
      event: parsed.data, 
      invItemId: invItemId || undefined, 
      invQty: invQty ? Number(invQty) : undefined 
    });
  }

  const allItems = useMemo(() => {
    const map: Record<string, any[]> = {};
    function add(key: string, item: any) {
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    for (const e of events.data ?? []) {
      add(format(new Date(e.starts_at), "yyyy-MM-dd"), { type: "event", ...e });
    }
    for (const c of cropEvents.data ?? []) {
      const name = (c as any).crop_catalog?.name ?? "Cultivo";
      const parcelName = (c as any).parcels?.name ?? "";
      const suffix = parcelName ? ` (${parcelName})` : "";
      add(format(new Date(c.planting_date + "T12:00:00"), "yyyy-MM-dd"), { type: "siembra", id: c.id, title: `Siembra: ${name}${suffix}`, description: `Inicio de siembra de ${name}` });
      if (c.estimated_harvest_date) {
        add(format(new Date(c.estimated_harvest_date + "T12:00:00"), "yyyy-MM-dd"), { type: "cosecha", id: c.id, title: `Cosecha: ${name}${suffix}`, description: `Cosecha estimada de ${name}` });
      }
    }
    for (const a of activityEvents.data ?? []) {
      const crop = (a as any).crops;
      const name = crop?.crop_catalog?.name ?? "";
      const suffix = name ? ` (${name})` : "";
      add(format(new Date(a.performed_at), "yyyy-MM-dd"), { type: "actividad", id: a.id, title: `${a.kind}${suffix}`, description: a.notes ?? "" });
    }
    return map;
  }, [events.data, cropEvents.data, activityEvents.data]);

  const selectedItems = allItems[format(selected, "yyyy-MM-dd")] ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendario</h1>
          <p className="text-sm text-muted-foreground capitalize">{format(cursor, "MMMM yyyy", { locale: es })}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="size-4" /></Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="ml-2"><Plus className="size-4 mr-1" /> Evento</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo evento</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="starts_at">Fecha y hora</Label>
                  <Input
                    id="starts_at"
                    name="starts_at"
                    type="datetime-local"
                    required
                    min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    defaultValue={format(selected < new Date() ? new Date() : selected, "yyyy-MM-dd'T'09:00")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cultivo relacionado</Label>
                  <Select name="crop_id">
                    <SelectTrigger><SelectValue placeholder="Sin cultivo asociado" /></SelectTrigger>
                    <SelectContent>
                      {(crops.data ?? []).map((crop) => (
                        <SelectItem key={crop.id} value={crop.id}>{(crop as any).crop_catalog?.name ?? "Cultivo"} - {(crop as any).parcels?.name ?? "Parcela"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" name="description" rows={3} />
                </div>
                
                {/* Sección Insumos */}
                <div className="space-y-2">
                  <Label>Insumo del inventario (opcional)</Label>
                  <div className="flex gap-2">
                    <Select value={invItemId} onValueChange={setInvItemId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sin insumo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(inventoryItems.data ?? []).map((it) => (
                          <SelectItem key={it.id} value={it.id}>
                            {it.name} — Stock: {Number(it.stock_qty).toFixed(1)} {it.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder="Cantidad"
                      value={invQty}
                      onChange={(e) => setInvQty(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  {invItemId && invQty && (() => {
                    const it = (inventoryItems.data ?? []).find(x => x.id === invItemId);
                    if (!it) return null;
                    const remaining = Number(it.stock_qty) - Number(invQty);
                    return (
                      <p className={`text-xs ${remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Stock tras uso: {remaining.toFixed(1)} {it.unit} {remaining < 0 ? '⚠️ Insuficiente' : '✓'}
                      </p>
                    );
                  })()}
                </div>

                <DialogFooter><Button type="submit" disabled={create.isPending}>Guardar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {["L","M","X","J","V","S","D"].map((d) => (
          <div key={d} className="bg-muted text-muted-foreground text-xs font-medium text-center py-2">{d}</div>
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = allItems[key] ?? [];
          const inMonth = isSameMonth(d, cursor);
          const isSelected = isSameDay(d, selected);
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={key}
              onClick={() => setSelected(d)}
              className={cn(
                "min-h-20 bg-card p-2 text-left transition-colors hover:bg-primary-soft",
                !inMonth && "text-muted-foreground/40",
                isSelected && "ring-2 ring-primary ring-inset",
              )}
            >
              <div className={cn("text-sm font-medium", isToday && "text-primary")}>{format(d, "d")}</div>
              <div className="mt-1 flex gap-0.5 flex-wrap">
                {items.slice(0, 4).map((it: any, i: number) => (
                  <span key={i} className={cn("size-1.5 rounded-full", it.type === "siembra" && "bg-green-500", it.type === "cosecha" && "bg-amber-500", it.type === "actividad" && "bg-blue-500", it.type === "event" && "bg-primary")} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3 capitalize">{format(selected, "EEEE, d 'de' MMMM", { locale: es })}</h2>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos este día.</p>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((it: any, i: number) => (
              <li key={`${it.type}-${it.id ?? i}`} className={cn("p-4 rounded-lg border", it.type === "siembra" && "border-green-200 bg-green-50 dark:bg-green-950/20", it.type === "cosecha" && "border-amber-200 bg-amber-50 dark:bg-amber-950/20", it.type === "actividad" && "border-blue-200 bg-blue-50 dark:bg-blue-950/20", it.type === "event" && "border-border bg-card")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {it.type === "siembra" && <Sprout className="size-4 text-green-600 shrink-0" />}
                    {it.type === "cosecha" && <Wheat className="size-4 text-amber-600 shrink-0" />}
                    <span className="font-medium">{it.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {it.starts_at && <span className="text-xs text-muted-foreground">{format(new Date(it.starts_at), "HH:mm")}</span>}
                    {it.type === "event" && (
                      <>
                        {!it.done && <Button variant="outline" size="sm" onClick={() => markDone.mutate(it.id)} disabled={markDone.isPending}>Realizado</Button>}
                        <button onClick={() => { setEditEvent(it); setEditOpen(true); }} className="text-muted-foreground hover:text-foreground" title="Editar"><Pencil className="size-3.5" /></button>
                        <button onClick={() => setDeleteConfirm(it.id)} className="text-destructive hover:text-destructive/80" title="Eliminar"><Trash2 className="size-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
                {it.description && <p className="text-sm text-muted-foreground mt-1">{it.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Edit event dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditEvent(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar evento</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            if (!editEvent) return; 
            const fd = new FormData(e.currentTarget); 
            const parsed = eventSchema.safeParse({
              title: fd.get("title"),
              starts_at: fd.get("starts_at"),
              description: (fd.get("description") as string) || undefined,
              crop_id: (fd.get("crop_id") as string) || undefined,
            });
            if (!parsed.success) return toast.error(parsed.error.issues[0].message);
            updateEvent.mutate({ 
              id: editEvent.id, 
              title: parsed.data.title, 
              description: parsed.data.description, 
              crop_id: parsed.data.crop_id, 
              starts_at: parsed.data.starts_at,
              editInvItemId: editInvItemId || undefined,
              editInvQty: editInvQty ? Number(editInvQty) : undefined
            }); 
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título</Label>
              <Input id="edit-title" name="title" required defaultValue={editEvent?.title ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-starts_at">Fecha y hora</Label>
              <Input
                id="edit-starts_at"
                name="starts_at"
                type="datetime-local"
                required
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                defaultValue={editEvent?.starts_at ? format(new Date(editEvent.starts_at), "yyyy-MM-dd'T'HH:mm") : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea id="edit-description" name="description" rows={3} defaultValue={editEvent?.description ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Cultivo relacionado</Label>
              <Select name="crop_id" defaultValue={editEvent?.crop_id ?? ""}>
                <SelectTrigger><SelectValue placeholder="Sin cultivo asociado" /></SelectTrigger>
                <SelectContent>
                  {(crops.data ?? []).map((crop) => (
                    <SelectItem key={crop.id} value={crop.id}>{(crop as any).crop_catalog?.name ?? "Cultivo"} - {(crop as any).parcels?.name ?? "Parcela"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sección Insumos */}
            <div className="space-y-2">
              <Label>Insumo del inventario (opcional)</Label>
              <div className="flex gap-2">
                <Select value={editInvItemId} onValueChange={setEditInvItemId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Sin insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(inventoryItems.data ?? []).map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name} — Stock: {Number(it.stock_qty).toFixed(1)} {it.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="Cantidad"
                  value={editInvQty}
                  onChange={(e) => setEditInvQty(e.target.value)}
                  className="w-28"
                />
              </div>
              {editInvItemId && editInvQty && (() => {
                const it = (inventoryItems.data ?? []).find(x => x.id === editInvItemId);
                if (!it) return null;
                const remaining = Number(it.stock_qty) - Number(editInvQty);
                return (
                  <p className={`text-xs ${remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    Stock tras uso: {remaining.toFixed(1)} {it.unit} {remaining < 0 ? '⚠️ Insuficiente' : '✓'}
                  </p>
                );
              })()}
            </div>

            <DialogFooter><Button type="submit" disabled={updateEvent.isPending}>Guardar cambios</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>¿Eliminar este evento? Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteConfirm}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
