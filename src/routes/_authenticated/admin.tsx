import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAllUsersWithRoles,
  assignRole,
  revokeRole,
  getMyRoles,
  getAdminMetrics,
  listFarmerSummaries,
  listAlerts,
  runGenerateAlerts,
  type AdminUserRow,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Shield, UserCog, X, Users, MapPin, Sprout, ClipboardList,
  BellRing, Activity, FileBarChart2, RefreshCcw, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ROLES = ["agricultor", "tecnico", "admin"] as const;
type AppRole = (typeof ROLES)[number];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administración — SIGIC" }] }),
  beforeLoad: async () => {
    const roles = await getMyRoles();
    if (!roles.includes("admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const metrics = useQuery({ queryKey: ["admin-metrics"], queryFn: getAdminMetrics });
  const farmers = useQuery({ queryKey: ["admin-farmers"], queryFn: listFarmerSummaries });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: listAllUsersWithRoles });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const alertSettings = useQuery({
    queryKey: ["alert-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("alert_settings").select("*").eq("id", true).single();
      if (error) throw error;
      return data;
    },
  });
  const assignments = useQuery({ queryKey: ["technician-assignments"], queryFn: async () => {
    const { data, error } = await (supabase as any).from("technician_farmer_assignments").select("*");
    if (error) throw error; return data ?? [];
  }});

  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmerPage, setFarmerPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [assignmentTechnician, setAssignmentTechnician] = useState("");
  const [assignmentFarmer, setAssignmentFarmer] = useState("");
  const pageSize = 20;

  const filteredFarmers = useMemo(() => {
    const q = farmerSearch.trim().toLowerCase();
    const list = farmers.data ?? [];
    if (!q) return list;
    return list.filter((f) => f.full_name.toLowerCase().includes(q));
  }, [farmers.data, farmerSearch]);

  const userCount = users.data?.length ?? 0;
  useEffect(() => { setFarmerPage(1); }, [farmerSearch]);
  const farmerTotalPages = Math.max(1, Math.ceil(filteredFarmers.length / pageSize));
  const userTotalPages = Math.max(1, Math.ceil(userCount / pageSize));
  const paginatedFarmers = useMemo(() => filteredFarmers.slice((farmerPage - 1) * pageSize, farmerPage * pageSize), [filteredFarmers, farmerPage]);
  const paginatedUsers = useMemo(() => (users.data ?? []).slice((userPage - 1) * pageSize, userPage * pageSize), [users.data, userPage]);

  const assign = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => assignRole(userId, role),
    onSuccess: () => { toast.success("Rol asignado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => revokeRole(userId, role),
    onSuccess: () => { toast.success("Rol revocado"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteUserMut = useMutation({
    mutationFn: async (userId: string) => {
      const { deleteUser } = await import("@/lib/services/seed-data.server");
      return deleteUser({ data: { userId } });
    },
    onSuccess: () => {
      toast.success("Usuario eliminado permanentemente");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
      qc.invalidateQueries({ queryKey: ["admin-farmers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const genAlerts = useMutation({
    mutationFn: runGenerateAlerts,
    onSuccess: () => {
      toast.success("Alertas regeneradas");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveAlertSettings = useMutation({
    mutationFn: async (input: { planting_reminder_days: number; stock_alerts_enabled: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("alert_settings").update({ ...input, updated_by: auth.user?.id }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configuración de alertas guardada"); qc.invalidateQueries({ queryKey: ["alert-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const assignFarmer = useMutation({
    mutationFn: async () => {
      if (!assignmentTechnician || !assignmentFarmer) throw new Error("Selecciona técnico y agricultor");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("technician_farmer_assignments").upsert({ technician_id: assignmentTechnician, farmer_id: assignmentFarmer, created_by: auth.user?.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agricultor asignado al técnico"); qc.invalidateQueries({ queryKey: ["technician-assignments"] }); setAssignmentFarmer(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingAlerts = (alerts.data ?? []).filter((a) => a.status === "PENDIENTE").slice(0, 5);
  const m = metrics.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Shield className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Panel de administración</h1>
            <p className="text-sm text-muted-foreground">Métricas globales, agricultores y acciones rápidas.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => genAlerts.mutate()} disabled={genAlerts.isPending}>
            <RefreshCcw className="size-4 mr-1" /> Regenerar alertas
          </Button>
          <Button asChild size="sm"><Link to="/reports"><FileBarChart2 className="size-4 mr-1" /> Reportes</Link></Button>
        </div>
      </header>

      {/* Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Usuarios" value={m?.users ?? "—"} />
        <MetricCard icon={MapPin} label="Parcelas" value={m?.parcels ?? "—"} sub={m ? `${m.totalAreaM2.toLocaleString()} m²` : undefined} />
        <MetricCard icon={Sprout} label="Cultivos" value={m?.crops ?? "—"} sub={m ? `${m.activeCrops} activos` : undefined} />
        <MetricCard icon={ClipboardList} label="Actividades" value={m?.activities ?? "—"} />
      </section>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Farmers */}
        <section className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <h2 className="font-semibold">Agricultores ({filteredFarmers.length})</h2>
       </div>

       <section className="rounded-xl border border-border bg-card p-5 space-y-4">
         <div><h2 className="font-semibold">Configuración automática de alertas</h2><p className="text-sm text-muted-foreground">Los cambios se aplican al regenerar alertas o en la siguiente ejecución programada.</p></div>
         <div className="flex flex-wrap items-end gap-4">
           <div className="space-y-1.5"><Label htmlFor="reminder-days">Días de anticipación para siembra</Label><Input id="reminder-days" type="number" min="0" max="30" defaultValue={alertSettings.data?.planting_reminder_days ?? 1} key={alertSettings.data?.updated_at} className="w-36" onChange={(e) => { (e.currentTarget.dataset.value = e.currentTarget.value); }} /></div>
           <div className="flex items-center gap-2 pb-2"><Switch id="stock-alerts" defaultChecked={alertSettings.data?.stock_alerts_enabled ?? true} key={`stock-${alertSettings.data?.updated_at}`} /><Label htmlFor="stock-alerts">Alertas de stock mínimo</Label></div>
           <Button size="sm" disabled={saveAlertSettings.isPending || alertSettings.isLoading} onClick={() => {
             const days = Number((document.getElementById("reminder-days") as HTMLInputElement)?.value);
             const stock = (document.getElementById("stock-alerts") as HTMLButtonElement)?.getAttribute("data-state") === "checked";
             if (!Number.isInteger(days) || days < 0 || days > 30) return toast.error("Indica entre 0 y 30 días");
             saveAlertSettings.mutate({ planting_reminder_days: days, stock_alerts_enabled: stock });
           }}>Guardar configuración</Button>
         </div>
       </section>

       <section className="rounded-xl border border-border bg-card p-5 space-y-3">
         <div><h2 className="font-semibold">Asignación técnico–agricultor</h2><p className="text-sm text-muted-foreground">Los técnicos sólo podrán consultar los agricultores asignados aquí.</p></div>
         <div className="flex flex-wrap gap-2 items-center">
           <Select value={assignmentTechnician} onValueChange={setAssignmentTechnician}><SelectTrigger className="w-56"><SelectValue placeholder="Seleccionar técnico" /></SelectTrigger><SelectContent>{(users.data ?? []).filter(u => u.roles.includes("tecnico")).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select>
           <Select value={assignmentFarmer} onValueChange={setAssignmentFarmer}><SelectTrigger className="w-56"><SelectValue placeholder="Seleccionar agricultor" /></SelectTrigger><SelectContent>{(users.data ?? []).filter(u => u.roles.includes("agricultor")).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent></Select>
           <Button size="sm" disabled={assignFarmer.isPending} onClick={() => assignFarmer.mutate()}>Asignar acceso</Button>
         </div>
         <p className="text-xs text-muted-foreground">Asignaciones activas: {assignments.data?.length ?? 0}</p>
       </section>
            <div className="relative">
              <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar…"
                value={farmerSearch}
                onChange={(e) => setFarmerSearch(e.target.value)}
                className="pl-8 h-8 w-44"
              />
            </div>
          </div>
          {farmers.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
          ) : filteredFarmers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Nombre</th>
                    <th className="text-right px-4 py-2">Parcelas</th>
                    <th className="text-right px-4 py-2">Área (m²)</th>
                    <th className="text-right px-4 py-2">Cultivos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedFarmers.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{f.full_name || "(sin nombre)"}</td>
                      <td className="px-4 py-2 text-right">{f.parcels}</td>
                      <td className="px-4 py-2 text-right">{f.area_m2.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{f.crops}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredFarmers.length > pageSize && <PaginationBar page={farmerPage} totalPages={farmerTotalPages} onPageChange={setFarmerPage} />}
        </section>

        {/* Quick actions sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <BellRing className="size-4 text-primary" />
              <h2 className="font-semibold">Alertas pendientes ({m?.pendingAlerts ?? 0})</h2>
            </div>
            {pendingAlerts.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Sin alertas pendientes.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingAlerts.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.scheduled_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-border">
              <Button asChild size="sm" variant="ghost" className="w-full justify-start">
                <Link to="/alerts"><BellRing className="size-4 mr-1" /> Ver todas</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h2 className="font-semibold flex items-center gap-2"><Activity className="size-4 text-primary" /> Atajos</h2>
            <Button asChild variant="outline" size="sm" className="w-full justify-start"><Link to="/parcels"><MapPin className="size-4 mr-1" /> Parcelas</Link></Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start"><Link to="/calendar"><ClipboardList className="size-4 mr-1" /> Calendario</Link></Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start"><Link to="/reports"><FileBarChart2 className="size-4 mr-1" /> Reportes</Link></Button>
          </div>


        </aside>
      </div>

      {/* Roles management */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <UserCog className="size-4 text-primary" />
          <h2 className="font-semibold">Roles de usuarios ({users.data?.length ?? 0})</h2>
        </div>
        {users.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
        ) : (users.data?.length ?? 0) === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No hay usuarios registrados aún.</p>
        ) : (
          <ul className="divide-y divide-border">
            {paginatedUsers.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onAssign={(role) => assign.mutate({ userId: u.id, role })}
                onRevoke={(role) => revoke.mutate({ userId: u.id, role })}
                onDelete={() => { if (confirm(`¿Eliminar permanentemente a "${u.full_name}"?\n\nSe borrarán todas sus parcelas, cultivos, actividades, cosechas, costos, inventario y alertas. No se puede deshacer.`)) deleteUserMut.mutate(u.id); }}
                busy={assign.isPending || revoke.isPending || deleteUserMut.isPending}
              />
            ))}
          </ul>
        )}
        {userCount > pageSize && <PaginationBar page={userPage} totalPages={userTotalPages} onPageChange={setUserPage} />}
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) {
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

function UserRow({
  user, onAssign, onRevoke, onDelete, busy,
}: {
  user: AdminUserRow;
  onAssign: (role: AppRole) => void;
  onRevoke: (role: AppRole) => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  const available = ROLES.filter((r) => !user.roles.includes(r));
  const [pending, setPending] = useState<AppRole | "">("");

  return (
    <li className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <p className="font-medium">{user.full_name || "(sin nombre)"}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{user.id}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {user.roles.length === 0 && (
            <span className="text-xs text-muted-foreground italic">Sin roles</span>
          )}
          {user.roles.map((r) => (
            <Badge key={r} variant="secondary" className="gap-1">
              {r}
              <button
                disabled={busy}
                onClick={() => onRevoke(r as AppRole)}
                className="hover:text-destructive"
                aria-label={`Revocar ${r}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={pending} onValueChange={(v) => setPending(v as AppRole)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Asignar rol…" /></SelectTrigger>
          <SelectContent>
            {available.length === 0 && (
              <SelectItem value="__none__" disabled>Sin roles disponibles</SelectItem>
            )}
            {available.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={busy || !pending}
          onClick={() => { if (pending) { onAssign(pending); setPending(""); } }}
        >Asignar</Button>
        {onDelete && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete} className="text-muted-foreground hover:text-destructive" title="Eliminar usuario">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </li>
  );
}
