import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

type MutationAction = "INSERT" | "UPDATE" | "DELETE";

export type OfflineSupportedTable =
  | "parcels"
  | "crops"
  | "activities"
  | "crop_costs"
  | "crop_harvests"
  | "inventory_items"
  | "field_labor_logs"
  | "calendar_events";

export type OfflineMutation = {
  table: OfflineSupportedTable;
  action: MutationAction;
  data: Record<string, unknown>;
  recordId?: string;
};

export type StoredMutation = OfflineMutation & {
  id: number;
  createdAt: number;
  attempts: number;
  status?: "pending" | "failed";
  lastError?: string;
};

export const MAX_SYNC_ATTEMPTS = 3;
export const OFFLINE_SYNCED_EVENT = "sigic:offline-synced";

let dbPromise: Promise<IDBPDatabase> | null = null;
let syncInFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore UI subscriber error
    }
  });
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB("sgic-offline", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mutations")) {
          db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export function isLikelyOfflineNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed") ||
    msg.includes("offline")
  );
}

export async function queueMutation(mutation: OfflineMutation) {
  if (mutation.action !== "INSERT" && !mutation.recordId) {
    throw new Error("Las mutaciones de actualización y eliminación requieren recordId");
  }

  const db = await getDb();
  await db.add("mutations", {
    ...mutation,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
    lastError: undefined,
  });
  notifyListeners();
}

/**
 * Ejecuta una operación en línea en Supabase; si el dispositivo está sin señal rural
 * o sufre caída de red, encola automáticamente la mutación en IndexedDB para sincronizar luego.
 */
export async function executeWithOfflineFallback<T = void>(params: {
  onlineRunner: () => Promise<T>;
  offlineMutation: OfflineMutation;
}): Promise<{ queuedOffline: boolean; result?: T }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await queueMutation(params.offlineMutation);
    return { queuedOffline: true };
  }

  try {
    const result = await params.onlineRunner();
    return { queuedOffline: false, result };
  } catch (err) {
    if (isLikelyOfflineNetworkError(err)) {
      await queueMutation(params.offlineMutation);
      return { queuedOffline: true };
    }
    throw err;
  }
}

export async function getPendingMutations(): Promise<StoredMutation[]> {
  const db = await getDb();
  return db.getAll("mutations");
}

export async function clearSyncedMutations(ids: number[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("mutations", "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
  notifyListeners();
}

export async function discardOfflineMutation(id: number) {
  const db = await getDb();
  await db.delete("mutations", id);
  notifyListeners();
}

export async function retryFailedMutations() {
  const db = await getDb();
  const all: StoredMutation[] = await db.getAll("mutations");
  const tx = db.transaction("mutations", "readwrite");
  for (const item of all) {
    if (item.status === "failed" || item.attempts >= MAX_SYNC_ATTEMPTS) {
      await tx.store.put({
        ...item,
        attempts: 0,
        status: "pending",
        lastError: undefined,
      });
    }
  }
  await tx.done;
  notifyListeners();
  await syncPendingMutations();
}

export async function setCache(key: string, value: unknown) {
  const db = await getDb();
  await db.put("cache", { key, value, updatedAt: Date.now() });
}

export async function getCache<T = unknown>(key: string): Promise<T | null> {
  const db = await getDb();
  return ((await db.get("cache", key))?.value as T | null) ?? null;
}

export async function clearCache() {
  const db = await getDb();
  await db.clear("cache");
}

export async function clearAllOfflineData() {
  const db = await getDb();
  const tx = db.transaction(["cache", "mutations"], "readwrite");
  await Promise.all([
    tx.objectStore("cache").clear(),
    tx.objectStore("mutations").clear(),
  ]);
  await tx.done;
  notifyListeners();
}

async function syncMutation(mutation: StoredMutation): Promise<boolean> {
  try {
    const sb = supabase as any;
    let result: { error?: { message?: string } | null } | undefined;
    if (mutation.action === "INSERT") {
      result = await sb.from(mutation.table).insert(mutation.data);
    } else if (mutation.action === "UPDATE") {
      result = await sb.from(mutation.table).update(mutation.data).eq("id", mutation.recordId!);
    } else {
      result = await sb.from(mutation.table).delete().eq("id", mutation.recordId!);
    }
    if (result?.error) throw new Error(result.error.message || "Conflicto al sincronizar registro");
    return true;
  } catch (error) {
    const nextAttempts = (mutation.attempts || 0) + 1;
    const db = await getDb();
    await db.put("mutations", {
      ...mutation,
      attempts: nextAttempts,
      status: nextAttempts >= MAX_SYNC_ATTEMPTS ? "failed" : "pending",
      lastError: error instanceof Error ? error.message : "Error desconocido al sincronizar",
    });
    return false;
  }
}

export async function syncPendingMutations() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const mutations = await getPendingMutations();
    const eligible = mutations.filter(
      (m) => m.status !== "failed" && (m.attempts ?? 0) < MAX_SYNC_ATTEMPTS
    );
    if (eligible.length === 0) return;

    const syncedIds: number[] = [];
    for (const mutation of eligible) {
      if (await syncMutation(mutation)) syncedIds.push(mutation.id);
    }
    await clearSyncedMutations(syncedIds);
    notifyListeners();
    if (syncedIds.length > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OFFLINE_SYNCED_EVENT, { detail: { count: syncedIds.length } }));
    }
  })()
    .catch((error) => {
      console.warn("No se pudo sincronizar la cola offline", error);
    })
    .finally(() => {
      syncInFlight = null;
    });

  return syncInFlight;
}

export function registerOnlineSync() {
  if (typeof window === "undefined") return () => undefined;

  const handleOnline = () => {
    void syncPendingMutations();
  };
  window.addEventListener("online", handleOnline);
  void syncPendingMutations();

  return () => window.removeEventListener("online", handleOnline);
}
