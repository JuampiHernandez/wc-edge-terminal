import { promises as fs } from "fs";
import path from "path";
import type { Signal } from "./types";
import { hashId } from "./news-build";
import { NEWS_MAX_AGE_MS } from "./roster";

const FILE = path.join(process.cwd(), ".data", "news-enrichment.json");
const DEFAULT_GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";

type CachedItem = {
  headline: string;
  context: string;
  createdAt: number;
};

type CacheFile = {
  generatedAt: number;
  items: Record<string, CachedItem>;
};

type ChatResponse = {
  choices?: { message?: { content?: string } }[];
};

function cacheKey(signal: Signal): string {
  return hashId(signal.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
}

async function readCache(): Promise<CacheFile> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    return { generatedAt: parsed.generatedAt ?? 0, items: parsed.items ?? {} };
  } catch {
    return { generatedAt: 0, items: {} };
  }
}

async function writeCache(cache: CacheFile): Promise<void> {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
  } catch {
    // .data is best-effort on serverless; Supabase is the durable store.
  }
}

function configuredClient(): { apiKey: string; baseUrl: string; model: string } | null {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    return {
      apiKey: gatewayKey,
      baseUrl: process.env.AI_GATEWAY_BASE_URL ?? DEFAULT_GATEWAY_BASE,
      model: process.env.AI_NEWS_MODEL ?? "openai/gpt-4o-mini",
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE,
      model: process.env.AI_NEWS_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  return null;
}

export function hasNewsEnrichmentConfig(): boolean {
  return configuredClient() !== null;
}

/** Headlines we send to the LLM for a short summary title. */
export function enrichmentCandidates(signals: Signal[], force = false): Signal[] {
  if (force) return signals.filter((s) => s.kind === "news");
  return signals.filter((s) => s.kind === "news" && !s.context && !s.contextEn);
}

function cleanSummary(text: string): string {
  let s = text.replace(/^["“]|["”]$/g, "").trim();
  s = s.replace(/^the headline suggests that\s+/i, "");
  s = s.replace(/^the report that\s+/i, "");
  s = s.replace(/^this headline suggests that\s+/i, "");
  return s;
}

async function interpret(signal: Signal): Promise<string | null> {
  const client = configuredClient();
  if (!client) return null;

  const res = await fetch(`${client.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${client.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: client.model,
      temperature: 0.1,
      max_tokens: 48,
      messages: [
        {
          role: "system",
          content:
            "You write short news headline summaries for a sports terminal. " +
            "Given a headline, output ONE concise headline-style line (max 12 words) stating what happened. " +
            "Always write the summary in English, even when the headline is in another language. " +
            "Name the players or team when relevant. " +
            "No market analysis, no betting odds, no speculation, no phrases like 'the headline suggests'. " +
            "Do not invent facts beyond the headline.",
        },
        {
          role: "user",
          content: signal.headline,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`news enrichment HTTP ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = (await res.json()) as ChatResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  return text ? cleanSummary(text) : null;
}

function withContext(signal: Signal, context: string): Signal {
  return { ...signal, context, contextEn: context };
}

export async function attachCachedNewsContexts(signals: Signal[]): Promise<Signal[]> {
  const cache = await readCache();
  const cutoff = Date.now() - NEWS_MAX_AGE_MS;
  return signals.map((s) => {
    const cached = cache.items[cacheKey(s)];
    if (!cached || cached.createdAt < cutoff) return s;
    return withContext(s, cached.context);
  });
}

function defaultEnrichLimit(): number {
  const fromEnv = Number(process.env.AI_NEWS_ENRICH_LIMIT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.min(1200, fromEnv);
  return 1200;
}

export type EnrichNewsResult = {
  attempted: number;
  enriched: number;
  skipped: boolean;
  signals: Signal[];
};

/** LLM summary — one short headline per article. */
export async function enrichNewsContexts(
  signals: Signal[],
  limit = defaultEnrichLimit(),
  options?: { force?: boolean },
): Promise<EnrichNewsResult> {
  const client = configuredClient();
  if (!client) return { attempted: 0, enriched: 0, skipped: true, signals };

  const force = options?.force ?? false;
  const cache = await readCache();
  const cutoff = Date.now() - NEWS_MAX_AGE_MS;
  for (const [key, item] of Object.entries(cache.items)) {
    if (item.createdAt < cutoff) delete cache.items[key];
  }

  const todo = enrichmentCandidates(signals, force)
    .filter((s) => force || !cache.items[cacheKey(s)])
    .slice(0, limit);

  let enriched = 0;
  for (const signal of todo) {
    try {
      const context = await interpret(signal);
      if (!context) continue;
      cache.items[cacheKey(signal)] = {
        headline: signal.headline,
        context,
        createdAt: Date.now(),
      };
      enriched++;
    } catch (e) {
      console.warn("[news-enrichment] failed:", e);
    }
  }

  cache.generatedAt = Date.now();
  await writeCache(cache);

  const withContextSignals = signals.map((s) => {
    const cached = cache.items[cacheKey(s)];
    if (!cached || cached.createdAt < cutoff) return s;
    return withContext(s, cached.context);
  });

  return { attempted: todo.length, enriched, skipped: false, signals: withContextSignals };
}
