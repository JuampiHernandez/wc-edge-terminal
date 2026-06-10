// Venue weather via Open-Meteo (free, no API key).
// Heat, rain, wind and altitude are genuine edges for goals/fatigue markets at
// the 2026 World Cup (Mexico altitude + US summer heat).
//
// One batched request covers every venue (Open-Meteo accepts comma-separated
// coordinate lists and returns an array).

import type { Signal } from "./types";
import { VENUES } from "./worldcup";

const BASE = "https://api.open-meteo.com/v1/forecast";

type CurrentBlock = {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  wind_speed_10m?: number;
};

type ForecastResponse = {
  current?: CurrentBlock;
  latitude?: number;
  longitude?: number;
};

export type VenueWeather = {
  venueId: string;
  city: string;
  stadium: string;
  tempC: number;
  humidity: number;
  precipitation: number;
  windKph: number;
  elevationM: number;
};

export async function fetchVenueWeather(): Promise<VenueWeather[]> {
  const lats = VENUES.map((v) => v.lat).join(",");
  const lons = VENUES.map((v) => v.lon).join(",");
  const url =
    `${BASE}?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m` +
    `&wind_speed_unit=kmh&temperature_unit=celsius`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 1800 }, // 30 min
  });
  if (!res.ok) throw new Error(`open-meteo HTTP ${res.status}`);

  const data = (await res.json()) as ForecastResponse | ForecastResponse[];
  const arr = Array.isArray(data) ? data : [data];

  return arr.map((d, i) => {
    const v = VENUES[i];
    const c = d.current ?? {};
    return {
      venueId: v.id,
      city: v.city,
      stadium: v.stadium,
      tempC: c.temperature_2m ?? NaN,
      humidity: c.relative_humidity_2m ?? NaN,
      precipitation: c.precipitation ?? 0,
      windKph: c.wind_speed_10m ?? 0,
      elevationM: v.elevationM,
    };
  });
}

/**
 * Turn notable venue conditions into signals. We only emit when something is
 * actually edge-relevant (extreme heat, real rain, strong wind, high altitude)
 * so the feed stays signal, not noise.
 */
export function weatherSignals(weather: VenueWeather[], linkedTeams: string[] = []): Signal[] {
  const out: Signal[] = [];
  const now = Date.now();
  const teams = [...new Set(linkedTeams)];

  for (const w of weather) {
    const notes: string[] = [];
    let severity: 1 | 2 | 3 = 1;

    if (Number.isFinite(w.tempC) && w.tempC >= 32) {
      notes.push(`${Math.round(w.tempC)}°C heat`);
      severity = w.tempC >= 36 ? 3 : 2;
    }
    if (w.precipitation >= 1) {
      notes.push(`${w.precipitation.toFixed(1)}mm rain`);
      severity = Math.max(severity, 2) as 1 | 2 | 3;
    }
    if (w.windKph >= 30) {
      notes.push(`${Math.round(w.windKph)} km/h wind`);
      severity = Math.max(severity, 2) as 1 | 2 | 3;
    }
    if (w.elevationM >= 1500) {
      notes.push(`altitude ${w.elevationM}m`);
      severity = Math.max(severity, 2) as 1 | 2 | 3;
    }

    if (notes.length === 0) continue;

    out.push({
      id: `wx_${w.venueId}`,
      t: now,
      kind: "weather",
      severity,
      confidence: 0.9,
      headline: `${w.city}: ${notes.join(" · ")}`,
      detail: `${w.stadium}. Conditions affect pace, total goals and late-game fatigue.`,
      source: "Open-Meteo",
      entities: { venue: w.venueId, teams },
      marketSlugs: teams.length > 0 ? ["world-cup-winner"] : [],
    });
  }
  return out;
}
