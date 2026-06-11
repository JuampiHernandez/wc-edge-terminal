// football-data.org v4 — World Cup fixtures, teams, squads.
// Auth: X-Auth-Token header. Respect x-requests-available-minute (10/min free).
// Falls back to public/world_cup_2026.ics when the API tier blocks WC data.

import { parseIcsEvents } from "./calendar-ics";
import { nationName } from "./teams-list";
import { VENUES } from "./worldcup";

const BASE = "https://api.football-data.org/v4";

export type FdTeam = { id: number; name: string | null; tla: string | null };
export type FdPlayer = { id: number; name: string; position: string };
export type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  venue?: string | null;
  venueId?: string;
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
    const body = await res.text().catch(() => "");
    console.warn(`[football-data] ${path} → HTTP ${res.status}`, body.slice(0, 120));
    return null;
  }
  return (await res.json()) as T;
}

function parseIcsDt(raw: string): string {
  // 20260611T190000Z → ISO UTC
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date().toISOString();
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

function icsGroup(description: string): string | null {
  const hit = description.match(/Group\s+([A-L])/i);
  return hit ? `GROUP_${hit[1].toUpperCase()}` : null;
}

function normVenue(s: string): string {
  return s
    .toLowerCase()
    .replace(/new york\/new jersey/g, "new york/nj")
    .replace(/bay area/g, "bay")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function venueIdFromLocation(location: string): string | undefined {
  const n = normVenue(location);
  return VENUES.find((v) => {
    const stadium = normVenue(v.stadium);
    const city = normVenue(v.city);
    return n.includes(stadium) || n.includes(city) || stadium.includes(n) || city.includes(n);
  })?.id;
}

function fixtureKey(dateIso: string, codes: string[]): string {
  return `${dateIso.slice(0, 10)}:${codes.filter(Boolean).sort().join("-")}`;
}

function icsVenueLookup(): {
  byMatchNum: Map<number, { venue: string; venueId?: string }>;
  byFixture: Map<string, { venue: string; venueId?: string }>;
} {
  const byMatchNum = new Map<number, { venue: string; venueId?: string }>();
  const byFixture = new Map<string, { venue: string; venueId?: string }>();
  for (const e of parseIcsEvents()) {
    if (!e.location) continue;
    const venue = { venue: e.location, venueId: venueIdFromLocation(e.location) };
    byMatchNum.set(e.matchNum, venue);

    const dt = parseIcsDt(e.block.match(/^DTSTART:(.+)$/m)?.[1]?.trim() ?? "");
    if (e.teamCodes.length === 2) byFixture.set(fixtureKey(dt, e.teamCodes), venue);
  }
  return { byMatchNum, byFixture };
}

/** Static schedule fallback from bundled ICS (group-stage + knockout). */
export function fixturesFromIcs(days = 45): FdMatch[] {
  const from = Date.now();
  const to = from + days * 86_400_000;
  const events = parseIcsEvents();

  const out: FdMatch[] = [];
  for (const e of events) {
    if (e.teamCodes.length !== 2) continue;
    const dt = parseIcsDt(e.block.match(/^DTSTART:(.+)$/m)?.[1]?.trim() ?? "");
    const t = Date.parse(dt);
    if (t < from || t > to) continue;
    const [homeCode, awayCode] = e.teamCodes;
    out.push({
      id: e.matchNum,
      utcDate: dt,
      status: "SCHEDULED",
      stage: "GROUP_STAGE",
      group: icsGroup(e.description),
      matchday: null,
      venue: e.location,
      venueId: venueIdFromLocation(e.location),
      homeTeam: { id: e.matchNum * 10 + 1, name: nationName(homeCode), tla: homeCode },
      awayTeam: { id: e.matchNum * 10 + 2, name: nationName(awayCode), tla: awayCode },
    });
  }
  return out;
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
  const api = (data?.matches ?? []).filter((m) => m.status === "TIMED" || m.status === "SCHEDULED");
  if (api.length > 0) {
    const venues = icsVenueLookup();
    return api.map((m) => {
      const codes = [tlaToCode(m.homeTeam.tla), tlaToCode(m.awayTeam.tla)];
      const byFixture = venues.byFixture.get(fixtureKey(m.utcDate, codes));
      return { ...m, ...(venues.byMatchNum.get(m.id) ?? byFixture) };
    });
  }
  return fixturesFromIcs(days);
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

/** Map football-data TLA (3-letter) to our internal team code. "" when unknown (TBD teams). */
export function tlaToCode(tla: string | null | undefined): string {
  const code = tla ? tla.toUpperCase() : "";
  if (code === "URY") return "URU";
  return code;
}

/** GROUP_A → world-cup-group-a-winner */
export function groupSlug(group: string | null): string | undefined {
  if (!group) return undefined;
  const letter = group.replace(/^GROUP_/i, "").toLowerCase();
  if (!/^[a-l]$/.test(letter)) return undefined;
  return `world-cup-group-${letter}-winner`;
}
