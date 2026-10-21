import { z } from "zod";
import { captureAppError } from "@/lib/services/error-monitoring";
import { fetchWithRetry } from "@/lib/services/http-retry.js";

export type DailyForecast = {
  date: string;
  tempMax: number;
  tempMin: number;
  precip: number;
  precipProb: number;
  wind: number;
  humidity: number;
};

export type WeatherAlerts = {
  hasFrost: boolean;
  hasHeavyRain: boolean;
  days: { date: string; alerts: string[] }[];
};

export type WeatherForecastResult = {
  daily: DailyForecast[];
  alerts: WeatherAlerts;
  source: "open-meteo";
  fetchedAt: string;
};

const dailySchema = z.object({
  time: z.array(z.string()),
  temperature_2m_max: z.array(z.number().nullable()).optional(),
  temperature_2m_min: z.array(z.number().nullable()).optional(),
  precipitation_sum: z.array(z.number().nullable()).optional(),
  precipitation_probability_max: z.array(z.number().nullable()).optional(),
  wind_speed_10m_max: z.array(z.number().nullable()).optional(),
});

const weatherResponseSchema = z.object({ daily: dailySchema });

export async function fetchWeatherForecast(lat: number, lng: number): Promise<WeatherForecastResult | null> {
  if (!isValidCoordinate(lat, lng)) return null;

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
      timezone: "auto",
      forecast_days: "7",
    });
    const response = await fetchWithRetry(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      timeoutMs: 8_000,
      maxAttempts: 2,
    });
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

    const parsed = weatherResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Weather response has an unsupported shape");

    const daily = parsed.data.daily.time.flatMap((date, index) => {
      const tempMax = readDailyValue(parsed.data.daily.temperature_2m_max, index);
      const tempMin = readDailyValue(parsed.data.daily.temperature_2m_min, index);
      if (tempMax === null || tempMin === null) return [];
      return [{
        date,
        tempMax,
        tempMin,
        precip: readDailyValue(parsed.data.daily.precipitation_sum, index) ?? 0,
        precipProb: readDailyValue(parsed.data.daily.precipitation_probability_max, index) ?? 0,
        wind: readDailyValue(parsed.data.daily.wind_speed_10m_max, index) ?? 0,
        humidity: 0,
      }];
    });

    if (daily.length === 0) throw new Error("Weather response has no usable forecast days");

    return {
      daily,
      alerts: buildAlerts(daily),
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    captureAppError(new Error("Weather integration unavailable"), { integration: "weather" });
    throw new Error("No se pudo actualizar el pronóstico.");
  }
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function readDailyValue(values: Array<number | null> | null | undefined, index: number) {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildAlerts(daily: DailyForecast[]): WeatherAlerts {
  const days: WeatherAlerts["days"] = [];
  let hasFrost = false;
  let hasHeavyRain = false;

  for (const day of daily) {
    const alerts: string[] = [];
    if (day.tempMin < 2) {
      alerts.push(`FROST_${day.date}`);
      hasFrost = true;
    }
    if (day.precipProb > 70 && day.precip > 10) {
      alerts.push(`RAIN_${day.date}`);
      hasHeavyRain = true;
    }
    if (alerts.length > 0) days.push({ date: day.date, alerts });
  }

  return { hasFrost, hasHeavyRain, days };
}
