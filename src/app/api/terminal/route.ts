// Single aggregation endpoint for the terminal.
// Fetches every tracked World Cup event + all real signal sources in parallel,
// links signals to markets, and returns one payload the client polls.

import { NextResponse } from "next/server";
import { fetchEvents } from "@/lib/polymarket";
import { fetchNewsSignals, readNewsSnapshot } from "@/lib/news";
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

async function buildTerminalPayload(): Promise<TerminalPayload> {
  const slugs = ALL_WC_EVENT_SLUGS.map((e) => e.slug);
  const sources: Source[] = [];

  const [eventsR, newsR, weatherR, footballR, teamsR] = await Promise.allSettled([
    fetchEvents(slugs),
    readNewsSnapshot().then((cached) => cached ?? fetchNewsSignals()),
    fetchVenueWeather(),
    fetchFootballSignals(),
    getCachedTeamContexts(),
  ]);

  const events: MarketEvent[] = eventsR.status === "fulfilled" ? eventsR.value : [];
  sources.push({
    id: "polymarket-markets",
    ok: eventsR.status === "fulfilled" && events.length > 0,
    note: `${events.length} events`,
  });

  const signals: Signal[] = [];

  // Line moves (derived from the markets we already fetch)
  const lm = lineMoveSignals(events);
  signals.push(...lm);
  sources.push({ id: "line-moves", ok: true, note: `${lm.length} moves` });

  // News (RSS + JSON APIs)
  if (newsR.status === "fulfilled") {
    const interpretedNews = newsR.value.signals.filter((s) => s.kind !== "news" || s.context);
    signals.push(...interpretedNews);
    const apiNote = newsR.value.apiOk?.length
      ? ` · api: ${newsR.value.apiOk.join(",")}`
      : "";
    sources.push({
      id: "news",
      ok: newsR.value.ok.length > 0 || (newsR.value.apiOk?.length ?? 0) > 0,
      note: `${newsR.value.ok.length} rss${apiNote} · ${interpretedNews.length}/${newsR.value.signals.length} interpreted · ${newsR.value.rosterNote ?? ""}`,
    });
  } else {
    const err = newsR.reason instanceof Error ? newsR.reason.message : String(newsR.reason);
    sources.push({ id: "news", ok: false, note: err.slice(0, 120) });
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
