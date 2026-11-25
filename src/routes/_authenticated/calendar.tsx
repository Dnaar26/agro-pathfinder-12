import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listEvents, listParcels } from "@/lib/queries";
import { fetchWeatherForecast, type DailyForecast } from "@/lib/services/weather";
import { coordsOrDefault } from "@/lib/geo";
import { findBestInventoryMatch } from "@/lib/ai/chat-action-extractor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sprout,
  Wheat,
  Pencil,
  Trash2,
  Sparkles,
  CloudRain,
  Snowflake,
  Sun,
  AlertTriangle,
  CalendarDays,
  ListTodo,
} from "lucide-react";
import { executeWithOfflineFallback } from "@/lib/services/offline-sync";
import { addMonths, format, startOfMonth, startOfWeek, addDays, isSameDay, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type CalendarSearchParams = {
  date?: string;
  openNew?: boolean;
  title?: string;
  description?: string;
  cropId?: string;
  itemId?: string;
  itemQuery?: string;
  qty?: number;
};

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendario — SIGIC" }] }),
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const rawDate = typeof search.date === "string" ? search.date : "";
    const parsedDate = new Date(`${rawDate}T00:00:00Z`);
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
      !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === rawDate;

    const openNew = search.openNew === true || search.openNew === "true" || search.openNew === "1";
    const title = typeof search.title === "string" && search.title.trim() ? search.title.trim().slice(0, 150) : undefined;
    const description =
      typeof search.description === "string" && search.description.trim()
        ? search.description.trim().slice(0, 500)
        : undefined;
    const cropId =
      typeof search.cropId === "string" && /^[0-9a-fA-F-]{36}$/.test(search.cropId)
        ? search.cropId
        : undefined;
    const itemId =
      typeof search.itemId === "string" && /^[0-9a-fA-F-]{36}$/.test(search.itemId)
        ? search.itemId
        : undefined;
    const itemQuery =
      typeof search.itemQuery === "string" && search.itemQuery.trim()
        ? search.itemQuery.trim().slice(0, 80)
        : undefined;
    const rawQty = typeof search.qty === "number" ? search.qty : typeof search.qty === "string" ? Number(search.qty) : NaN;
    const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.round(rawQty * 100) / 100 : undefined;

    return {
      date: validDate ? rawDate : undefined,
      openNew: openNew || undefined,
      title,
      description,
      cropId,
      itemId,
      itemQuery,
      qty,
    };
  },
  component: CalendarPage,
});

const eventSchema = z.object({
  title: z.string().trim().min(2, "El título debe tener al menos 2 caracteres").max(150),
  starts_at: z.string().min(1, "La fecha es obligatoria").refine(
    (val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      return d.getTime() >= Date.now() - 2 * 60 * 1000;
    },
    { message: "No se pueden programar eventos en fechas u horas pasadas" }
  ),
  description: z.string().max(500).optional(),
  crop_id: z.string().uuid().optional(),
});

const KIND_STYLE: Record<string, { dot: string; card: string; label: string }> = {
  siembra: { dot: "bg-primary", card: "border-primary/30 bg-primary-soft", label: "Siembra" },
  cosecha: { dot: "bg-highlight", card: "border-highlight/50 bg-highlight/15", label: "Cosecha estimada" },
  actividad: { dot: "bg-info", card: "border-info/30 bg-info/10", label: "Labor realizada" },
  event: { dot: "bg-foreground/70", card: "border-border bg-card", label: "Evento" },
};

const editSchema = eventSchema.extend({ starts_at: z.string().min(1, "La fecha es obligatoria") });

function defaultFutureDateTime(baseDate: Date): string {
  const now = new Date();
  if (baseDate.getTime() < now.getTime()) {
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    nextHour.setMinutes(0, 0, 0);
    return format(nextHour, "yyyy-MM-dd'T'HH:mm");
  }
  return format(baseDate, "yyyy-MM-dd'T'09:00");
}

function CalendarPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [cursor, setCursor] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<"month" | "agenda">(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? "agenda" : "month"
  );
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date>(new Date());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formStartsAt, setFormStartsAt] = useState(() => defaultFutureDateTime(new Date()));
  const [formCropId, setFormCropId] = useState<string>("__none__");
  const [formDescription, setFormDescription] = useState("");
  const [invItemId, setInvItemId] = useState("");
  const [invQty, setInvQty] = useState("");
  const [prefilledBanner, setPrefilledBanner] = useState(false);
  const [pendingItemQuery, setPendingItemQuery] = useState<string | null>(null);

  const startsAtInputRef = useRef<HTMLInputElement>(null);

  const [editEvent, setEditEvent] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editInvItemId, setEditInvItemId] = useState("");
  const [editInvQty, setEditInvQty] = useState("");

  useEffect(() => {
    if (!search.date) return;
    const date = new Date(`${search.date}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
    setCursor(date);
    setSelected(date);
  }, [search.date]);

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
      const { data } = await supabase
        .from("inventory_items")
        .select("id, name, unit, stock_qty")
        .order("name");
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

  const parcelsForWeather = useQuery({
    queryKey: ["parcels"],
    queryFn: listParcels,
    staleTime: 5 * 60 * 1000,
  });

  const primaryCoords = useMemo(() => {
    const firstWithGps = (parcelsForWeather.data ?? []).find(
      (p: any) => p.latitude != null && p.longitude != null
    );
    return coordsOrDefault(firstWithGps?.latitude, firstWithGps?.longitude);
  }, [parcelsForWeather.data]);

  const weatherQuery = useQuery({
    queryKey: [
      "weather-forecast",
      Number(primaryCoords.lat.toFixed(3)),
      Number(primaryCoords.lng.toFixed(3)),
    ],
    queryFn: () => fetchWeatherForecast(primaryCoords.lat, primaryCoords.lng),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const weatherByDay = useMemo(() => {
    const map: Record<string, DailyForecast> = {};
    for (const d of weatherQuery.data?.daily ?? []) {
      map[d.date] = d;
    }
    return map;
  }, [weatherQuery.data]);

  useEffect(() => {
    if (!search.openNew) return;

    setFormTitle(search.title ?? "");
    setFormDescription(search.description ?? "");
    setFormCropId(search.cropId ?? "__none__");
    setFormStartsAt(defaultFutureDateTime(selected));
    if (search.qty) setInvQty(String(search.qty));
    if (search.itemId) {
      setInvItemId(search.itemId);
      setPendingItemQuery(null);
    } else if (search.itemQuery) {
      setPendingItemQuery(search.itemQuery);
    }

    setPrefilledBanner(true);
    setOpen(true);

    window.setTimeout(() => {
      startsAtInputRef.current?.focus();
    }, 180);

    navigate({
      to: "/calendar",
      search: search.date ? { date: search.date } : {},
      replace: true,
    });
  }, [
    search.openNew,
    search.title,
    search.description,
    search.cropId,
    search.itemId,
    search.itemQuery,
    search.qty,
    search.date,
    selected,
    navigate,
  ]);

  useEffect(() => {
    if (!pendingItemQuery || !inventoryItems.data?.length) return;
    const match = findBestInventoryMatch(pendingItemQuery, inventoryItems.data as any);
    if (match) setInvItemId(match.id);
    setPendingItemQuery(null);
  }, [pendingItemQuery, inventoryItems.data]);

  const resetNewEventForm = (baseDate = selected) => {
    setFormTitle("");
    setFormDescription("");
    setFormCropId("__none__");
    setFormStartsAt(defaultFutureDateTime(baseDate));
    setInvItemId("");
    setInvQty("");
    setPrefilledBanner(false);
  };

  const cropEvents = useQuery({
    queryKey: ["crop-events", monthStart.toISOString()],
    queryFn: async () => {
      const s = format(gridStart, "yyyy-MM-dd");
      const e = format(gridEnd, "yyyy-MM-dd");
      const { data } = await supabase
        .from("crops")
        .select("id, planting_date, estimated_harvest_date, status, crop_catalog(name), parcels(name)")
        .or(`and(planting_date.gte.${s},planting_date.lte.${e}),and(estimated_harvest_date.gte.${s},estimated_harvest_date.lte.${e})`)
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
      const eventDate = new Date(payload.event.starts_at);
      if (isNaN(eventDate.getTime()) || eventDate.getTime() < Date.now() - 2 * 60 * 1000) {
        throw new Error("No se pueden programar eventos en fechas u horas pasadas");
      }

      if (!payload.invItemId && typeof navigator !== "undefined" && !navigator.onLine) {
        const { data: s } = await supabase.auth.getSession();
        const uid = s.session?.user?.id;
        if (uid) {
          await executeWithOfflineFallback({
            offlineMutation: {
              table: "calendar_events",
              action: "INSERT",
              data: {
                user_id: uid,
                title: payload.event.title,
                starts_at: eventDate.toISOString(),
                description: payload.event.description ?? null,
                crop_id: payload.event.crop_id ?? null,
                done: false,
              },
            },
            onlineRunner: async () => undefined,
          });
          return;
        }
      }

      const { error } = await supabase.rpc("create_calendar_event_with_inventory", {
        p_title: payload.event.title,
        p_starts_at: eventDate.toISOString(),
        p_description: payload.event.description ?? null,
        p_crop_id: payload.event.crop_id ?? null,
        p_item_id: payload.invItemId ?? null,
        p_qty: payload.invQty ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento creado");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["calendar-inventory"] });
      setOpen(false);
      resetNewEventForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvent = useMutation({
    mutationFn: async (payload: {
      id: string;
      originalStartsAt?: string;
      title: string;
      description?: string;
      starts_at: string;
      crop_id?: string;
      editInvItemId?: string;
      editInvQty?: number;
    }) => {
      const eventDate = new Date(payload.starts_at);
      const dateChanged = !payload.originalStartsAt || new Date(payload.originalStartsAt).getTime() !== eventDate.getTime();
      if (isNaN(eventDate.getTime()) || (dateChanged && eventDate.getTime() < Date.now() - 2 * 60 * 1000)) {
        throw new Error("No se pueden programar eventos en fechas u horas pasadas");
      }

      const { error } = await supabase.rpc("update_calendar_event_with_inventory", {
        p_event_id: payload.id,
        p_title: payload.title,
        p_starts_at: eventDate.toISOString(),
        p_description: payload.description ?? null,
        p_crop_id: payload.crop_id ?? null,
        p_item_id: payload.editInvItemId ?? null,
        p_qty: payload.editInvQty ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento actualizado");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
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
      const { error } = await supabase.rpc("set_calendar_event_done", { p_event_id: id });
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["events"] });
      const previousEvents = qc.getQueryData<any[]>(["events"]);
      if (previousEvents) {
        qc.setQueryData(
          ["events"],
          previousEvents.map((ev) => (ev.id === id ? { ...ev, done: true } : ev))
        );
      }
      return { previousEvents };
    },
    onSuccess: () => {
      toast.success("Evento marcado como realizado");
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.previousEvents) qc.setQueryData(["events"], ctx.previousEvents);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_calendar_event_with_inventory", { p_event_id: id });
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["events"] });
      const previousEvents = qc.getQueryData<any[]>(["events"]);
      if (previousEvents) {
        qc.setQueryData(
          ["events"],
          previousEvents.filter((ev) => ev.id !== id)
        );
      }
      return { previousEvents };
    },
    onSuccess: () => {
      toast.success("Evento eliminado");
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.previousEvents) qc.setQueryData(["events"], ctx.previousEvents);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["calendar-inventory"] });
    },
  });

  function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    deleteEvent.mutate(deleteConfirm);
    setDeleteConfirm(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = eventSchema.safeParse({
      title: formTitle,
      starts_at: formStartsAt,
      description: formDescription.trim() || undefined,
      crop_id: formCropId && formCropId !== "__none__" ? formCropId : undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate({
      event: parsed.data,
      invItemId: invItemId && invItemId !== "__none__" ? invItemId : undefined,
      invQty: invQty ? Number(invQty) : undefined,
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
      add(format(new Date(c.planting_date + "T12:00:00"), "yyyy-MM-dd"), {
        type: "siembra",
        id: c.id,
        title: `Siembra: ${name}${suffix}`,
        description: `Inicio de siembra de ${name}`,
      });
      if (c.estimated_harvest_date) {
        add(format(new Date(c.estimated_harvest_date + "T12:00:00"), "yyyy-MM-dd"), {
          type: "cosecha",
          id: c.id,
          title: `Cosecha: ${name}${suffix}`,
          description: `Cosecha estimada de ${name}`,
        });
      }
    }
    for (const a of activityEvents.data ?? []) {
      const crop = (a as any).crops;
      const name = crop?.crop_catalog?.name ?? "";
      const suffix = name ? ` (${name})` : "";
      add(format(new Date(a.performed_at), "yyyy-MM-dd"), {
        type: "actividad",
        id: a.id,
        title: `${a.kind}${suffix}`,
        description: a.notes ?? "",
      });
    }
    return map;
  }, [events.data, cropEvents.data, activityEvents.data]);

  const selectedItems = allItems[format(selected, "yyyy-MM-dd")] ?? [];

  const agendaDays = useMemo(() => {
    const entries: { dateKey: string; dateObj: Date; items: any[] }[] = [];
    for (const d of days) {
      if (!isSameMonth(d, cursor)) continue;
      const key = format(d, "yyyy-MM-dd");
      const dayList = allItems[key] ?? [];
      if (dayList.length > 0 || isSameDay(d, new Date())) {
        entries.push({ dateKey: key, dateObj: d, items: dayList });
      }
    }
    return entries;
  }, [days, cursor, allItems]);
  const chosenDayForecast = formStartsAt ? weatherByDay[formStartsAt.slice(0, 10)] : undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Calendario</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(cursor, "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 mr-1">
            <button
              type="button"
              onClick={() => setCalendarMode("month")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                calendarMode === "month"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="size-3.5" /> Mes
            </button>
            <button
              type="button"
              onClick={() => setCalendarMode("agenda")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                calendarMode === "agenda"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTodo className="size-3.5" /> Agenda
            </button>
          </div>

          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Button>

          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (nextOpen && !prefilledBanner) {
                setFormStartsAt(defaultFutureDateTime(selected));
              }
              if (!nextOpen) {
                resetNewEventForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="ml-2">
                <Plus className="size-4 mr-1" /> Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo evento</DialogTitle>
              </DialogHeader>

              {prefilledBanner && (
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-primary">Datos prellenados automáticamente</p>
                    <p className="text-muted-foreground">
                      Solo confirma o ajusta la <strong>fecha y hora</strong> y pulsa <strong>Guardar</strong>.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ej: Aplicación de fertilizante en lote norte"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="starts_at" className="flex items-center justify-between">
                    <span>Fecha y hora</span>
                    {prefilledBanner && (
                      <span className="text-[11px] font-semibold text-primary">← Selecciona cuándo agendar</span>
                    )}
                  </Label>
                  <Input
                    ref={startsAtInputRef}
                    id="starts_at"
                    name="starts_at"
                    type="datetime-local"
                    required
                    min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className={cn(prefilledBanner && "ring-2 ring-primary/40 border-primary")}
                  />

                  {chosenDayForecast && (chosenDayForecast.precipProb > 65 || chosenDayForecast.tempMin < 2) && (
                    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-xs text-foreground">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden="true" />
                      <span>
                        {chosenDayForecast.tempMin < 2
                          ? `Alerta de helada pronosticada (${chosenDayForecast.tempMin.toFixed(1)}°C mín.) para esta fecha.`
                          : `Alta probabilidad de lluvia (${chosenDayForecast.precipProb}% · ${chosenDayForecast.precip} mm): evita aplicaciones foliares sin adherente.`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Cultivo relacionado</Label>
                  <Select value={formCropId} onValueChange={setFormCropId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin cultivo asociado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cultivo asociado</SelectItem>
                      {(crops.data ?? []).map((crop) => (
                        <SelectItem key={crop.id} value={crop.id}>
                          {(crop as any).crop_catalog?.name ?? "Cultivo"} - {(crop as any).parcels?.name ?? "Parcela"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción y recomendaciones</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Dosis, pasos y precauciones de aplicación…"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Insumo del inventario (opcional — descuenta stock al guardar)</Label>
                  <div className="flex gap-2">
                    <Select value={invItemId || "__none__"} onValueChange={(v) => setInvItemId(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sin insumo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sin insumo</SelectItem>
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
                  {invItemId &&
                    invQty &&
                    (() => {
                      const it = (inventoryItems.data ?? []).find((x) => x.id === invItemId);
                      if (!it) return null;
                      const remaining = Number(it.stock_qty) - Number(invQty);
                      return (
                        <p className={`text-xs ${remaining < 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          Stock tras uso: {remaining.toFixed(1)} {it.unit}{" "}
                          {remaining < 0 ? "· Stock insuficiente en bodega" : ""}
                        </p>
                      );
                    })()}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    Guardar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {calendarMode === "agenda" ? (
        <div className="space-y-3">
          {agendaDays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No hay labores, siembras ni cosechas programadas en {format(cursor, "MMMM yyyy", { locale: es })}.
            </div>
          ) : (
            agendaDays.map(({ dateKey, dateObj, items }) => {
              const dw = weatherByDay[dateKey];
              const isTodayDate = isSameDay(dateObj, new Date());
              return (
                <div
                  key={dateKey}
                  className={cn(
                    "rounded-xl border bg-card p-4 space-y-2.5",
                    isTodayDate ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(dateObj);
                        setCalendarMode("month");
                      }}
                      className="text-sm font-bold capitalize text-foreground hover:text-primary flex items-center gap-2"
                    >
                      <span>{format(dateObj, "EEEE d 'de' MMMM", { locale: es })}</span>
                      {isTodayDate && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          HOY
                        </span>
                      )}
                    </button>
                    {dw && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {dw.precipProb > 65 ? (
                          <CloudRain className="size-3.5 text-info" />
                        ) : (
                          <Sun className="size-3.5 text-warning" />
                        )}
                        {Math.round(dw.tempMax)}°/{Math.round(dw.tempMin)}° · Lluvia {dw.precipProb}%
                      </span>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sin labores agendadas hoy.</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((it: any, idx: number) => (
                        <li key={`${it.type}-${it.id ?? idx}`} className={cn("rounded-lg border p-3 text-sm", KIND_STYLE[it.type]?.card)}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={cn("font-medium", it.done && "line-through text-muted-foreground")}>
                              {it.title}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {it.starts_at && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {format(new Date(it.starts_at), "HH:mm")}
                                </span>
                              )}
                              {it.type === "event" && !it.done && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => markDone.mutate(it.id)}>
                                  Realizado
                                </Button>
                              )}
                            </div>
                          </div>
                          {it.description && (
                            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">{it.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="bg-muted text-muted-foreground text-xs font-medium text-center py-2">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = allItems[key] ?? [];
          const dayWeather = weatherByDay[key];
          const inMonth = isSameMonth(d, cursor);
          const isSelected = isSameDay(d, selected);
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${format(d, "EEEE d 'de' MMMM", { locale: es })}, ${
                items.length === 0 ? "sin eventos" : items.length === 1 ? "1 evento" : `${items.length} eventos`
              }`}
              onClick={() => setSelected(d)}
              className={cn(
                "min-h-16 sm:min-h-20 bg-card p-1.5 sm:p-2 text-left transition-colors hover:bg-primary-soft flex flex-col justify-between",
                !inMonth && "text-muted-foreground/40",
                isSelected && "ring-2 ring-primary ring-inset"
              )}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <div
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs sm:text-sm font-medium tabular",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(d, "d")}
                </div>
                {dayWeather && (
                  <span
                    title={`Máx ${Math.round(dayWeather.tempMax)}° / Mín ${Math.round(dayWeather.tempMin)}° · Lluvia ${dayWeather.precipProb}%`}
                    className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground"
                  >
                    {dayWeather.tempMin < 2 ? (
                      <Snowflake className="size-3 text-sky-500" aria-hidden="true" />
                    ) : dayWeather.precipProb > 65 ? (
                      <CloudRain className="size-3 text-info" aria-hidden="true" />
                    ) : (
                      <Sun className="size-3 text-warning" aria-hidden="true" />
                    )}
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-0.5 flex-wrap">
                {items.slice(0, 4).map((it: any, i: number) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={cn("size-2 rounded-full", KIND_STYLE[it.type]?.dot, it.done && "opacity-40")}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      )}

      {calendarMode === "month" && (
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold capitalize">
            {format(selected, "EEEE, d 'de' MMMM", { locale: es })}
          </h2>
          {weatherByDay[format(selected, "yyyy-MM-dd")] && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              {weatherByDay[format(selected, "yyyy-MM-dd")].precipProb > 65 ? (
                <CloudRain className="size-3.5 text-info" aria-hidden="true" />
              ) : (
                <Sun className="size-3.5 text-warning" aria-hidden="true" />
              )}
              {Math.round(weatherByDay[format(selected, "yyyy-MM-dd")].tempMax)}° /{" "}
              {Math.round(weatherByDay[format(selected, "yyyy-MM-dd")].tempMin)}° · Lluvia{" "}
              {weatherByDay[format(selected, "yyyy-MM-dd")].precipProb}%
            </span>
          )}
        </div>

        {selectedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos este día.</p>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((it: any, i: number) => (
              <li key={`${it.type}-${it.id ?? i}`} className={cn("rounded-lg border p-4", KIND_STYLE[it.type]?.card)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {it.type === "siembra" && <Sprout className="size-4 text-primary shrink-0" />}
                    {it.type === "cosecha" && <Wheat className="size-4 text-earth shrink-0" />}
                    <span className={cn("font-medium", it.done && "text-muted-foreground line-through")}>
                      {it.title}
                    </span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                      {it.done ? "Realizado" : KIND_STYLE[it.type]?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {it.starts_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(it.starts_at), "HH:mm")}
                      </span>
                    )}
                    {it.type === "event" && (
                      <>
                        {!it.done && (
                          <Button variant="outline" size="sm" onClick={() => markDone.mutate(it.id)} disabled={markDone.isPending}>
                            Realizado
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditEvent(it);
                            setEditOpen(true);
                          }}
                          aria-label={`Editar ${it.title}`}
                          className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(it.id)}
                          aria-label={`Eliminar ${it.title}`}
                          className="grid size-9 place-items-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {it.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-line">
                    {it.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) {
            setEditEvent(null);
            setEditInvItemId("");
            setEditInvQty("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar evento</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editEvent) return;
              const fd = new FormData(e.currentTarget);
              const rawCrop = (fd.get("crop_id") as string) || "";
              const parsed = editSchema.safeParse({
                title: fd.get("title"),
                starts_at: fd.get("starts_at"),
                description: (fd.get("description") as string) || undefined,
                crop_id: rawCrop && rawCrop !== "__none__" ? rawCrop : undefined,
              });
              if (!parsed.success) return toast.error(parsed.error.issues[0].message);
              updateEvent.mutate({
                id: editEvent.id,
                originalStartsAt: editEvent.starts_at,
                title: parsed.data.title,
                description: parsed.data.description,
                crop_id: parsed.data.crop_id,
                starts_at: parsed.data.starts_at,
                editInvItemId: editInvItemId && editInvItemId !== "__none__" ? editInvItemId : undefined,
                editInvQty: editInvQty ? Number(editInvQty) : undefined,
              });
            }}
            className="space-y-4"
          >
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
                defaultValue={editEvent?.starts_at ? format(new Date(editEvent.starts_at), "yyyy-MM-dd'T'HH:mm") : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea id="edit-description" name="description" rows={3} defaultValue={editEvent?.description ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Cultivo relacionado</Label>
              <Select name="crop_id" defaultValue={editEvent?.crop_id ?? "__none__"}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin cultivo asociado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin cultivo asociado</SelectItem>
                  {(crops.data ?? []).map((crop) => (
                    <SelectItem key={crop.id} value={crop.id}>
                      {(crop as any).crop_catalog?.name ?? "Cultivo"} - {(crop as any).parcels?.name ?? "Parcela"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Insumo del inventario (opcional)</Label>
              <div className="flex gap-2">
                <Select value={editInvItemId || "__none__"} onValueChange={(v) => setEditInvItemId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Sin insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin insumo</SelectItem>
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
              {editInvItemId &&
                editInvQty &&
                (() => {
                  const it = (inventoryItems.data ?? []).find((x) => x.id === editInvItemId);
                  if (!it) return null;
                  const remaining = Number(it.stock_qty) - Number(editInvQty);
                  return (
                    <p className={`text-xs ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      Stock tras uso: {remaining.toFixed(1)} {it.unit} {remaining < 0 ? "· Insuficiente" : ""}
                    </p>
                  );
                })()}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={updateEvent.isPending}>
                Guardar cambios
              </Button>
            </DialogFooter>
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
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteConfirm}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
