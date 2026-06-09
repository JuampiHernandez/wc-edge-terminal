// Daily cron — roster refresh (10 teams) + email digest.
// Vercel Hobby: one cron/day max. Keep a single entry in vercel.json.
// Requires CRON_SECRET in Vercel env (Vercel sends it as Authorization header).

import { NextResponse } from "next/server";
import { listSubscribers } from "@/lib/subscribers";
import { nationName } from "@/lib/teams-list";
import { fetchNewsSignals } from "@/lib/news";
import { refreshRostersBatch, buildIndex } from "@/lib/roster";

export const runtime = "nodejs";
export const maxDuration = 60;

function teamInHeadline(headline: string, code: string, name: string): boolean {
  const h = headline.toLowerCase();
  return h.includes(name.toLowerCase()) || h.includes(code.toLowerCase());
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. Incremental roster refresh (default 16 teams/day on Vercel; use ?teams=48 locally).
  const url = new URL(req.url);
  const teamLimit = Math.min(48, Math.max(1, Number(url.searchParams.get("teams")) || 16));
  let roster = { teams: 0, players: 0, ok: false as boolean, refreshed: teamLimit };
  if (process.env.FOOTBALL_DATA_API_KEY || process.env.API_FOOTBALL_KEY) {
    try {
      const stored = await refreshRostersBatch(teamLimit);
      const idx = buildIndex(stored);
      roster = { teams: idx.teamCount, players: idx.playerCount, ok: true, refreshed: teamLimit };
    } catch (e) {
      console.warn("[cron/digest] roster batch failed:", e);
    }
  }

  // 2. Email digest (optional — needs subscribers + Resend).
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL ?? "digest@wc-edge.local";
  const subs = await listSubscribers();

  if (subs.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      note: "no subscribers",
      roster,
    });
  }

  const { signals } = await fetchNewsSignals();
  let sent = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    const items = signals.filter((s) =>
      sub.teams.some(
        (code) =>
          s.entities.teams?.includes(code) ||
          teamInHeadline(s.headline, code, nationName(code)),
      ),
    );
    const lines =
      items.length > 0
        ? items.map((s) => `• ${s.headline} (${s.source})`).join("\n")
        : "No major headlines today for your teams.";

    const body = `World Cup Terminal — daily digest for ${sub.teams.map(nationName).join(", ")}\n\n${lines}\n\n— World Cup Terminal`;

    if (!resendKey) {
      console.log(`[digest] ${sub.email}:\n${body}`);
      sent++;
      continue;
    }

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: sub.email,
          subject: `World Cup Terminal · ${sub.teams.map(nationName).join(", ")} — daily update`,
          text: body,
        }),
      });
      if (r.ok) sent++;
      else errors.push(`${sub.email}: HTTP ${r.status}`);
    } catch (e) {
      errors.push(`${sub.email}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    subscribers: subs.length,
    resend: !!resendKey,
    roster,
    errors,
  });
}
