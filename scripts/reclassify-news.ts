/**
 * Re-run classification + team tagging over stored news signals.
 * Run after changing the classifier or tagging rules:
 *   npm run research:reclassify
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { reclassifyStoredNews } from "../src/lib/news-reclassify";

reclassifyStoredNews((msg) => process.stdout.write(`${msg}\n`))
  .then((result) => {
    console.log("\n--- Reclassification complete ---");
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.errors.length === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
