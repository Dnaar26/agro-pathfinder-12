import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  discardOfflineMutation,
  getPendingMutations,
  MAX_SYNC_ATTEMPTS,
  retryFailedMutations,
  subscribeOfflineQueue,
  type StoredMutation,
} from "@/lib/services/offline-sync";

const TABLE_LABELS: Record<StoredMutation["table"], string> = {
  parcels: "Parcela",
  crops: "Cultivo",
  activities: "Actividad",
  inventory_items: "Insumo",
};

/** Estado real de conexión + bandeja de resolución de conflictos de sincronización offline */
export function ConnectionBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<StoredMutation[]>([]);
  const [retrying, setRetrying] = useState(false);

  const refreshQueue = useCallback(async () => {
    try {
      const items = await getPendingMutations();
      setQueue(items);
    } catch {
      // IndexedDB unavailable in private/SSR mode
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    void refreshQueue();
    const unsub = subscribeOfflineQueue(() => {
      void refreshQueue();
    });
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      unsub();
    };
  }, [refreshQueue]);

  const failedItems = queue.filter((m) => m.status === "failed" || m.attempts >= MAX_SYNC_ATTEMPTS);
  const pendingCount = queue.length - failedItems.length;

  const badgePill = (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        failedItems.length > 0
          ? "cursor-pointer border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
          : !online || pendingCount > 0
            ? "cursor-pointer border-warning/50 bg-warning/15 text-foreground hover:bg-warning/25"
            : "border-border bg-muted/60 text-muted-foreground",
        className,
      )}
    >
      {failedItems.length > 0 ? (
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-warning")}
        />
      )}
      <span>{online ? t("shell.online") : t("shell.offline")}</span>
      {failedItems.length > 0 && (
        <span className="font-semibold">· {failedItems.length} conflicto{failedItems.length > 1 ? "s" : ""}</span>
      )}
      {failedItems.length === 0 && pendingCount > 0 && (
        <span className="font-semibold">· {pendingCount} pend.</span>
      )}
    </span>
  );

  if (queue.length === 0) {
    return badgePill;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Revisar estado de sincronización offline" className="focus:outline-none">
          {badgePill}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-foreground">Cola de sincronización ({queue.length})</p>
          {failedItems.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={retrying || !online}
              onClick={async () => {
                setRetrying(true);
                await retryFailedMutations().finally(() => setRetrying(false));
              }}
              className="h-7 px-2 text-[11px]"
            >
              <RefreshCw className={cn("mr-1 size-3", retrying && "animate-spin")} aria-hidden="true" />
              Reintentar
            </Button>
          )}
        </div>
        <ul className="max-h-52 space-y-2 overflow-y-auto">
          {queue.map((item) => {
            const isFailed = item.status === "failed" || item.attempts >= MAX_SYNC_ATTEMPTS;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-lg border p-2",
                  isFailed ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {TABLE_LABELS[item.table]} ({item.action})
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {isFailed ? item.lastError || "Rechazado por el servidor" : "Esperando conexión estable…"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Descartar cambio local"
                  onClick={() => void discardOfflineMutation(item.id)}
                  className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
