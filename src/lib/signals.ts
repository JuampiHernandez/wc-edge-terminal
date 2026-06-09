// Signal aggregation. Turns the raw real-data sources into a single, deduped,
// market-linked Signal[]:
//   · line_move   — 24h price moves derived from the markets we already fetch
//   · news        — RSS injuries / lineups / returns / general
//   · weather     — extreme venue conditions (Open-Meteo)

import type { Market, MarketEvent, Signal, SignalKind } from "./types";

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
        headline: `${m.label} ${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}pp (24h)`,
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

/** Decide whether a signal is relevant to a specific market. */
export function linksToMarket(sig: Signal, market: Market): boolean {
  // Team-specific signals require a matching nation/region.
  if (sig.entities.teams && sig.entities.teams.length > 0) {
    return market.teamCode ? sig.entities.teams.includes(market.teamCode) : false;
  }
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
