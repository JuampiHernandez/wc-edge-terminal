// Daily deep news research — per-nation keyword search (team + every roster player),
// 24h window, persisted to Supabase. Run locally via npm run research:news.

import type { Signal } from "./types";
import { fetchTeamInjuries, resolveNationalTeamId } from "./api-football";
import { hashId, rawToSignal, type RawNewsItem } from "./news-build";
import { enrichNewsContexts, hasNewsEnrichmentConfig } from "./news-enrichment";
import { fetchTeamRssSignals } from "./news";
import {
  createResearchRun,
  completeResearchRun,
  upsertSignals,
  pruneOldSignals,
  NEWS_RESEARCH_WINDOW_MS,
} from "./news-store";
import {
  getCachedSquads,
  getRosterIndex,
  refreshRostersBatch,
  refreshRostersForCodes,
} from "./roster";
import { WC_NATIONS, type WcNation } from "./teams-list";

const UA = "WC-Edge-Terminal/1.0 (research)";
const GDELT_MAX_PER_QUERY = 50;
const PLAYER_BATCH = 6;

/** Nicknames used as GDELT / NewsAPI keywords per nation. */
const NATION_ALIASES: Record<string, string[]> = {
  USA: ["usmnt", "united states"],
  ENG: ["three lions", "england"],
  ARG: ["la albiceleste", "argentina"],
  FRA: ["les bleus", "france"],
  GER: ["die mannschaft", "germany"],
  BRA: ["selecao", "seleção", "brazil"],
  NED: ["oranje", "netherlands"],
  ESP: ["la roja", "spain", "seleccion española", "selección española"],
  ITA: ["azzurri"],
  MEX: ["el tri", "mexico"],
  JPN: ["samurai blue", "japan"],
  KOR: ["taeguk warriors", "south korea"],
  GHA: ["black stars", "ghana"],
  SEN: ["lions of teranga", "senegal"],
  MAR: ["atlas lions", "morocco"],
  CIV: ["ivory coast", "cote d'ivoire", "côte d'ivoire"],
  KSA: ["saudi arabia"],
  RSA: ["south africa"],
  NZL: ["new zealand"],
};

export type DeepResearchResult = {
  runId: string | null;
  nationsScanned: number;
  signalsFound: number;
  signalsStored: number;
  enriched: number;
  errors: string[];
  durationMs: number;
  note: string;
};

export type DeepResearchOptions = {
  /** Team codes to scan (default: all WC nations). */
  nations?: string[];
  /** Run LLM enrichment before storing (needs AI_GATEWAY or OPENAI key). */
  enrich?: boolean;
  /** Refresh full rosters before searching (recommended). */
  refreshRosters?: boolean;
  onProgress?: (message: string) => void;
};

function log(opts: DeepResearchOptions | undefined, msg: string): void {
  opts?.onProgress?.(msg);
  console.log(`[news-research] ${msg}`);
}

function fresh(t: number, windowMs: number): boolean {
  return Date.now() - t <= windowMs;
}

function dedupeSignals(signals: Signal[]): Signal[] {
  const seenHeadline = new Set<string>();
  const seenUrl = new Set<string>();
  return signals
    .sort((a, b) => b.t - a.t)
    .filter((s) => {
      const h = s.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seenHeadline.has(h)) return false;
      seenHeadline.add(h);
      if (s.url) {
        const u = s.url.toLowerCase();
        if (seenUrl.has(u)) return false;
        seenUrl.add(u);
      }
      return true;
    });
}

function nationKeywords(nation: WcNation, players: string[]): string[] {
  const aliases = NATION_ALIASES[nation.code] ?? [];
  const terms = new Set<string>([nation.name, nation.code, ...aliases]);
  for (const p of players) {
    if (p.length >= 4) terms.add(p);
    const parts = p.trim().split(/\s+/);
    const surname = parts[parts.length - 1];
    if (surname && surname.length >= 4) terms.add(surname);
  }
  return [...terms];
}

function buildGdeltQueries(nation: WcNation, players: string[]): string[] {
  const aliases = NATION_ALIASES[nation.code] ?? [];
  const teamTerms = [nation.name, ...aliases].map((t) => `"${t}"`);
  const context =
    "(soccer OR football OR FIFA OR \"world cup\" OR injury OR squad OR convocatoria OR seleccion OR lineup OR suspension OR lesion OR baja)";
  const queries: string[] = [`(${teamTerms.join(" OR ")}) ${context}`];

  for (let i = 0; i < players.length; i += PLAYER_BATCH) {
    const batch = players.slice(i, i + PLAYER_BATCH).map((p) => `"${p}"`);
    if (batch.length === 0) continue;
    queries.push(`(${batch.join(" OR ")}) (${teamTerms.join(" OR ")})`);
  }
  return queries;
}

async function fetchGdeltQuery(
  query: string,
  prefix: string,
  teamCode: string,
  windowMs: number,
): Promise<RawNewsItem[]> {
  const q = encodeURIComponent(query);
  const timespan = windowMs <= NEWS_RESEARCH_WINDOW_MS ? "24h" : "7d";
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=${GDELT_MAX_PER_QUERY}&timespan=${timespan}&sort=datedesc`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (res.status === 429) return [];
    throw new Error(`gdelt HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    articles?: { title: string; url: string; seendate: string }[];
  };
  const cutoff = Date.now() - windowMs;
  return (data.articles ?? [])
    .map((a) => {
      const raw = a.seendate ?? "";
      const t = Date.parse(
        `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`,
      );
      return {
        id: `${prefix}_${hashId(a.url)}`,
        title: a.title,
        url: a.url,
        t: Number.isFinite(t) ? t : Date.now(),
        source: "GDELT",
        scoped: true,
        teamCode,
      };
    })
    .filter((it) => it.t >= cutoff);
}

async function fetchNewsApiNation(
  nation: WcNation,
  keywords: string[],
  windowMs: number,
): Promise<RawNewsItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return [];
  const from = new Date(Date.now() - windowMs).toISOString().slice(0, 10);
  const teamQ = keywords
    .slice(0, 12)
    .map((k) => `"${k}"`)
    .join(" OR ");
  const q = encodeURIComponent(
    `(${teamQ}) AND (FIFA OR "world cup" OR soccer OR football OR injury OR squad OR convocatoria)`,
  );
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&from=${from}&sortBy=publishedAt&pageSize=100&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`newsapi/${nation.code}: HTTP ${res.status}`);
  const data = (await res.json()) as {
    articles?: { title: string; url: string; publishedAt: string; source?: { name?: string } }[];
  };
  const cutoff = Date.now() - windowMs;
  return (data.articles ?? [])
    .filter((a) => a.title && a.url && a.title !== "[Removed]")
    .map((a) => ({
      id: `newsapi_${nation.code}_${hashId(a.url)}`,
      title: a.title,
      url: a.url,
      t: Date.parse(a.publishedAt),
      source: a.source?.name ?? "NewsAPI",
      scoped: true,
      teamCode: nation.code,
    }))
    .filter((it) => fresh(it.t, windowMs) && it.t >= cutoff);
}

async function fetchGNewsNation(nation: WcNation, keywords: string[], windowMs: number): Promise<RawNewsItem[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const top = keywords
    .slice(0, 8)
    .map((k) => `"${k}"`)
    .join(" OR ");
  // Parenthesized — an unscoped trailing OR would match any "FIFA"/"injury" article.
  const q = encodeURIComponent(`(${top}) AND ("world cup" OR FIFA OR injury)`);
  const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=50&sortby=publishedAt&apikey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gnews/${nation.code}: HTTP ${res.status}`);
  const data = (await res.json()) as {
    articles?: { title: string; url: string; publishedAt: string; source?: { name?: string } }[];
  };
  const cutoff = Date.now() - windowMs;
  return (data.articles ?? [])
    .map((a) => ({
      id: `gnews_${nation.code}_${hashId(a.url)}`,
      title: a.title,
      url: a.url,
      t: Date.parse(a.publishedAt),
      source: a.source?.name ?? "GNews",
      scoped: true,
      teamCode: nation.code,
    }))
    .filter((it) => fresh(it.t, windowMs) && it.t >= cutoff);
}

function injurySignals(
  teamName: string,
  teamCode: string,
  injuries: { player: { name: string; reason: string; type: string } }[],
): Signal[] {
  return injuries.map((inj, i) => ({
    id: `af_inj_${teamCode}_${inj.player.name.replace(/\s/g, "_")}_${i}`,
    t: Date.now(),
    kind: "injury" as const,
    severity: 3 as const,
    confidence: 0.9,
    headline: `${inj.player.name} (${teamName}) — ${inj.player.reason || inj.player.type || "unavailable"}`,
    detail: "Reported via API-Football injury feed.",
    source: "API-Football",
    entities: { teams: [teamCode], players: [inj.player.name] },
    marketSlugs: ["world-cup-winner", "world-cup-team-to-advance-to-knockout-stages"],
    priceImpact: { direction: "down" as const, estPct: 2.5 },
  }));
}

async function researchNation(
  nation: WcNation,
  players: string[],
  index: Awaited<ReturnType<typeof getRosterIndex>>,
  windowMs: number,
  errors: string[],
): Promise<Signal[]> {
  const merged: Signal[] = [];
  const keywords = nationKeywords(nation, players);

  const queries = buildGdeltQueries(nation, players);
  for (const query of queries) {
    try {
      const items = await fetchGdeltQuery(query, `gdelt_${nation.code}`, nation.code, windowMs);
      merged.push(...items.map((it) => rawToSignal(it, index)));
    } catch (e) {
      errors.push(`${nation.code}/gdelt: ${String(e)}`);
    }
  }

  try {
    const newsApi = await fetchNewsApiNation(nation, keywords, windowMs);
    merged.push(...newsApi.map((it) => rawToSignal(it, index)));
  } catch (e) {
    errors.push(`${nation.code}/newsapi: ${String(e)}`);
  }

  try {
    const gnews = await fetchGNewsNation(nation, keywords, windowMs);
    merged.push(...gnews.map((it) => rawToSignal(it, index)));
  } catch (e) {
    errors.push(`${nation.code}/gnews: ${String(e)}`);
  }

  try {
    const rss = await fetchTeamRssSignals(nation.code, index, windowMs);
    merged.push(...rss);
  } catch (e) {
    errors.push(`${nation.code}/rss: ${String(e)}`);
  }

  if (process.env.API_FOOTBALL_KEY) {
    try {
      const afId = await resolveNationalTeamId(nation.name);
      if (afId) {
        const injuries = await fetchTeamInjuries(afId, 2024);
        if (injuries.length > 0) {
          merged.push(...injurySignals(nation.name, nation.code, injuries));
        }
      }
    } catch (e) {
      errors.push(`${nation.code}/injuries: ${String(e)}`);
    }
  }

  return merged;
}

export async function runDeepNewsResearch(options?: DeepResearchOptions): Promise<DeepResearchResult> {
  const start = Date.now();
  const errors: string[] = [];
  const windowMs = NEWS_RESEARCH_WINDOW_MS;
  const enrich = options?.enrich ?? hasNewsEnrichmentConfig();

  log(options, `starting deep research (last ${windowMs / 3_600_000}h window)`);

  const runId = await createResearchRun();
  if (!runId) {
    errors.push("supabase: could not create research run (check SUPABASE_SERVICE_ROLE_KEY)");
  }

  const nationFilter = options?.nations;
  const nations = nationFilter
    ? WC_NATIONS.filter((n) => nationFilter.includes(n.code))
    : WC_NATIONS;

  if (options?.refreshRosters ?? true) {
    if (process.env.FOOTBALL_DATA_API_KEY || process.env.API_FOOTBALL_KEY) {
      try {
        if (nationFilter) {
          log(options, `refreshing rosters (${nationFilter.join(",")})…`);
          await refreshRostersForCodes(nationFilter);
        } else {
          log(options, "refreshing rosters (batch of 16 stale nations)…");
          await refreshRostersBatch(16);
        }
      } catch (e) {
        errors.push(`rosters: ${String(e)}`);
      }
    } else {
      log(options, "skipping roster refresh (no football API keys)");
    }
  }

  const index = await getRosterIndex(true);
  const squadsMap = await getCachedSquads();

  const allSignals: Signal[] = [];

  for (const nation of nations) {
    const players = squadsMap[nation.code] ?? [];
    log(options, `${nation.code} — ${players.length} players, keywords: ${nationKeywords(nation, players).length}`);

    const nationSignals = await researchNation(nation, players, index, windowMs, errors);
    allSignals.push(...nationSignals);
    log(options, `${nation.code} → ${nationSignals.length} raw hits`);
  }

  const deduped = dedupeSignals(allSignals.filter((s) => fresh(s.t, windowMs)));
  log(options, `${deduped.length} signals after dedupe (from ${allSignals.length} raw)`);

  let enriched = 0;
  let toStore = deduped;
  if (enrich && hasNewsEnrichmentConfig()) {
    log(options, "enriching news headlines with LLM…");
    const result = await enrichNewsContexts(deduped);
    enriched = result.enriched;
    toStore = result.signals;
    log(options, `enriched ${enriched} headlines`);
  }

  let signalsStored = 0;
  if (runId) {
    signalsStored = await upsertSignals(toStore, runId);
    await pruneOldSignals(14);
    await completeResearchRun(runId, {
      nationsScanned: nations.length,
      signalsFound: deduped.length,
      signalsStored,
      errors,
      note: `24h deep research · ${index.playerCount} players indexed`,
    });
  }

  const durationMs = Date.now() - start;
  const note = `${nations.length} nations · ${deduped.length} signals · ${signalsStored} stored · ${durationMs}ms`;

  log(options, `done — ${note}`);

  return {
    runId,
    nationsScanned: nations.length,
    signalsFound: deduped.length,
    signalsStored,
    enriched,
    errors,
    durationMs,
    note,
  };
}

