// LLM digestion job — reads undigested news from Supabase, writes `context` back.

import { enrichNewsContexts, hasNewsEnrichmentConfig } from "./news-enrichment";
import { loadSignalsNeedingEnrichment, upsertSignals } from "./news-store";

export type NewsEnrichJobResult = {
  pending: number;
  attempted: number;
  enriched: number;
  stored: number;
  skipped: boolean;
  durationMs: number;
  note: string;
};

export type NewsEnrichJobOptions = {
  limit?: number;
  /** Re-summarize headlines that already have a digest (e.g. after prompt change). */
  force?: boolean;
  onProgress?: (message: string) => void;
};

export async function runNewsEnrichmentJob(options?: NewsEnrichJobOptions): Promise<NewsEnrichJobResult> {
  const start = Date.now();
  const log = (msg: string) => {
    options?.onProgress?.(msg);
    console.log(`[news-enrich] ${msg}`);
  };

  if (!hasNewsEnrichmentConfig()) {
    throw new Error(
      "LLM not configured — set AI_GATEWAY_API_KEY (recommended) or OPENAI_API_KEY in .env.local",
    );
  }

  const force = options?.force ?? process.env.FORCE === "1";
  const limit = options?.limit ?? (Number(process.env.AI_NEWS_ENRICH_LIMIT) || 1200);
  const pending = await loadSignalsNeedingEnrichment(undefined, limit, force);

  log(
    `${pending.length} headlines to summarize${force ? " (force re-run)" : ""} (limit ${limit})`,
  );

  if (pending.length === 0) {
    return {
      pending: 0,
      attempted: 0,
      enriched: 0,
      stored: 0,
      skipped: false,
      durationMs: Date.now() - start,
      note: "nothing to enrich — run npm run research:news first",
    };
  }

  log("writing short headline summaries…");
  const result = await enrichNewsContexts(pending, limit, { force });
  const digested = result.signals.filter((s) => s.context || s.contextEn);
  const stored = await upsertSignals(digested);

  const durationMs = Date.now() - start;
  const note = `${result.enriched} digested · ${stored} saved to supabase · ${durationMs}ms`;
  log(note);

  return {
    pending: pending.length,
    attempted: result.attempted,
    enriched: result.enriched,
    stored,
    skipped: result.skipped,
    durationMs,
    note,
  };
}
