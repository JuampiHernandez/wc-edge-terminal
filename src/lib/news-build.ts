// Shared helpers — turn a raw headline into a Signal with roster matching.

import type { Signal, SignalKind } from "./types";
import { matchHeadlineEntities, type RosterIndex } from "./roster";

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
  kind?: SignalKind;
  confidence?: number;
};

function classify(headline: string): { kind: SignalKind; severity: 1 | 2 | 3; impact?: -1 | 1 } {
  const h = headline.toLowerCase();
  if (/(ruled out|out for|sidelined|injur|will miss|baja|lesion|doubtful|muscle knock|picked up a knock|surgery)/.test(h))
    return { kind: "injury", severity: 3, impact: -1 };
  if (/(suspend|banned|red card|sancionado)/.test(h))
    return { kind: "suspension", severity: 3, impact: -1 };
  if (/(lineup|line-up|starting xi|squad named|called up|convocator|alineaci)/.test(h))
    return { kind: "lineup", severity: 2 };
  if (/(returns|fit again|back in training|recovered|cleared to play)/.test(h))
    return { kind: "injury", severity: 2, impact: 1 };
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

export function rawToSignal(item: RawNewsItem, index: RosterIndex): Signal {
  const classified = classify(item.title);
  const kind = item.kind ?? classified.kind;
  const severity = kind === "social_velocity" ? 2 : classified.severity;
  const impact = item.kind ? undefined : classified.impact;
  const matched = matchHeadlineEntities(item.title, index);
  const teams = new Set(matched.teams);
  if (item.teamCode) teams.add(item.teamCode);

  return {
    id: item.id,
    t: item.t,
    kind,
    severity,
    confidence: item.confidence ?? (item.scoped ? 0.65 : 0.6),
    headline: item.title,
    source: item.source,
    url: item.url,
    entities: { teams: [...teams], players: matched.players.slice(0, 5) },
    marketSlugs: slugsForTeams([...teams]),
    priceImpact: impact ? { direction: impact > 0 ? "up" : "down", estPct: severity * 1.5 } : undefined,
  };
}
