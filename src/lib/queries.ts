import { supabase } from "@/integrations/supabase/client";

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
    .select("*, soil_types(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getParcel(id: string) {
  const { data, error } = await supabase
    .from("parcels")
    .select("*, soil_types(name), crops(*, crop_catalog(name, cycle_days))")
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
    .select("*, crop_catalog(name, cycle_days), parcels(name, owner_id), activities(*)")
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

export async function listAlerts() {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("scheduled_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
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

export async function assignRole(userId: string, role: "agricultor" | "tecnico" | "admin") {
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

export async function revokeRole(userId: string, role: "agricultor" | "tecnico" | "admin") {
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) throw error;
}

