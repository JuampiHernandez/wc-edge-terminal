// Single aggregation endpoint for the terminal.
// Fetches every tracked World Cup event + all real signal sources in parallel,
// links signals to markets, and returns one payload the client polls.

import { NextResponse } from "next/server";
import { fetchEvents } from "@/lib/polymarket";
import { fetchNewsSignals } from "@/lib/news";
import { fetchVenueWeather, weatherSignals } from "@/lib/weather";
import { lineMoveSignals } from "@/lib/signals";
import { fetchFootballSignals } from "@/lib/football-signals";
import { ALL_WC_EVENT_SLUGS } from "@/lib/worldcup";
import type { MarketEvent, Signal } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Source = { id: string; ok: boolean; note?: string };

export async function GET() {
  const slugs = ALL_WC_EVENT_SLUGS.map((e) => e.slug);
  const sources: Source[] = [];

  const [eventsR, newsR, weatherR, footballR] = await Promise.allSettled([
    fetchEvents(slugs),
    fetchNewsSignals(),
    fetchVenueWeather(),
    fetchFootballSignals(),
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

  // News
  if (newsR.status === "fulfilled") {
    signals.push(...newsR.value.signals);
    sources.push({
      id: "news-rss",
      ok: newsR.value.ok.length > 0,
      note: `feeds ok: ${newsR.value.ok.join(", ") || "none"}`,
    });
  } else {
    sources.push({ id: "news-rss", ok: false });
  }

  // Weather
  if (weatherR.status === "fulfilled") {
    const ws = weatherSignals(weatherR.value);
    signals.push(...ws);
    sources.push({ id: "weather", ok: true, note: `${ws.length} venue alerts` });
  } else {
    sources.push({ id: "weather", ok: false });
  }

  // Football-data.org + API-Football
  if (footballR.status === "fulfilled") {
    signals.push(...footballR.value.signals);
    sources.push({
      id: "football-api",
      ok: footballR.value.ok,
      note: footballR.value.note,
    });
  } else {
    sources.push({ id: "football-api", ok: false, note: "fetch failed" });
  }

  signals.sort((a, b) => b.t - a.t);

  return NextResponse.json(
    { events, signals, sources, generatedAt: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
