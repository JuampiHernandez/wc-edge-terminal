// Turn football-data.org (+ API-Football where available) into Signal objects.

import type { Signal } from "./types";
import {
  fetchTeamSquad,
  fetchWcFixtures,
  groupSlug,
  tlaToCode,
  type FdMatch,
} from "./football-data";
import { fetchNationalSquad, fetchTeamInjuries, resolveNationalTeamId } from "./api-football";
import { getCachedSquads } from "./roster";
import { nationName } from "./teams-list";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function fixtureSignals(matches: FdMatch[]): Signal[] {
  // Knockout slots before qualification have TBD (null) teams — nothing to signal yet.
  return matches.filter((m) => m.homeTeam.name && m.awayTeam.name).map((m): Signal => {
    const home = tlaToCode(m.homeTeam.tla);
    const away = tlaToCode(m.awayTeam.tla);
    const gs = groupSlug(m.group);
    const slugs = [
      "world-cup-winner",
      "world-cup-team-to-advance-to-knockout-stages",
      "world-cup-nation-to-reach-final",
      "world-cup-nation-to-reach-semifinals",
      "world-cup-nation-to-reach-quarterfinals",
      "world-cup-nation-to-reach-round-of-16",
    ];
    if (gs) slugs.push(gs);
    const days = daysUntil(m.utcDate);
    const urgency: 1 | 2 | 3 = days <= 2 ? 3 : days <= 7 ? 2 : 1;
    const groupLabel = m.group ? m.group.replace("GROUP_", "Group ") : m.stage.replace(/_/g, " ");
    return {
      id: `fd_fixture_${m.id}`,
      t: Date.parse(m.utcDate),
      kind: "fatigue",
      severity: urgency,
      confidence: 1,
      headline: `${m.homeTeam.name} vs ${m.awayTeam.name} · ${fmtDate(m.utcDate)} · ${groupLabel}`,
      detail:
        days > 0
          ? `Kickoff in ${days} day${days === 1 ? "" : "s"}. Schedule congestion and travel affect squad rotation.`
          : "Match day.",
      source: "football-data.org",
      entities: { teams: [home, away].filter(Boolean), venue: m.venueId },
      marketSlugs: slugs,
    };
  });
}

function squadSignal(
  teamName: string,
  teamCode: string,
  players: { name: string; position?: string }[] | string[],
  source: string,
): Signal {
  const names = players.map((p) => (typeof p === "string" ? p : p.name));
  const gk = players.filter((p) => /goal/i.test(typeof p === "string" ? "" : (p.position ?? ""))).length;
  const fwd = players.filter((p) =>
    /attack|forward|offence|offense/i.test(typeof p === "string" ? "" : (p.position ?? "")),
  ).length;
  return {
    id: `squad_${teamCode}_${source}`,
    t: Date.now(),
    kind: "lineup",
    severity: 2,
    confidence: 0.95,
    headline: `${teamName} squad: ${names.length} players listed`,
    detail: `${gk} GK · ${fwd} attackers · official squad data`,
    source,
    entities: { teams: [teamCode], players: names.slice(0, 5) },
    marketSlugs: [
      "world-cup-winner",
      "world-cup-team-to-advance-to-knockout-stages",
      "world-cup-nation-to-reach-final",
      "world-cup-nation-to-reach-semifinals",
      "world-cup-nation-to-reach-quarterfinals",
      "world-cup-nation-to-reach-round-of-16",
    ],
  };
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
 *   · 1 call — WC fixtures through group stage (cached 1h)
 *   · squads from cron-warmed roster index (no extra API calls)
 *   · ≤2 calls — API-Football injury lookup for teams playing within 3 days
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
    signals.push(...fixtureSignals(matches));
    notes.push(`${matches.length} fixtures`);
  }

  // Squads from cron-warmed cache (fast read — never hits APIs here).
  const cachedSquads = await getCachedSquads();
  const fixtureTeams = teamsFromFixtures(matches);
  let squadCount = 0;
  for (const code of fixtureTeams) {
    const playerNames = cachedSquads[code];
    if (!playerNames?.length) continue;
    if (signals.some((s) => s.id === `squad_${code}_roster-cache`)) continue;
    signals.push(squadSignal(nationName(code), code, playerNames, "roster-cache"));
    squadCount++;
  }
  if (squadCount > 0) notes.push(`${squadCount} cached squads`);

  // Live squad fetch for teams playing within 3 days.
  const soon = matches.filter((m) => daysUntil(m.utcDate) <= 3 && daysUntil(m.utcDate) >= 0);
  const teamIds = new Map<number, { name: string; code: string }>();
  for (const m of soon) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      const code = tlaToCode(team.tla);
      if (code && team.name) teamIds.set(team.id, { name: team.name, code });
    }
  }
  for (const [id, meta] of [...teamIds.entries()].slice(0, 4)) {
    if (signals.some((s) => s.id.startsWith(`squad_${meta.code}_`))) continue;
    const squad = await fetchTeamSquad(id);
    if (squad.length > 0) {
      signals.push(squadSignal(meta.name, meta.code, squad, "football-data.org"));
    }
  }

  // API-Football injuries (free plan: 2022–2024 seasons — best-effort for near-term squads).
  if (process.env.API_FOOTBALL_KEY && teamIds.size > 0) {
    let injCount = 0;
    for (const [, meta] of [...teamIds.entries()].slice(0, 2)) {
      try {
        const afId = await resolveNationalTeamId(meta.name);
        if (!afId) continue;
        const injuries = await fetchTeamInjuries(afId, 2024);
        if (injuries.length > 0) {
          signals.push(...injurySignals(meta.name, meta.code, injuries));
          injCount += injuries.length;
        }
        if (!signals.some((s) => s.id.startsWith(`squad_${meta.code}_`))) {
          const afSquad = await fetchNationalSquad(afId);
          if (afSquad.length > 0) {
            signals.push(squadSignal(meta.name, meta.code, afSquad, "API-Football"));
          }
        }
      } catch (e) {
        console.warn(`[football-signals] api-football ${meta.code}:`, e);
      }
    }
    if (injCount > 0) notes.push(`${injCount} injuries`);
  }

  const note = notes.length > 0 ? notes.join(" · ") : matches.length > 0 ? `${matches.length} fixtures (ics)` : "no data";

  return {
    signals,
    note,
    ok: signals.length > 0,
    matches,
  };
  } catch (e) {
    console.error("[football-signals] failed:", e);
    return { signals: [], note: "fetch failed", ok: false, matches: [] };
  }
}
