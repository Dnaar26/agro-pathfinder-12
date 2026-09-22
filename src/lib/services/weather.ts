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

export async function fetchWeatherForecast(lat: number, lng: number): Promise<{ daily: DailyForecast[]; alerts: WeatherAlerts } | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const daily: DailyForecast[] = (data.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precip: data.daily.precipitation_sum[i] ?? 0,
      precipProb: data.daily.precipitation_probability_max[i] ?? 0,
      wind: data.daily.wind_speed_10m_max[i] ?? 0,
      humidity: 0,
    }));

    const days: WeatherAlerts["days"] = [];
    let hasFrost = false;
    let hasHeavyRain = false;

    for (const d of daily) {
      const alerts: string[] = [];
      if (d.tempMin < 2) { alerts.push(`FROST_${d.date}`); hasFrost = true; }
      if (d.precipProb > 70 && d.precip > 10) { alerts.push(`RAIN_${d.date}`); hasHeavyRain = true; }
      if (alerts.length > 0) days.push({ date: d.date, alerts });
    }

    return { daily, alerts: { hasFrost, hasHeavyRain, days } };
  } catch {
    return null;
  }
}
