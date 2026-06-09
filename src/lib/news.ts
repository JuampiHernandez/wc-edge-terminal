// News wire via OFFICIAL RSS feeds only (publisher-approved syndication).
// We never scrape HTML — headline + outbound link only. Each item becomes a
// Signal, with the referenced nation resolved so it can be linked to markets.

import type { Signal, SignalKind } from "./types";
import { resolveTeam, TEAMS } from "./worldcup";

type RssFeed = { id: string; source: string; url: string; limit: number };

export const NEWS_FEEDS: RssFeed[] = [
  { id: "espn-soccer", source: "ESPN", url: "https://www.espn.com/espn/rss/soccer/news", limit: 14 },
  { id: "bbc-football", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml", limit: 12 },
  { id: "guardian-wc", source: "Guardian", url: "https://www.theguardian.com/football/world-cup-2026/rss", limit: 12 },
  { id: "marca-futbol", source: "Marca", url: "https://www.marca.com/rss/futbol.xml", limit: 10 },
];

const UA = "WC-Edge-Terminal/1.0 (RSS reader)";

const WC_KEYWORDS =
  /world cup|world-cup|fifa|mundial|usmnt|2026|selecci[oó]n|group stage|golden boot|copa del mundo|qualif/i;

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

/** Map a headline to a signal kind + severity + price-impact hint. */
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

/** Detect every nation mentioned in a headline. */
function detectTeams(headline: string): string[] {
  const h = ` ${headline.toLowerCase()} `;
  const codes = new Set<string>();
  for (const [name, meta] of Object.entries(TEAMS)) {
    if (h.includes(` ${name} `) || h.includes(`${name},`) || h.includes(`${name}'`)) {
      codes.add(meta.code);
    }
  }
  return [...codes];
}

/**
 * Which market/event slugs a team-tagged story plausibly touches. We link to the
 * broad outright + advancement markets; precise per-team linking happens at edge
 * time via the team code, but these slugs make feed→market navigation work.
 */
function slugsForTeams(teams: string[]): string[] {
  if (teams.length === 0) return [];
  return [
    "world-cup-winner",
    "world-cup-team-to-advance-to-knockout-stages",
    "world-cup-nation-to-reach-final",
  ];
}

async function fetchFeed(feed: RssFeed): Promise<Signal[]> {
  const res = await fetch(feed.url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*", "User-Agent": UA },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`${feed.id}: HTTP ${res.status}`);
  const xml = await res.text();
  const raw = parseRss(xml).slice(0, feed.limit);

  return raw
    .filter((it) => feed.id !== "bbc-football" || WC_KEYWORDS.test(it.title))
    .map((it): Signal => {
      const { kind, severity, impact } = classify(it.title);
      const teams = detectTeams(it.title);
      return {
        id: `news_${feed.id}_${it.guid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`,
        t: parseDate(it.pubDate),
        kind,
        severity,
        confidence: 0.6,
        headline: it.title,
        source: feed.source,
        url: it.link,
        entities: { teams },
        marketSlugs: slugsForTeams(teams),
        priceImpact: impact ? { direction: impact > 0 ? "up" : "down", estPct: severity * 1.5 } : undefined,
      };
    });
}

export async function fetchNewsSignals(): Promise<{ signals: Signal[]; ok: string[]; failed: string[] }> {
  const results = await Promise.allSettled(NEWS_FEEDS.map(fetchFeed));
  const ok: string[] = [];
  const failed: string[] = [];
  const merged: Signal[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok.push(NEWS_FEEDS[i].id);
      merged.push(...r.value);
    } else {
      failed.push(NEWS_FEEDS[i].id);
    }
  });

  // Dedupe by normalized headline.
  const seen = new Set<string>();
  const signals = merged
    .sort((a, b) => b.t - a.t)
    .filter((s) => {
      const key = s.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);

  return { signals, ok, failed };
}

// re-export for callers that want to resolve a label themselves
export { resolveTeam };
