import type { WeatherEvidence } from "@liveearth/domain/types";

interface CurrentWeatherResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
  };
}

export async function fetchCurrentWeather(input: {
  latitude: number;
  longitude: number;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<WeatherEvidence> {
  const url = new URL("https://customer-api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.latitude));
  url.searchParams.set("longitude", String(input.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m",
  );
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("apikey", input.apiKey);

  const response = await fetch(url, input.signal ? { signal: input.signal } : undefined);
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const body = (await response.json()) as CurrentWeatherResponse;
  const current = body.current;
  if (!current) throw new Error("Open-Meteo response has no current conditions");

  return {
    observedAt: current.time ? new Date(`${current.time}Z`).toISOString() : new Date().toISOString(),
    weatherCode: current.weather_code ?? 0,
    temperatureC: current.temperature_2m ?? 0,
    windKph: current.wind_speed_10m ?? 0,
    precipitationMm: current.precipitation ?? 0,
    cloudCoverPercent: current.cloud_cover ?? 0,
    source: "open-meteo",
  };
}
