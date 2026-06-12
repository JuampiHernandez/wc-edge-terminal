/**
 * LLM summary — short headline per stored article.
 * Re-run all: FORCE=1 npm run research:enrich
 * Run after news research:
 *   npm run research:enrich
 *
 * Requires AI_GATEWAY_API_KEY or OPENAI_API_KEY in .env.local
 */

import { runNewsEnrichmentJob } from "../src/lib/news-enrich-job";

runNewsEnrichmentJob({
  force: process.env.FORCE === "1",
  onProgress: (msg) => process.stdout.write(`${msg}\n`),
})
  .then((result) => {
    console.log("\n--- Enrichment complete ---");
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.enriched > 0 || result.pending === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
