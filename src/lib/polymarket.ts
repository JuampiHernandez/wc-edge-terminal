// Polymarket Gamma + Data API helpers.
// No API key required — both are public, read-only endpoints.
//
//   Gamma (markets/events/prices):  https://gamma-api.polymarket.com
//   Data  (trades/holders/flow):    https://data-api.polymarket.com

import type { FlowEntry, Market, MarketEvent } from "./types";
import { resolveTeam } from "./worldcup";

export const GAMMA = "https://gamma-api.polymarket.com";
export const DATA = "https://data-api.polymarket.com";

type RawMarket = {
  id: string;
  question: string;
  slug?: string;
  outcomes?: string; // JSON string
  outcomePrices?: string; // JSON string
  volume?: string | number;
  volumeNum?: number;
  volume24hr?: string | number;
  liquidity?: string | number;
  liquidityNum?: number;
  oneDayPriceChange?: number;
  image?: string;
  closed?: boolean;
  active?: boolean;
  conditionId?: string;
  clobTokenIds?: string;
};

type RawEvent = {
  id: string | number;
  title: string;
  slug: string;
  volume?: string | number;
  volume24hr?: string | number;
  liquidity?: string | number;
  markets?: RawMarket[];
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Strip the boilerplate from a Polymarket question to a clean label. */
export function cleanLabel(question: string): string {
  const scorer = question.match(/^will\s+(.+?)\s+be the top goalscorer/i);
  if (scorer) return scorer[1].trim();
  const score = question.match(/^will\s+(.+?)\s+score\b/i);
  if (score) return score[1].trim();
  const win = question.match(/^will\s+(.+?)\s+win/i);
  if (win) return win[1].trim();
  const reach = question.match(/^will\s+(.+?)\s+(?:reach|advance|play)/i);
  if (reach) return reach[1].trim();
  return question.replace(/^will\s+/i, "").replace(/\?$/, "").trim();
}

function toMarket(raw: RawMarket, ev: RawEvent): Market | null {
  try {
    const outcomes: string[] = raw.outcomes ? JSON.parse(raw.outcomes) : ["Yes", "No"];
    const prices: number[] = raw.outcomePrices ? JSON.parse(raw.outcomePrices).map(num) : [0, 0];
    const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === "yes");
    const yesPrice = yesIdx >= 0 ? prices[yesIdx] : prices[0];
    const noPrice = yesIdx >= 0 ? prices[1 - yesIdx] ?? 1 - yesPrice : prices[1] ?? 1 - yesPrice;
    const label = cleanLabel(raw.question);
    const team = resolveTeam(label);
    return {
      id: String(raw.id),
      eventSlug: ev.slug,
      eventTitle: ev.title,
      slug: raw.slug || String(raw.id),
      question: raw.question,
      label,
      teamCode: team?.code,
      yesPrice,
      noPrice,
      volume: num(raw.volumeNum ?? raw.volume),
      volume24hr: num(raw.volume24hr),
      liquidity: num(raw.liquidityNum ?? raw.liquidity),
      image: raw.image,
      change24h: typeof raw.oneDayPriceChange === "number" ? raw.oneDayPriceChange * 100 : undefined,
    };
  } catch {
    return null;
  }
}

/** Fetch one event (with its scoped markets) by slug. */
export async function fetchEvent(slug: string): Promise<MarketEvent | null> {
  const res = await fetch(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as RawEvent[];
  const ev = Array.isArray(arr) ? arr[0] : null;
  if (!ev) return null;

  const markets = (ev.markets ?? [])
    .filter((m) => !m.closed)
    .map((m) => toMarket(m, ev))
    .filter((m): m is Market => m !== null && m.yesPrice >= 0.0001)
    .sort((a, b) => b.yesPrice - a.yesPrice);

  return {
    slug: ev.slug,
    title: ev.title,
    volume: num(ev.volume),
    volume24hr: num(ev.volume24hr),
    liquidity: num(ev.liquidity),
    markets,
  };
}

/** Fetch several events in parallel, dropping any that fail. */
export async function fetchEvents(slugs: string[]): Promise<MarketEvent[]> {
  const results = await Promise.allSettled(slugs.map(fetchEvent));
  return results
    .filter((r): r is PromiseFulfilledResult<MarketEvent | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((e): e is MarketEvent => e !== null && e.markets.length > 0);
}

type RawTrade = {
  proxyWallet?: string;
  side?: string;
  outcome?: string;
  size?: number | string;
  price?: number | string;
  timestamp?: number | string;
  slug?: string;
  title?: string;
  eventSlug?: string;
};

/**
 * Large recent trades ("whale flow") across markets, via the public Data API.
 * `filterAmount` is the minimum USDC notional to include.
 */
export async function fetchFlow(filterAmount = 1000, limit = 100): Promise<FlowEntry[]> {
  const url = `${DATA}/trades?takerOnly=true&limit=${limit}&filterType=CASH&filterAmount=${filterAmount}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 20 } });
  if (!res.ok) return [];
  const trades = (await res.json()) as RawTrade[];
  if (!Array.isArray(trades)) return [];
  return trades.map((t, i) => {
    const size = num(t.size);
    const price = num(t.price);
    return {
      id: `${t.proxyWallet ?? "x"}_${t.timestamp ?? i}_${i}`,
      t: num(t.timestamp) * (String(t.timestamp).length <= 11 ? 1000 : 1),
      side: (String(t.side).toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
      outcome: t.outcome ?? "?",
      size: size * price, // notional in USDC
      price,
      proxyWallet: t.proxyWallet,
      marketSlug: t.eventSlug || t.slug || "",
    };
  });
}
