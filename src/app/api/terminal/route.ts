// Single aggregation endpoint for the terminal.
// Fetches every tracked World Cup event + all real signal sources in parallel,
// links signals to markets, and returns one payload the client polls.

import { NextResponse } from "next/server";
import { fetchEvents } from "@/lib/polymarket";
import { fetchNewsSignals, readNewsSnapshot } from "@/lib/news";
import { loadStoredNewsSignals } from "@/lib/news-store";
import { fetchVenueWeather, weatherSignals } from "@/lib/weather";
import { lineMoveSignals } from "@/lib/signals";
import { fetchFootballSignals, teamsByVenueFromFixtures } from "@/lib/football-signals";
import { ALL_WC_EVENT_SLUGS } from "@/lib/worldcup";
import { getCachedTeamContexts } from "@/lib/roster";
import type { MarketEvent, Signal, TeamContext } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Source = { id: string; ok: boolean; note?: string };
type TerminalPayload = {
  events: MarketEvent[];
  signals: Signal[];
  sources: Source[];
  teams: Record<string, TeamContext>;
  generatedAt: number;
};

const TERMINAL_TTL_MS = 30_000;
let terminalCache: { at: number; payload: TerminalPayload } | null = null;
let terminalInFlight: Promise<TerminalPayload> | null = null;

/** When Polymarket Gamma is unreachable locally, borrow events from prod (dev only). */
async function loadEvents(slugs: string[]): Promise<{ events: MarketEvent[]; note: string; ok: boolean }> {
  const direct = await fetchEvents(slugs);
  if (direct.length > 0) {
    return { events: direct, note: `${direct.length} events`, ok: true };
  }

  const fallbackUrl =
    process.env.TERMINAL_EVENTS_FALLBACK_URL ??
    (process.env.NODE_ENV === "development" ? "https://worldcupterminal.xyz/api/terminal" : undefined);
  if (!fallbackUrl) return { events: [], note: "0 events", ok: false };

  try {
    const res = await fetch(fallbackUrl, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return { events: [], note: "0 events", ok: false };
    const data = (await res.json()) as TerminalPayload;
    if (data.events?.length) {
      return {
        events: data.events,
        note: `${data.events.length} events · dev fallback`,
        ok: true,
      };
    }
  } catch (e) {
    console.warn("[terminal] events fallback failed:", e);
  }
  return { events: [], note: "0 events", ok: false };
}

async function buildTerminalPayload(): Promise<TerminalPayload> {
  const sources: Source[] = [];

  const [eventsR, storedNewsR, weatherR, footballR, teamsR] = await Promise.allSettled([
    loadEvents(ALL_WC_EVENT_SLUGS.map((e) => e.slug)),
    loadStoredNewsSignals(),
    fetchVenueWeather(),
    fetchFootballSignals(),
    getCachedTeamContexts(),
  ]);

  const events: MarketEvent[] =
    eventsR.status === "fulfilled" ? eventsR.value.events : [];
  sources.push({
    id: "polymarket-markets",
    ok: eventsR.status === "fulfilled" && eventsR.value.ok,
    note: eventsR.status === "fulfilled" ? eventsR.value.note : "fetch failed",
  });

  const signals: Signal[] = [];

  // Line moves (derived from the markets we already fetch)
  const lm = lineMoveSignals(events);
  signals.push(...lm);
  sources.push({ id: "line-moves", ok: true, note: `${lm.length} moves` });

  // News — primary: Supabase (daily deep research). Fallback: live RSS/API snapshot.
  if (storedNewsR.status === "fulfilled" && storedNewsR.value.length > 0) {
    const newsSignals = storedNewsR.value;
    const enriched = newsSignals.filter((s) => s.kind === "news" && (s.context || s.contextEn)).length;
    signals.push(...newsSignals);
    sources.push({
      id: "news",
      ok: true,
      note: `${newsSignals.length} from supabase · ${enriched} enriched`,
    });
  } else {
    try {
      const newsR = await readNewsSnapshot().then((cached) => cached ?? fetchNewsSignals());
      const newsSignals = newsR.signals;
      const enriched = newsSignals.filter((s) => s.kind === "news" && (s.context || s.contextEn)).length;
      signals.push(...newsSignals);
      const apiNote = newsR.apiOk?.length ? ` · api: ${newsR.apiOk.join(",")}` : "";
      sources.push({
        id: "news",
        ok: newsR.ok.length > 0 || (newsR.apiOk?.length ?? 0) > 0,
        note: `live fallback · ${newsR.ok.length} rss${apiNote} · ${newsSignals.length} stories · ${enriched} enriched · ${newsR.rosterNote ?? ""}`,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      sources.push({ id: "news", ok: false, note: err.slice(0, 120) });
    }
  }

  // Football-data.org + API-Football (before weather — fixtures tag teams to venues)
  let teamsByVenue: Record<string, string[]> = {};
  if (footballR.status === "fulfilled") {
    signals.push(...footballR.value.signals);
    teamsByVenue = teamsByVenueFromFixtures(footballR.value.matches);
    sources.push({
      id: "football-api",
      ok: footballR.value.ok,
      note: footballR.value.note,
    });
  } else {
    sources.push({ id: "football-api", ok: false, note: "fetch failed" });
  }

  // Weather — linked only to nations with upcoming fixtures at each venue.
  if (weatherR.status === "fulfilled") {
    const ws = weatherSignals(weatherR.value, teamsByVenue);
    signals.push(...ws);
    sources.push({ id: "weather", ok: true, note: `${ws.length} venue alerts` });
  } else {
    sources.push({ id: "weather", ok: false });
  }

  signals.sort((a, b) => b.t - a.t);

  const teams: Record<string, TeamContext> = teamsR.status === "fulfilled" ? teamsR.value : {};

  return { events, signals, sources, teams, generatedAt: Date.now() };
}

async function getTerminalPayload(): Promise<TerminalPayload> {
  const now = Date.now();
  if (terminalCache && now - terminalCache.at < TERMINAL_TTL_MS) return terminalCache.payload;
  if (terminalInFlight) return terminalInFlight;

  terminalInFlight = buildTerminalPayload()
    .then((payload) => {
      terminalCache = { at: Date.now(), payload };
      return payload;
    })
    .finally(() => {
      terminalInFlight = null;
    });
  return terminalInFlight;
}

export async function GET() {
  const payload = await getTerminalPayload();
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
