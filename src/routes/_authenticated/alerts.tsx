import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { supabase } from "@/integrations/supabase/client";
import { listAlerts, getMyRoles } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, BellOff, Check, CheckCheck, Plus, Trash2, CalendarPlus, PackageSearch } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Notificaciones y Avisos — SIGIC" }] }),
  component: AlertsPage,
});

function extractStockKeywordFromAlert(title: string, body?: string | null): string | undefined {
  const combined = `${title} ${body ?? ""}`;
  const quoted = combined.match(/["«“]([^"»”]+)["»”]/);
  if (quoted?.[1]) return quoted[1].trim();
  const colonSplit = title.split(":");
  if (colonSplit.length > 1 && colonSplit[1].trim()) {
    return colonSplit[1].replace(/\([^)]*\)/g, "").trim();
  }
  return undefined;
}

function AlertsPage() {
  const navigate = useNavigate();
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const qc = useQueryClient();
  const isStaff = (roles.data ?? []).some((r) => ["tecnico", "admin"].includes(r));

  const recipients = useQuery({
    queryKey: ["manual-alert-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_manual_alert_recipients");
      if (error) throw error;
      return data;
    },
    enabled: isStaff,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("alerts").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["alerts"] });
      const previousAlerts = qc.getQueryData<any[]>(["alerts"]);
      if (previousAlerts) {
        qc.setQueryData(
          ["alerts"],
          previousAlerts.map((a) => (a.id === id ? { ...a, status } : a))
        );
      }
      return { previousAlerts };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previousAlerts) qc.setQueryData(["alerts"], ctx.previousAlerts);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["pending-alerts-count"] });
    },
  });

  const markAllHandled = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("alerts").update({ status: "ATENDIDA" as any }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Todas las notificaciones marcadas como atendidas");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["pending-alerts-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 15;
  const [newOpen, setNewOpen] = useState(false);
  const [alertFarmer, setAlertFarmer] = useState("");
  const [alertKind, setAlertKind] = useState("RIEGO");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertBody, setAlertBody] = useState("");

  const createAlert = useMutation({
    mutationFn: async () => {
      if (!isStaff) throw new Error("Los agricultores no tienen permisos para generar notificaciones manuales.");
      if (!alertTitle.trim()) throw new Error("El título es obligatorio");
      if (!alertFarmer) throw new Error("Selecciona un destinatario");
      const { error } = await supabase.rpc("create_manual_alert", {
        p_recipient_id: alertFarmer,
        p_kind: alertKind as any,
        p_title: alertTitle.trim(),
        p_body: alertBody.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aviso enviado inmediatamente");
      setNewOpen(false);
      setAlertTitle("");
      setAlertBody("");
      setAlertFarmer("");
      setAlertKind("RIEGO");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["pending-alerts-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (alerts.data ?? []).filter((a) => a.status === "PENDIENTE");
  const automatic = pending.filter((a) => a.origin === "AUTOMATICA");
  const manual = pending.filter((a) => a.origin === "MANUAL");
  const handled = (alerts.data ?? []).filter((a) => a.status !== "PENDIENTE");
  const historyPages = Math.max(1, Math.ceil(handled.length / pageSize));
  const paginatedHandled = useMemo(
    () => handled.slice((historyPage - 1) * pageSize, historyPage * pageSize),
    [handled, historyPage]
  );

  useEffect(() => {
    if (historyPage > historyPages) setHistoryPage(historyPages);
  }, [historyPage, historyPages]);

  const handleResolveAction = (alertItem: any) => {
    if (alertItem.kind === "STOCK") {
      const kw = extractStockKeywordFromAlert(alertItem.title, alertItem.body);
      navigate({
        to: "/inventory",
        search: { q: kw, lowStock: true },
      });
      return;
    }

    navigate({
      to: "/calendar",
      search: {
        openNew: true,
        title: alertItem.title?.slice(0, 140),
        description: alertItem.body?.slice(0, 480) ?? `Seguimiento a alerta de ${alertItem.kind}`,
        cropId: alertItem.crop_id ?? undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alertas y Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            Avisos inteligentes con acciones directas hacia Calendario e Inventario.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              disabled={markAllHandled.isPending}
              onClick={() => markAllHandled.mutate(pending.map((p) => p.id))}
            >
              <CheckCheck className="size-4 mr-1.5" />
              Atender todas ({pending.length})
            </Button>
          )}

          {isStaff && (
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-1" /> Enviar aviso
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Notificación inmediata</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createAlert.mutate(); }} className="space-y-4">
                  {isStaff && (
                    <div className="space-y-1.5">
                      <Label>Asignar a</Label>
                      <Combobox
                        value={alertFarmer}
                        onChange={setAlertFarmer}
                        options={(recipients.data ?? []).map((person) => ({
                          value: person.id,
                          label: `${person.full_name} (${person.role})`,
                        }))}
                        placeholder="Seleccionar destinatario"
                        searchPlaceholder="Buscar destinatario…"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Tipo de aviso</Label>
                    <Select value={alertKind} onValueChange={setAlertKind}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["RIEGO", "FERTILIZACION", "COSECHA", "CLIMA", "VENCIDA", "HELADA", "STOCK"].map((k) => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Título del aviso</Label>
                    <Input value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} placeholder="Ej: Revisar riego" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descripción (opcional)</Label>
                    <Input value={alertBody} onChange={(e) => setAlertBody(e.target.value)} placeholder="Detalles adicionales" />
                  </div>
                  <Button type="submit" className="w-full" disabled={createAlert.isPending}>
                    Enviar aviso ahora
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      {alerts.isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground" role="status">
          Cargando avisos…
        </div>
      )}
      {alerts.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-sm text-destructive" role="alert">
          No se pudieron cargar las notificaciones. Intenta recargar la sección.
        </div>
      )}
      {!alerts.isLoading && !alerts.isError && (
        <>
          <AlertSection
            title="Automáticas"
            alerts={automatic}
            busy={setStatus.isPending}
            onStatus={(id, status) => setStatus.mutate({ id, status })}
            onResolveAction={handleResolveAction}
          />
          <AlertSection
            title={isStaff ? "Manuales enviadas/recibidas" : "De tu técnico"}
            alerts={manual}
            busy={setStatus.isPending}
            onStatus={(id, status) => setStatus.mutate({ id, status })}
            onResolveAction={handleResolveAction}
          />
          {pending.length === 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Bell className="size-4 text-warning" /> Avisos pendientes
              </h2>
              <div className="p-8 border border-dashed border-border rounded-xl text-center">
                <BellOff className="size-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No tienes avisos ni notificaciones pendientes.</p>
              </div>
            </section>
          )}
          {handled.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                Historial de avisos ({handled.length})
              </h2>
              <ul className="space-y-2">
                {paginatedHandled.map((a) => (
                  <li key={a.id} className="p-3 rounded-lg border border-border bg-card text-sm flex items-center justify-between gap-2">
                    <span>
                      <span className="text-muted-foreground">[{a.status}]</span> {a.title}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(a.scheduled_at), "dd MMM yyyy", { locale: es })}
                    </span>
                  </li>
                ))}
              </ul>
              {handled.length > pageSize && (
                <PaginationBar page={historyPage} totalPages={historyPages} onPageChange={setHistoryPage} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AlertSection({
  title,
  alerts,
  busy,
  onStatus,
  onResolveAction,
}: {
  title: string;
  alerts: any[];
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  onResolveAction: (alertItem: any) => void;
}) {
  if (alerts.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Bell className="size-4 text-warning" /> {title} ({alerts.length})
      </h2>
      <ul className="space-y-2.5">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="p-4 rounded-xl border border-warning/30 bg-warning/5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning-foreground font-medium">
                  {a.kind}
                </span>
                <span className="font-medium">{a.title}</span>
              </div>
              {a.body && <p className="text-sm text-muted-foreground">{a.body}</p>}
              {a.sender?.full_name && <p className="text-xs text-muted-foreground">Enviada por: {a.sender.full_name}</p>}
              <p className="text-xs text-muted-foreground">
                {format(new Date(a.scheduled_at), "dd MMM yyyy HH:mm", { locale: es })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <Button type="button" size="sm" variant="outline" onClick={() => onResolveAction(a)} className="h-8 text-xs gap-1.5 bg-card">
                {a.kind === "STOCK" ? (
                  <>
                    <PackageSearch className="size-3.5 text-primary" />
                    Ver en Inventario
                  </>
                ) : (
                  <>
                    <CalendarPlus className="size-3.5 text-primary" />
                    Agendar labor
                  </>
                )}
              </Button>
              <Button size="icon" variant="ghost" disabled={busy} onClick={() => onStatus(a.id, "ATENDIDA")} aria-label="Marcar aviso como atendido" title="Marcar como atendido">
                <Check className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" disabled={busy} onClick={() => onStatus(a.id, "DESCARTADA")} aria-label="Descartar aviso" title="Descartar">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
