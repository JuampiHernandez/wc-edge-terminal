// Daily deep news research — scans every nation with team + player keywords (24h window),
// stores results in Supabase. Trigger via cron or locally:
//   npm run research:news
//   npm run cron:news-research

import { NextResponse } from "next/server";
import { runDeepNewsResearch } from "@/lib/news-research";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const nations = url.searchParams.get("nations")?.split(",").filter(Boolean);
  const enrich = url.searchParams.get("enrich") !== "0";

  try {
    const result = await runDeepNewsResearch({
      nations,
      enrich,
      refreshRosters: url.searchParams.get("refresh") !== "0",
      onProgress: (msg) => console.log(`[cron/news-research] ${msg}`),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
