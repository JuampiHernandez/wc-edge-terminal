// API-Football (api-sports.io) — squads & injuries for national teams.
// Auth: x-apisports-key header.
//
// Free-plan caveat: seasons 2022–2024 only. WC 2026 league data returns a plan
// error until upgraded — we still use squads (team endpoint) which works.

const BASE = "https://v3.football.api-sports.io";

function key(): string | undefined {
  const raw = process.env.API_FOOTBALL_KEY?.trim();
  if (!raw) return undefined;
  return raw.replace(/[^\x20-\x7E]/g, "");
}

function watchRateLimit(res: Response): void {
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  if (remaining !== null && Number(remaining) <= 5) {
    console.warn(`[api-football] rate limit low: ${remaining} requests remaining`);
  }
}

async function afGet<T>(path: string, revalidate: number): Promise<T | null> {
  const k = key();
  if (!k) return null;
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": k, Accept: "application/json" },
    next: { revalidate },
  });
  watchRateLimit(res);
  if (!res.ok) {
    console.warn(`[api-football] ${path} → HTTP ${res.status}`);
    return null;
  }
  const body = (await res.json()) as T & { errors?: Record<string, string> };
  if (body.errors && Object.keys(body.errors).length > 0) {
    console.warn(`[api-football] ${path} errors:`, body.errors);
    return null;
  }
  return body;
}

type AfTeamSearch = { response: { team: { id: number; name: string; national: boolean } }[] };
type AfSquad = {
  response: { team: { id: number; name: string }; players: { id: number; name: string; position: string }[] }[];
};
type AfInjury = {
  response: {
    player: { id: number; name: string; reason: string; type: string };
    team: { id: number; name: string };
    fixture: { date: string };
  }[];
};

/** Resolve a national team's API-Football id (cached 7 days). */
export async function resolveNationalTeamId(country: string): Promise<number | null> {
  const data = await afGet<AfTeamSearch>(
    `/teams?country=${encodeURIComponent(country)}`,
    604_800,
  );
  const hit = data?.response?.find((r) => r.team.national);
  return hit?.team.id ?? null;
}

export async function fetchNationalSquad(teamId: number): Promise<{ name: string; position: string }[]> {
  const data = await afGet<AfSquad>(`/players/squads?team=${teamId}`, 21_600);
  return (data?.response?.[0]?.players ?? []).map((p) => ({ name: p.name, position: p.position }));
}

/** Injuries for a national team in a given season (free plan: 2022–2024). */
export async function fetchTeamInjuries(teamId: number, season = 2024): Promise<AfInjury["response"]> {
  const data = await afGet<AfInjury>(`/injuries?team=${teamId}&season=${season}`, 3600);
  return data?.response ?? [];
}
