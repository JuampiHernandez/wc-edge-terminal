// Shared helpers — turn a raw headline into a Signal with roster matching.

import type { Signal, SignalKind } from "./types";
import { matchHeadlineEntities, WC_KEYWORDS, type RosterIndex } from "./roster";

/** Short stable hash so IDs built from long URLs/guids never collide after truncation. */
export function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export type RawNewsItem = {
  id: string;
  title: string;
  url: string;
  t: number;
  source: string;
  /** Skip relevance check (query was already WC-scoped). */
  scoped?: boolean;
  teamCode?: string;
  /**
   * The teamCode comes from a curated per-team source (e.g. BBC team page RSS),
   * so it's kept even when the headline doesn't name the team. Keyword-search
   * sources (GDELT/NewsAPI/GNews nation queries) leave this false: their tag
   * only sticks when the headline itself corroborates the team.
   */
  teamCodeTrusted?: boolean;
  kind?: SignalKind;
  confidence?: number;
};

export function classify(headline: string): { kind: SignalKind; severity: 1 | 2 | 3; impact?: -1 | 1 } {
  const h = headline.toLowerCase();
  // Recovery news first — "returns from injury" must not hit the negative branch below.
  if (/(returns? from injury|injury return|back from injury|fit again|back in training|recovered from|cleared to play|shakes off)/.test(h))
    return { kind: "injury", severity: 2, impact: 1 };
  if (
    /(ruled out|out for|sidelined|injur|will miss|\bbaja\b|lesi[oó]n|doubtful|injury doubt|fitness doubt|injury scare|muscle knock|picked up a knock|surgery|hamstring|se pierde)/.test(h)
  )
    return { kind: "injury", severity: 3, impact: -1 };
  // Confirmed bans only — a red card in a match report is card news, not a suspension.
  if (/(suspend|banned|sancionado|match ban)/.test(h))
    return { kind: "suspension", severity: 3, impact: -1 };
  if (/(red card|sent off|sending[- ]off|yellow card)/.test(h))
    return { kind: "card_watch", severity: 2 };
  return { kind: "news", severity: 1 };
}

const TEAM_EVENT_SLUGS = [
  "world-cup-winner",
  "world-cup-team-to-advance-to-knockout-stages",
  "world-cup-nation-to-reach-final",
  "world-cup-nation-to-reach-semifinals",
  "world-cup-nation-to-reach-quarterfinals",
  "world-cup-nation-to-reach-round-of-16",
] as const;

function slugsForTeams(teams: string[]): string[] {
  if (teams.length === 0) return [];
  return [...TEAM_EVENT_SLUGS];
}

export type DerivedNewsFields = {
  kind: SignalKind;
  severity: 1 | 2 | 3;
  teams: string[];
  players: string[];
  marketSlugs: string[];
  priceImpact?: Signal["priceImpact"];
  global?: boolean;
};

/**
 * Classification + team tagging for a headline. Shared by live ingestion and
 * the stored-signal reclassification job so both always agree.
 *
 * Tagging rules:
 *  · Teams confirmed by the headline (nation name / alias / roster player) always count.
 *  · A forced source tag is kept only when trusted (curated team feed) or when
 *    the headline corroborates it — nation keyword-search hits are routing noise.
 *  · No team at all but clearly World Cup coverage → global (tournament-wide).
 *  · priceImpact requires at least one confirmed/trusted team: a misrouted
 *    headline must never move a market's fair price.
 */
export function deriveNewsFields(
  title: string,
  index: RosterIndex,
  opts?: { teamCode?: string; teamCodeTrusted?: boolean; kind?: SignalKind },
): DerivedNewsFields {
  const classified = classify(title);
  const kind = opts?.kind ?? classified.kind;
  const severity = kind === "social_velocity" ? 2 : classified.severity;
  const impact = opts?.kind ? undefined : classified.impact;

  const matched = matchHeadlineEntities(title, index);
  const teams = new Set(matched.teams);
  if (opts?.teamCode && (opts.teamCodeTrusted || teams.has(opts.teamCode))) {
    teams.add(opts.teamCode);
  }

  const global = teams.size === 0 && WC_KEYWORDS.test(title);

  return {
    kind,
    severity,
    teams: [...teams],
    players: matched.players.slice(0, 5),
    marketSlugs: slugsForTeams([...teams]),
    priceImpact:
      impact && teams.size > 0
        ? { direction: impact > 0 ? "up" : "down", estPct: severity * 1.5 }
        : undefined,
    global: global || undefined,
  };
}

export function rawToSignal(item: RawNewsItem, index: RosterIndex): Signal {
  const d = deriveNewsFields(item.title, index, {
    teamCode: item.teamCode,
    teamCodeTrusted: item.teamCodeTrusted,
    kind: item.kind,
  });

  return {
    id: item.id,
    t: item.t,
    kind: d.kind,
    severity: d.severity,
    confidence: item.confidence ?? (item.scoped ? 0.65 : 0.6),
    headline: item.title,
    source: item.source,
    url: item.url,
    entities: { teams: d.teams, players: d.players },
    marketSlugs: d.marketSlugs,
    priceImpact: d.priceImpact,
    global: d.global,
  };
}
