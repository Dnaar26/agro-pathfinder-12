import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireCookieUser } from "@/lib/api/auth.server";

const BulkProducerRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  producerName: z.string().trim().min(2, "Nombre demasiado corto").max(100),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(160),
  phone: z.string().trim().max(30).optional().nullable(),
  parcelName: z.string().trim().min(2, "Nombre de parcela requerido").max(120),
  areaM2: z.number().positive("El área debe ser mayor a 0").max(100_000_000),
  soilTypeName: z.string().trim().max(80).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  initialCropName: z.string().trim().max(80).optional().nullable(),
  plantingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha debe ser YYYY-MM-DD")
    .optional()
    .nullable(),
  notes: z.string().trim().max(800).optional().nullable(),
});

export const BulkImportPayloadSchema = z.object({
  rows: z.array(BulkProducerRowSchema).min(1).max(200),
});

export type BulkProducerRowInput = z.infer<typeof BulkProducerRowSchema>;

export interface BulkImportCredential {
  producerName: string;
  email: string;
  temporaryPassword: string;
}

export interface BulkImportResult {
  createdUsers: number;
  linkedUsers: number;
  createdParcels: number;
  skippedParcels: number;
  createdCrops: number;
  rowErrors: { rowNumber: number; email: string; message: string }[];
  credentials: BulkImportCredential[];
}

function requireServerEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const val =
    process.env[name] ??
    (name === "SUPABASE_URL" ? process.env.VITE_SUPABASE_URL : undefined);
  if (!val) throw new Error(`Falta configurar ${name} en el servidor`);
  return val;
}

function getAdminSupabase() {
  return createClient(
    requireServerEnv("SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function normalizeLookupText(val: string): string {
  return val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function generateSecureTempPassword(): string {
  // Cumple longitud >= 10, mayúscula, minúscula, dígito y símbolo
  const suffix = randomBytes(4).toString("hex");
  return `Sigic#${suffix}9A`;
}

function addDaysIso(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

async function requireAdminCaller(): Promise<string> {
  const adminDb = getAdminSupabase();
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let callerId: string | null = null;

  if (authHeader?.startsWith("Bearer ") && supabaseUrl && publishableKey) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) {
      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await userClient.auth.getUser(token);
      if (!error && data.user?.id) {
        callerId = data.user.id;
      }
    }
  }

  if (!callerId) {
    const cookieUser = await requireCookieUser();
    callerId = cookieUser.id;
  }

  const { data: roles } = await adminDb
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);

  if (!(roles ?? []).some((r) => r.role === "admin")) {
    throw new Error("No autorizado: se requiere rol Administrador para importar padrones masivos.");
  }

  return callerId;
}

export const bulkImportProducersServerFn = createServerFn({ method: "POST" })
  .validator(BulkImportPayloadSchema)
  .handler(async ({ data }): Promise<BulkImportResult> => {
    await requireAdminCaller();
    const adminDb = getAdminSupabase();

    // 1. Pre-cargar catálogos de suelo, cultivos y cuentas Auth existentes en memoria (O(1))
    const [soilsRes, catalogRes, usersPageRes] = await Promise.all([
      adminDb.from("soil_types").select("id, name"),
      adminDb.from("crop_catalog").select("id, name, cycle_days"),
      adminDb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const soilByNormName = new Map<string, number>();
    for (const s of soilsRes.data ?? []) {
      soilByNormName.set(normalizeLookupText(s.name), s.id);
    }

    const cropByNormName = new Map<string, { id: number; cycle_days: number }>();
    for (const c of catalogRes.data ?? []) {
      cropByNormName.set(normalizeLookupText(c.name), {
        id: c.id,
        cycle_days: Number(c.cycle_days || 120),
      });
    }

    const userIdByEmail = new Map<string, string>();
    for (const u of usersPageRes.data?.users ?? []) {
      if (u.email) {
        userIdByEmail.set(u.email.toLowerCase(), u.id);
      }
    }

    const seenEmailsInBatch = new Set<string>();
    const existingEmailsCounted = new Set<string>();
    const credentials: BulkImportCredential[] = [];
    const rowErrors: { rowNumber: number; email: string; message: string }[] = [];

    let createdUsers = 0;
    let linkedUsers = 0;
    let createdParcels = 0;
    let skippedParcels = 0;
    let createdCrops = 0;

    // Cache de parcelas por productor para evitar duplicados dentro del mismo lote o contra BD
    const parcelsCacheByOwner = new Map<string, Map<string, string>>();

    async function getOwnerParcelsMap(ownerId: string): Promise<Map<string, string>> {
      const cached = parcelsCacheByOwner.get(ownerId);
      if (cached) return cached;
      const { data: existingParcels } = await adminDb
        .from("parcels")
        .select("id, name")
        .eq("owner_id", ownerId);
      const pMap = new Map<string, string>();
      for (const p of existingParcels ?? []) {
        pMap.set(normalizeLookupText(p.name), p.id);
      }
      parcelsCacheByOwner.set(ownerId, pMap);
      return pMap;
    }

    const todayIso = new Date().toISOString().slice(0, 10);

    for (const row of data.rows) {
      try {
        const emailKey = row.email.toLowerCase();
        let ownerId = userIdByEmail.get(emailKey);

        if (ownerId) {
          if (!seenEmailsInBatch.has(emailKey) && !existingEmailsCounted.has(emailKey)) {
            linkedUsers++;
            existingEmailsCounted.add(emailKey);
          }
        } else {
          const tempPassword = generateSecureTempPassword();
          const { data: createdAuth, error: createAuthErr } =
            await adminDb.auth.admin.createUser({
              email: emailKey,
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                full_name: row.producerName,
                phone: row.phone ?? "",
              },
            });

          if (createAuthErr || !createdAuth.user) {
            throw new Error(createAuthErr?.message || "No se pudo crear la cuenta Auth");
          }

          ownerId = createdAuth.user.id;
          userIdByEmail.set(emailKey, ownerId);
          createdUsers++;
          credentials.push({
            producerName: row.producerName,
            email: emailKey,
            temporaryPassword: tempPassword,
          });
        }

        seenEmailsInBatch.add(emailKey);

        // Asegurar perfil actualizado y rol 'agricultor'
        await adminDb.from("profiles").upsert(
          {
            id: ownerId,
            full_name: row.producerName,
            ...(row.phone ? { phone: row.phone } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        await adminDb
          .from("user_roles")
          .upsert(
            { user_id: ownerId, role: "agricultor" },
            { onConflict: "user_id,role" }
          );

        // Resolver tipo de suelo opcional
        const soilId = row.soilTypeName
          ? soilByNormName.get(normalizeLookupText(row.soilTypeName)) ?? null
          : null;

        // Verificar idempotencia de parcela por nombre + propietario
        const ownerParcels = await getOwnerParcelsMap(ownerId);
        const normParcelName = normalizeLookupText(row.parcelName);
        let parcelId = ownerParcels.get(normParcelName);

        if (parcelId) {
          skippedParcels++;
        } else {
          const { data: insertedParcel, error: parcelErr } = await adminDb
            .from("parcels")
            .insert({
              owner_id: ownerId,
              name: row.parcelName,
              area_m2: Math.round(row.areaM2),
              soil_type_id: soilId,
              latitude: row.latitude ?? null,
              longitude: row.longitude ?? null,
              notes: row.notes ?? null,
            })
            .select("id")
            .single();

          if (parcelErr || !insertedParcel?.id) {
            throw new Error(parcelErr?.message || "Error al crear la parcela");
          }

          parcelId = insertedParcel.id;
          ownerParcels.set(normParcelName, parcelId);
          createdParcels++;
        }

        // Si indicó cultivo inicial en la fila, sembrarlo o programarlo de forma idempotente
        if (row.initialCropName && parcelId) {
          const matchedCrop = cropByNormName.get(normalizeLookupText(row.initialCropName));
          if (matchedCrop) {
            const plantDate = row.plantingDate || todayIso;
            const estHarvest = addDaysIso(plantDate, matchedCrop.cycle_days);

            const { data: dupCrop } = await adminDb
              .from("crops")
              .select("id")
              .eq("parcel_id", parcelId)
              .eq("catalog_id", matchedCrop.id)
              .eq("planting_date", plantDate)
              .maybeSingle();

            if (!dupCrop) {
              const isFuture = plantDate > todayIso;
              const { error: cropErr } = await adminDb.from("crops").insert({
                parcel_id: parcelId,
                catalog_id: matchedCrop.id,
                planting_date: plantDate,
                estimated_harvest_date: estHarvest,
                status: isFuture ? "PLANEADO" : "SEMBRADO",
                planting_confirmed_at: isFuture ? null : new Date().toISOString(),
                notes: row.notes ?? null,
              });
              if (!cropErr) {
                createdCrops++;
              }
            }
          }
        }
      } catch (err: unknown) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          email: row.email,
          message: err instanceof Error ? err.message : "Error inesperado en fila",
        });
      }
    }

    return {
      createdUsers,
      linkedUsers,
      createdParcels,
      skippedParcels,
      createdCrops,
      rowErrors,
      credentials,
    };
  });


// ============================================================================
// IMPORTACIÓN MASIVA DE INVENTARIO INICIAL DE BODEGA (POR PRODUCTOR O COOPERATIVA)
// ============================================================================

const ALLOWED_INVENTORY_CATEGORIES = [
  "Fertilizante",
  "Plaguicida",
  "Bioinsumo",
  "Semilla",
  "Herramienta",
  "Combustible",
  "Otro",
] as const;

const ALLOWED_INVENTORY_UNITS = ["KG", "L", "UN", "SACO", "GL", "TON"] as const;

const BulkInventoryRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  itemName: z.string().trim().min(2, "Nombre de insumo muy corto").max(120),
  category: z.enum(ALLOWED_INVENTORY_CATEGORIES),
  unit: z.enum(ALLOWED_INVENTORY_UNITS),
  initialStock: z.number().min(0, "El stock no puede ser negativo").max(10_000_000),
  minStock: z.number().min(0, "El stock mínimo no puede ser negativo").max(10_000_000),
  unitCostCop: z.number().min(0, "El costo unitario no puede ser negativo").max(1_000_000_000),
  producerEmail: z.string().trim().toLowerCase().email("Correo de productor inválido").optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const BulkInventoryImportPayloadSchema = z.object({
  targetOwnerId: z.string().uuid().optional().nullable(),
  duplicateStrategy: z.enum(["SKIP", "ADD_STOCK"]).default("SKIP"),
  rows: z.array(BulkInventoryRowSchema).min(1).max(300),
});

export type BulkInventoryRowInput = z.infer<typeof BulkInventoryRowSchema>;

export interface BulkInventoryImportResult {
  createdItems: number;
  updatedItems: number;
  skippedItems: number;
  kardexMovementsLogged: number;
  totalImportedValueCop: number;
  rowErrors: { rowNumber: number; itemName: string; message: string }[];
}

async function resolveAuthenticatedCaller(): Promise<{ userId: string; isAdmin: boolean; isReadOnlyTech: boolean }> {
  const adminDb = getAdminSupabase();
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let callerId: string | null = null;

  if (authHeader?.startsWith("Bearer ") && supabaseUrl && publishableKey) {
    const token = authHeader.replace("Bearer ", "").trim();
    if (token) {
      const userClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await userClient.auth.getUser(token);
      if (!error && data.user?.id) {
        callerId = data.user.id;
      }
    }
  }

  if (!callerId) {
    const cookieUser = await requireCookieUser();
    callerId = cookieUser.id;
  }

  const { data: roles } = await adminDb
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);

  const roleList = (roles ?? []).map((r) => String(r.role));
  const isAdmin = roleList.includes("admin");
  const isReadOnlyTech = roleList.includes("tecnico") && !isAdmin;

  return { userId: callerId, isAdmin, isReadOnlyTech };
}

export const bulkImportInventoryServerFn = createServerFn({ method: "POST" })
  .validator(BulkInventoryImportPayloadSchema)
  .handler(async ({ data }): Promise<BulkInventoryImportResult> => {
    const caller = await resolveAuthenticatedCaller();
    if (caller.isReadOnlyTech) {
      throw new Error("No autorizado: el rol Técnico tiene permisos de solo lectura sobre el inventario.");
    }

    const adminDb = getAdminSupabase();

    // Si hay correos de productores en el CSV y el usuario es Admin, precargar mapa email -> userId
    const needsEmailLookup = caller.isAdmin && data.rows.some((r) => Boolean(r.producerEmail));
    const userIdByEmail = new Map<string, string>();

    if (needsEmailLookup) {
      const usersPageRes = await adminDb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of usersPageRes.data?.users ?? []) {
        if (u.email) {
          userIdByEmail.set(u.email.toLowerCase(), u.id);
        }
      }
    }

    // Cache en memoria de ítems actuales por propietario: Map<ownerId, Map<normItemName, { id, stock_qty }>>
    const ownerInventoryCache = new Map<string, Map<string, { id: string; stock_qty: number }>>();

    async function getOwnerItemsMap(ownerId: string) {
      const cached = ownerInventoryCache.get(ownerId);
      if (cached) return cached;

      const { data: existingRows, error } = await adminDb
        .from("inventory_items")
        .select("id, name, stock_qty")
        .eq("owner_id", ownerId);

      if (error) throw new Error(error.message);

      const itemMap = new Map<string, { id: string; stock_qty: number }>();
      for (const it of existingRows ?? []) {
        itemMap.set(normalizeLookupText(it.name), {
          id: it.id,
          stock_qty: Number(it.stock_qty || 0),
        });
      }
      ownerInventoryCache.set(ownerId, itemMap);
      return itemMap;
    }

    let createdItems = 0;
    let updatedItems = 0;
    let skippedItems = 0;
    let kardexMovementsLogged = 0;
    let totalImportedValueCop = 0;
    const rowErrors: { rowNumber: number; itemName: string; message: string }[] = [];

    for (const row of data.rows) {
      try {
        // Determinar el propietario destino respetando permisos estrictos
        let ownerId = caller.userId;

        if (caller.isAdmin) {
          if (row.producerEmail) {
            const foundByEmail = userIdByEmail.get(row.producerEmail.toLowerCase());
            if (!foundByEmail) {
              throw new Error(
                `No existe ningún productor registrado con el correo ${row.producerEmail}. Impórtalo primero en Padrón CSV.`
              );
            }
            ownerId = foundByEmail;
          } else if (data.targetOwnerId) {
            ownerId = data.targetOwnerId;
          }
        }

        const itemsMap = await getOwnerItemsMap(ownerId);
        const normName = normalizeLookupText(row.itemName);
        const existing = itemsMap.get(normName);

        if (existing) {
          if (data.duplicateStrategy === "SKIP") {
            skippedItems++;
            continue;
          }

          // Estrategia ADD_STOCK: sumar stock inicial y registrar movimiento ENTRADA en Kardex
          const addedQty = Math.round(row.initialStock * 100) / 100;
          const newTotalStock = Math.round((existing.stock_qty + addedQty) * 100) / 100;

          const updatePayload: Record<string, unknown> = {
            stock_qty: newTotalStock,
            updated_at: new Date().toISOString(),
          };
          if (row.unitCostCop > 0) updatePayload.unit_cost = row.unitCostCop;
          if (row.minStock >= 0) updatePayload.min_stock = row.minStock;

          const { error: updErr } = await adminDb
            .from("inventory_items")
            .update(updatePayload)
            .eq("id", existing.id);

          if (updErr) throw new Error(updErr.message);

          existing.stock_qty = newTotalStock;
          updatedItems++;
          totalImportedValueCop += addedQty * row.unitCostCop;

          if (addedQty > 0) {
            const { error: movErr } = await adminDb.from("inventory_movements").insert({
              item_id: existing.id,
              kind: "ENTRADA",
              qty: addedQty,
              notes: row.notes || "Recarga de existencias vía importación CSV",
            });
            if (!movErr) kardexMovementsLogged++;
          }
          continue;
        }

        // Crear nuevo insumo en bodega
        const initialQty = Math.round(row.initialStock * 100) / 100;
        const insertPayload: Record<string, unknown> = {
          owner_id: ownerId,
          name: row.itemName,
          category: row.category,
          unit: row.unit,
          stock_qty: initialQty,
          min_stock: row.minStock,
          unit_cost: row.unitCostCop,
        };

        let insertedId: string | null = null;
        const { data: insertedRow, error: insErr } = await adminDb
          .from("inventory_items")
          .insert(insertPayload)
          .select("id")
          .single();

        if (insErr) {
          // Respaldo seguro si la columna 'category' aún no estuviera migrada en entornos antiguos
          if (insErr.message?.includes("category") || insErr.code === "PGRST204") {
            const { category: _c, ...fallbackPayload } = insertPayload;
            const retry = await adminDb
              .from("inventory_items")
              .insert(fallbackPayload)
              .select("id")
              .single();
            if (retry.error || !retry.data?.id) {
              throw new Error(retry.error?.message || "No se pudo insertar el insumo");
            }
            insertedId = retry.data.id;
          } else {
            throw new Error(insErr.message);
          }
        } else {
          insertedId = insertedRow?.id ?? null;
        }

        if (!insertedId) throw new Error("No se obtuvo ID del insumo creado");

        itemsMap.set(normName, { id: insertedId, stock_qty: initialQty });
        createdItems++;
        totalImportedValueCop += initialQty * row.unitCostCop;

        if (initialQty > 0) {
          const { error: movErr } = await adminDb.from("inventory_movements").insert({
            item_id: insertedId,
            kind: "ENTRADA",
            qty: initialQty,
            notes: row.notes || "Carga inicial de bodega vía CSV",
          });
          if (!movErr) kardexMovementsLogged++;
        }
      } catch (err: unknown) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          itemName: row.itemName,
          message: err instanceof Error ? err.message : "Error inesperado al importar insumo",
        });
      }
    }

    return {
      createdItems,
      updatedItems,
      skippedItems,
      kardexMovementsLogged,
      totalImportedValueCop: Math.round(totalImportedValueCop),
      rowErrors,
    };
  });
