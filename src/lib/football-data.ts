// football-data.org v4 — World Cup fixtures, teams, squads.
// Auth: X-Auth-Token header. Respect x-requests-available-minute (10/min free).

const BASE = "https://api.football-data.org/v4";

export type FdTeam = { id: number; name: string; tla: string };
export type FdPlayer = { id: number; name: string; position: string };
export type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
};

function token(): string | undefined {
  const raw = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!raw) return undefined;
  // Headers must be ByteString — strip accidental unicode from copy/paste.
  return raw.replace(/[^\x20-\x7E]/g, "");
}

function authHeaders(): HeadersInit {
  const t = token();
  if (!t) return { Accept: "application/json" };
  return { Accept: "application/json", "X-Auth-Token": t };
}

/** Log when the free-tier minute bucket is nearly exhausted. */
function watchRateLimit(res: Response): void {
  const left = res.headers.get("x-requests-available-minute");
  if (left !== null && Number(left) <= 2) {
    console.warn(`[football-data] rate limit low: ${left} requests left this minute`);
  }
}

async function fdGet<T>(path: string, revalidate: number): Promise<T | null> {
  if (!token()) return null;
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    next: { revalidate },
  });
  watchRateLimit(res);
  if (res.status === 429) {
    console.warn("[football-data] 429 rate limited");
    return null;
  }
  if (!res.ok) {
    console.warn(`[football-data] ${path} → HTTP ${res.status}`);
    return null;
  }
  return (await res.json()) as T;
}

/** Upcoming WC group/knockout fixtures in the next N days. */
export async function fetchWcFixtures(days = 14): Promise<FdMatch[]> {
  const from = new Date();
  const to = new Date(from.getTime() + days * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await fdGet<{ matches: FdMatch[] }>(
    `/competitions/WC/matches?dateFrom=${fmt(from)}&dateTo=${fmt(to)}`,
    3600,
  );
  return (data?.matches ?? []).filter((m) => m.status === "TIMED" || m.status === "SCHEDULED");
}

/** All teams registered for the World Cup competition. */
export async function fetchWcTeams(): Promise<FdTeam[]> {
  const data = await fdGet<{ teams: FdTeam[] }>("/competitions/WC/teams", 604_800);
  return data?.teams ?? [];
}

/** Full squad for one national team (by football-data team id). */
export async function fetchTeamSquad(teamId: number): Promise<FdPlayer[]> {
  const data = await fdGet<{ squad: FdPlayer[] }>(`/teams/${teamId}`, 604_800);
  return (data?.squad ?? []).slice(0, 26);
}

/** Map football-data TLA (3-letter) to our internal team code. */
export function tlaToCode(tla: string): string {
  return tla.toUpperCase();
}

/** GROUP_A → world-cup-group-a-winner */
export function groupSlug(group: string | null): string | undefined {
  if (!group) return undefined;
  const letter = group.replace(/^GROUP_/i, "").toLowerCase();
  if (!/^[a-l]$/.test(letter)) return undefined;
  return `world-cup-group-${letter}-winner`;
}
