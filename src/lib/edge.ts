// Edge scoring: synthesize a "fair price" from the market price plus the
// confidence-weighted impact of every signal linked to that market, then
// surface the divergence (edge). Fully transparent — every edge lists the
// signals that produced it.

import type { EdgeScore, Market, MarketEvent, Signal } from "./types";
import { linksToMarket } from "./signals";

const SEVERITY_WEIGHT: Record<1 | 2 | 3, number> = { 1: 0.4, 2: 0.8, 3: 1.3 };
const MAX_ADJ_PP = 12; // cap total adjustment at ±12 percentage points

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Signals linked to a market (for the "Why this moves" drawer). */
export function signalsForMarket(market: Market, signals: Signal[]): Signal[] {
  return signals
    .filter((s) => linksToMarket(s, market))
    .sort((a, b) => b.severity - a.severity || b.t - a.t);
}

/** Compute the edge score for a single market. */
export function scoreMarket(market: Market, signals: Signal[]): EdgeScore {
  const linked = signals.filter((s) => linksToMarket(s, market));

  let adjPp = 0;
  const contributing: string[] = [];
  for (const s of linked) {
    if (!s.priceImpact) continue;
    const w = SEVERITY_WEIGHT[s.severity] * s.confidence;
    const signed = (s.priceImpact.direction === "up" ? 1 : -1) * s.priceImpact.estPct * w;
    adjPp += signed;
    contributing.push(s.id);
  }
  adjPp = clamp(adjPp, -MAX_ADJ_PP, MAX_ADJ_PP);

  const fairPrice = clamp(market.yesPrice + adjPp / 100, 0.005, 0.995);
  return {
    marketSlug: market.slug,
    label: market.label,
    eventTitle: market.eventTitle,
    marketPrice: market.yesPrice,
    fairPrice,
    edge: fairPrice - market.yesPrice,
    contributingSignals: contributing,
  };
}

/** Edge scores across all markets, ranked by absolute divergence. */
export function rankEdges(events: MarketEvent[], signals: Signal[]): EdgeScore[] {
  const scores: EdgeScore[] = [];
  for (const ev of events) {
    for (const m of ev.markets) {
      const s = scoreMarket(m, signals);
      if (Math.abs(s.edge) > 0.0001) scores.push(s);
    }
  }
  return scores.sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));
}
