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
import { NEWS_FEEDS, type RssFeed } from "./news-feeds";
import { nationName, WC_NATIONS } from "./teams-list";

const UA = "WC-Edge-Terminal/1.0 (RSS reader)";
const GLOBAL_CAP = 1200;
const TAGGED_CAP = 1000;
const FEED_TIMEOUT_MS = 8_000;
const FEED_BATCH = 8;
const NATION_FEED_BATCH = 12;
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

// --- Near-duplicate story collapsing -----------------------------------------
// Exact-headline dedup misses the same story phrased differently by each outlet
// ("THREE red cards in the first game" / "2 goals, 3 red cards | Gazette").
// For classified kinds we compare significant-token overlap instead.

const NEAR_DUP_KINDS = new Set(["injury", "suspension", "card_watch", "lineup"]);

const STORY_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for", "with", "as",
  "by", "is", "are", "was", "were", "be", "what", "this", "that", "it", "its", "does",
  "do", "his", "her", "their", "after", "before", "vs", "v",
  "de", "la", "el", "los", "las", "del", "un", "una", "y", "en", "por", "con", "que",
  // Tournament boilerplate — present in nearly every headline, useless for identity.
  "world", "cup", "fifa", "mundial", "football", "soccer", "2026", "game", "match",
]);

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

// Words that appear in every headline of a given kind — sharing them says
// nothing about whether two stories are the same one.
const KIND_GENERIC_TOKENS = new Set([
  "injury", "injured", "injuries", "doubt", "doubtful", "scare", "lesion", "lesionado",
  "suspension", "suspended", "banned", "ban", "sancionado",
  "red", "yellow", "card", "cards", "sent",
  "lineup", "squad", "xi", "starting",
  "first", "opener", "players", "team",
]);

const NATION_NAME_TOKENS = new Set(
  WC_NATIONS.flatMap((n) =>
    nationName(n.code)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  ),
);

function storyTokens(headline: string): Set<string> {
  const main = headline.split("|")[0]; // drop "| Publisher Name" tails
  const words = main
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((w) => NUMBER_WORDS[w] ?? w)
    .filter((w) => (w.length > 1 || /^\d$/.test(w)) && !STORY_STOP_WORDS.has(w));
  return new Set(words);
}

/** True when two same-kind signals look like the same underlying story. */
function isNearDuplicate(a: Signal, aTokens: Set<string>, b: Signal, bTokens: Set<string>): boolean {
  // Different named players → different stories, even if wording overlaps.
  const ap = a.entities.players ?? [];
  const bp = b.entities.players ?? [];
  if (ap.length > 0 && bp.length > 0 && !ap.some((p) => bp.includes(p))) return false;

  let shared = 0;
  let sharedSpecific = 0;
  for (const tok of aTokens) {
    if (!bTokens.has(tok)) continue;
    shared++;
    if (!KIND_GENERIC_TOKENS.has(tok) && !NATION_NAME_TOKENS.has(tok)) sharedSpecific++;
  }
  // Require a distinctive shared token (player, number, venue…) — "injury doubt
  // Argentina" alone must not merge a Messi story with a Di María story.
  if (shared < 3 || sharedSpecific < 1) return false;
  const containment = shared / Math.min(aTokens.size, bTokens.size);
  // Same nation tag(s) → likely the same match story; allow looser wording.
  const at = [...(a.entities.teams ?? [])].sort().join(",");
  const bt = [...(b.entities.teams ?? [])].sort().join(",");
  const threshold = at && at === bt ? 0.5 : 0.6;
  return containment >= threshold;
}

/** Collapse near-duplicate classified stories, keeping the newest of each. */
function collapseNearDuplicates(signals: Signal[]): Signal[] {
  const kept: Signal[] = [];
  const accepted: { sig: Signal; tokens: Set<string> }[] = [];
  for (const s of signals) {
    if (!NEAR_DUP_KINDS.has(s.kind)) {
      kept.push(s);
      continue;
    }
    const tokens = storyTokens(s.headline);
    const dup = accepted.find(
      (e) => e.sig.kind === s.kind && isNearDuplicate(s, tokens, e.sig, e.tokens),
    );
    if (dup) {
      // Merge team tags so the surviving story links to all affected markets.
      const teams = new Set([...(dup.sig.entities.teams ?? []), ...(s.entities.teams ?? [])]);
      dup.sig.entities.teams = [...teams];
      continue;
    }
    accepted.push({ sig: s, tokens });
    kept.push(s);
  }
  return kept;
}

function isFresh(t: number): boolean {
  return Date.now() - t <= NEWS_MAX_AGE_MS;
}

async function fetchFeed(
  feed: RssFeed,
  index: RosterIndex,
  maxAgeMs = NEWS_MAX_AGE_MS,
): Promise<Signal[]> {
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
  const cutoff = Date.now() - maxAgeMs;

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
    const deduped = collapseNearDuplicates(
      merged
        .filter((s) => isFresh(s.t))
        .sort((a, b) => b.t - a.t)
        .filter((s) => {
          const key = s.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
    );

    // Team-tagged items are the only ones that link to nation markets — never
    // let high-volume untagged wires (GDELT/Currents/…) push them past the cap.
    const tagged = deduped.filter((s) => (s.entities.teams?.length ?? 0) > 0);
    const untagged = deduped.filter((s) => (s.entities.teams?.length ?? 0) === 0);
    const taggedSlice = tagged.slice(0, TAGGED_CAP);
    const untaggedSlice = untagged.slice(0, Math.max(0, GLOBAL_CAP - taggedSlice.length));
    const signals = await attachCachedNewsContexts(
      [...taggedSlice, ...untaggedSlice].sort((a, b) => b.t - a.t),
    );

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

/** Nation-scoped RSS (BBC + Guardian team pages) for deep research. */
export async function fetchTeamRssSignals(
  teamCode: string,
  index: RosterIndex,
  maxAgeMs = NEWS_MAX_AGE_MS,
): Promise<Signal[]> {
  const feeds = NEWS_FEEDS.filter((f) => f.teamCode === teamCode);
  const signals: Signal[] = [];
  for (const feed of feeds) {
    try {
      signals.push(...(await fetchFeed(feed, index, maxAgeMs)));
    } catch (e) {
      console.warn(`[news] ${feed.id}:`, e);
    }
  }
  return signals;
}

export { resolveTeam };
