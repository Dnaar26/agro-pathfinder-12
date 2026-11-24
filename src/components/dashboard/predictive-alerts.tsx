import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Thermometer, AlertTriangle, Droplets } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchWeatherForecast } from "@/lib/services/weather";
import { cn } from "@/lib/utils";

type RiskItem = {
  day: string;
  type: "frost" | "heavy_rain";
  severity: "baja" | "media" | "alta";
  temp?: number;
  precip?: number;
};

export function PredictiveAlerts() {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const parcels = useQuery({
    queryKey: ["parcels-coords"],
    queryFn: async () => {
      const { data } = await supabase
        .from("parcels")
        .select("id, name, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(10);
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const parcelIdsKey = (parcels.data ?? []).map((p) => p.id).join(",");

  const risksQuery = useQuery({
    queryKey: ["weather-risks", parcelIdsKey],
    queryFn: async () => {
      const validParcels = (parcels.data ?? []).filter((p) => p.latitude != null && p.longitude != null);
      // Agrupar parcelas cercanas (~1.1 km) para no disparar peticiones duplicadas a Open-Meteo
      const groups = new Map<string, { lat: number; lng: number; names: string[] }>();
      for (const p of validParcels) {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        const existing = groups.get(key);
        if (existing) existing.names.push(p.name);
        else groups.set(key, { lat, lng, names: [p.name] });
      }

      const allRisks: { parcel: string; risks: RiskItem[] }[] = [];
      await Promise.allSettled(
        Array.from(groups.values()).map(async (group) => {
          const forecast = await qc.fetchQuery({
            queryKey: ["weather-forecast", Number(group.lat.toFixed(3)), Number(group.lng.toFixed(3))],
            queryFn: () => fetchWeatherForecast(group.lat, group.lng),
            staleTime: 30 * 60 * 1000,
          });
          if (!forecast?.daily) return;

          const risks: RiskItem[] = [];
          for (const d of forecast.daily.slice(0, 3)) {
            if (d.tempMin < 2) {
              risks.push({
                day: d.date,
                type: "frost",
                severity: d.tempMin < 0 ? "alta" : "media",
                temp: d.tempMin,
              });
            }
            if (d.precip > 20) {
              risks.push({
                day: d.date,
                type: "heavy_rain",
                severity: d.precip > 50 ? "alta" : "media",
                precip: d.precip,
              });
            }
          }

          if (risks.length > 0) {
            for (const name of group.names) {
              allRisks.push({ parcel: name, risks });
            }
          }
        })
      );

      return allRisks;
    },
    enabled: (parcels.data ?? []).length > 0,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 3600000,
  });

  const totalRisks = risksQuery.data?.reduce((s, r) => s + r.risks.length, 0) ?? 0;

  if (totalRisks === 0) return null;

  return (
    <Card className={cn("border-warning/30 bg-warning/10 p-4")}>
      <button
        type="button"
        aria-expanded={expanded}
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <AlertTriangle className="size-5 shrink-0 text-warning-text" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-warning-text">
            {totalRisks} riesgo{totalRisks !== 1 ? "s" : ""} climático{totalRisks !== 1 ? "s" : ""} detectado{totalRisks !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-warning-text/90">
            {risksQuery.data?.map((r) => `${r.parcel} (${r.risks.length})`).join(" · ")}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-warning/30 pt-3">
          {risksQuery.data?.map((r) =>
            r.risks.map((risk, i) => (
              <div key={`${r.parcel}-${i}`} className="flex items-start gap-2 text-sm">
                {risk.type === "frost" ? (
                  <Thermometer className="mt-0.5 size-4 text-info" aria-hidden="true" />
                ) : (
                  <Droplets className="mt-0.5 size-4 text-info" aria-hidden="true" />
                )}
                <div>
                  <p className="font-medium capitalize">{r.parcel}</p>
                  <p className="text-xs text-muted-foreground">
                    {risk.type === "frost" ? `Helada (${risk.temp?.toFixed(1)}°C)` : `Lluvia fuerte (${risk.precip}mm)`} — {risk.day}
                    <span className={cn("ml-1 text-xs font-medium", risk.severity === "alta" ? "text-destructive" : "text-warning-text")}>
                      ({risk.severity === "alta" ? "Alta" : "Media"})
                    </span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
