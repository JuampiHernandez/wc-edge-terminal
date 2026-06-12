// News from JSON APIs — GDELT (no key), NewsAPI, GNews, Currents, Reddit.
// All responses are cached 1h via Next fetch revalidate to protect daily quotas.

import type { Signal } from "./types";
import { headlineIsRelevant, NEWS_MAX_AGE_MS, type RosterIndex } from "./roster";
import { nationName, WC_NATIONS } from "./teams-list";
import { hashId, rawToSignal, type RawNewsItem } from "./news-build";

const API_CACHE = 3600;
const UA = "WC-Edge-Terminal/1.0";
const GDELT_NATION_BATCH = 8;

function fresh(t: number): boolean {
  return Date.now() - t <= NEWS_MAX_AGE_MS;
}

function currentsKey(): string | undefined {
  return process.env.CURRENTS_API_KEY ?? process.env.CURRENT_API_KEY;
}

function redditUa(): string {
  return process.env.REDDIT_USER_AGENT ?? "web:worldcupterminal:v1.0 (by /u/wcedgeterminal)";
}

function slugId(prefix: string, s: string): string {
  return `${prefix}_${hashId(s)}`;
}

function filterRelevant(items: RawNewsItem[], index: RosterIndex): RawNewsItem[] {
  return items.filter((it) => it.scoped || headlineIsRelevant(it.title, index));
}

function parseGdeltDate(raw: string): number {
  const t = Date.parse(
    `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`,
  );
  return Number.isFinite(t) ? t : Date.now();
}

async function fetchGdeltQuery(
  query: string,
  maxrecords: number,
  prefix: string,
  scoped = true,
  teamCode?: string,
): Promise<RawNewsItem[]> {
  const q = encodeURIComponent(query);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=${maxrecords}&timespan=7d&sort=datedesc`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: API_CACHE },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (res.status === 429) return [];
    throw new Error(`gdelt: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    articles?: { title: string; url: string; seendate: string }[];
  };
  return (data.articles ?? [])
    .map((a) => ({
      id: slugId(prefix, a.url),
      title: a.title,
      url: a.url,
      t: parseGdeltDate(a.seendate ?? ""),
      source: "GDELT",
      scoped,
      teamCode,
    }))
    .filter((it) => fresh(it.t));
}

/** GDELT DOC 2.0 — free, no registration. https://api.gdeltproject.org/api/v2/doc/doc */
async function fetchGdelt(): Promise<RawNewsItem[]> {
  return fetchGdeltQuery(
    '("world cup" OR fifa OR "world cup 2026" OR mundial) (soccer OR football)',
    250,
    "gdelt",
  );
}

/** Per-nation GDELT queries — auto-tag each nation for market linking. */
async function fetchGdeltNations(): Promise<RawNewsItem[]> {
  const merged: RawNewsItem[] = [];
  for (let i = 0; i < WC_NATIONS.length; i += GDELT_NATION_BATCH) {
    const batch = WC_NATIONS.slice(i, i + GDELT_NATION_BATCH);
    const results = await Promise.allSettled(
      batch.map((n) => {
        const name = nationName(n.code);
        const query = `("${name}" OR "${n.code}") (soccer OR football OR FIFA OR "world cup" OR injury OR squad OR seleccion OR convocatoria)`;
        return fetchGdeltQuery(query, 25, `gdelt_${n.code.toLowerCase()}`, true, n.code);
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") merged.push(...r.value);
    }
  }
  return merged;
}

/** NewsAPI.org — https://newsapi.org/register */
async function fetchNewsApi(): Promise<RawNewsItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  const q = encodeURIComponent('"world cup" OR FIFA OR "World Cup 2026"');
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=100&apiKey=${key}`;
  const res = await fetch(url, { next: { revalidate: API_CACHE } });
  if (!res.ok) throw new Error(`newsapi: HTTP ${res.status}`);
  const data = (await res.json()) as {
    articles?: { title: string; url: string; publishedAt: string; source?: { name?: string } }[];
  };
  return (data.articles ?? [])
    .filter((a) => a.title && a.url && a.title !== "[Removed]")
    .map((a) => ({
      id: slugId("newsapi", a.url),
      title: a.title,
      url: a.url,
      t: Date.parse(a.publishedAt),
      source: a.source?.name ?? "NewsAPI",
    }))
    .filter((it) => fresh(it.t));
}

async function fetchNewsApiNations(): Promise<RawNewsItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  const merged: RawNewsItem[] = [];
  const batchSize = 6;
  for (let i = 0; i < WC_NATIONS.length; i += batchSize) {
    const batch = WC_NATIONS.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (n) => {
        const name = nationName(n.code);
        const q = encodeURIComponent(`"${name}" AND (FIFA OR "world cup" OR soccer OR football)`);
        const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${key}`;
        const res = await fetch(url, { next: { revalidate: API_CACHE } });
        if (!res.ok) throw new Error(`newsapi/${n.code}: HTTP ${res.status}`);
        const data = (await res.json()) as {
          articles?: { title: string; url: string; publishedAt: string; source?: { name?: string } }[];
        };
        return (data.articles ?? [])
          .filter((a) => a.title && a.url && a.title !== "[Removed]")
          .map((a) => ({
            id: slugId(`newsapi_${n.code}`, a.url),
            title: a.title,
            url: a.url,
            t: Date.parse(a.publishedAt),
            source: a.source?.name ?? "NewsAPI",
            scoped: true,
            teamCode: n.code,
          }))
          .filter((it) => fresh(it.t));
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") merged.push(...r.value);
    }
  }
  return merged;
}

/** GNews — https://gnews.io/register */
async function fetchGNews(): Promise<RawNewsItem[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const q = encodeURIComponent("world cup OR FIFA");
  const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=100&sortby=publishedAt&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate: API_CACHE } });
  if (!res.ok) throw new Error(`gnews: HTTP ${res.status}`);
  const data = (await res.json()) as {
    articles?: { title: string; url: string; publishedAt: string; source?: { name?: string } }[];
  };
  return (data.articles ?? [])
    .map((a) => ({
      id: slugId("gnews", a.url),
      title: a.title,
      url: a.url,
      t: Date.parse(a.publishedAt),
      source: a.source?.name ?? "GNews",
    }))
    .filter((it) => fresh(it.t));
}

async function fetchGNewsNations(): Promise<RawNewsItem[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const merged: RawNewsItem[] = [];
  const batchSize = 8;
  for (let i = 0; i < WC_NATIONS.length; i += batchSize) {
    const batch = WC_NATIONS.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (n) => {
        const name = nationName(n.code);
        const q = encodeURIComponent(`"${name}" AND ("world cup" OR FIFA)`);
        const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=10&sortby=publishedAt&apikey=${key}`;
        const res = await fetch(url, { next: { revalidate: API_CACHE } });
        if (!res.ok) throw new Error(`gnews/${n.code}: HTTP ${res.status}`);
        const data = (await res.json()) as {
          articles?: { title: string; url: string; publishedAt: string; source?: { name?: string } }[];
        };
        return (data.articles ?? [])
          .map((a) => ({
            id: slugId(`gnews_${n.code}`, a.url),
            title: a.title,
            url: a.url,
            t: Date.parse(a.publishedAt),
            source: a.source?.name ?? "GNews",
            scoped: true,
            teamCode: n.code,
          }))
          .filter((it) => fresh(it.t));
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") merged.push(...r.value);
    }
  }
  return merged;
}

/** Currents API — https://currentsapi.services/en/register */
async function fetchCurrents(): Promise<RawNewsItem[]> {
  const key = currentsKey();
  if (!key) return [];
  const url = `https://api.currentsapi.services/v1/search?keywords=world+cup+FIFA+soccer&language=en&apiKey=${key}`;
  const res = await fetch(url, { next: { revalidate: API_CACHE } });
  if (!res.ok) throw new Error(`currents: HTTP ${res.status}`);
  const data = (await res.json()) as {
    news?: { title: string; url: string; published: string; author?: string }[];
  };
  return (data.news ?? [])
    .map((a) => ({
      id: slugId("currents", a.url),
      title: a.title,
      url: a.url,
      t: Date.parse(a.published),
      source: "Currents",
    }))
    .filter((it) => fresh(it.t));
}

type RedditPost = { data: { id: string; title: string; permalink: string; created_utc: number; score: number; subreddit: string } };

async function fetchRedditSub(sub: string, query: string, limit = 50): Promise<RawNewsItem[]> {
  const q = encodeURIComponent(query);
  const oauthUrl = `https://oauth.reddit.com/r/${sub}/search?q=${q}&restrict_sr=1&sort=new&limit=${limit}&t=week`;
  const publicUrl = `https://www.reddit.com/r/${sub}/search.json?q=${q}&restrict_sr=1&sort=new&limit=${limit}&t=week`;

  let res = await redditFetch(oauthUrl);
  if (!res?.ok) {
    res = await fetch(publicUrl, {
      headers: { "User-Agent": redditUa(), Accept: "application/json" },
      next: { revalidate: API_CACHE },
    });
  }
  if (!res.ok) throw new Error(`reddit/${sub}: HTTP ${res.status}`);

  const data = (await res.json()) as { data?: { children?: RedditPost[] } };
  return (data.data?.children ?? [])
    .map(({ data: p }) => ({
      id: slugId("reddit", p.id),
      title: p.title,
      url: `https://www.reddit.com${p.permalink}`,
      t: p.created_utc * 1000,
      source: `Reddit r/${p.subreddit}`,
      kind: p.score >= 100 ? ("social_velocity" as const) : undefined,
      confidence: p.score >= 200 ? 0.55 : 0.45,
      scoped: true,
    }))
    .filter((it) => fresh(it.t));
}

async function redditFetch(url: string): Promise<Response | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": redditUa(),
    },
    body: "grant_type=client_credentials",
    next: { revalidate: 3500 },
  });
  if (!tokenRes.ok) return null;
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;

  return fetch(url, {
    headers: { Authorization: `Bearer ${access_token}`, "User-Agent": redditUa() },
    next: { revalidate: API_CACHE },
  });
}

/** Reddit — requires approved API access (Responsible Builder Policy). Skipped until creds set. */
async function fetchReddit(): Promise<RawNewsItem[]> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return [];

  const [soccer, wc, spain, copa] = await Promise.allSettled([
    fetchRedditSub("soccer", "world cup OR FIFA"),
    fetchRedditSub("worldcup", "2026 OR squad OR injury"),
    fetchRedditSub("soccer", "Spain OR La Roja OR seleccion", 30),
    fetchRedditSub("soccer", "injury OR ruled out OR convocatoria", 30),
  ]);
  const items: RawNewsItem[] = [];
  if (soccer.status === "fulfilled") items.push(...soccer.value);
  if (wc.status === "fulfilled") items.push(...wc.value);
  if (spain.status === "fulfilled") items.push(...spain.value);
  if (copa.status === "fulfilled") items.push(...copa.value);
  if (items.length === 0 && soccer.status === "rejected" && wc.status === "rejected") {
    throw soccer.reason;
  }
  return items;
}

const API_SOURCES: { id: string; fn: () => Promise<RawNewsItem[]> }[] = [
  { id: "gdelt", fn: fetchGdelt },
  { id: "gdelt-nations", fn: fetchGdeltNations },
  { id: "newsapi", fn: fetchNewsApi },
  { id: "newsapi-nations", fn: fetchNewsApiNations },
  { id: "gnews", fn: fetchGNews },
  { id: "gnews-nations", fn: fetchGNewsNations },
  { id: "currents", fn: fetchCurrents },
  { id: "reddit", fn: fetchReddit },
];

export async function fetchApiNewsSignals(index: RosterIndex): Promise<{
  signals: Signal[];
  ok: string[];
  failed: string[];
}> {
  const results = await Promise.allSettled(API_SOURCES.map((s) => s.fn()));
  const ok: string[] = [];
  const failed: string[] = [];
  const merged: RawNewsItem[] = [];

  results.forEach((r, i) => {
    const id = API_SOURCES[i].id;
    const hasKey =
      id.startsWith("gdelt") ||
      (id.startsWith("newsapi") && process.env.NEWS_API_KEY) ||
      (id.startsWith("gnews") && process.env.GNEWS_API_KEY) ||
      (id === "currents" && currentsKey()) ||
      (id === "reddit" && process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
    if (!hasKey) return;
    if (r.status === "fulfilled") {
      ok.push(id);
      merged.push(...r.value);
    } else {
      failed.push(id);
      console.warn(`[news-api] ${id}:`, r.reason);
    }
  });

  const signals = filterRelevant(merged, index).map((it) => rawToSignal(it, index));
  return { signals, ok, failed };
}
