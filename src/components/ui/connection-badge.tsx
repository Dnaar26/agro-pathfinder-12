import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Estado real de la conexión del navegador (no un indicador decorativo). */
export function ConnectionBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        online
          ? "border-border bg-muted/60 text-muted-foreground"
          : "border-warning/50 bg-warning/15 text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-warning")}
      />
      {online ? t("shell.online") : t("shell.offline")}
    </span>
  );
}
