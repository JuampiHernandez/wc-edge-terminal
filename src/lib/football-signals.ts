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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function fixtureSignals(matches: FdMatch[]): Signal[] {
  return matches.map((m): Signal => {
    const home = tlaToCode(m.homeTeam.tla);
    const away = tlaToCode(m.awayTeam.tla);
    const gs = groupSlug(m.group);
    const slugs = ["world-cup-winner", "world-cup-team-to-advance-to-knockout-stages"];
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
      entities: { teams: [home, away], venue: undefined },
      marketSlugs: slugs,
    };
  });
}

function squadSignal(
  teamName: string,
  teamCode: string,
  players: { name: string; position?: string }[],
  source: string,
): Signal {
  const gk = players.filter((p) => /goal/i.test(p.position ?? "")).length;
  const fwd = players.filter((p) => /attack|forward|offence|offense/i.test(p.position ?? "")).length;
  return {
    id: `squad_${teamCode}_${source}`,
    t: Date.now(),
    kind: "lineup",
    severity: 2,
    confidence: 0.95,
    headline: `${teamName} squad: ${players.length} players listed`,
    detail: `${gk} GK · ${fwd} attackers · official squad data`,
    source,
    entities: { teams: [teamCode], players: players.slice(0, 5).map((p) => p.name) },
    marketSlugs: ["world-cup-winner", "world-cup-team-to-advance-to-knockout-stages"],
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

/**
 * Fetch football signals. Keeps API usage low:
 *   · 1 call  — WC fixtures (cached 1h)
 *   · ≤4 calls — squads for teams playing within 3 days (cached 6h each)
 *   · ≤2 calls — API-Football injury lookup for those same teams (if key set)
 */
export async function fetchFootballSignals(): Promise<{
  signals: Signal[];
  note: string;
  ok: boolean;
}> {
  if (!process.env.FOOTBALL_DATA_API_KEY && !process.env.API_FOOTBALL_KEY) {
    return { signals: [], note: "no keys configured", ok: false };
  }

  const signals: Signal[] = [];
  const notes: string[] = [];

  const matches = await fetchWcFixtures(14);
  if (matches.length > 0) {
    signals.push(...fixtureSignals(matches));
    notes.push(`${matches.length} fixtures`);
  }

  // Squads for teams with a match in the next 3 days (max 4 team lookups).
  const soon = matches.filter((m) => daysUntil(m.utcDate) <= 3 && daysUntil(m.utcDate) >= 0);
  const teamIds = new Map<number, { name: string; code: string }>();
  for (const m of soon) {
    teamIds.set(m.homeTeam.id, { name: m.homeTeam.name, code: tlaToCode(m.homeTeam.tla) });
    teamIds.set(m.awayTeam.id, { name: m.awayTeam.name, code: tlaToCode(m.awayTeam.tla) });
  }
  const toFetch = [...teamIds.entries()].slice(0, 4);

  let squadCount = 0;
  for (const [id, meta] of toFetch) {
    const squad = await fetchTeamSquad(id);
    if (squad.length > 0) {
      signals.push(squadSignal(meta.name, meta.code, squad, "football-data.org"));
      squadCount++;
    }
  }
  if (squadCount > 0) notes.push(`${squadCount} squads`);

  // API-Football injuries (free plan: 2022–2024 seasons — best-effort for near-term squads).
  if (process.env.API_FOOTBALL_KEY && toFetch.length > 0) {
    let injCount = 0;
    for (const [, meta] of toFetch.slice(0, 2)) {
      const afId = await resolveNationalTeamId(meta.name);
      if (!afId) continue;
      const injuries = await fetchTeamInjuries(afId, 2024);
      if (injuries.length > 0) {
        signals.push(...injurySignals(meta.name, meta.code, injuries));
        injCount += injuries.length;
      }
      // Also attach API-Football squad if football-data squad was empty.
      if (!signals.some((s) => s.id === `squad_${meta.code}_football-data.org`)) {
        const afSquad = await fetchNationalSquad(afId);
        if (afSquad.length > 0) {
          signals.push(squadSignal(meta.name, meta.code, afSquad, "API-Football"));
        }
      }
    }
    if (injCount > 0) notes.push(`${injCount} injuries`);
    else notes.push("injuries: none (free plan = seasons 2022–24)");
  }

  return {
    signals,
    note: notes.join(" · ") || "no data",
    ok: signals.length > 0,
  };
}
