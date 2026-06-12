/**
 * Full daily pipeline: collect news (24h) → LLM digestion → Supabase.
 *   npm run research:full
 */

import { runDeepNewsResearch } from "../src/lib/news-research";
import { runNewsEnrichmentJob } from "../src/lib/news-enrich-job";
import { hasNewsEnrichmentConfig } from "../src/lib/news-enrichment";

const log = (msg: string) => process.stdout.write(`${msg}\n`);

function nationsFromCli(): string[] | undefined {
  const raw = process.env.NATIONS ?? process.argv[2];
  if (!raw) return undefined;
  const codes = raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  return codes.length > 0 ? codes : undefined;
}

async function main() {
  const nations = nationsFromCli();
  if (nations) log(`nations filter: ${nations.join(", ")}`);

  log("=== Step 1/2: deep news research ===");
  const research = await runDeepNewsResearch({
    nations,
    enrich: false,
    refreshRosters: process.env.REFRESH !== "0",
    onProgress: log,
  });

  if (!hasNewsEnrichmentConfig()) {
    log("\nSkipping step 2 — no AI_GATEWAY_API_KEY or OPENAI_API_KEY");
    console.log(JSON.stringify({ research }, null, 2));
    process.exit(research.signalsStored > 0 ? 0 : 1);
  }

  log("\n=== Step 2/2: LLM digestion ===");
  const enrich = await runNewsEnrichmentJob({ onProgress: log });

  console.log("\n--- Full pipeline complete ---");
  console.log(JSON.stringify({ research, enrich }, null, 2));
  process.exit(research.signalsStored > 0 || enrich.enriched > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
