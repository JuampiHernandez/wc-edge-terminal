// Supabase persistence for deep news research results.

import { createAdminClient, createReaderClient } from "@/lib/supabase/admin";
import type { PriceImpact, Signal, SignalKind, SignalSeverity } from "@/lib/types";

export const NEWS_DISPLAY_MAX_AGE_MS = 7 * 86_400_000;
export const NEWS_RESEARCH_WINDOW_MS = 24 * 3_600_000;

type SignalRow = {
  id: string;
  published_at: string;
  detected_at: string;
  kind: string;
  severity: number;
  confidence: number;
  headline: string;
  context: string | null;
  context_en: string | null;
  context_es: string | null;
  detail: string | null;
  source: string;
  url: string | null;
  team_codes: string[];
  players: string[];
  market_slugs: string[];
  price_impact: PriceImpact | null;
  is_global: boolean | null;
  research_run_id: string | null;
};

/** Kinds dropped from the product — old rows may linger until the cleanup migration runs. */
const REMOVED_KINDS = new Set(["lineup", "fatigue"]);

type ResearchRunRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  nations_scanned: number;
  signals_found: number;
  signals_stored: number;
  errors: string[];
  note: string | null;
};

function rowToSignal(row: SignalRow): Signal {
  return {
    id: row.id,
    t: new Date(row.published_at).getTime(),
    kind: row.kind as SignalKind,
    severity: row.severity as SignalSeverity,
    confidence: row.confidence,
    headline: row.headline,
    context: row.context_en ?? row.context ?? undefined,
    contextEn: row.context_en ?? row.context ?? undefined,
    detail: row.detail ?? undefined,
    source: row.source,
    url: row.url ?? undefined,
    entities: {
      teams: row.team_codes.length > 0 ? row.team_codes : undefined,
      players: row.players.length > 0 ? row.players : undefined,
    },
    marketSlugs: row.market_slugs,
    priceImpact: row.price_impact ?? undefined,
    global: row.is_global ?? undefined,
  };
}

function signalToRow(signal: Signal, runId?: string): Omit<SignalRow, "detected_at" | "created_at"> {
  return {
    id: signal.id,
    published_at: new Date(signal.t).toISOString(),
    kind: signal.kind,
    severity: signal.severity,
    confidence: signal.confidence,
    headline: signal.headline,
    context: signal.context ?? signal.contextEn ?? null,
    context_en: signal.context ?? signal.contextEn ?? null,
    context_es: null,
    detail: signal.detail ?? null,
    source: signal.source,
    url: signal.url ?? null,
    team_codes: signal.entities.teams ?? [],
    players: signal.entities.players ?? [],
    market_slugs: signal.marketSlugs,
    price_impact: signal.priceImpact ?? null,
    is_global: signal.global ?? false,
    research_run_id: runId ?? null,
  };
}

export async function createResearchRun(): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("news_research_runs")
    .insert({})
    .select("id")
    .single();
  if (error) {
    console.warn("[news-store] create run failed:", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

export async function completeResearchRun(
  runId: string,
  stats: {
    nationsScanned: number;
    signalsFound: number;
    signalsStored: number;
    errors: string[];
    note?: string;
  },
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin
    .from("news_research_runs")
    .update({
      completed_at: new Date().toISOString(),
      nations_scanned: stats.nationsScanned,
      signals_found: stats.signalsFound,
      signals_stored: stats.signalsStored,
      errors: stats.errors,
      note: stats.note ?? null,
    })
    .eq("id", runId);
}

export async function upsertSignals(signals: Signal[], runId?: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin || signals.length === 0) return 0;

  const rows = dedupeRowsForStore(signals.map((s) => signalToRow(s, runId)));
  const chunkSize = 100;
  let stored = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from("team_news_signals").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.warn("[news-store] upsert chunk failed:", error.message);
      continue;
    }
    stored += chunk.length;
  }
  return stored;
}

function dedupeRowsForStore(
  rows: Omit<SignalRow, "detected_at" | "created_at">[],
): Omit<SignalRow, "detected_at" | "created_at">[] {
  const seenUrl = new Set<string>();
  const seenId = new Set<string>();
  return rows.filter((r) => {
    if (seenId.has(r.id)) return false;
    seenId.add(r.id);
    if (r.url) {
      const u = r.url.toLowerCase();
      if (seenUrl.has(u)) return false;
      seenUrl.add(u);
    }
    return true;
  });
}

/** News rows for LLM summary (`context` null, or all news when `force`). */
export async function loadSignalsNeedingEnrichment(
  maxAgeMs = NEWS_DISPLAY_MAX_AGE_MS,
  limit = 1200,
  force = false,
): Promise<Signal[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  let query = admin
    .from("team_news_signals")
    .select("*")
    .eq("kind", "news")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!force) {
    query = query.is("context_en", null);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[news-store] load pending enrichment failed:", error.message);
    return [];
  }

  return (data as SignalRow[]).map(rowToSignal);
}

export async function loadStoredNewsSignals(maxAgeMs = NEWS_DISPLAY_MAX_AGE_MS): Promise<Signal[]> {
  const admin = createReaderClient();
  if (!admin) return [];

  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const { data, error } = await admin
    .from("team_news_signals")
    .select("*")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.warn("[news-store] load failed:", error.message);
    return [];
  }

  return (data as SignalRow[]).filter((r) => !REMOVED_KINDS.has(r.kind)).map(rowToSignal);
}

export async function pruneOldSignals(keepDays = 14): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
  await admin.from("team_news_signals").delete().lt("published_at", cutoff);
}

export async function getLatestResearchRun(): Promise<ResearchRunRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("news_research_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as ResearchRunRow;
}
