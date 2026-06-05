import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listAlerts } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alertas — SGIC" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const qc = useQueryClient();

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("alerts").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (alerts.data ?? []).filter((a) => a.status === "PENDIENTE");
  const handled = (alerts.data ?? []).filter((a) => a.status !== "PENDIENTE");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Alertas</h1>
        <p className="text-sm text-muted-foreground">Notificaciones y recordatorios.</p>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Bell className="size-4 text-warning" /> Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center">
            <BellOff className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">No tienes alertas pendientes.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((a) => (
              <li key={a.id} className="p-4 rounded-lg border border-warning/30 bg-warning/5 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning-foreground font-medium">{a.kind}</span>
                    <span className="font-medium">{a.title}</span>
                  </div>
                  {a.body && <p className="text-sm text-muted-foreground mt-1">{a.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(a.scheduled_at), "dd MMM yyyy HH:mm", { locale: es })}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "ATENDIDA" })}><Check className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setStatus.mutate({ id: a.id, status: "DESCARTADA" })}><Trash2 className="size-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {handled.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Historial</h2>
          <ul className="space-y-2">
            {handled.slice(0, 20).map((a) => (
              <li key={a.id} className="p-3 rounded-lg border border-border bg-card text-sm flex items-center justify-between">
                <span><span className="text-muted-foreground">[{a.status}]</span> {a.title}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(a.scheduled_at), "dd MMM")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
