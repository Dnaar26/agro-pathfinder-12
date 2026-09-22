import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { CloudSun, CloudRain, Thermometer, AlertTriangle, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

async function getWeatherRisk(parcelId: string, lat: number, lon: number) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max&forecast_days=3&timezone=auto`
  );
  const data = await res.json();
  const risks: { day: string; type: "frost" | "heavy_rain"; severity: "baja" | "media" | "alta"; temp?: number; precip?: number }[] = [];
  for (let i = 0; i < (data.daily?.time?.length ?? 0); i++) {
    const minTemp = data.daily.temperature_2m_min?.[i];
    const precip = data.daily.precipitation_sum?.[i];
    if (minTemp != null && minTemp < 2) risks.push({ day: data.daily.time[i], type: "frost", severity: minTemp < 0 ? "alta" : "media", temp: minTemp });
    if (precip != null && precip > 20) risks.push({ day: data.daily.time[i], type: "heavy_rain", severity: precip > 50 ? "alta" : "media", precip });
  }
  return risks;
}

export function PredictiveAlerts() {
  const [expanded, setExpanded] = useState(false);

  const parcels = useQuery({
    queryKey: ["parcels-coords"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("parcels").select("id, name, latitude, longitude").not("latitude", "is", null).not("longitude", "is", null).limit(10);
      return data ?? [];
    },
  });

  const risksQuery = useQuery({
    queryKey: ["weather-risks", parcels.data],
    queryFn: async () => {
      const allRisks: { parcel: string; risks: any[] }[] = [];
      for (const p of parcels.data ?? []) {
        if (!p.latitude || !p.longitude) continue;
        const risks = await getWeatherRisk(p.id, Number(p.latitude), Number(p.longitude));
        if (risks.length > 0) allRisks.push({ parcel: p.name, risks });
      }
      return allRisks;
    },
    enabled: (parcels.data ?? []).length > 0,
    refetchInterval: 3600000,
  });

  const totalRisks = risksQuery.data?.reduce((s, r) => s + r.risks.length, 0) ?? 0;

  if (totalRisks === 0) return null;

  return (
    <Card className={cn("p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800")}>
      <button className="flex items-center gap-2 w-full text-left" onClick={() => setExpanded(!expanded)}>
        <AlertTriangle className="size-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {totalRisks} riesgo{totalRisks !== 1 ? "s" : ""} climático{totalRisks !== 1 ? "s" : ""} detectado{totalRisks !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {risksQuery.data?.map((r) => `${r.parcel} (${r.risks.length})`).join(" · ")}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-amber-200 dark:border-amber-800 pt-3">
          {risksQuery.data?.map((r) =>
            r.risks.map((risk: any, i: number) => (
              <div key={`${r.parcel}-${i}`} className="flex items-start gap-2 text-sm">
                {risk.type === "frost" ? <Thermometer className="size-4 text-blue-500 mt-0.5" /> : <Droplets className="size-4 text-blue-500 mt-0.5" />}
                <div>
                  <p className="font-medium capitalize">{r.parcel}</p>
                  <p className="text-xs text-muted-foreground">
                    {risk.type === "frost" ? `Helada (${risk.temp?.toFixed(1)}°C)` : `Lluvia fuerte (${risk.precip}mm)`} — {risk.day}
                    <span className={cn("ml-1 text-xs font-medium", risk.severity === "alta" ? "text-red-600" : "text-amber-600")}>
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
