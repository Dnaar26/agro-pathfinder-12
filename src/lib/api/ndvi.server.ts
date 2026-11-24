import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireCookieUser } from "@/lib/api/auth.server";

const inputSchema = z.object({
  parcelId: z.string().uuid(),
  latitude: z.number().finite().gte(-90).lte(90),
  longitude: z.number().finite().gte(-180).lte(180),
});

type NdviResult = { ndvi: number; date: string } | null;

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name] ?? (name === "SUPABASE_URL" ? process.env.VITE_SUPABASE_URL : undefined);
  if (!value) throw new Error(`Falta configurar ${name} en el servidor`);
  return value;
}

function adminClient() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function resolveAuthenticatedUserId(): Promise<string> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (authHeader?.startsWith("Bearer ") && supabaseUrl && publishableKey) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) {
      const client = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.getUser(token);
      if (!error && data.user?.id) {
        return data.user.id;
      }
    }
  }

  const cookieUser = await requireCookieUser();
  return cookieUser.id;
}

export const getNdvi = createServerFn({ method: "GET" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<NdviResult> => {
    const userId = await resolveAuthenticatedUserId();
    const supabase = adminClient();
    const { data: parcel, error: parcelError } = await supabase
      .from("parcels")
      .select("owner_id")
      .eq("id", data.parcelId)
      .maybeSingle();
    if (parcelError || !parcel) throw new Error("Parcela no encontrada");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = (roles ?? []).some((role) => role.role === "tecnico" || role.role === "admin");
    if (!isStaff && parcel.owner_id !== userId) throw new Error("No autorizado");

    const { data: cached } = await supabase
      .from("ndvi_cache")
      .select("ndvi, date")
      .eq("parcel_id", data.parcelId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) return { ndvi: Number(cached.ndvi), date: cached.date };

    const instanceId = process.env.SENTINEL_INSTANCE_ID;
    const apiKey = process.env.SENTINEL_API_KEY;
    if (!instanceId || !apiKey) return null;

    const bbox = `${data.longitude - 0.01},${data.latitude - 0.01},${data.longitude + 0.01},${data.latitude + 0.01}`;
    const url = new URL(`https://services.sentinel-hub.com/ogc/wms/${instanceId}`);
    url.search = new URLSearchParams({
      service: "WMS",
      request: "GetFeatureInfo",
      layers: "NDVI",
      bbox,
      width: "1",
      height: "1",
      query_layers: "NDVI",
      info_format: "application/json",
      i: "0",
      j: "0",
    }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return null;
    const info = await response.json();
    const ndvi = Number(info?.features?.[0]?.properties?.NDVI);
    if (!Number.isFinite(ndvi)) return null;

    const date = new Date().toISOString().split("T")[0];
    const normalized = Math.round(ndvi * 1000) / 1000;
    await supabase.from("ndvi_cache").upsert({ parcel_id: data.parcelId, ndvi: normalized, date });
    return { ndvi: normalized, date };
  });
