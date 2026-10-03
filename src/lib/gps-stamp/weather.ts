/** Cuaca saat ini dari Open-Meteo (gratis, tanpa API key). Gagal -> null (tidak ada data palsu). */

export interface WeatherInfo {
  temperature: number;
  description: string;
  icon: string;
  humidity: number | null;
  /** km/jam */
  windSpeed: number | null;
  /** hPa */
  pressure: number | null;
}

function decodeWeatherCode(code: number): { description: string; icon: string } {
  switch (code) {
    case 0: return { description: "Cerah", icon: "☀️" };
    case 1: return { description: "Cerah Berawan", icon: "🌤️" };
    case 2: return { description: "Berawan Sebagian", icon: "⛅" };
    case 3: return { description: "Mendung", icon: "☁️" };
    case 45:
    case 48: return { description: "Berkabut", icon: "🌫️" };
    case 51:
    case 53:
    case 55: return { description: "Gerimis", icon: "🌦️" };
    case 61:
    case 63:
    case 65: return { description: "Hujan", icon: "🌧️" };
    case 66:
    case 67: return { description: "Hujan Beku", icon: "🌨️" };
    case 71:
    case 73:
    case 75:
    case 77: return { description: "Salju", icon: "❄️" };
    case 80:
    case 81:
    case 82: return { description: "Hujan Deras", icon: "🌦️" };
    case 85:
    case 86: return { description: "Hujan Salju", icon: "🌨️" };
    case 95: return { description: "Badai Petir", icon: "⛈️" };
    case 96:
    case 99: return { description: "Badai Petir & Hujan Es", icon: "🌩️" };
    default: return { description: "Berawan", icon: "🌤️" };
  }
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
    weather_code?: number | null;
    surface_pressure?: number | null;
    wind_speed_10m?: number | null;
  };
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { data: WeatherInfo; at: number }>();

export async function fetchWeather(lat: number, lon: number): Promise<WeatherInfo | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure,wind_speed_10m`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const c = ((await res.json()) as OpenMeteoResponse).current;
    if (!c || typeof c.temperature_2m !== "number") return null;

    const wmo = decodeWeatherCode(c.weather_code ?? 0);
    const data: WeatherInfo = {
      temperature: c.temperature_2m,
      description: wmo.description,
      icon: wmo.icon,
      humidity: c.relative_humidity_2m ?? null,
      windSpeed: c.wind_speed_10m ?? null,
      pressure: c.surface_pressure ?? null,
    };
    cache.set(key, { data, at: Date.now() });
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Baris ringkas cuaca untuk stempel/overlay: "☀️ 29°C (Cerah) | 💨 12 km/j | ⏱️ 1012 hPa | 💧 70%". */
export function formatWeatherLine(w: WeatherInfo): string {
  const parts = [`${w.icon} ${Math.round(w.temperature)}°C (${w.description})`];
  if (w.windSpeed !== null) parts.push(`💨 ${Math.round(w.windSpeed)} km/j`);
  if (w.pressure !== null) parts.push(`⏱️ ${Math.round(w.pressure)} hPa`);
  if (w.humidity !== null) parts.push(`💧 ${Math.round(w.humidity)}%`);
  return parts.join("  |  ");
}
