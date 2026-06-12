// Turn football-data.org (+ API-Football where available) into Signal objects.

import type { Signal } from "./types";
import { fetchWcFixtures, tlaToCode, type FdMatch } from "./football-data";
import { fetchTeamInjuries, resolveNationalTeamId } from "./api-football";
import { getCachedSquads } from "./roster";
import { nationName, WC_NATIONS } from "./teams-list";

/** Top nations — injury lookup even when no fixture is imminent. */
const INJURY_PRIORITY_CODES = [
  "ESP",
  "FRA",
  "ENG",
  "GER",
  "BRA",
  "ARG",
  "POR",
  "NED",
  "BEL",
  "COL",
  "MEX",
  "USA",
  "ITA",
  "URU",
  "CRO",
  "JPN",
] as const;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function injurySignals(
  teamName: string,
  teamCode: string,
  injuries: { player: { name: string; reason: string; type: string } }[],
): Signal[] {
  return injuries.map((inj, i): Signal => {
    const reason = inj.player.reason || inj.player.type || "unavailable";
    return {
      id: `af_inj_${teamCode}_${inj.player.name.replace(/\s/g, "_")}_${i}`,
      t: Date.now(),
      kind: "injury",
      severity: 3,
      confidence: 0.9,
      headline: `${inj.player.name} (${teamName}) — ${reason}`,
      detail: "Reported via API-Football injury feed.",
      source: "API-Football",
      entities: { teams: [teamCode], players: [inj.player.name] },
      marketSlugs: ["world-cup-winner", "world-cup-team-to-advance-to-knockout-stages"],
      priceImpact: { direction: "down", estPct: 2.5 },
    };
  });
}

/** Teams with a fixture in the next N days (unique codes). */
export function teamsFromFixtures(matches: FdMatch[], withinDays = 45): string[] {
  const codes = new Set<string>();
  for (const m of matches) {
    if (daysUntil(m.utcDate) < 0 || daysUntil(m.utcDate) > withinDays) continue;
    codes.add(tlaToCode(m.homeTeam.tla));
    codes.add(tlaToCode(m.awayTeam.tla));
  }
  codes.delete("");
  return [...codes];
}

/** Upcoming fixture teams grouped by host venue. Used to scope weather alerts. */
export function teamsByVenueFromFixtures(matches: FdMatch[], withinDays = 45): Record<string, string[]> {
  const byVenue: Record<string, Set<string>> = {};
  for (const m of matches) {
    if (!m.venueId || daysUntil(m.utcDate) < 0 || daysUntil(m.utcDate) > withinDays) continue;
    const home = tlaToCode(m.homeTeam.tla);
    const away = tlaToCode(m.awayTeam.tla);
    byVenue[m.venueId] ??= new Set<string>();
    if (home) byVenue[m.venueId].add(home);
    if (away) byVenue[m.venueId].add(away);
  }
  return Object.fromEntries(Object.entries(byVenue).map(([venueId, teams]) => [venueId, [...teams]]));
}

/**
 * Fetch football signals:
 *   · 1 call — WC fixtures through group stage (cached 1h, feeds the matchday view)
 *   · API-Football injury lookup for priority nations + teams playing within 3 days
 */
export async function fetchFootballSignals(): Promise<{
  signals: Signal[];
  note: string;
  ok: boolean;
  matches: FdMatch[];
}> {
  if (!process.env.FOOTBALL_DATA_API_KEY && !process.env.API_FOOTBALL_KEY) {
    return { signals: [], note: "no keys configured", ok: false, matches: [] };
  }

  try {
  const signals: Signal[] = [];
  const notes: string[] = [];

  const matches = await fetchWcFixtures(45);
  if (matches.length > 0) {
    notes.push(`${matches.length} fixtures`);
  }

  // API-Football injuries (free plan: 2022–2024 seasons — best-effort for near-term squads).
  if (process.env.API_FOOTBALL_KEY) {
    const cachedSquads = await getCachedSquads();
    const soon = matches.filter((m) => daysUntil(m.utcDate) <= 3 && daysUntil(m.utcDate) >= 0);
    const injuryTargets = new Map<string, string>();
    for (const m of soon) {
      for (const team of [m.homeTeam, m.awayTeam]) {
        const code = tlaToCode(team.tla);
        if (code && team.name) injuryTargets.set(code, team.name);
      }
    }
    for (const code of INJURY_PRIORITY_CODES) {
      if (!injuryTargets.has(code)) injuryTargets.set(code, nationName(code));
    }
    for (const nation of WC_NATIONS) {
      if (cachedSquads[nation.code]?.length && !injuryTargets.has(nation.code)) {
        injuryTargets.set(nation.code, nation.name);
      }
    }

    let injCount = 0;
    for (const [code, name] of [...injuryTargets.entries()].slice(0, 16)) {
      try {
        const afId = await resolveNationalTeamId(name);
        if (!afId) continue;
        const injuries = await fetchTeamInjuries(afId, 2024);
        if (injuries.length > 0) {
          signals.push(...injurySignals(name, code, injuries));
          injCount += injuries.length;
        }
      } catch (e) {
        console.warn(`[football-signals] api-football ${code}:`, e);
      }
    }
    if (injCount > 0) notes.push(`${injCount} injuries`);
  }

  const note = notes.length > 0 ? notes.join(" · ") : "no data";

  return {
    signals,
    note,
    ok: signals.length > 0 || matches.length > 0,
    matches,
  };
  } catch (e) {
    console.error("[football-signals] failed:", e);
    return { signals: [], note: "fetch failed", ok: false, matches: [] };
  }
}
