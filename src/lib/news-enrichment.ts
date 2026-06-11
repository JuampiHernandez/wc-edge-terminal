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
    // .data is best-effort on serverless; Vercel deployments should use a DB for durable cache.
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

function candidates(signals: Signal[]): Signal[] {
  return signals.filter(
    (s) =>
      s.kind === "news" &&
      !s.context,
  );
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
      temperature: 0.2,
      max_tokens: 90,
      messages: [
        {
          role: "system",
          content:
            "Eres analista de mercados predictivos del Mundial. Explica en español, en una frase breve, por qué esta noticia puede afectar a las selecciones mencionadas o al mercado general del Mundial. No inventes datos fuera del titular.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: signal.headline,
            teams: signal.entities.teams ?? [],
            players: signal.entities.players ?? [],
            kind: signal.kind,
          }),
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
  return text ? text.replace(/^["“]|["”]$/g, "") : null;
}

export async function attachCachedNewsContexts(signals: Signal[]): Promise<Signal[]> {
  const cache = await readCache();
  const cutoff = Date.now() - NEWS_MAX_AGE_MS;
  return signals.map((s) => {
    const cached = cache.items[cacheKey(s)];
    if (!cached || cached.createdAt < cutoff) return s;
    return { ...s, context: cached.context };
  });
}

export async function enrichNewsContexts(
  signals: Signal[],
  limit = 120,
): Promise<{ attempted: number; enriched: number; skipped: boolean }> {
  const client = configuredClient();
  if (!client) return { attempted: 0, enriched: 0, skipped: true };

  const cache = await readCache();
  const cutoff = Date.now() - NEWS_MAX_AGE_MS;
  for (const [key, item] of Object.entries(cache.items)) {
    if (item.createdAt < cutoff) delete cache.items[key];
  }

  const todo = candidates(signals)
    .filter((s) => !cache.items[cacheKey(s)])
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
  return { attempted: todo.length, enriched, skipped: false };
}
