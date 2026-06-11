// News wire via OFFICIAL RSS feeds only (publisher-approved syndication).
// We never scrape HTML — headline + outbound link only. Each item becomes a
// Signal, with nations/players resolved via roster index + team aliases.
// Stories older than 7 days are dropped. JSON APIs merged from news-apis.ts.

import { promises as fs } from "fs";
import path from "path";
import type { Signal } from "./types";
import {
  getRosterIndex,
  headlineIsRelevant,
  NEWS_MAX_AGE_MS,
  type RosterIndex,
} from "./roster";
import { hashId, rawToSignal } from "./news-build";
import { fetchApiNewsSignals } from "./news-apis";
import { attachCachedNewsContexts } from "./news-enrichment";
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
const NATION_FEED_BATCH = 4;
const SNAPSHOT_FILE = path.join(process.cwd(), ".data", "news-signals.json");
const SNAPSHOT_TTL_MS = 6 * 60 * 60_000;

export type NewsSignalsResult = {
  signals: Signal[];
  ok: string[];
  failed: string[];
  apiOk?: string[];
  apiFailed?: string[];
  rosterNote?: string;
  cachedAt?: number;
};

async function writeSnapshot(result: NewsSignalsResult): Promise<void> {
  try {
    await fs.mkdir(path.dirname(SNAPSHOT_FILE), { recursive: true });
    await fs.writeFile(SNAPSHOT_FILE, JSON.stringify({ ...result, cachedAt: Date.now() }, null, 2));
  } catch {
    // Best effort local/serverless cache. Production durability should move to Supabase/KV.
  }
}

export async function readNewsSnapshot(maxAgeMs = SNAPSHOT_TTL_MS): Promise<NewsSignalsResult | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, "utf8");
    const parsed = JSON.parse(raw) as NewsSignalsResult;
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
  const timeout = feed.teamCode ? 15_000 : FEED_TIMEOUT_MS;
  const res = await fetchWithTimeout(
    feed.url,
    {
      headers: { Accept: "application/rss+xml, application/xml, text/xml, */*", "User-Agent": UA },
      next: { revalidate: 1800 },
    },
    timeout,
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
          id: `news_${feed.id}_${hashId(it.guid)}`,
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

  // Nation feeds tag teams directly. Run in small batches to keep cold loads fast
  // without hammering BBC with all country feeds at once.
  for (let i = 0; i < nationFeeds.length; i += NATION_FEED_BATCH) {
    const batch = nationFeeds.slice(i, i + NATION_FEED_BATCH);
    const failedBefore = failed.length;
    await Promise.all(batch.map((f) => runFeed(f, index, ok, failed, signals)));
    const retry = failed.splice(failedBefore);
    if (retry.length > 0) {
      const retryFeeds = batch.filter((f) => retry.includes(f.id));
      await Promise.all(retryFeeds.map((f) => runFeed(f, index, ok, failed, signals)));
    }
  }

  for (let i = 0; i < generalFeeds.length; i += FEED_BATCH) {
    const batch = generalFeeds.slice(i, i + FEED_BATCH);
    await Promise.all(batch.map((f) => runFeed(f, index, ok, failed, signals)));
  }

  return { signals, ok, failed };
}

export async function fetchNewsSignals(): Promise<NewsSignalsResult> {
  try {
    const index = await getRosterIndex();
    const [rssResults, apiResults] = await Promise.all([
      fetchRssBatched(index),
      fetchApiNewsSignals(index),
    ]);

    const merged: Signal[] = [...apiResults.signals, ...rssResults.signals];

    const seen = new Set<string>();
    const deduped = merged
      .filter((s) => isFresh(s.t))
      .sort((a, b) => b.t - a.t)
      .filter((s) => {
        const key = s.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // Team-tagged items are the only ones that link to nation markets — never
    // let high-volume untagged wires (GDELT/Currents/…) push them past the cap.
    const tagged = deduped.filter((s) => (s.entities.teams?.length ?? 0) > 0);
    const untagged = deduped.filter((s) => (s.entities.teams?.length ?? 0) === 0);
    const signals = await attachCachedNewsContexts([...tagged.slice(0, GLOBAL_CAP), ...untagged]
      .slice(0, GLOBAL_CAP)
      .sort((a, b) => b.t - a.t));

    const rosterNote =
      index.playerCount > 0
        ? `${index.playerCount} players · ${index.teamCount} squads`
        : "aliases only (cron warms player rosters)";

    const result = {
      signals,
      ok: rssResults.ok,
      failed: rssResults.failed,
      apiOk: apiResults.ok,
      apiFailed: apiResults.failed,
      rosterNote,
    };
    await writeSnapshot(result);
    return result;
  } catch (e) {
    console.error("[news] fetchNewsSignals failed:", e);
    return { signals: [], ok: [], failed: ["all"], apiFailed: ["all"] };
  }
}

export { resolveTeam };
