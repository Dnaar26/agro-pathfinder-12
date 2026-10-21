import { cn } from "@/lib/utils";
import { cropStatusClass, cropStatusLabel } from "@/lib/status-styles";

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 font-medium", size === "lg" ? "text-xs" : "text-[11px]", cropStatusClass(status))}>{cropStatusLabel(status)}</span>;
}

export const CROP_STATUSES = ["PLANEADO", "SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO", "COSECHA", "POSTCOSECHA", "FINALIZADO"] as const;

export const ACTIVE_STATUSES = ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"];

export function isActive(status: string) {
  return ACTIVE_STATUSES.includes(status);
}
