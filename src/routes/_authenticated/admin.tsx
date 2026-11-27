import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAllUsersWithRoles,
  listAllUsersWithRolesPage,
  assignRole,
  revokeRole,
  getMyRoles,
  getAdminMetrics,
  listFarmerSummaries,
  listAlerts,
  runGenerateAlerts,
  type AdminUserRow,
  type FarmerSummary,
} from "@/lib/queries";
import { setGlobalProducerScope } from "@/components/admin/producer-scope-bar";
import { BulkCsvImportDialog } from "@/components/admin/bulk-csv-import-dialog";
import { BulkInventoryCsvDialog } from "@/components/inventory/bulk-inventory-csv-dialog";
import { compressImageFileToDataUrl, fetchOrgBranding, saveOrgBranding } from "@/lib/org-branding";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  UserCog,
  X,
  Users,
  MapPin,
  Sprout,
  ClipboardList,
  BellRing,
  Activity,
  FileBarChart2,
  RefreshCcw,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Link2Off,
  Tractor,
  Package2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Stethoscope,
  Building2,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const navigate = useNavigate();
  const pageSize = 16;

  const [activeTab, setActiveTab] = useState("fincas");
  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmFilter, setFarmFilter] = useState<"ALL" | "WITH_PARCELS" | "UNASSIGNED">("ALL");
  const [farmerPage, setFarmerPage] = useState(1);

  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | AppRole>("ALL");
  const [userPage, setUserPage] = useState(1);

  const [assignmentTechnician, setAssignmentTechnician] = useState("");
  const [assignmentFarmer, setAssignmentFarmer] = useState("");
  const [plantingReminderDays, setPlantingReminderDays] = useState("1");
  const [stockAlertThreshold, setStockAlertThreshold] = useState("0");
  const [stockAlertsEnabled, setStockAlertsEnabled] = useState(true);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; name: string } | null>(null);

  const [orgName, setOrgName] = useState("");
  const [orgNit, setOrgNit] = useState("");
  const [orgMunicipality, setOrgMunicipality] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");

  const metrics = useQuery({ queryKey: ["admin-metrics"], queryFn: getAdminMetrics });
  const farmers = useQuery({ queryKey: ["admin-farmers"], queryFn: listFarmerSummaries });
  const users = useQuery({
    queryKey: ["admin-users", userPage, userSearch],
    queryFn: () => listAllUsersWithRolesPage({ page: userPage, pageSize: 20, search: userSearch }),
    placeholderData: (previous) => previous,
  });
  const userDirectory = useQuery({ queryKey: ["admin-user-directory"], queryFn: listAllUsersWithRoles });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });
  const alertSettings = useQuery({
    queryKey: ["alert-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("alert_settings").select("*").eq("id", true).single();
      if (error) throw error;
      return data;
    },
  });

  const orgBrandingQuery = useQuery({
    queryKey: ["org-branding"],
    queryFn: fetchOrgBranding,
  });

  useEffect(() => {
    if (!orgBrandingQuery.data) return;
    setOrgName(orgBrandingQuery.data.orgName);
    setOrgNit(orgBrandingQuery.data.orgNit);
    setOrgMunicipality(orgBrandingQuery.data.orgMunicipality);
    setOrgLogoUrl(orgBrandingQuery.data.orgLogoUrl);
  }, [orgBrandingQuery.data]);

  const saveBrandingMut = useMutation({
    mutationFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      return saveOrgBranding(
        { orgName, orgNit, orgMunicipality, orgLogoUrl },
        uid
      );
    },
    onSuccess: () => {
      toast.success("Identidad institucional guardada para Reportes PDF y Certificados");
      qc.invalidateQueries({ queryKey: ["org-branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignments = useQuery({
    queryKey: ["technician-assignments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("technician_farmer_assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientErrors = useQuery({
    queryKey: ["admin-client-errors"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_error_logs")
        .select("id, route, boundary, message, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) return [];
      return data ?? [];
    },
  });

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of userDirectory.data ?? []) {
      map.set(u.id, u.full_name || u.id.slice(0, 8));
    }
    return map;
  }, [userDirectory.data]);

  const techsByFarmerId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const asg of assignments.data ?? []) {
      const tName = userNameById.get(asg.technician_id) ?? asg.technician_id?.slice(0, 8);
      const list = map.get(asg.farmer_id) ?? [];
      list.push(tName);
      map.set(asg.farmer_id, list);
    }
    return map;
  }, [assignments.data, userNameById]);

  const assignmentsByTechnician = useMemo(() => {
    const map = new Map<string, { techId: string; techName: string; farms: { farmerId: string; farmerName: string }[] }>();
    for (const u of (userDirectory.data ?? []).filter((x) => x.roles.includes("tecnico"))) {
      map.set(u.id, { techId: u.id, techName: u.full_name || u.id.slice(0, 8), farms: [] });
    }
    for (const asg of assignments.data ?? []) {
      const techId = asg.technician_id;
      const techName = userNameById.get(techId) ?? techId?.slice(0, 8);
      if (!map.has(techId)) {
        map.set(techId, { techId, techName, farms: [] });
      }
      map.get(techId)!.farms.push({
        farmerId: asg.farmer_id,
        farmerName: userNameById.get(asg.farmer_id) ?? asg.farmer_id?.slice(0, 8),
      });
    }
    return Array.from(map.values());
  }, [userDirectory.data, assignments.data, userNameById]);

  const filteredFarmers = useMemo(() => {
    const q = farmerSearch.trim().toLowerCase();
    return (farmers.data ?? []).filter((f) => {
      if (farmFilter === "WITH_PARCELS" && f.parcels === 0) return false;
      if (farmFilter === "UNASSIGNED" && (techsByFarmerId.get(f.id)?.length ?? 0) > 0) return false;
      if (!q) return true;
      const parcelMatch = (f.parcel_details ?? []).some((p) => p.name.toLowerCase().includes(q));
      return f.full_name.toLowerCase().includes(q) || parcelMatch;
    });
  }, [farmers.data, farmerSearch, farmFilter, techsByFarmerId]);

  const userCount = users.data?.count ?? 0;
  const paginatedUsers = useMemo(() => {
    const base = users.data?.data ?? [];
    if (roleFilter === "ALL") return base;
    return base.filter((u) => u.roles.includes(roleFilter));
  }, [users.data?.data, roleFilter]);

  useEffect(() => {
    setFarmerPage(1);
  }, [farmerSearch, farmFilter]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, roleFilter]);

  const farmerTotalPages = Math.max(1, Math.ceil(filteredFarmers.length / pageSize));
  const userTotalPages = Math.max(1, Math.ceil(userCount / 20));
  const paginatedFarmers = useMemo(
    () => filteredFarmers.slice((farmerPage - 1) * pageSize, farmerPage * pageSize),
    [filteredFarmers, farmerPage]
  );

  useEffect(() => {
    const settings = alertSettings.data;
    if (!settings) return;
    setPlantingReminderDays(String(settings.planting_reminder_days ?? 1));
    setStockAlertThreshold(String(settings.stock_alert_threshold ?? 0));
    setStockAlertsEnabled(Boolean(settings.stock_alerts_enabled));
  }, [alertSettings.data]);

  const assign = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => assignRole(userId, role),
    onSuccess: () => {
      toast.success("Rol asignado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
      qc.invalidateQueries({ queryKey: ["admin-farmers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => revokeRole(userId, role),
    onSuccess: () => {
      toast.success("Rol revocado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
      qc.invalidateQueries({ queryKey: ["admin-farmers"] });
    },
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
    mutationFn: async (input: { planting_reminder_days: number; stock_alerts_enabled: boolean; stock_alert_threshold: number }) => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      const { error } = await (supabase as any)
        .from("alert_settings")
        .update({ ...input, updated_by: uid })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración de alertas guardada");
      qc.invalidateQueries({ queryKey: ["alert-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignFarmer = useMutation({
    mutationFn: async () => {
      if (!assignmentTechnician || !assignmentFarmer) throw new Error("Selecciona técnico y agricultor");
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      const { error } = await (supabase as any)
        .from("technician_farmer_assignments")
        .upsert({ technician_id: assignmentTechnician, farmer_id: assignmentFarmer, created_by: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Finca asignada al técnico");
      qc.invalidateQueries({ queryKey: ["technician-assignments"] });
      setAssignmentFarmer("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAssignment = useMutation({
    mutationFn: async (params: { technicianId: string; farmerId: string }) => {
      const { error } = await (supabase as any)
        .from("technician_farmer_assignments")
        .delete()
        .eq("technician_id", params.technicianId)
        .eq("farmer_id", params.farmerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asignación revocada");
      qc.invalidateQueries({ queryKey: ["technician-assignments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportFarmersDirectoryCsv = () => {
    const rows = filteredFarmers;
    if (!rows.length) return;
    const headers = ["unidad_productiva", "telefono", "parcelas", "area_ha", "cultivos_activos", "cultivos_totales", "tecnico_asignado"];
    const csvLines = rows.map((r) =>
      [
        `"${(r.full_name || "").replace(/"/g, '""')}"`,
        `"${(r.phone || "").replace(/"/g, '""')}"`,
        r.parcels,
        (r.area_m2 / 10000).toFixed(2),
        r.active_crops,
        r.crops,
        `"${(techsByFarmerId.get(r.id)?.join(" / ") || "Sin asignar").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const blob = new Blob(["\uFEFF" + [headers.join(","), ...csvLines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "directorio-fincas-sigic.csv";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const navigateWithFarmFocus = (farmerId: string, to: "/parcels" | "/cultivos" | "/inventory" | "/reports") => {
    setGlobalProducerScope(farmerId);
    navigate({ to });
  };

  const pendingAlerts = (alerts.data ?? []).filter((a) => a.status === "PENDIENTE").slice(0, 8);
  const m = metrics.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Shield className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Centro de Administración</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Gestión estructurada por unidad productiva/finca, supervisión técnica, roles y salud operativa.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => genAlerts.mutate()} disabled={genAlerts.isPending}>
            <RefreshCcw className="size-4 mr-1" /> Regenerar alertas
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/audit">
              <ClipboardList className="size-4 mr-1" /> Auditoría
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/reports">
              <FileBarChart2 className="size-4 mr-1" /> Centro de Reportes
            </Link>
          </Button>
        </div>
      </header>

      {/* Indicadores Globales Consolidados */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Tractor} label="Fincas / Productores" value={farmers.data?.length ?? "—"} sub={`${m?.users ?? 0} cuentas totales`} />
        <MetricCard icon={MapPin} label="Parcelas Catastradas" value={m?.parcels ?? "—"} sub={m ? `${(m.totalAreaM2 / 10000).toFixed(2)} ha totales` : undefined} />
        <MetricCard icon={Sprout} label="Cultivos Registrados" value={m?.crops ?? "—"} sub={m ? `${m.activeCrops} en producción activa` : undefined} />
        <MetricCard icon={BellRing} label="Alertas Pendientes" value={m?.pendingAlerts ?? "—"} sub={`${m?.activities ?? 0} labores históricas`} />
      </section>

      {/* Navegación limpia en 4 pestañas administrativas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="bg-muted/60 p-1.5 w-full flex flex-wrap justify-start h-auto gap-1">
          <TabsTrigger value="fincas" className="text-xs sm:text-sm gap-1.5 py-2 px-3">
            <Tractor className="size-4" />
            Fincas y Productores ({farmers.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="asignaciones" className="text-xs sm:text-sm gap-1.5 py-2 px-3">
            <Stethoscope className="size-4" />
            Asignaciones Técnico–Finca ({assignments.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="text-xs sm:text-sm gap-1.5 py-2 px-3">
            <UserCog className="size-4" />
            Usuarios y Roles ({userCount})
          </TabsTrigger>
          <TabsTrigger value="sistema" className="text-xs sm:text-sm gap-1.5 py-2 px-3">
            <Activity className="size-4" />
            Alertas y Salud Técnica
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: DIRECTORIO ORGANIZADO POR FINCA / UNIDAD PRODUCTIVA */}
        <TabsContent value="fincas" className="space-y-4">
          <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Buscar por nombre de productor o nombre de parcela…"
                  value={farmerSearch}
                  onChange={(e) => setFarmerSearch(e.target.value)}
                  aria-label="Buscar finca o productor"
                  className="pl-8"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {[
                  { id: "ALL", label: "Todas las fincas" },
                  { id: "WITH_PARCELS", label: "Con parcelas activas" },
                  { id: "UNASSIGNED", label: "Sin técnico asignado" },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFarmFilter(chip.id as any)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      farmFilter === chip.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
              <BulkCsvImportDialog />
              <BulkInventoryCsvDialog isAdmin buttonLabel="Importar Bodegas CSV" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={filteredFarmers.length === 0}
                onClick={exportFarmersDirectoryCsv}
              >
                <Download className="size-3.5" /> Exportar Directorio CSV
              </Button>
            </div>
          </Card>

          {farmers.isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Cargando unidades productivas…</p>
          ) : farmers.isError ? (
            <Card className="p-6 text-center text-sm text-destructive" role="alert">
              No se pudieron cargar las unidades productivas.
            </Card>
          ) : filteredFarmers.length === 0 ? (
            <Card className="p-10 text-center border-dashed text-sm text-muted-foreground">
              No hay fincas que coincidan con el criterio seleccionado.
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginatedFarmers.map((farm) => (
                <FarmUnitCard
                  key={farm.id}
                  farm={farm}
                  assignedTechs={techsByFarmerId.get(farm.id) ?? []}
                  onNavigate={(target) => navigateWithFarmFocus(farm.id, target)}
                />
              ))}
            </div>
          )}

          {filteredFarmers.length > pageSize && (
            <PaginationBar page={farmerPage} totalPages={farmerTotalPages} onPageChange={setFarmerPage} />
          )}
        </TabsContent>

        {/* PESTAÑA 2: ASIGNACIONES AGRUPADAS POR TÉCNICO */}
        <TabsContent value="asignaciones" className="space-y-5">
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-base">Vincular Técnico Agrónomo a una Finca</h2>
              <p className="text-xs text-muted-foreground">
                Cada técnico supervisará únicamente las unidades productivas que tenga asignadas aquí.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 items-center">
              <Select value={assignmentTechnician} onValueChange={setAssignmentTechnician}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="1. Seleccionar técnico…" />
                </SelectTrigger>
                <SelectContent>
                  {(userDirectory.data ?? [])
                    .filter((u) => u.roles.includes("tecnico"))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={assignmentFarmer} onValueChange={setAssignmentFarmer}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="2. Seleccionar finca / productor…" />
                </SelectTrigger>
                <SelectContent>
                  {(farmers.data ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.full_name} ({f.parcels} lotes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                disabled={assignFarmer.isPending || userDirectory.isLoading}
                onClick={() => assignFarmer.mutate()}
                className="gap-1.5"
              >
                <UserCheck className="size-4" /> Asignar supervisión
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignmentsByTechnician.length === 0 ? (
              <Card className="p-8 text-center border-dashed col-span-2 text-sm text-muted-foreground">
                Aún no hay usuarios con el rol «tecnico» registrados. Asígnalo desde la pestaña Usuarios y Roles.
              </Card>
            ) : (
              assignmentsByTechnician.map((group) => (
                <Card key={group.techId} className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary font-bold text-xs">
                        {group.techName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{group.techName}</h3>
                        <p className="text-[11px] text-muted-foreground">Técnico Agrónomo</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {group.farms.length} finca{group.farms.length !== 1 ? "s" : ""} a cargo
                    </Badge>
                  </div>

                  {group.farms.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Sin fincas asignadas actualmente.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/50 text-xs">
                      {group.farms.map((f) => (
                        <li key={f.farmerId} className="py-2 flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{f.farmerName}</span>
                          <button
                            type="button"
                            disabled={removeAssignment.isPending}
                            onClick={() =>
                              removeAssignment.mutate({
                                technicianId: group.techId,
                                farmerId: f.farmerId,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Link2Off className="size-3" /> Desvincular
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* PESTAÑA 3: USUARIOS Y ROLES */}
        <TabsContent value="usuarios" className="space-y-4">
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "ALL", label: "Todos" },
                  { id: "agricultor", label: "Agricultores" },
                  { id: "tecnico", label: "Técnicos" },
                  { id: "admin", label: "Administradores" },
                ].map((rf) => (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => setRoleFilter(rf.id as any)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      roleFilter === rf.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Buscar cuenta por nombre…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  aria-label="Buscar usuario por nombre"
                  className="pl-8 h-9 w-full sm:w-56"
                />
              </div>
            </div>
            {users.isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Cargando cuentas…</p>
            ) : users.isError ? (
              <p className="p-6 text-sm text-destructive" role="alert">
                No se pudieron cargar los usuarios.
              </p>
            ) : paginatedUsers.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No hay cuentas que coincidan con el filtro.</p>
            ) : (
              <ul className="divide-y divide-border">
                {paginatedUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onAssign={(role) => assign.mutate({ userId: u.id, role })}
                    onRevoke={(role) => revoke.mutate({ userId: u.id, role })}
                    onDelete={() => setDeleteUserTarget({ id: u.id, name: u.full_name || "este usuario" })}
                    busy={assign.isPending || revoke.isPending || deleteUserMut.isPending}
                  />
                ))}
              </ul>
            )}
            {userCount > 20 && <PaginationBar page={userPage} totalPages={userTotalPages} onPageChange={setUserPage} />}
          </section>
        </TabsContent>

        {/* PESTAÑA 4: IDENTIDAD COOPERATIVA, REGLAS DE ALERTAS Y SALUD DEL SISTEMA */}
        <TabsContent value="sistema" className="space-y-5">
          <Card className="p-5 space-y-4 border-primary/25">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Identidad Institucional (Cooperativa / Asociación / Empresa)
                </h2>
                <p className="text-xs text-muted-foreground">
                  El nombre, NIT y logo configurados aquí se estampan automáticamente en todos los Reportes PDF y Certificados Oficiales BPA/QR.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre de Asociación / Cooperativa</Label>
                <Input
                  placeholder="Ej: Cooperativa Cafetera del Sur"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NIT / RUT Institucional</Label>
                <Input
                  placeholder="Ej: 900.456.789-1"
                  value={orgNit}
                  onChange={(e) => setOrgNit(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Municipio / Sede Principal</Label>
                <Input
                  placeholder="Ej: Pitalito, Huila"
                  value={orgMunicipality}
                  onChange={(e) => setOrgMunicipality(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                {orgLogoUrl ? (
                  <img
                    src={orgLogoUrl}
                    alt="Logo institucional"
                    className="size-12 rounded-lg border border-border bg-white object-contain p-1"
                  />
                ) : (
                  <div className="grid size-12 place-items-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground">
                    <Building2 className="size-5" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    <ImagePlus className="size-3.5 text-primary" />
                    Subir logo institucional
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          const dataUrl = await compressImageFileToDataUrl(file, {
                            maxDimension: 320,
                            quality: 0.85,
                            preservePng: true,
                          });
                          setOrgLogoUrl(dataUrl);
                        } catch (err: any) {
                          toast.error(err?.message ?? "No se pudo procesar el logo");
                        }
                      }}
                    />
                  </label>
                  {orgLogoUrl && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => setOrgLogoUrl("")}>
                      Quitar logo
                    </Button>
                  )}
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                disabled={saveBrandingMut.isPending}
                onClick={() => saveBrandingMut.mutate()}
              >
                {saveBrandingMut.isPending ? "Guardando…" : "Guardar identidad institucional"}
              </Button>
            </div>
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-base">Umbrales Automáticos de Alertas</h2>
                <p className="text-xs text-muted-foreground">
                  Parámetros globales aplicados en la tarea diaria de recordatorios de siembra y stock mínimo.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-days" className="text-xs">
                    Anticipación de siembra (días)
                  </Label>
                  <Input
                    id="reminder-days"
                    type="number"
                    min="0"
                    max="30"
                    value={plantingReminderDays}
                    onChange={(e) => setPlantingReminderDays(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock-threshold" className="text-xs">
                    Umbral global mínimo de stock
                  </Label>
                  <Input
                    id="stock-threshold"
                    type="number"
                    min="0"
                    step="any"
                    value={stockAlertThreshold}
                    onChange={(e) => setStockAlertThreshold(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Switch id="stock-alerts" checked={stockAlertsEnabled} onCheckedChange={setStockAlertsEnabled} />
                  <Label htmlFor="stock-alerts" className="text-xs">
                    Activar alertas automáticas de stock bajo
                  </Label>
                </div>
                <Button
                  size="sm"
                  disabled={saveAlertSettings.isPending || alertSettings.isLoading}
                  onClick={() => {
                    const days = Number(plantingReminderDays);
                    const threshold = Number(stockAlertThreshold);
                    if (!Number.isInteger(days) || days < 0 || days > 30) return toast.error("Indica entre 0 y 30 días");
                    if (!Number.isFinite(threshold) || threshold < 0) return toast.error("Indica un umbral válido");
                    saveAlertSettings.mutate({
                      planting_reminder_days: days,
                      stock_alerts_enabled: stockAlertsEnabled,
                      stock_alert_threshold: threshold,
                    });
                  }}
                >
                  Guardar reglas
                </Button>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <BellRing className="size-4 text-primary" /> Últimas Alertas Pendientes ({m?.pendingAlerts ?? 0})
                </h2>
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link to="/alerts">Ver todas</Link>
                </Button>
              </div>
              {pendingAlerts.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Sin alertas pendientes en la plataforma.</p>
              ) : (
                <ul className="divide-y divide-border max-h-48 overflow-y-auto text-xs">
                  {pendingAlerts.map((a) => (
                    <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{a.title}</span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(a.scheduled_at).toLocaleDateString("es-CO")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Activity className="size-4 text-primary" /> Salud Técnica y Telemetría de Clientes
                </h2>
                <p className="text-xs text-muted-foreground">
                  Excepciones capturadas automáticamente por ErrorBoundary en navegadores de usuarios.
                </p>
              </div>
              {(clientErrors.data ?? []).length === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="size-3.5" /> 0 incidentes recientes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-xs font-semibold text-warning-text">
                  <AlertTriangle className="size-3.5" /> {(clientErrors.data ?? []).length} evento(s) registrados
                </span>
              )}
            </div>

            {(clientErrors.data ?? []).length > 0 && (
              <ul className="divide-y divide-border text-xs">
                {(clientErrors.data ?? []).map((err: any) => (
                  <li key={err.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="min-w-0">
                      <span className="font-mono font-semibold text-primary mr-2">{err.route}</span>
                      <span className="text-foreground">{err.message}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(err.created_at).toLocaleString("es-CO")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(deleteUserTarget)} onOpenChange={(o) => !o && setDeleteUserTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cuenta permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmas eliminar permanentemente a «{deleteUserTarget?.name}»? Se borrarán en cascada todas sus parcelas, cultivos, actividades, cosechas, costos, inventario y alertas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMut.isPending}
              onClick={() => {
                if (deleteUserTarget) deleteUserMut.mutate(deleteUserTarget.id);
                setDeleteUserTarget(null);
              }}
            >
              Eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FarmUnitCard({
  farm,
  assignedTechs,
  onNavigate,
}: {
  farm: FarmerSummary;
  assignedTechs: string[];
  onNavigate: (target: "/parcels" | "/cultivos" | "/inventory" | "/reports") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ha = (farm.area_m2 / 10000).toFixed(2);

  return (
    <Card className="p-5 space-y-4 hover:border-primary/40 transition-colors flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary font-bold">
              {farm.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-foreground truncate">{farm.full_name}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {farm.phone ? `Tel: ${farm.phone}` : "Sin teléfono registrado"}
              </p>
            </div>
          </div>

          {assignedTechs.length > 0 ? (
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
              Téc: {assignedTechs[0]}
              {assignedTechs.length > 1 ? ` +${assignedTechs.length - 1}` : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
              Sin técnico
            </Badge>
          )}
        </div>

        {/* Resumen numérico de la finca */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-muted/25 p-2.5 text-center">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Parcelas</p>
            <p className="text-base font-bold tabular-nums">{farm.parcels}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Superficie</p>
            <p className="text-base font-bold tabular-nums">{ha} ha</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Cultivos act.</p>
            <p className="text-base font-bold tabular-nums text-success">
              {farm.active_crops} <span className="text-xs font-normal text-muted-foreground">/ {farm.crops}</span>
            </p>
          </div>
        </div>

        {/* Desplegable de lotes propios de esta finca */}
        {farm.parcel_details.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <span>Ver lotes de esta finca ({farm.parcel_details.length})</span>
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            {expanded && (
              <ul className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {farm.parcel_details.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/parcels/$id"
                      params={{ id: p.id }}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs hover:border-primary/40"
                    >
                      <span className="font-medium truncate">
                        {p.name} {p.soil_name ? `· ${p.soil_name}` : ""}
                      </span>
                      <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                        {(p.area_m2 / 10000).toFixed(2)} ha · {p.active_crops} act.
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Acciones contextualizadas a esta finca */}
      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/60">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1" onClick={() => onNavigate("/parcels")}>
          <MapPin className="size-3.5 text-primary" /> Lotes
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1" onClick={() => onNavigate("/cultivos")}>
          <Sprout className="size-3.5 text-primary" /> Cultivos
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1" onClick={() => onNavigate("/inventory")}>
          <Package2 className="size-3.5 text-primary" /> Bodega
        </Button>
        <Button type="button" size="sm" className="h-8 text-xs gap-1 flex-1" onClick={() => onNavigate("/reports")}>
          <FileBarChart2 className="size-3.5" /> Expediente
        </Button>
      </div>
    </Card>
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
  user,
  onAssign,
  onRevoke,
  onDelete,
  busy,
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
          {user.roles.length === 0 && <span className="text-xs text-muted-foreground italic">Sin roles</span>}
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
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Asignar rol…" />
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 && (
              <SelectItem value="__none__" disabled>
                Sin roles disponibles
              </SelectItem>
            )}
            {available.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={busy || !pending}
          onClick={() => {
            if (pending) {
              onAssign(pending);
              setPending("");
            }
          }}
        >
          Asignar
        </Button>
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            title="Eliminar usuario"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </li>
  );
}
