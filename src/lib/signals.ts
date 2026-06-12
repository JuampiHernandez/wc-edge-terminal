// Signal aggregation. Turns the raw real-data sources into a single, deduped,
// market-linked Signal[]:
//   · line_move   — 24h price moves derived from the markets we already fetch
//   · news        — RSS injuries / lineups / returns / general
//   · weather     — extreme venue conditions (Open-Meteo)

import type { Market, MarketEvent, MatchFixture, Signal, SignalKind } from "./types";

/** Kinds shown in the market "Related information" drawer (causes, not price reactions). */
export const INFO_SIGNAL_KINDS: SignalKind[] = [
  "injury",
  "suspension",
  "lineup",
  "card_watch",
  "news",
  "weather",
  "referee",
  "fatigue", // fixtures & schedule from football-data.org
];

/** Derive line-movement signals from 24h price change on each market. */
export function lineMoveSignals(events: MarketEvent[]): Signal[] {
  const out: Signal[] = [];
  for (const ev of events) {
    for (const m of ev.markets) {
      const d = m.change24h;
      if (typeof d !== "number" || Math.abs(d) < 1.5) continue;
      const severity: 1 | 2 | 3 = Math.abs(d) >= 6 ? 3 : Math.abs(d) >= 3 ? 2 : 1;
      out.push({
        id: `lm_${m.id}`,
        t: Date.now(),
        kind: "line_move",
        severity,
        confidence: 1,
        headline: `${m.label} ${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}pp (24h) · ${ev.title}`,
        detail: `${ev.title} · now ${Math.round(m.yesPrice * 100)}%.`,
        source: "Polymarket",
        entities: m.teamCode ? { teams: [m.teamCode] } : {},
        // No priceImpact: a move that already happened shouldn't push fair value.
        marketSlugs: [m.slug, m.eventSlug],
      });
    }
  }
  return out.sort((a, b) => b.severity - a.severity).slice(0, 25);
}

/** Signals relevant to a match: anything tagged to either nation. */
export function signalsForMatch(match: MatchFixture, signals: Signal[]): Signal[] {
  const codes = new Set([match.homeCode, match.awayCode]);
  return signals
    .filter((s) => s.id !== `fd_fixture_${match.id}`) // the fixture itself isn't news
    .filter((s) => INFO_SIGNAL_KINDS.includes(s.kind) || s.kind === "line_move")
    .filter((s) => s.entities.teams?.some((code) => codes.has(code)))
    .sort((a, b) => b.t - a.t || b.severity - a.severity);
}

/** Decide whether a signal is relevant to a specific market. */
export function linksToMarket(sig: Signal, market: Market): boolean {
  // Team-specific signals require a matching nation/region.
  if (sig.entities.teams && sig.entities.teams.length > 0) {
    return market.teamCode ? sig.entities.teams.includes(market.teamCode) : false;
  }
  // Tournament-wide signals (FIFA rulings, format changes…) touch every market.
  if (sig.global) return true;
  // Line moves only attach to the exact market that moved.
  if (sig.kind === "line_move") {
    return sig.marketSlugs.includes(market.slug);
  }
  // News tagged to an event but without a team → only show on that event's
  // non-team markets (e.g. continent winner), not every nation in the same event.
  if (sig.marketSlugs.length > 0) {
    const slugHit =
      sig.marketSlugs.includes(market.eventSlug) || sig.marketSlugs.includes(market.slug);
    if (!slugHit) return false;
    if (market.teamCode) return false;
    return true;
  }
  return false;
}

const FEED_KIND_CAP = 30;

/** Balance the live feed so fixture fatigue timestamps don't bury news entirely. */
export function rankFeedSignals(signals: Signal[], limit = 120): Signal[] {
  const sorted = [...signals].sort((a, b) => b.t - a.t || b.severity - a.severity);
  const picked: Signal[] = [];
  const kindCounts = new Map<SignalKind, number>();
  const seen = new Set<string>();

  for (const s of sorted) {
    const n = kindCounts.get(s.kind) ?? 0;
    if (n >= FEED_KIND_CAP) continue;
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    kindCounts.set(s.kind, n + 1);
    picked.push(s);
    if (picked.length >= limit) break;
  }

  if (picked.length < limit) {
    for (const s of sorted) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      picked.push(s);
      if (picked.length >= limit) break;
    }
  }

  return picked.sort((a, b) => b.t - a.t || b.severity - a.severity);
}
