// Polymarket per-match (moneyline) markets for the FIFA World Cup.
//
// Polymarket lists every WC game under the "soccer-fifwc" series as an event
// like "fifwc-can-bih-2026-06-12" with three binary moneyline markets
// (home win / draw / away win). We discover those events from the series
// listing (cached — slugs never change), then fetch live prices per match
// and attach them to the fixture schedule.

import { fetchEvent, GAMMA } from "./polymarket";
import { resolveTeam } from "./worldcup";
import { fixturesFromIcs, tlaToCode, type FdMatch } from "./football-data";
import type { MatchFixture, MatchOdds, Market } from "./types";

const SERIES_SLUG = "soccer-fifwc";
const UA = "WC-Edge-Terminal/1.0 (markets reader)";
const MAIN_EVENT_RE = /^fifwc-[a-z0-9]+-[a-z0-9]+-(\d{4}-\d{2}-\d{2})$/;
const DISCOVERY_TTL_MS = 6 * 3600_000;
const SERIES_PAGES = 2; // 2 × 100 events ≈ the next ~8 days of matches

type DiscoveredMatch = {
  eventSlug: string;
  homeCode: string;
  awayCode: string;
  /** UTC kickoff date (YYYY-MM-DD). */
  date: string;
};

type RawSeriesEvent = {
  slug?: string;
  title?: string;
  closed?: boolean;
  /** Actual kickoff instant (the slug date is the US/ET calendar date — don't key off it). */
  startTime?: string;
  teams?: { name?: string; ordering?: string }[];
};

let discoveryCache: { at: number; matches: DiscoveredMatch[] } | null = null;
let seriesIdCache: string | null = null;

function fixtureKey(date: string, codes: string[]): string {
  return `${date}:${codes.filter(Boolean).sort().join("-")}`;
}

async function gammaJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${GAMMA}${path}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function resolveSeriesId(): Promise<string | null> {
  if (seriesIdCache) return seriesIdCache;
  const arr = await gammaJson<{ id?: string | number }[]>(`/series?slug=${SERIES_SLUG}&limit=1`);
  const id = Array.isArray(arr) && arr[0]?.id != null ? String(arr[0].id) : null;
  if (id) seriesIdCache = id;
  return id;
}

/** Home/away codes for one series event, via team names (slug abbreviations are unreliable). */
function eventTeams(ev: RawSeriesEvent): { home: string; away: string } | null {
  let home = "";
  let away = "";
  for (const t of ev.teams ?? []) {
    const code = t.name ? resolveTeam(t.name)?.code ?? "" : "";
    if (t.ordering === "home") home = code;
    if (t.ordering === "away") away = code;
  }
  if (home && away) return { home, away };
  // Fallback: parse "Canada vs. Bosnia-Herzegovina" from the title.
  const sides = ev.title?.split(/\s+vs\.?\s+/i) ?? [];
  if (sides.length === 2) {
    const h = resolveTeam(sides[0])?.code;
    const a = resolveTeam(sides[1])?.code;
    if (h && a) return { home: h, away: a };
  }
  return null;
}

/** Discover upcoming match events from the series listing (cached 6h). */
async function discoverMatchEvents(): Promise<DiscoveredMatch[]> {
  if (discoveryCache && Date.now() - discoveryCache.at < DISCOVERY_TTL_MS) {
    return discoveryCache.matches;
  }
  const seriesId = await resolveSeriesId();
  if (!seriesId) return discoveryCache?.matches ?? [];

  const pages = await Promise.all(
    Array.from({ length: SERIES_PAGES }, (_, i) =>
      gammaJson<RawSeriesEvent[]>(
        `/events?series_id=${seriesId}&closed=false&order=startTime&ascending=true&limit=100&offset=${i * 100}`,
      ),
    ),
  );

  const out: DiscoveredMatch[] = [];
  for (const page of pages) {
    if (!Array.isArray(page)) continue;
    for (const ev of page) {
      const slugMatch = ev.slug?.match(MAIN_EVENT_RE);
      if (!slugMatch || ev.closed) continue;
      const teams = eventTeams(ev);
      if (!teams) continue;
      const kickoff = ev.startTime ? Date.parse(ev.startTime) : NaN;
      out.push({
        eventSlug: ev.slug!,
        homeCode: teams.home,
        awayCode: teams.away,
        date: Number.isFinite(kickoff)
          ? new Date(kickoff).toISOString().slice(0, 10)
          : slugMatch[1],
      });
    }
  }

  if (out.length > 0) discoveryCache = { at: Date.now(), matches: out };
  return out;
}

/** Extract 1X2 odds from a fetched Polymarket match event. */
function oddsFromEvent(
  eventSlug: string,
  markets: Market[],
  homeCode: string,
  awayCode: string,
  volume24hr: number,
  liquidity: number,
): MatchOdds | null {
  const homeM = markets.find((m) => m.teamCode === homeCode);
  const awayM = markets.find((m) => m.teamCode === awayCode);
  const drawM = markets.find((m) => m.slug.endsWith("-draw") || /end in a draw/i.test(m.question));
  if (!homeM || !awayM || !drawM) return null;
  return {
    eventSlug,
    home: homeM.yesPrice,
    draw: drawM.yesPrice,
    away: awayM.yesPrice,
    volume24hr,
    liquidity,
    homeChange24h: homeM.change24h,
    awayChange24h: awayM.change24h,
  };
}

function stageLabel(m: FdMatch): string | undefined {
  if (m.group) return m.group.replace(/^GROUP_/i, "Group ");
  if (m.stage && m.stage !== "GROUP_STAGE") {
    return m.stage.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return undefined;
}

function toFixture(m: FdMatch): MatchFixture | null {
  const homeCode = tlaToCode(m.homeTeam.tla);
  const awayCode = tlaToCode(m.awayTeam.tla);
  if (!homeCode || !awayCode || !m.homeTeam.name || !m.awayTeam.name) return null;
  return {
    id: String(m.id),
    kickoff: Date.parse(m.utcDate),
    homeCode,
    awayCode,
    homeName: m.homeTeam.name,
    awayName: m.awayTeam.name,
    stageLabel: stageLabel(m),
    venue: m.venue ?? undefined,
  };
}

/**
 * Build the matchday board: fixtures from now (minus in-play grace) through
 * `daysAhead`, with Polymarket moneyline odds attached where a match event exists.
 */
export async function buildMatchday(
  matches: FdMatch[],
  daysAhead = 7,
): Promise<{ matchday: MatchFixture[]; note: string; ok: boolean }> {
  const source = matches.length > 0 ? matches : fixturesFromIcs(daysAhead + 1);
  const from = Date.now() - 3 * 3600_000; // keep in-play matches on the board
  const to = Date.now() + daysAhead * 86_400_000;

  const fixtures = source
    .map(toFixture)
    .filter((f): f is MatchFixture => f !== null && f.kickoff >= from && f.kickoff <= to)
    .sort((a, b) => a.kickoff - b.kickoff);

  if (fixtures.length === 0) return { matchday: [], note: "no fixtures in window", ok: false };

  const discovered = await discoverMatchEvents();
  const bySlugKey = new Map(
    discovered.map((d) => [fixtureKey(d.date, [d.homeCode, d.awayCode]), d] as const),
  );

  let withOdds = 0;
  await Promise.all(
    fixtures.map(async (f) => {
      const key = fixtureKey(new Date(f.kickoff).toISOString().slice(0, 10), [f.homeCode, f.awayCode]);
      const hit = bySlugKey.get(key);
      if (!hit) return;
      const ev = await fetchEvent(hit.eventSlug).catch(() => null);
      if (!ev) return;
      const odds = oddsFromEvent(hit.eventSlug, ev.markets, f.homeCode, f.awayCode, ev.volume24hr, ev.liquidity);
      if (odds) {
        f.odds = odds;
        withOdds++;
      }
    }),
  );

  return {
    matchday: fixtures,
    note: `${fixtures.length} fixtures · ${withOdds} with odds`,
    ok: withOdds > 0,
  };
}

/** Merge odds from a fallback payload (prod) into locally-built fixtures (dev). */
export function mergeMatchdayOdds(local: MatchFixture[], remote: MatchFixture[]): number {
  const remoteByKey = new Map(
    remote
      .filter((f) => f.odds)
      .map((f) => [fixtureKey(new Date(f.kickoff).toISOString().slice(0, 10), [f.homeCode, f.awayCode]), f.odds!] as const),
  );
  let merged = 0;
  for (const f of local) {
    if (f.odds) continue;
    const odds = remoteByKey.get(
      fixtureKey(new Date(f.kickoff).toISOString().slice(0, 10), [f.homeCode, f.awayCode]),
    );
    if (odds) {
      f.odds = odds;
      merged++;
    }
  }
  return merged;
}
