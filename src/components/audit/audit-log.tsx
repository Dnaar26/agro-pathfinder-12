import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { ClipboardList, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

export function AuditLog() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, table_name, record_id, old_data, new_data, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((e) =>
    !search || e.action?.toLowerCase().includes(search.toLowerCase()) || e.table_name?.toLowerCase().includes(search.toLowerCase()) || e.record_id?.toLowerCase().includes(search.toLowerCase())
  );
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const actionColor = (action: string) => {
    if (action === "DELETE") return "destructive";
    if (action === "UPDATE") return "warning";
    return "secondary";
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ClipboardList className="size-4 text-primary" />
        {t("audit.title")}
      </div>

      <div className="relative">
        <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`${t("common.search")} action, table...`} aria-label={t("common.search")} className="pl-8" />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : isError ? (
        <p className="text-sm text-destructive" role="alert">No se pudo cargar el registro de auditoría.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("common.no_data")}</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {pageRows.map((e) => (
            <div key={e.id} className="p-3 rounded-lg border border-border text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={actionColor(e.action) as any} className="text-xs">{e.action}</Badge>
                  <span className="font-medium text-xs">{e.table_name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{e.record_id?.slice(0, 8)}…</span>
                </div>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setExpanded(expanded === e.id ? null : e.id)} aria-label={expanded === e.id ? "Ocultar detalles" : "Mostrar detalles"} title={expanded === e.id ? "Ocultar detalles" : "Mostrar detalles"}>
                  {expanded === e.id ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{format(new Date(e.created_at), "yyyy-MM-dd HH:mm")}</p>
              {expanded === e.id && (
                <div className="mt-2 p-2 rounded bg-muted text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-40">
                  {JSON.stringify({ old: e.old_data, new: e.new_data }, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!isLoading && !isError && filtered.length > pageSize && <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />}
    </Card>
  );
}
