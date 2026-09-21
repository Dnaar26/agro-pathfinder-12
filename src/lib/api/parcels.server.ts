import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireCookieUser } from "@/lib/auth/session.server";

function adminClient() {
  return createClient(
    process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const getSecureUserParcels = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireCookieUser();
  const { data: roles } = await adminClient().from("user_roles").select("role").eq("user_id", user.id);
  const isStaff = (roles ?? []).some((r) => ["tecnico", "admin"].includes(r.role));

  let query = adminClient().from("parcels").select("id, name, area_m2, latitude, longitude, polygon_area_m2, geometry, owner_id, soil_types(name), profiles!parcels_owner_id_fkey(full_name)");
  if (!isStaff) {
    query = query.eq("owner_id", user.id);
  }
  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);
  return { parcels: data ?? [] };
});
