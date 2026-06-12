/**
 * Local daily news research — run every 24h with your machine online:
 *   npm run research:news
 *
 * Requires .env.local with Supabase service role + optional news API keys.
 */

import { runDeepNewsResearch } from "../src/lib/news-research";

function nationsFromCli(): string[] | undefined {
  const raw = process.env.NATIONS ?? process.argv[2];
  if (!raw) return undefined;
  const codes = raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  return codes.length > 0 ? codes : undefined;
}

runDeepNewsResearch({
  nations: nationsFromCli(),
  enrich: false,
  refreshRosters: process.env.REFRESH !== "0",
  onProgress: (msg) => process.stdout.write(`${msg}\n`),
})
  .then((result) => {
    console.log("\n--- Research complete ---");
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      console.warn("\nErrors:");
      result.errors.forEach((e) => console.warn(`  · ${e}`));
    }
    process.exit(result.signalsStored > 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
