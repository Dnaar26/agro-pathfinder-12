import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sun, CloudRain, CloudDrizzle, CloudSun, Droplets, Wind, AlertTriangle, RefreshCw } from "lucide-react";
import { fetchWeatherForecast, type DailyForecast, type WeatherAlerts } from "@/lib/services/weather";
import { Button } from "@/components/ui/button";

export function WeatherForecast({ lat, lng, parcelName }: { lat: number; lng: number; parcelName?: string }) {
  const { t } = useTranslation();
  const forecastQuery = useQuery({
    queryKey: ["weather-forecast", Number(lat.toFixed(3)), Number(lng.toFixed(3))],
    queryFn: () => fetchWeatherForecast(lat, lng),
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: false,
  });
  const forecast: DailyForecast[] = forecastQuery.data?.daily ?? [];
  const alerts: WeatherAlerts | null = forecastQuery.data?.alerts ?? null;

  if (forecastQuery.isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (forecastQuery.isError && forecast.length === 0) return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 p-3">
      <p className="text-sm text-muted-foreground">{t("weather.update_failed")}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => forecastQuery.refetch()} disabled={forecastQuery.isFetching}>
        <RefreshCw className={`size-4 ${forecastQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
        {t("weather.retry")}
      </Button>
    </div>
  );
  if (forecast.length === 0) return <p className="text-sm text-muted-foreground">{t("weather.no_forecast")}</p>;

  return (
    <div className="space-y-3">
      {forecastQuery.isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 p-3">
          <p className="text-sm text-muted-foreground">{t("weather.update_failed")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => forecastQuery.refetch()} disabled={forecastQuery.isFetching}>
            <RefreshCw className={`size-4 ${forecastQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            {t("weather.retry")}
          </Button>
        </div>
      )}
      {alerts && (alerts.hasFrost || alerts.hasHeavyRain) && (
        <div className="space-y-1">
          {alerts.days.map((d) => d.alerts.map((a) => (
            <div
              key={a}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs"
            >
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="font-medium">
                {a.startsWith("FROST") ? "Heladas" : "Lluvias fuertes"} —{" "}
                {new Date(d.date + "T12:00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
          )))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 auto-rows-fr">
        {forecast.map((d, i) => {
          const isToday = i === 0;
          const WeatherIcon =
            d.precipProb > 70 ? CloudRain :
            d.precipProb > 40 ? CloudDrizzle :
            d.precipProb > 20 ? CloudSun :
            Sun;

          return (
            <div
              key={d.date}
              className={`rounded-xl border text-center transition-colors flex flex-col items-center min-h-[120px] ${
                isToday
                  ? "bg-primary/5 border-primary/30 shadow-sm ring-1 ring-primary/10"
                  : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              <div className="flex-1 flex flex-col items-center justify-end pb-2.5 px-2 w-full">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isToday ? "HOY" : new Date(d.date + "T12:00:00").toLocaleDateString("es", { weekday: "short" })}
                </p>

                <WeatherIcon className="size-6 my-1.5 text-amber-400" />

                <p className="text-base font-bold tabular-nums leading-tight">
                  {Math.round(d.tempMax)}°<span className="text-[11px] font-normal text-muted-foreground">/{Math.round(d.tempMin)}°</span>
                </p>

                <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Droplets className="size-3 text-blue-400" />{d.precip}
                  </span>
                  <span className="text-border/30">·</span>
                  <span className="flex items-center gap-0.5">
                    <Wind className="size-3 text-sky-500" />{Math.round(d.wind)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
