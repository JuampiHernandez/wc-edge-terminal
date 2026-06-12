// World Cup squad rosters — fetched from football-data.org / API-Football,
// cached for 7 days, used to match player & team names in news headlines.

import { promises as fs } from "fs";
import path from "path";
import { revalidateTag, unstable_cache } from "next/cache";
import { fetchNationalSquad, resolveNationalTeamId } from "./api-football";
import { fetchTeamSquad, fetchWcTeams, tlaToCode } from "./football-data";
import { nationName, WC_NATIONS } from "./teams-list";
import fallbackValuations from "@/data/team-valuations.fallback.json";
import { fetchTransfermarktValuations } from "./transfermarkt-valuations";
import { TEAMS } from "./worldcup";
import type { TeamContext, TeamValuation } from "./types";

const VALUATIONS_FALLBACK = fallbackValuations as Record<string, TeamValuation>;

const FILE = path.join(process.cwd(), ".data", "rosters.json");
const ROSTER_TTL_MS = 7 * 86_400_000;
const MAX_PLAYERS_PER_TEAM = 26;

export type StoredRoster = {
  generatedAt: number;
  /** team code → player display names */
  teams: Record<string, string[]>;
  /** Optional valuation data populated by a future cached provider/import. */
  valuations?: Record<string, TeamValuation>;
  /** Per-team last refresh (for incremental cron on Vercel free tier). */
  teamUpdatedAt?: Record<string, number>;
};

const ROSTER_TAG = "wc-rosters";

export type RosterIndex = {
  generatedAt: number;
  /** Longest-first full-name phrases for headline matching. */
  fullNameTerms: { phrase: string; teamCode: string; name: string }[];
  /** Surname → team code (only when surname is unique across all squads). */
  uniqueSurnames: Record<string, string>;
  /** Team search terms longest-first: phrase → team code. */
  teamTerms: { phrase: string; teamCode: string }[];
  playerCount: number;
  teamCount: number;
};

/** Extra nicknames / aliases → team code. */
const TEAM_ALIASES: [string, string][] = [
  ["usmnt", "USA"],
  ["united states", "USA"],
  ["three lions", "ENG"],
  ["la albiceleste", "ARG"],
  ["les bleus", "FRA"],
  ["die mannschaft", "GER"],
  ["selecao", "BRA"],
  ["seleção", "BRA"],
  ["oranje", "NED"],
  ["la roja", "ESP"],
  ["azzurri", "ITA"],
  ["el tri", "MEX"],
  ["samurai blue", "JPN"],
  ["taeguk warriors", "KOR"],
  ["black stars", "GHA"],
  ["lions of teranga", "SEN"],
  ["atlas lions", "MAR"],
  ["cote d'ivoire", "CIV"],
  ["côte d'ivoire", "CIV"],
  ["congo dr", "COD"],
  ["bosnia-herzegovina", "BIH"],
  ["south korea", "KOR"],
  ["saudi arabia", "KSA"],
  ["south africa", "RSA"],
  ["new zealand", "NZL"],
  ["ivory coast", "CIV"],
  ["cape verde", "CPV"],
  ["curaçao", "CUW"],
  ["curacao", "CUW"],
];

export const WC_KEYWORDS =
  /world cup|world-cup|worldcup|fifa|mundial|copa del mundo|usmnt|2026|selecci[oó]n|group stage|golden boot|golden glove|knockout|round of 16|quarter-?final|semi-?final|host nation|concacaf|conmebol|caf|afc|ofc|qualif|playoff|draw|seeded|favorites?|favourites?|dark horse|penalt|var\b/i;

export const NEWS_MAX_AGE_MS = 7 * 86_400_000;

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function surname(name: string): string {
  const parts = norm(name).split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function containsPhrase(haystack: string, phrase: string): boolean {
  if (phrase.length < 3) return false;
  const re = new RegExp(`(?:^|[\\s,.:;"'(-])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s,.:;"')-]|$)`, "i");
  return re.test(` ${haystack} `);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function readStored(): Promise<StoredRoster | null> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as StoredRoster;
  } catch {
    return null;
  }
}

async function writeStored(data: StoredRoster): Promise<void> {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(data, null, 2));
  } catch {
    // .data/ is ephemeral on Vercel serverless — unstable_cache + fetch cache carry state.
  }
}

function buildTeamTerms(): { phrase: string; teamCode: string }[] {
  const seen = new Set<string>();
  const terms: { phrase: string; teamCode: string }[] = [];

  const add = (phrase: string, teamCode: string) => {
    const p = norm(phrase);
    if (p.length < 2 || seen.has(`${p}:${teamCode}`)) return;
    seen.add(`${p}:${teamCode}`);
    terms.push({ phrase: p, teamCode });
  };

  for (const nation of WC_NATIONS) {
    add(nation.name, nation.code);
    add(nation.code, nation.code);
  }
  for (const [name, meta] of Object.entries(TEAMS)) {
    add(name, meta.code);
  }
  for (const [alias, code] of TEAM_ALIASES) {
    add(alias, code);
  }

  return terms.sort((a, b) => b.phrase.length - a.phrase.length);
}

export function buildIndex(stored: StoredRoster): RosterIndex {
  const fullNameTerms: RosterIndex["fullNameTerms"] = [];
  const surnameCounts = new Map<string, Set<string>>();

  for (const [teamCode, players] of Object.entries(stored.teams)) {
    for (const name of players) {
      const phrase = norm(name);
      if (phrase.length >= 4) {
        fullNameTerms.push({ phrase, teamCode, name });
      }
      const sn = surname(name);
      if (sn.length >= 4) {
        if (!surnameCounts.has(sn)) surnameCounts.set(sn, new Set());
        surnameCounts.get(sn)!.add(teamCode);
      }
    }
  }

  fullNameTerms.sort((a, b) => b.phrase.length - a.phrase.length);

  const uniqueSurnames: Record<string, string> = {};
  for (const [sn, codes] of surnameCounts) {
    if (codes.size === 1) uniqueSurnames[sn] = [...codes][0];
  }

  const playerCount = Object.values(stored.teams).reduce((n, p) => n + p.length, 0);

  return {
    generatedAt: stored.generatedAt,
    fullNameTerms,
    uniqueSurnames,
    teamTerms: buildTeamTerms(),
    playerCount,
    teamCount: Object.keys(stored.teams).length,
  };
}

/** Match headline against rosters + team aliases. Returns team codes and player names. */
export function matchHeadlineEntities(
  headline: string,
  index: RosterIndex,
): { teams: string[]; players: string[] } {
  const h = norm(headline);
  const teams = new Set<string>();
  const players: string[] = [];

  for (const { phrase, teamCode } of index.teamTerms) {
    if (containsPhrase(h, phrase)) teams.add(teamCode);
  }

  for (const { phrase, teamCode, name } of index.fullNameTerms) {
    if (containsPhrase(h, phrase)) {
      teams.add(teamCode);
      if (!players.includes(name)) players.push(name);
    }
  }

  for (const [sn, teamCode] of Object.entries(index.uniqueSurnames ?? {})) {
    if (containsPhrase(h, sn)) teams.add(teamCode);
  }

  if (WC_KEYWORDS.test(headline)) {
    // WC-tagged stories may not name a team; leave teams as detected above.
  }

  return { teams: [...teams], players };
}

/** True when a headline is relevant to World Cup coverage. */
export function headlineIsRelevant(headline: string, index: RosterIndex): boolean {
  if (WC_KEYWORDS.test(headline)) return true;
  const { teams, players } = matchHeadlineEntities(headline, index);
  return teams.length > 0 || players.length > 0;
}

let mem: { at: number; index: RosterIndex } | null = null;

async function squadForCode(code: string, name: string): Promise<string[]> {
  const fdTeams = await fetchWcTeams();
  const fd = fdTeams.find((t) => tlaToCode(t.tla) === code);
  if (fd) {
    const squad = await fetchTeamSquad(fd.id);
    if (squad.length > 0) return squad.map((p) => p.name).slice(0, MAX_PLAYERS_PER_TEAM);
  }
  if (process.env.API_FOOTBALL_KEY) {
    const afId = await resolveNationalTeamId(name);
    if (afId) {
      const squad = await fetchNationalSquad(afId);
      if (squad.length > 0) return squad.map((p) => p.name).slice(0, MAX_PLAYERS_PER_TEAM);
    }
  }
  return [];
}

/** Refresh up to N teams — fits Vercel Hobby cron (~10s timeout). */
export async function refreshRostersBatch(maxTeams = 10): Promise<StoredRoster> {
  const stored: StoredRoster = (await readStored()) ?? {
    generatedAt: Date.now(),
    teams: {},
    teamUpdatedAt: {},
  };
  stored.teamUpdatedAt ??= {};

  const now = Date.now();
  const stale = WC_NATIONS.filter((n) => now - (stored.teamUpdatedAt![n.code] ?? 0) > ROSTER_TTL_MS);
  const pick = (stale.length > 0 ? stale : WC_NATIONS)
    .sort((a, b) => (stored.teamUpdatedAt![a.code] ?? 0) - (stored.teamUpdatedAt![b.code] ?? 0))
    .slice(0, maxTeams);

  for (let i = 0; i < pick.length; i += 4) {
    const chunk = pick.slice(i, i + 4);
    await Promise.all(
      chunk.map(async (n) => {
        const players = await squadForCode(n.code, nationName(n.code));
        if (players.length > 0) {
          stored.teams[n.code] = players;
          stored.teamUpdatedAt![n.code] = now;
        }
      }),
    );
  }

  stored.generatedAt = now;
  try {
    stored.valuations = await fetchTransfermarktValuations();
    if (Object.keys(stored.valuations).length > 0) valuationsCacheWarm = stored.valuations;
  } catch (e) {
    console.warn("[roster] valuation refresh failed:", e);
  }
  await writeStored(stored);
  mem = { at: Date.now(), index: buildIndex(stored) };
  try {
    revalidateTag(ROSTER_TAG, { expire: 0 });
  } catch {
    /* revalidateTag is cron-only; ignore in ephemeral runtimes */
  }
  return stored;
}

/** Refresh squads for specific nations only (for nation-scoped news research). */
export async function refreshRostersForCodes(codes: string[]): Promise<StoredRoster> {
  const stored: StoredRoster = (await readStored()) ?? {
    generatedAt: Date.now(),
    teams: {},
    teamUpdatedAt: {},
  };
  stored.teamUpdatedAt ??= {};

  const pick = WC_NATIONS.filter((n) => codes.includes(n.code));
  if (pick.length === 0) return stored;

  const now = Date.now();
  let fdTeams: Awaited<ReturnType<typeof fetchWcTeams>> = [];
  try {
    fdTeams = await fetchWcTeams();
  } catch (e) {
    console.warn("[roster] fetchWcTeams failed:", e);
  }

  for (const n of pick) {
    let players: string[] = [];
    const fd = fdTeams.find((t) => tlaToCode(t.tla) === n.code);
    if (fd) {
      const squad = await fetchTeamSquad(fd.id);
      if (squad.length > 0) {
        players = squad.map((p) => p.name).slice(0, MAX_PLAYERS_PER_TEAM);
      }
    }
    if (players.length === 0 && process.env.API_FOOTBALL_KEY) {
      await sleep(400);
      const afId = await resolveNationalTeamId(nationName(n.code));
      if (afId) {
        const squad = await fetchNationalSquad(afId);
        if (squad.length > 0) {
          players = squad.map((p) => p.name).slice(0, MAX_PLAYERS_PER_TEAM);
        }
      }
    }
    if (players.length > 0) {
      stored.teams[n.code] = players;
      stored.teamUpdatedAt![n.code] = now;
    }
    await sleep(400);
  }

  stored.generatedAt = now;
  await writeStored(stored);
  squadCacheWarm = stored.teams;
  mem = { at: Date.now(), index: buildIndex(stored) };
  return stored;
}

/** Fetch squads for all WC nations from available APIs. */
export async function refreshRosters(): Promise<StoredRoster> {
  const teams: Record<string, string[]> = {};
  const teamUpdatedAt: Record<string, number> = {};
  const codesSeen = new Set<string>();
  const now = Date.now();

  const fdTeams = await fetchWcTeams();
  for (let i = 0; i < fdTeams.length; i++) {
    const t = fdTeams[i];
    const code = tlaToCode(t.tla);
    if (codesSeen.has(code)) continue;
    const squad = await fetchTeamSquad(t.id);
    if (squad.length > 0) {
      teams[code] = squad.map((p) => p.name).slice(0, MAX_PLAYERS_PER_TEAM);
      teamUpdatedAt[code] = now;
      codesSeen.add(code);
    }
    if ((i + 1) % 8 === 0) await sleep(650);
  }

  if (process.env.API_FOOTBALL_KEY) {
    for (const nation of WC_NATIONS) {
      if (codesSeen.has(nation.code)) continue;
      const afId = await resolveNationalTeamId(nationName(nation.code));
      if (!afId) continue;
      const squad = await fetchNationalSquad(afId);
      if (squad.length > 0) {
        teams[nation.code] = squad.map((p) => p.name).slice(0, MAX_PLAYERS_PER_TEAM);
        teamUpdatedAt[nation.code] = now;
        codesSeen.add(nation.code);
      }
      await sleep(300);
    }
  }

  const stored: StoredRoster = { generatedAt: now, teams, teamUpdatedAt };
  try {
    stored.valuations = await fetchTransfermarktValuations();
    if (Object.keys(stored.valuations).length > 0) valuationsCacheWarm = stored.valuations;
  } catch (e) {
    console.warn("[roster] valuation refresh failed:", e);
  }
  await writeStored(stored);
  mem = { at: Date.now(), index: buildIndex(stored) };
  try {
    revalidateTag(ROSTER_TAG, { expire: 0 });
  } catch {
    /* revalidateTag is cron-only; ignore in ephemeral runtimes */
  }
  return stored;
}

/** Fast index with nation aliases only — safe on every request path. */
export function staticRosterIndex(): RosterIndex {
  return buildIndex({ generatedAt: Date.now(), teams: {} });
}

async function loadRosterIndexInner(): Promise<RosterIndex> {
  const stored = await readStored();
  if (stored && Object.keys(stored.teams).length > 0) {
    return buildIndex(stored);
  }
  // Never hit football APIs here — cron pre-warms rosters; requests stay fast.
  return staticRosterIndex();
}

const cachedRosterIndex = unstable_cache(loadRosterIndexInner, ["wc-roster-index-v2"], {
  revalidate: 86_400,
  tags: [ROSTER_TAG],
});

/** Bust Next.js data cache (call from daily cron). */
export async function revalidateRosterCache(): Promise<void> {
  try {
    revalidateTag(ROSTER_TAG, { expire: 0 });
  } catch {
    /* ignore outside Next request context */
  }
}

/** Stash used to seed Vercel Data Cache during cron (same invocation only). */
let cronSquads: Record<string, string[]> | null = null;
/** Fast per-instance read after cron or cache hit. */
let squadCacheWarm: Record<string, string[]> | null = null;
/** Fast per-instance read after cron or live fetch. */
let valuationsCacheWarm: Record<string, TeamValuation> | null = null;

async function squadCacheInner(): Promise<Record<string, string[]>> {
  if (cronSquads && Object.keys(cronSquads).length > 0) return cronSquads;
  const stored = await readStored();
  if (stored?.teams && Object.keys(stored.teams).length > 0) return stored.teams;
  return {};
}

const cachedSquadMap = unstable_cache(squadCacheInner, ["wc-squad-map"], {
  revalidate: 86_400,
  tags: [ROSTER_TAG],
});

const cachedValuations = unstable_cache(fetchTransfermarktValuations, ["wc-team-valuations-v1"], {
  revalidate: 7 * 86_400,
  tags: [ROSTER_TAG],
});

async function loadValuations(stored: StoredRoster | null): Promise<Record<string, TeamValuation>> {
  if (valuationsCacheWarm && Object.keys(valuationsCacheWarm).length > 0) {
    return valuationsCacheWarm;
  }
  if (stored?.valuations && Object.keys(stored.valuations).length > 0) {
    valuationsCacheWarm = stored.valuations;
    return stored.valuations;
  }
  try {
    const fresh = await cachedValuations();
    if (Object.keys(fresh).length > 0) {
      valuationsCacheWarm = fresh;
      if (stored) {
        stored.valuations = fresh;
        await writeStored(stored);
      }
      return fresh;
    }
  } catch (e) {
    console.warn("[roster] valuation fetch failed:", e);
  }
  if (Object.keys(VALUATIONS_FALLBACK).length > 0) return VALUATIONS_FALLBACK;
  return stored?.valuations ?? {};
}

/** Squad lists — Vercel Data Cache (24h). Never fetches live APIs on request path. */
export async function getCachedSquads(): Promise<Record<string, string[]>> {
  if (squadCacheWarm && Object.keys(squadCacheWarm).length > 0) return squadCacheWarm;
  try {
    const teams = await cachedSquadMap();
    if (Object.keys(teams).length > 0) squadCacheWarm = teams;
    return teams;
  } catch (e) {
    console.warn("[roster] squad cache read failed:", e);
    try {
      const stored = await readStored();
      if (stored?.teams && Object.keys(stored.teams).length > 0) {
        squadCacheWarm = stored.teams;
        return stored.teams;
      }
    } catch {
      /* ignore */
    }
    return {};
  }
}

/** Team context for market pages — roster + Transfermarkt squad valuation. */
export async function getCachedTeamContexts(): Promise<Record<string, TeamContext>> {
  const squads = await getCachedSquads();
  let stored: StoredRoster | null = null;
  try {
    stored = await readStored();
  } catch {
    stored = null;
  }

  const valuations = await loadValuations(stored);
  const codes = new Set([...Object.keys(squads), ...Object.keys(valuations)]);
  const out: Record<string, TeamContext> = {};
  for (const code of codes) {
    out[code] = {
      code,
      players: squads[code] ?? [],
      generatedAt: stored?.generatedAt,
      valuation: valuations[code],
    };
  }
  return out;
}

/** Full squad refresh — cron only (can take minutes). */
export async function warmSquadCache(): Promise<Record<string, string[]>> {
  if (!process.env.FOOTBALL_DATA_API_KEY && !process.env.API_FOOTBALL_KEY) return {};

  const teams: Record<string, string[]> = {};
  const fdTeams = await fetchWcTeams();
  for (let i = 0; i < fdTeams.length; i++) {
    const t = fdTeams[i];
    const code = tlaToCode(t.tla);
    const squad = await fetchTeamSquad(t.id);
    if (squad.length > 0) {
      teams[code] = squad.map((p) => p.name).slice(0, MAX_PLAYERS_PER_TEAM);
    }
    if ((i + 1) % 8 === 0) await sleep(650);
  }

  cronSquads = teams;
  squadCacheWarm = teams;
  let valuations: Record<string, TeamValuation> | undefined;
  try {
    valuations = await fetchTransfermarktValuations();
    if (valuations && Object.keys(valuations).length > 0) valuationsCacheWarm = valuations;
  } catch (e) {
    console.warn("[roster] valuation refresh failed:", e);
    if (Object.keys(VALUATIONS_FALLBACK).length > 0) valuations = VALUATIONS_FALLBACK;
  }
  await writeStored({ generatedAt: Date.now(), teams, teamUpdatedAt: {}, valuations });
  await revalidateRosterCache();
  return await cachedSquadMap();
}

/** Load roster index — player data pre-warmed by cron; requests never block on APIs. */
export async function getRosterIndex(force = false): Promise<RosterIndex> {
  if (!force && mem && Date.now() - mem.at < 60_000) return mem.index;

  try {
    const index = force ? await loadRosterIndexInner() : await cachedRosterIndex();
    mem = { at: Date.now(), index };
    return index;
  } catch (e) {
    console.warn("[roster] index load failed, using static aliases:", e);
    const index = staticRosterIndex();
    mem = { at: Date.now(), index };
    return index;
  }
}
