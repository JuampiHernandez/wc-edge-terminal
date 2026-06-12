// Re-run headline classification + team tagging over stored news signals.
//
// Needed whenever the classifier or tagging rules change: signals are
// classified at ingest time and persisted to Supabase, so old rows keep
// stale kinds / price impacts (e.g. "Türkiye returns to World Cup" once
// matched a loose "returns" regex and was stored as an injury-recovery
// signal with positive price impact).

import { createAdminClient } from "@/lib/supabase/admin";
import { deriveNewsFields } from "./news-build";
import { NEWS_FEEDS } from "./news-feeds";
import { getRosterIndex } from "./roster";
import { WC_NATIONS } from "./teams-list";
import type { PriceImpact } from "./types";

type StoredRow = {
  id: string;
  kind: string;
  severity: number;
  headline: string;
  team_codes: string[];
  players: string[];
  market_slugs: string[];
  price_impact: PriceImpact | null;
  is_global: boolean | null;
};

export type ReclassifyResult = {
  scanned: number;
  updated: number;
  impactsCleared: number;
  tagsChanged: number;
  markedGlobal: number;
  errors: string[];
};

const NATION_CODES = new Set(WC_NATIONS.map((n) => n.code));
const FEED_TEAM: Record<string, string> = Object.fromEntries(
  NEWS_FEEDS.filter((f) => f.teamCode).map((f) => [f.id, f.teamCode!]),
);

/**
 * Recover the forced team tag (and whether it's trustworthy) from a signal id.
 * Ids encode their source: `news_{feedId}_{hash}` (curated RSS → trusted),
 * `gdelt_JPN_{hash}` / `newsapi_JPN_{hash}` / `gnews_JPN_{hash}`
 * (nation keyword query → untrusted).
 */
export function provenanceFromId(id: string): { teamCode?: string; trusted?: boolean } {
  const rss = id.match(/^news_(.+)_[0-9a-z]+$/);
  if (rss) {
    const teamCode = FEED_TEAM[rss[1]];
    return teamCode ? { teamCode, trusted: true } : {};
  }
  const api = id.match(/^(?:gdelt|newsapi|gnews)_([A-Za-z]{3})_/);
  if (api) {
    const code = api[1].toUpperCase();
    if (NATION_CODES.has(code)) return { teamCode: code, trusted: false };
  }
  return {};
}

function sameArr(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
}

function sameImpact(a: PriceImpact | null, b: PriceImpact | null): boolean {
  if (!a && !b) return true;
  return a?.direction === b?.direction && a?.estPct === b?.estPct;
}

export async function reclassifyStoredNews(
  onProgress?: (msg: string) => void,
): Promise<ReclassifyResult> {
  const log = (msg: string) => {
    onProgress?.(msg);
    console.log(`[news-reclassify] ${msg}`);
  };

  const result: ReclassifyResult = {
    scanned: 0,
    updated: 0,
    impactsCleared: 0,
    tagsChanged: 0,
    markedGlobal: 0,
    errors: [],
  };

  const admin = createAdminClient();
  if (!admin) {
    result.errors.push("supabase admin client unavailable (check SUPABASE_SERVICE_ROLE_KEY)");
    return result;
  }

  const index = await getRosterIndex(true);
  if (index.playerCount === 0) {
    // Without rosters, player-confirmed team tags would be silently wiped.
    result.errors.push("roster index has no players — run roster refresh first");
    return result;
  }
  log(`roster index ready · ${index.playerCount} players · ${index.teamCount} squads`);

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("team_news_signals")
      .select("id, kind, severity, headline, team_codes, players, market_slugs, price_impact, is_global")
      .order("published_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) {
      result.errors.push(`load page ${from}: ${error.message}`);
      break;
    }
    const rows = (data ?? []) as StoredRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      result.scanned++;
      // Structured feeds (API-Football injuries) aren't headline-classified.
      if (row.id.startsWith("af_inj_")) continue;

      const prov = provenanceFromId(row.id);
      const keepKind = row.kind === "social_velocity" ? ("social_velocity" as const) : undefined;
      const d = deriveNewsFields(row.headline, index, {
        teamCode: prov.teamCode,
        teamCodeTrusted: prov.trusted,
        kind: keepKind,
      });

      const newImpact = d.priceImpact ?? null;
      const newGlobal = d.global ?? false;
      const changed =
        d.kind !== row.kind ||
        d.severity !== row.severity ||
        !sameArr(d.teams, row.team_codes) ||
        !sameArr(d.marketSlugs, row.market_slugs) ||
        !sameImpact(newImpact, row.price_impact) ||
        newGlobal !== (row.is_global ?? false);
      if (!changed) continue;

      if (row.price_impact && !newImpact) result.impactsCleared++;
      if (!sameArr(d.teams, row.team_codes)) result.tagsChanged++;
      if (newGlobal && !row.is_global) result.markedGlobal++;

      const { error: upErr } = await admin
        .from("team_news_signals")
        .update({
          kind: d.kind,
          severity: d.severity,
          team_codes: d.teams,
          players: d.players,
          market_slugs: d.marketSlugs,
          price_impact: newImpact,
          is_global: newGlobal,
        })
        .eq("id", row.id);
      if (upErr) {
        result.errors.push(`${row.id}: ${upErr.message}`);
        continue;
      }
      result.updated++;
    }
    log(`scanned ${result.scanned} · updated ${result.updated}`);
    if (rows.length < PAGE) break;
  }

  return result;
}
