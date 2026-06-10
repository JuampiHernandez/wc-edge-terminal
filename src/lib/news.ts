// News wire via OFFICIAL RSS feeds only (publisher-approved syndication).
// We never scrape HTML — headline + outbound link only. Each item becomes a
// Signal, with nations/players resolved via roster index + team aliases.
// Stories older than 7 days are dropped. JSON APIs merged from news-apis.ts.

import type { Signal } from "./types";
import {
  getRosterIndex,
  headlineIsRelevant,
  NEWS_MAX_AGE_MS,
  type RosterIndex,
} from "./roster";
import { rawToSignal } from "./news-build";
import { fetchApiNewsSignals } from "./news-apis";
import { resolveTeam } from "./worldcup";

type RssFeed = {
  id: string;
  source: string;
  url: string;
  limit: number;
  /** Feed is already scoped (WC tag or single nation) — skip broad relevance filter. */
  scoped?: boolean;
  /** Auto-tag this nation on every item from the feed. */
  teamCode?: string;
};

export const NEWS_FEEDS: RssFeed[] = [
  // — existing —
  { id: "espn-soccer", source: "ESPN", url: "https://www.espn.com/espn/rss/soccer/news", limit: 20 },
  { id: "bbc-football", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml", limit: 18 },
  { id: "guardian-wc", source: "Guardian", url: "https://www.theguardian.com/football/world-cup-2026/rss", limit: 18, scoped: true },
  { id: "marca-futbol", source: "Marca", url: "https://www.marca.com/rss/futbol.xml", limit: 16 },
  // — expanded —
  { id: "guardian-football", source: "Guardian", url: "https://www.theguardian.com/football/rss", limit: 16 },
  { id: "sky-football", source: "Sky Sports", url: "https://www.skysports.com/rss/12040", limit: 18 },
  { id: "fourfourtwo", source: "FourFourTwo", url: "https://www.fourfourtwo.com/feeds/all", limit: 14 },
  { id: "independent-football", source: "Independent", url: "https://www.independent.co.uk/sport/football/rss", limit: 14 },
  { id: "cbs-soccer", source: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/soccer/", limit: 14 },
  { id: "sportsnet", source: "Sportsnet", url: "https://www.sportsnet.ca/feed/", limit: 12 },
  // — per-nation BBC feeds (host nations + favorites) —
  { id: "bbc-usa", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/usa/rss.xml", limit: 10, scoped: true, teamCode: "USA" },
  { id: "bbc-mexico", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/mexico/rss.xml", limit: 10, scoped: true, teamCode: "MEX" },
  { id: "bbc-england", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/england/rss.xml", limit: 10, scoped: true, teamCode: "ENG" },
  { id: "bbc-france", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/france/rss.xml", limit: 10, scoped: true, teamCode: "FRA" },
  { id: "bbc-germany", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/germany/rss.xml", limit: 10, scoped: true, teamCode: "GER" },
  { id: "bbc-spain", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/spain/rss.xml", limit: 10, scoped: true, teamCode: "ESP" },
  { id: "bbc-brazil", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/brazil/rss.xml", limit: 10, scoped: true, teamCode: "BRA" },
  { id: "bbc-argentina", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/argentina/rss.xml", limit: 10, scoped: true, teamCode: "ARG" },
  { id: "bbc-netherlands", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/netherlands/rss.xml", limit: 10, scoped: true, teamCode: "NED" },
  { id: "bbc-portugal", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/teams/portugal/rss.xml", limit: 10, scoped: true, teamCode: "POR" },
];

const UA = "WC-Edge-Terminal/1.0 (RSS reader)";
const GLOBAL_CAP = 120;
const FEED_TIMEOUT_MS = 8_000;
const FEED_BATCH = 6;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function readTag(block: string, tag: string): string {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(cdata) ?? block.match(plain);
  return m?.[1] ? stripTags(m[1]) : "";
}

type RawItem = { title: string; link: string; pubDate: string; guid: string };

function parseRss(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = readTag(block, "title");
    const link = readTag(block, "link");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      pubDate: readTag(block, "pubDate") || readTag(block, "dc:date"),
      guid: readTag(block, "guid") || link,
    });
  }
  return items;
}

function parseDate(raw: string): number {
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Date.now();
}

function isFresh(t: number): boolean {
  return Date.now() - t <= NEWS_MAX_AGE_MS;
}

async function fetchFeed(feed: RssFeed, index: RosterIndex): Promise<Signal[]> {
  const res = await fetchWithTimeout(
    feed.url,
    {
      headers: { Accept: "application/rss+xml, application/xml, text/xml, */*", "User-Agent": UA },
      next: { revalidate: 1800 },
    },
    FEED_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`${feed.id}: HTTP ${res.status}`);
  const xml = await res.text();
  const cutoff = Date.now() - NEWS_MAX_AGE_MS;

  return parseRss(xml)
    .slice(0, feed.limit)
    .map((it) => ({ ...it, t: parseDate(it.pubDate) }))
    .filter((it) => it.t >= cutoff)
    .filter((it) => feed.scoped || headlineIsRelevant(it.title, index))
    .map((it) =>
      rawToSignal(
        {
          id: `news_${feed.id}_${it.guid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`,
          title: it.title,
          url: it.link,
          t: it.t,
          source: feed.source,
          scoped: feed.scoped,
          teamCode: feed.teamCode,
        },
        index,
      ),
    );
}

async function runFeed(
  feed: RssFeed,
  index: RosterIndex,
  ok: string[],
  failed: string[],
  signals: Signal[],
): Promise<void> {
  try {
    const items = await fetchFeed(feed, index);
    ok.push(feed.id);
    signals.push(...items);
  } catch (e) {
    failed.push(feed.id);
    console.warn(`[news] ${feed.id}:`, e);
  }
}

async function fetchRssBatched(index: RosterIndex): Promise<{
  signals: Signal[];
  ok: string[];
  failed: string[];
}> {
  const ok: string[] = [];
  const failed: string[] = [];
  const signals: Signal[] = [];
  const nationFeeds = NEWS_FEEDS.filter((f) => f.teamCode);
  const generalFeeds = NEWS_FEEDS.filter((f) => !f.teamCode);

  // Nation feeds sequentially — each tags a team; avoid BBC rate limits/timeouts.
  for (const feed of nationFeeds) {
    await runFeed(feed, index, ok, failed, signals);
  }

  for (let i = 0; i < generalFeeds.length; i += FEED_BATCH) {
    const batch = generalFeeds.slice(i, i + FEED_BATCH);
    await Promise.all(batch.map((f) => runFeed(f, index, ok, failed, signals)));
  }

  return { signals, ok, failed };
}

export async function fetchNewsSignals(): Promise<{
  signals: Signal[];
  ok: string[];
  failed: string[];
  apiOk?: string[];
  apiFailed?: string[];
  rosterNote?: string;
}> {
  try {
    const index = await getRosterIndex();
    const [rssResults, apiResults] = await Promise.all([
      fetchRssBatched(index),
      fetchApiNewsSignals(index),
    ]);

    const merged: Signal[] = [...apiResults.signals, ...rssResults.signals];

    const seen = new Set<string>();
    const signals = merged
      .filter((s) => isFresh(s.t))
      .sort((a, b) => b.t - a.t)
      .filter((s) => {
        const key = s.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, GLOBAL_CAP);

    const rosterNote =
      index.playerCount > 0
        ? `${index.playerCount} players · ${index.teamCount} squads`
        : "aliases only (cron warms player rosters)";

    return {
      signals,
      ok: rssResults.ok,
      failed: rssResults.failed,
      apiOk: apiResults.ok,
      apiFailed: apiResults.failed,
      rosterNote,
    };
  } catch (e) {
    console.error("[news] fetchNewsSignals failed:", e);
    return { signals: [], ok: [], failed: ["all"], apiFailed: ["all"] };
  }
}

export { resolveTeam };
