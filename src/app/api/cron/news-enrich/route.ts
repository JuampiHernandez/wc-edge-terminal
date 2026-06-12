// LLM digestion cron — enriches stored headlines missing `context`.
//   npm run research:enrich
//   npm run cron:news-enrich

import { NextResponse } from "next/server";
import { runNewsEnrichmentJob } from "@/lib/news-enrich-job";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(1200, Math.max(1, Number(url.searchParams.get("limit")) || 1200));

  try {
    const result = await runNewsEnrichmentJob({
      limit,
      onProgress: (msg) => console.log(`[cron/news-enrich] ${msg}`),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
