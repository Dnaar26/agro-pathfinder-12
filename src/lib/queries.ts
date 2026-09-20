import { supabase } from "@/integrations/supabase/client";

export type PaginationParams = { page: number; pageSize: number };
export type PaginatedResult<T> = { data: T[]; count: number; page: number; pageSize: number; totalPages: number };

export function paginationRange(params: PaginationParams): { from: number; to: number } {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  return { from, to };
}

export function buildPaginatedResult<T>(data: T[], count: number, params: PaginationParams): PaginatedResult<T> {
  return { data, count, page: params.page, pageSize: params.pageSize, totalPages: Math.max(1, Math.ceil(count / params.pageSize)) };
}

const DEFAULT_PAGE_SIZE = 50;

export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  return data;
}

export async function getMyRoles(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  return (data ?? []).map((r) => r.role as string);
}

export async function listParcels() {
  const { data, error } = await supabase
    .from("parcels")
    .select("*, soil_types(name), crops(id, status), profiles!owner_id(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listParcelsPage(params: PaginationParams) {
  const countQuery = supabase.from("parcels").select("*", { count: "exact", head: true });
  const { from, to } = paginationRange(params);
  const { data, error, count } = await supabase
    .from("parcels")
    .select("*, soil_types(name), crops(id, status), profiles!owner_id(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return buildPaginatedResult(data ?? [], count ?? 0, params);
}


export async function getParcel(id: string) {
  const { data, error } = await supabase
    .from("parcels")
    .select("*, soil_types(name), crops(*, crop_catalog(name, cycle_days)), profiles!owner_id(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCatalog() {
  const { data } = await supabase.from("crop_catalog").select("*").order("name");
  return data ?? [];
}

export async function listSoils() {
  const { data } = await supabase.from("soil_types").select("*").order("name");
  return data ?? [];
}

export async function getCrop(id: string) {
  const { data, error } = await supabase
    .from("crops")
    .select("*, crop_catalog(name, cycle_days), parcels(name, owner_id, latitude, longitude, profiles!owner_id(full_name)), activities(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listEvents(from: Date, to: Date) {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at");
  if (error) throw error;
  return data ?? [];
}

export async function listAllCrops() {
  const { data, error } = await supabase
    .from("crops")
    .select("*, crop_catalog(name, cycle_days), parcels!inner(name, owner_id, profiles!owner_id(full_name))")
    .order("planting_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAllCropsPage(params: PaginationParams) {
  const { from, to } = paginationRange(params);
  const { data, error, count } = await supabase
    .from("crops")
    .select("*, crop_catalog(name, cycle_days), parcels!inner(name, owner_id, profiles!owner_id(full_name))", { count: "exact" })
    .order("planting_date", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

export async function listAlerts() {
  const { data, error } = await supabase
    .from("alerts")
    .select("*, profiles!user_id(full_name)")
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAlertsPage(params: PaginationParams) {
  const { from, to } = paginationRange(params);
  const { data, error, count } = await supabase
    .from("alerts")
    .select("*, profiles!user_id(full_name)", { count: "exact" })
    .order("scheduled_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

export async function listAllActivitiesForReport() {
  const { data, error } = await supabase
    .from("activities")
    .select("id, kind, performed_at, notes, crops(planting_date, crop_catalog(name), parcels(name))")
    .order("performed_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return data ?? [];
}

export async function listAllActivitiesForReportPage(params: PaginationParams) {
  const { from, to } = paginationRange(params);
  const { data, error, count } = await supabase
    .from("activities")
    .select("id, kind, performed_at, notes, crops(planting_date, crop_catalog(name), parcels(name))", { count: "exact" })
    .order("performed_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return buildPaginatedResult(data ?? [], count ?? 0, params);
}

export type AdminUserRow = {
  id: string;
  full_name: string;
  phone: string | null;
  roles: string[];
};

export async function listAllUsersWithRoles(): Promise<AdminUserRow[]> {
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .order("full_name");
  if (pErr) throw pErr;
  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids);
  if (rErr) throw rErr;
  const map = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const arr = map.get(r.user_id) ?? [];
    arr.push(r.role as string);
    map.set(r.user_id, arr);
  }
  return (profiles ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? [] }));
}

export async function listAllUsersWithRolesPage(params: PaginationParams): Promise<PaginatedResult<AdminUserRow>> {
  const { from, to } = paginationRange(params);
  const { count, data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, full_name, phone", { count: "exact" })
    .order("full_name")
    .range(from, to);
  if (pErr) throw pErr;
  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) return buildPaginatedResult([], count ?? 0, params);
  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids);
  if (rErr) throw rErr;
  const map = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const arr = map.get(r.user_id) ?? [];
    arr.push(r.role as string);
    map.set(r.user_id, arr);
  }
  const result: AdminUserRow[] = (profiles ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? [] }));
  return buildPaginatedResult(result, count ?? 0, params);
}

export async function assignRole(userId: string, role: "agricultor" | "tecnico" | "admin") {
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

export async function revokeRole(userId: string, role: "agricultor" | "tecnico" | "admin") {
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) throw error;
}

export type AdminMetrics = {
  users: number;
  parcels: number;
  crops: number;
  activities: number;
  pendingAlerts: number;
  totalAreaM2: number;
  activeCrops: number;
};

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [users, parcelsRes, cropsRes, activities, alerts, activeCrops] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("parcels").select("area_m2"),
    supabase.from("crops").select("id", { count: "exact", head: true }),
    supabase.from("activities").select("id", { count: "exact", head: true }),
    supabase.from("alerts").select("id", { count: "exact", head: true }).eq("status", "PENDIENTE"),
    supabase.from("crops").select("id", { count: "exact", head: true }).in("status", ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"]),
  ]);
  const totalAreaM2 = (parcelsRes.data ?? []).reduce((s, p: any) => s + Number(p.area_m2 || 0), 0);
  return {
    users: users.count ?? 0,
    parcels: (parcelsRes.data ?? []).length,
    crops: cropsRes.count ?? 0,
    activities: activities.count ?? 0,
    pendingAlerts: alerts.count ?? 0,
    totalAreaM2,
    activeCrops: activeCrops.count ?? 0,
  };
}

export type FarmerSummary = {
  id: string;
  full_name: string;
  parcels: number;
  area_m2: number;
  crops: number;
};

export async function listFarmerSummaries(): Promise<FarmerSummary[]> {
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").order("full_name");
  const { data: parcels } = await supabase.from("parcels").select("id, owner_id, area_m2");
  const { data: crops } = await supabase.from("crops").select("parcel_id");
  const parcelByOwner = new Map<string, { count: number; area: number; ids: string[] }>();
  for (const p of parcels ?? []) {
    const cur = parcelByOwner.get(p.owner_id) ?? { count: 0, area: 0, ids: [] };
    cur.count++;
    cur.area += Number(p.area_m2 || 0);
    cur.ids.push(p.id);
    parcelByOwner.set(p.owner_id, cur);
  }
  const cropsByParcel = new Map<string, number>();
  for (const c of crops ?? []) cropsByParcel.set(c.parcel_id, (cropsByParcel.get(c.parcel_id) ?? 0) + 1);
  return (profiles ?? []).map((p) => {
    const info = parcelByOwner.get(p.id);
    const cropCount = (info?.ids ?? []).reduce((s, id) => s + (cropsByParcel.get(id) ?? 0), 0);
    return { id: p.id, full_name: p.full_name, parcels: info?.count ?? 0, area_m2: info?.area ?? 0, crops: cropCount };
  });
}

export async function runGenerateAlerts() {
  const { error } = await supabase.rpc("generate_automatic_alerts");
  if (error) throw error;
}

async function getCropIdsForOwner(ownerId?: string): Promise<string[]> {
  if (!ownerId) return [];
  const { data: parcels, error: pErr } = await supabase.from("parcels").select("id").eq("owner_id", ownerId);
  if (pErr) throw pErr;
  const parcelIds = (parcels ?? []).map((p) => p.id);
  if (parcelIds.length === 0) return [];
  const { data: crops, error: cErr } = await supabase.from("crops").select("id").in("parcel_id", parcelIds);
  if (cErr) throw cErr;
  return (crops ?? []).map((c) => c.id);
}

export async function getMonthlyYield(ownerId?: string) {
  const cropIds = await getCropIdsForOwner(ownerId);
  if (ownerId && cropIds.length === 0) return [];
  let q = supabase
    .from("crop_harvests")
    .select("harvested_qty, performed_at, crops!inner(crop_catalog(name))")
    .order("performed_at");
  if (ownerId) {
    q = q.in("crop_id", cropIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getTotalPandL(ownerId?: string) {
  const cropIds = await getCropIdsForOwner(ownerId);
  if (ownerId && cropIds.length === 0) return { totalCost: 0, totalRevenue: 0 };
  const [costs, harvests] = await Promise.all([
    ownerId
      ? supabase.from("crop_costs").select("total").in("crop_id", cropIds)
      : supabase.from("crop_costs").select("total"),
    ownerId
      ? supabase.from("crop_harvests").select("total_revenue").in("crop_id", cropIds)
      : supabase.from("crop_harvests").select("total_revenue"),
  ]);
  if (costs.error) throw costs.error;
  if (harvests.error) throw harvests.error;
  return {
    totalCost: (costs.data ?? []).reduce((s, c: any) => s + Number(c.total), 0),
    totalRevenue: (harvests.data ?? []).reduce((s, h: any) => s + Number(h.total_revenue || 0), 0),
  };
}

export async function getUpcomingActivities(days = 7, ownerId?: string) {
  const now = new Date().toISOString();
  const limit = new Date(Date.now() + days * 86400000).toISOString();
  const cropIds = await getCropIdsForOwner(ownerId);
  if (ownerId && cropIds.length === 0) return [];
  let q = supabase
    .from("activities")
    .select("id, kind, performed_at, notes, crop_id, crops(id, crop_catalog(name), parcels(name))")
    .gte("performed_at", now)
    .lte("performed_at", limit);
  if (ownerId) {
    q = q.in("crop_id", cropIds);
  }
  const { data, error } = await q.order("performed_at").limit(5);
  if (error) throw error;
  return data ?? [];
}

export async function getTotalInventoryValue(ownerId?: string) {
  let q = supabase.from("inventory_items").select("stock_qty, unit_cost, owner_id");
  if (ownerId) {
    q = q.eq("owner_id", ownerId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).reduce((s, i: any) => s + Number(i.stock_qty || 0) * Number(i.unit_cost || 0), 0);
}

export async function listScheduledReports() {
  const { data, error } = await supabase
    .from("scheduled_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createScheduledReport(input: { template: string; recipients: string[]; schedule: string }) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sesión expirada");
  const { data, error } = await supabase
    .from("scheduled_reports")
    .insert({ user_id: auth.user.id, template: input.template, recipients: input.recipients, schedule: input.schedule })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleScheduledReport(id: string, enabled: boolean) {
  const { error } = await supabase
    .from("scheduled_reports")
    .update({ enabled })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteScheduledReport(id: string) {
  const { error } = await supabase
    .from("scheduled_reports")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function getYearOverYearComparison() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;
  const [currentHarvests, lastHarvests, currentCosts, lastCosts] = await Promise.all([
    supabase.from("crop_harvests").select("total_revenue, performed_at").gte("performed_at", `${currentYear}-01-01`).lt("performed_at", `${currentYear + 1}-01-01`),
    supabase.from("crop_harvests").select("total_revenue, performed_at").gte("performed_at", `${lastYear}-01-01`).lt("performed_at", `${currentYear}-01-01`),
    supabase.from("crop_costs").select("total, created_at").gte("created_at", `${currentYear}-01-01`).lt("created_at", `${currentYear + 1}-01-01`),
    supabase.from("crop_costs").select("total, created_at").gte("created_at", `${lastYear}-01-01`).lt("created_at", `${currentYear}-01-01`),
  ]);
  if (currentHarvests.error) throw currentHarvests.error;
  if (lastHarvests.error) throw lastHarvests.error;
  if (currentCosts.error) throw currentCosts.error;
  if (lastCosts.error) throw lastCosts.error;
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const aggregateByMonth = (rows: any[], key: string, dateKey: "created_at" | "performed_at") => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (!r[dateKey]) continue;
      const d = new Date(r[dateKey]);
      const m = monthNames[d.getMonth()];
      map[m] = (map[m] ?? 0) + Number(r[key] || 0);
    }
    return map;
  };
  return {
    currentYear: {
      revenue: (currentHarvests.data ?? []).reduce((s, h: any) => s + Number(h.total_revenue || 0), 0),
      costs: (currentCosts.data ?? []).reduce((s, c: any) => s + Number(c.total || 0), 0),
      revenueByMonth: aggregateByMonth(currentHarvests.data ?? [], "total_revenue", "performed_at"),
      costsByMonth: aggregateByMonth(currentCosts.data ?? [], "total", "created_at"),
    },
    lastYear: {
      revenue: (lastHarvests.data ?? []).reduce((s, h: any) => s + Number(h.total_revenue || 0), 0),
      costs: (lastCosts.data ?? []).reduce((s, c: any) => s + Number(c.total || 0), 0),
      revenueByMonth: aggregateByMonth(lastHarvests.data ?? [], "total_revenue", "performed_at"),
      costsByMonth: aggregateByMonth(lastCosts.data ?? [], "total", "created_at"),
    },
  };
}

export async function listPestIncidents(cropId: string) {
  const { data, error } = await supabase
    .from("pest_incidents")
    .select("*")
    .eq("crop_id", cropId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCropPhotoUrls(cropId: string) {
  const { data, error } = await supabase
    .from("activities")
    .select("photo_urls, kind, performed_at")
    .eq("crop_id", cropId)
    .not("photo_urls", "is", null)
    .order("performed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
