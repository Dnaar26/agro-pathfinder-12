import { openDB, type IDBPDatabase } from "idb";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB("sgic-offline", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mutations")) db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

let mutationQueue: { table: string; action: "INSERT" | "UPDATE" | "DELETE"; data: any; recordId?: string }[] = [];

export async function queueMutation(mutation: { table: string; action: "INSERT" | "UPDATE" | "DELETE"; data: any; recordId?: string }) {
  mutationQueue.push(mutation);
  const db = await getDb();
  await db.add("mutations", { ...mutation, createdAt: Date.now(), synced: false });
}

export async function getPendingMutations() {
  const db = await getDb();
  return db.getAll("mutations");
}

export async function clearSyncedMutations(ids: number[]) {
  const db = await getDb();
  const tx = db.transaction("mutations", "readwrite");
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function setCache(key: string, value: any) {
  const db = await getDb();
  await db.put("cache", { key, value, updatedAt: Date.now() });
}

export async function getCache(key: string) {
  const db = await getDb();
  return (await db.get("cache", key))?.value ?? null;
}

export async function clearCache() {
  const db = await getDb();
  await db.clear("cache");
}

async function syncMutation(m: any, supabase: any): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (m.action === "INSERT") await supabase.from(m.table).insert(m.data);
      else if (m.action === "UPDATE") await supabase.from(m.table).update(m.data).eq("id", m.recordId);
      else if (m.action === "DELETE") await supabase.from(m.table).delete().eq("id", m.recordId);
      return true;
    } catch {
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  return false;
}

export function registerOnlineSync() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", async () => {
    const mutations = await getPendingMutations();
    const syncedIds: number[] = [];
    for (const m of mutations) {
      const { default: supabase } = await import("@/integrations/supabase/client");
      const ok = await syncMutation(m, supabase);
      if (ok) syncedIds.push(m.id);
    }
    if (syncedIds.length > 0) await clearSyncedMutations(syncedIds);
  });
  window.addEventListener("beforeunload", () => {
    if (mutationQueue.length > 0) {
      mutationQueue = [];
    }
  });
}
