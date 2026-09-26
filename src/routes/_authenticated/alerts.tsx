import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { supabase } from "@/integrations/supabase/client";
import { listAlerts, getMyRoles } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, BellOff, Check, Plus, Trash2, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alertas — SIGIC" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const qc = useQueryClient();
  const isStaff = (roles.data ?? []).some((r) => ["tecnico", "admin"].includes(r));

  const farmers = useQuery({
    queryKey: ["farmers-for-alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data ?? [];
    },
    enabled: isStaff,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("alerts").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 15;
  const [newOpen, setNewOpen] = useState(false);
  const [alertFarmer, setAlertFarmer] = useState("__self__");
  const [alertKind, setAlertKind] = useState("RIEGO");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertBody, setAlertBody] = useState("");

  const createAlert = useMutation({
    mutationFn: async () => {
      if (!alertTitle.trim()) throw new Error("El título es obligatorio");
      const targetUser = isStaff && alertFarmer && alertFarmer !== "__self__" ? alertFarmer : (await supabase.auth.getUser()).data.user!.id;
      const { error } = await supabase.from("alerts").insert({
        user_id: targetUser,
        kind: alertKind as any,
        title: alertTitle.trim(),
        body: alertBody.trim() || null,
        scheduled_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aviso enviado inmediatamente");
      setNewOpen(false);
      setAlertTitle("");
      setAlertBody("");
      setAlertFarmer("__self__");
      setAlertKind("RIEGO");
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (alerts.data ?? []).filter((a) => a.status === "PENDIENTE");
  const handled = (alerts.data ?? []).filter((a) => a.status !== "PENDIENTE");
  const pendingPages = Math.max(1, Math.ceil(pending.length / pageSize));
  const historyPages = Math.max(1, Math.ceil(handled.length / pageSize));
  const paginatedPending = useMemo(() => pending.slice((pendingPage - 1) * pageSize, pendingPage * pageSize), [pending, pendingPage]);
  const paginatedHandled = useMemo(() => handled.slice((historyPage - 1) * pageSize, historyPage * pageSize), [handled, historyPage]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alertas y Notificaciones</h1>
          <p className="text-sm text-muted-foreground">Avisos y recordatorios del sistema.</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Enviar aviso</Button>
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
                    options={[
                      { value: "__self__", label: "A mí mismo" },
                      ...(farmers.data ?? []).map((f: any) => ({ value: f.id, label: f.full_name })),
                    ]}
                    placeholder="A mí mismo"
                    searchPlaceholder="Buscar agricultor…"
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
              <Button type="submit" className="w-full" disabled={createAlert.isPending}>Enviar aviso ahora</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Bell className="size-4 text-warning" /> Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center">
            <BellOff className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">No tienes alertas pendientes.</p>
          </div>
        ) : (
          <><ul className="space-y-2">
            {paginatedPending.map((a: any) => (
              <li key={a.id} className="p-4 rounded-lg border border-warning/30 bg-warning/5 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning-foreground font-medium">{a.kind}</span>
                    <span className="font-medium">{a.title}</span>
                    {a.profiles?.full_name && isStaff && <span className="text-xs text-primary flex items-center gap-0.5"><User className="size-3" />{a.profiles.full_name}</span>}
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
          {pending.length > pageSize && <PaginationBar page={pendingPage} totalPages={pendingPages} onPageChange={setPendingPage} />}
          </>
        )}
      </section>

      {handled.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Historial ({handled.length})</h2>
          <ul className="space-y-2">
            {paginatedHandled.map((a) => (
              <li key={a.id} className="p-3 rounded-lg border border-border bg-card text-sm flex items-center justify-between">
                <span><span className="text-muted-foreground">[{a.status}]</span> {a.title}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(a.scheduled_at), "dd MMM")}</span>
              </li>
            ))}
          </ul>
          {handled.length > pageSize && <PaginationBar page={historyPage} totalPages={historyPages} onPageChange={setHistoryPage} />}
        </section>
      )}
    </div>
  );
}
