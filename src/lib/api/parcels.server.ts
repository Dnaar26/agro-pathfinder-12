import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name} en el servidor`);
  return value;
}

function userClient(token: string) {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

async function requireBearerToken(): Promise<string> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("No autorizado");
  return authHeader.replace("Bearer ", "");
}

export const getSecureUserParcels = createServerFn({ method: "GET" }).handler(async () => {
  const token = await requireBearerToken();
  const supabase = userClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("No autorizado");

  const { data, error } = await supabase
    .from("parcels")
    .select("id, name, area_m2, latitude, longitude, polygon_area_m2, geometry, owner_id, soil_types(name), profiles!parcels_owner_id_fkey(full_name)")
    .order("name");
  if (error) throw new Error(error.message);
  return { parcels: data ?? [] };
});
