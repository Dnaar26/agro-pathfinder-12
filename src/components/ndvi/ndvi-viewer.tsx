import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";

type NdviEntry = { ndvi: number; date: string };

export function NdviViewer({ parcelId, lat, lng }: { parcelId: string; lat?: number | null; lng?: number | null }) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["ndvi", parcelId],
    queryFn: async () => {
      const { data: cached } = await supabase.from("ndvi_cache").select("ndvi, date").eq("parcel_id", parcelId).order("date", { ascending: false }).limit(1).maybeSingle();
      if (cached) return cached as NdviEntry;

      if (!lat || !lng) return null;

      try {
        const url = `https://services.sentinel-hub.com/ogc/wms/${import.meta.env.VITE_SENTINEL_INSTANCE_ID || "INSTANCE"}?service=WMS&request=GetFeatureInfo&layers=NDVI&bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&width=1&height=1&query_layers=NDVI&info_format=application/json&i=0&j=0`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SENTINEL_API_KEY || ""}` } });
        if (!res.ok) return null;
        const info = await res.json();
        const ndvi = info?.features?.[0]?.properties?.NDVI ?? null;
        if (ndvi != null) {
          await supabase.from("ndvi_cache").upsert({ parcel_id: parcelId, ndvi: Math.round(ndvi * 1000) / 1000, date: new Date().toISOString().split("T")[0] }).maybeSingle();
          return { ndvi, date: new Date().toISOString().split("T")[0] };
        }
        return null;
      } catch { return null; }
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
