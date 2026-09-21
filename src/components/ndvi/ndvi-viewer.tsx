import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getNdvi } from "@/lib/api/ndvi.server";

type NdviEntry = { ndvi: number; date: string };

export function NdviViewer({ parcelId, lat, lng }: { parcelId: string; lat?: number | null; lng?: number | null }) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["ndvi", parcelId],
    queryFn: async () => {
      const { data: cached } = await supabase.from("ndvi_cache").select("ndvi, date").eq("parcel_id", parcelId).order("date", { ascending: false }).limit(1).maybeSingle();
      if (cached) return cached as NdviEntry;

      if (lat == null || lng == null) return null;
      return getNdvi({ data: { parcelId, latitude: lat, longitude: lng } });
    },
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60,
  });

  function getHealth(value: number) {
    if (value > 0.6) return { label: t("ndvi.healthy"), color: "text-green-600", bg: "bg-green-100" };
    if (value > 0.3) return { label: t("ndvi.moderate"), color: "text-yellow-600", bg: "bg-yellow-100" };
    return { label: t("ndvi.stressed"), color: "text-red-600", bg: "bg-red-100" };
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Leaf className="size-4 text-primary" />
        {t("ndvi.title")}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t("ndvi.no_data")}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold tabular-nums">{data.ndvi.toFixed(3)}</span>
            <Badge className={getHealth(data.ndvi).bg + " " + getHealth(data.ndvi).color}>{getHealth(data.ndvi).label}</Badge>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min(100, data.ndvi * 100)}%`,
              background: data.ndvi > 0.6 ? "#16a34a" : data.ndvi > 0.3 ? "#ca8a04" : "#dc2626",
            }} />
          </div>
          <p className="text-xs text-muted-foreground">{t("ndvi.last_update", { date: new Date(data.date + "T12:00:00").toLocaleDateString() })}</p>
        </div>
      )}
    </Card>
  );
}
