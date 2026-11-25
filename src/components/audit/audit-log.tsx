import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  ClipboardList,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Code2,
  ArrowRight,
  ShieldAlert,
  PlusCircle,
  PencilLine,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

const TABLE_FRIENDLY_NAMES: Record<string, string> = {
  parcels: "Parcelas",
  crops: "Cultivos",
  activities: "Actividades de campo",
  inventory_items: "Inventario de insumos",
  inventory_movements: "Movimientos Kardex",
  user_roles: "Roles de usuario",
  profiles: "Perfiles",
  crop_costs: "Costos agrícolas",
  crop_harvests: "Cosechas",
  pest_incidents: "Incidencias de plagas",
  alerts: "Alertas y avisos",
  batches: "Lotes de trazabilidad",
  calendar_events: "Eventos de calendario",
  technician_farmer_assignments: "Asignaciones técnico-agricultor",
};

const IGNORED_DIFF_KEYS = new Set(["updated_at", "created_at"]);

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function computeFieldDiffs(
  action: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): { field: string; before: string; after: string }[] {
  const oldObj = oldData && typeof oldData === "object" ? oldData : {};
  const newObj = newData && typeof newData === "object" ? newData : {};
  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).filter(
    (k) => !IGNORED_DIFF_KEYS.has(k)
  );

  const diffs: { field: string; before: string; after: string }[] = [];
  for (const key of keys) {
    const b = formatCellValue(oldObj[key]);
    const a = formatCellValue(newObj[key]);
    if (action === "UPDATE" && b === a) continue;
    diffs.push({ field: key, before: b, after: a });
  }
  return diffs.slice(0, 16);
}

function exportAuditCsv(rows: any[]) {
  const esc = (v: unknown) => {
    if (v == null) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[\t\r ]*[=+@-]/.test(s)) s = `'${s}`;
    s = s.replace(/"/g, '""');
    return /[",\r\n]/.test(s) ? `"${s}"` : s;
  };
  const headers = ["fecha", "accion", "modulo", "registro_id", "resumen_cambios"];
  const lines = rows.map((r) => {
    const diffs = computeFieldDiffs(r.action, r.old_data, r.new_data)
      .map((d) => `${d.field}: ${d.before} -> ${d.after}`)
      .join(" | ");
    return [
      esc(r.created_at),
      esc(r.action),
      esc(TABLE_FRIENDLY_NAMES[r.table_name] || r.table_name),
      esc(r.record_id),
      esc(diffs),
    ].join(",");
  });
  const csv = "\uFEFF" + [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria-sigic-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AuditLog() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [tableFilter, setTableFilter] = useState<string>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showRawJsonId, setShowRawJsonId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, table_name, record_id, old_data, new_data, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      inserts: rows.filter((r) => r.action === "INSERT").length,
      updates: rows.filter((r) => r.action === "UPDATE").length,
      deletes: rows.filter((r) => r.action === "DELETE").length,
    };
  }, [data]);

  const availableTables = useMemo(() => {
    const set = new Set<string>();
    for (const r of data ?? []) {
      if (r.table_name) set.add(r.table_name);
    }
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      if (actionFilter !== "ALL" && e.action !== actionFilter) return false;
      if (tableFilter !== "ALL" && e.table_name !== tableFilter) return false;
      if (!q) return true;
      const friendly = (TABLE_FRIENDLY_NAMES[e.table_name] || "").toLowerCase();
      const payloadStr = JSON.stringify(e.new_data || e.old_data || {}).toLowerCase();
      return (
        e.action?.toLowerCase().includes(q) ||
        e.table_name?.toLowerCase().includes(q) ||
        friendly.includes(q) ||
        e.record_id?.toLowerCase().includes(q) ||
        payloadStr.includes(q)
      );
    });
  }, [data, search, actionFilter, tableFilter]);

  const pageSize = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, tableFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const actionColor = (action: string) => {
    if (action === "DELETE") return "destructive";
    if (action === "UPDATE") return "warning";
    return "secondary";
  };

  const actionLabel = (action: string) => {
    if (action === "INSERT") return "CREACIÓN";
    if (action === "UPDATE") return "EDICIÓN";
    if (action === "DELETE") return "ELIMINACIÓN";
    return action;
  };

  return (
    <div className="space-y-4">
      {/* KPIs de trazabilidad operativa */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ClipboardList className="size-3.5 text-primary" /> Total eventos
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{stats.total}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <PlusCircle className="size-3.5 text-success" /> Creaciones
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-success">{stats.inserts}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <PencilLine className="size-3.5 text-warning-text" /> Ediciones
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{stats.updates}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-destructive" /> Eliminaciones
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-destructive">{stats.deletes}</p>
        </Card>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: "Todas" },
              { id: "INSERT", label: "Creaciones" },
              { id: "UPDATE", label: "Ediciones" },
              { id: "DELETE", label: "Eliminaciones" },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActionFilter(chip.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  actionFilter === chip.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={filtered.length === 0}
            onClick={() => exportAuditCsv(filtered)}
            className="gap-1.5 self-end sm:self-auto"
          >
            <Download className="size-3.5" />
            Exportar CSV ({filtered.length})
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por módulo, valor modificado o ID de registro…"
              aria-label={t("common.search")}
              className="pl-8"
            />
          </div>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Todos los módulos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los módulos</SelectItem>
              {availableTables.map((tb) => (
                <SelectItem key={tb} value={tb}>
                  {TABLE_FRIENDLY_NAMES[tb] || tb}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t("common.loading")}</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-6 text-center" role="alert">
            No se pudo cargar el registro de auditoría.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t("common.no_data")}</p>
        ) : (
          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {pageRows.map((e) => {
              const isExp = expanded === e.id;
              const diffs = isExp
                ? computeFieldDiffs(
                    e.action,
                    e.old_data as Record<string, unknown> | null,
                    e.new_data as Record<string, unknown> | null
                  )
                : [];
              const friendlyModule = TABLE_FRIENDLY_NAMES[e.table_name] || e.table_name;

              return (
                <div key={e.id} className="p-3.5 rounded-xl border border-border bg-card/60 text-sm transition-colors hover:border-primary/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={actionColor(e.action) as any} className="text-[11px]">
                        {actionLabel(e.action)}
                      </Badge>
                      <span className="font-semibold text-xs sm:text-sm text-foreground">{friendlyModule}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        #{e.record_id?.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => setExpanded(isExp ? null : e.id)}
                        aria-label={isExp ? "Ocultar cambios" : "Ver cambios"}
                      >
                        {isExp ? "Ocultar" : "Ver detalle"}
                        {isExp ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <p className="sm:hidden text-[11px] text-muted-foreground mt-1">
                    {format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}
                  </p>

                  {isExp && (
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                      {diffs.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-muted/60 text-muted-foreground">
                              <tr>
                                <th className="px-3 py-1.5 font-semibold">Campo</th>
                                {e.action !== "INSERT" && <th className="px-3 py-1.5 font-semibold">Antes</th>}
                                {e.action !== "DELETE" && <th className="px-3 py-1.5 font-semibold">Después</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {diffs.map((d) => (
                                <tr key={d.field}>
                                  <td className="px-3 py-1.5 font-mono font-medium text-foreground">{d.field}</td>
                                  {e.action !== "INSERT" && (
                                    <td className="px-3 py-1.5 text-muted-foreground break-all max-w-[220px]">
                                      {d.before}
                                    </td>
                                  )}
                                  {e.action !== "DELETE" && (
                                    <td className="px-3 py-1.5 font-medium text-foreground break-all max-w-[240px]">
                                      {e.action === "UPDATE" && (
                                        <ArrowRight className="inline size-3 mr-1 text-primary" aria-hidden="true" />
                                      )}
                                      {d.after}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sin diferencias de campos registradas.</p>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowRawJsonId(showRawJsonId === e.id ? null : e.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Code2 className="size-3" />
                          {showRawJsonId === e.id ? "Ocultar JSON técnico" : "Ver JSON técnico"}
                        </button>
                      </div>

                      {showRawJsonId === e.id && (
                        <pre className="p-2.5 rounded-lg bg-muted text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-44">
                          {JSON.stringify({ old: e.old_data, new: e.new_data }, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && !isError && filtered.length > pageSize && (
          <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
