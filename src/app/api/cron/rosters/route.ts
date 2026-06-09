// Weekly roster refresh — pre-warm player index for news matching.
// Requires CRON_SECRET (same as digest cron).

import { NextResponse } from "next/server";
import { refreshRosters, buildIndex } from "@/lib/roster";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.FOOTBALL_DATA_API_KEY && !process.env.API_FOOTBALL_KEY) {
    return NextResponse.json({ ok: false, note: "no API keys configured" });
  }

  try {
    const stored = await refreshRosters();
    const index = buildIndex(stored);
    return NextResponse.json({
      ok: true,
      teams: index.teamCount,
      players: index.playerCount,
      generatedAt: stored.generatedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
