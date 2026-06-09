// Daily email digest — call via Vercel Cron or manual trigger.
// Requires RESEND_API_KEY + CRON_SECRET in env.

import { NextResponse } from "next/server";
import { listSubscribers } from "@/lib/subscribers";
import { nationName } from "@/lib/teams-list";
import { fetchNewsSignals } from "@/lib/news";

export const runtime = "nodejs";

function teamInHeadline(headline: string, code: string, name: string): boolean {
  const h = headline.toLowerCase();
  return h.includes(name.toLowerCase()) || h.includes(code.toLowerCase());
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL ?? "digest@wc-edge.local";
  const subs = await listSubscribers();
  if (subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "no subscribers" });
  }

  const { signals } = await fetchNewsSignals();
  let sent = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    const items = signals.filter((s) =>
      sub.teams.some((code) => teamInHeadline(s.headline, code, nationName(code))),
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
    errors,
  });
}
