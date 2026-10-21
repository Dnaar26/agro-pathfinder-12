import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

type MutationAction = "INSERT" | "UPDATE" | "DELETE";

export type OfflineMutation = {
  table: "parcels" | "crops" | "activities" | "inventory_items";
  action: MutationAction;
  data: Record<string, unknown>;
  recordId?: string;
};

type StoredMutation = OfflineMutation & {
  id: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;
let syncInFlight: Promise<void> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB("sgic-offline", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mutations")) {
          db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
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
    lastError: undefined,
  });
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
}

export async function setCache(key: string, value: unknown) {
  const db = await getDb();
  await db.put("cache", { key, value, updatedAt: Date.now() });
}

export async function getCache<T = unknown>(key: string): Promise<T | null> {
  const db = await getDb();
  return (await db.get("cache", key))?.value as T | null ?? null;
}

export async function clearCache() {
  const db = await getDb();
  await db.clear("cache");
}

async function syncMutation(mutation: StoredMutation): Promise<boolean> {
  try {
    let result: { error?: { message?: string } | null } | undefined;
    if (mutation.action === "INSERT") {
      result = await supabase.from(mutation.table).insert(mutation.data);
    } else if (mutation.action === "UPDATE") {
      result = await supabase.from(mutation.table).update(mutation.data).eq("id", mutation.recordId!);
    } else {
      result = await supabase.from(mutation.table).delete().eq("id", mutation.recordId!);
    }
    if (result?.error) throw result.error;
    return true;
  } catch (error) {
    const db = await getDb();
    await db.put("mutations", {
      ...mutation,
      attempts: mutation.attempts + 1,
      lastError: error instanceof Error ? error.message : "Error desconocido al sincronizar",
    });
    return false;
  }
}

async function syncPendingMutations() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const mutations = await getPendingMutations();
    const syncedIds: number[] = [];
    for (const mutation of mutations) {
      if (await syncMutation(mutation)) syncedIds.push(mutation.id);
    }
    await clearSyncedMutations(syncedIds);
  })().catch((error) => {
    console.warn("No se pudo sincronizar la cola offline", error);
  }).finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

export function registerOnlineSync() {
  if (typeof window === "undefined") return () => undefined;

  const handleOnline = () => { void syncPendingMutations(); };
  window.addEventListener("online", handleOnline);
  void syncPendingMutations();

  return () => window.removeEventListener("online", handleOnline);
}
