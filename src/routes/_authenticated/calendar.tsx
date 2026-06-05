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
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addMonths, endOfMonth, format, startOfMonth, startOfWeek, addDays, isSameDay, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendario — SGIC" }] }),
  component: CalendarPage,
});

const eventSchema = z.object({
  title: z.string().trim().min(2).max(150),
  starts_at: z.string().min(1),
  description: z.string().max(500).optional(),
});

function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date>(new Date());
  const qc = useQueryClient();

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const events = useQuery({
    queryKey: ["events", monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: () => listEvents(gridStart, addDays(gridStart, 42)),
  });

  const create = useMutation({
    mutationFn: async (data: z.infer<typeof eventSchema>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sesión expirada");
      const { error } = await supabase.from("calendar_events").insert({
        user_id: u.user.id,
        title: data.title,
        description: data.description ?? null,
        starts_at: new Date(data.starts_at).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento creado");
      qc.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = eventSchema.safeParse({
      title: fd.get("title"),
      starts_at: fd.get("starts_at"),
      description: (fd.get("description") as string) || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    create.mutate(parsed.data);
  }

  const eventsByDay = (events.data ?? []).reduce<Record<string, any[]>>((acc, e) => {
    const key = format(new Date(e.starts_at), "yyyy-MM-dd");
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  const selectedEvents = eventsByDay[format(selected, "yyyy-MM-dd")] ?? [];

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
                  <Input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={format(selected, "yyyy-MM-dd'T'09:00")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" name="description" rows={3} />
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
          const evs = eventsByDay[key] ?? [];
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
                {evs.slice(0, 3).map((e) => (
                  <span key={e.id} className="size-1.5 rounded-full bg-primary" />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3 capitalize">{format(selected, "EEEE, d 'de' MMMM", { locale: es })}</h2>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos este día.</p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => (
              <li key={e.id} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(e.starts_at), "HH:mm")}</span>
                </div>
                {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
