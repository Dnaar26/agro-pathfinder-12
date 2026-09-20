const STATUS_COLORS: Record<string, string> = {
  PLANEADO: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
  SEMBRADO: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
  CRECIMIENTO: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",
  MANTENIMIENTO: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700",
  COSECHA: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700",
  POSTCOSECHA: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700",
  FINALIZADO: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
};

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const color = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${size === "lg" ? "text-xs" : "text-[10px]"} ${color}`}>
      {status}
    </span>
  );
}

export const CROP_STATUSES = ["PLANEADO","SEMBRADO","CRECIMIENTO","MANTENIMIENTO","COSECHA","POSTCOSECHA","FINALIZADO"] as const;

export const ACTIVE_STATUSES = ["SEMBRADO", "CRECIMIENTO", "MANTENIMIENTO"];

export function isActive(status: string) {
  return ACTIVE_STATUSES.includes(status);
}