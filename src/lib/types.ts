// Core domain types for the World Cup Edge Terminal.
//
// The product thesis: surface the *variables that move prediction markets*
// and link every signal to the market(s) it affects. The two central types
// are `Market` (a Polymarket outcome) and `Signal` (something that may move it).

export type SignalKind =
  | "injury"
  | "lineup"
  | "suspension"
  | "card_watch"
  | "weather"
  | "referee"
  | "fatigue"
  | "news"
  | "social_velocity"
  | "whale_flow"
  | "line_move"
  | "cross_book";

export type SignalSeverity = 1 | 2 | 3; // 3 = likely market-moving

export type PriceImpact = {
  direction: "up" | "down";
  /** Estimated probability shift in percentage points (e.g. 4 = +4pp). */
  estPct: number;
};

/** Something that may move one or more markets. */
export type Signal = {
  id: string;
  t: number; // detected at (ms epoch)
  kind: SignalKind;
  severity: SignalSeverity;
  /** 0–1 — official source > beat reporter > rumor. */
  confidence: number;
  headline: string;
  /** LLM market-impact summary (English, generated once at cron). */
  context?: string;
  /** Alias for `context` when mapped from `context_en` column. */
  contextEn?: string;
  detail?: string;
  source: string;
  url?: string;
  /** Graph edges — the real-world entities this signal references. */
  entities: {
    teams?: string[]; // team codes, e.g. ["FRA"]
    players?: string[];
    venue?: string;
  };
  /** Polymarket market/event slugs this signal is linked to. */
  marketSlugs: string[];
  priceImpact?: PriceImpact;
};

export type TeamValuation = {
  totalEur?: number;
  source?: string;
  updatedAt?: number;
};

export type TeamContext = {
  code: string;
  players: string[];
  generatedAt?: number;
  valuation?: TeamValuation;
};

/** A single tradable Polymarket outcome (binary Yes/No). */
export type Market = {
  id: string;
  /** Parent event slug (e.g. "world-cup-winner"). */
  eventSlug: string;
  eventTitle: string;
  /** Market slug — used for signal linking. Falls back to id. */
  slug: string;
  question: string;
  /** Clean label extracted from the question (e.g. "France"). */
  label: string;
  /** Best-guess team code if the outcome maps to a nation. */
  teamCode?: string;
  yesPrice: number; // 0–1
  noPrice: number;
  volume: number;
  volume24hr: number;
  liquidity: number;
  image?: string;
  /** 24h price delta in probability points, if known. */
  change24h?: number;
};

/** A grouping of markets (one Polymarket event). */
export type MarketEvent = {
  slug: string;
  title: string;
  volume: number;
  volume24hr: number;
  liquidity: number;
  markets: Market[];
};

/** Moneyline (1X2) prices for a single match, from the Polymarket match event. */
export type MatchOdds = {
  /** Polymarket event slug, e.g. "fifwc-can-bih-2026-06-12". */
  eventSlug: string;
  home: number; // 0–1
  draw: number;
  away: number;
  volume24hr: number;
  liquidity: number;
  /** 24h delta of the home-win price, in probability points. */
  homeChange24h?: number;
  awayChange24h?: number;
};

/** A scheduled World Cup match, optionally enriched with Polymarket odds. */
export type MatchFixture = {
  id: string;
  kickoff: number; // ms epoch
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  /** e.g. "Group B" or "Round of 16". */
  stageLabel?: string;
  venue?: string;
  odds?: MatchOdds;
};

/** A whale / large position from the Polymarket data API. */
export type FlowEntry = {
  id: string;
  t: number;
  side: "BUY" | "SELL";
  outcome: string; // "Yes" / "No" / team
  size: number; // USDC notional
  price: number;
  proxyWallet?: string;
  marketSlug: string;
};

/** Computed line-movement signal for a market. */
export type LineMove = {
  marketSlug: string;
  label: string;
  from: number;
  to: number;
  deltaPct: number; // percentage points
  windowMins: number;
};

/** Edge score: our synthesized fair price vs the market price. */
export type EdgeScore = {
  marketSlug: string;
  eventSlug: string;
  label: string;
  teamCode?: string;
  eventTitle: string;
  marketPrice: number; // 0–1
  fairPrice: number; // 0–1, market + signal adjustments
  edge: number; // fairPrice - marketPrice (signed)
  contributingSignals: string[]; // signal ids
};

/** Aggregator response from /api/signals. */
export type SignalsPayload = {
  signals: Signal[];
  fetchedAt: number;
  sources: { id: string; ok: boolean; note?: string }[];
};
