// Squad market values from Transfermarkt's WC participants table.
// Cached via roster cron + Next.js unstable_cache — never fetched on hot paths per team.

import { WC_NATIONS } from "./teams-list";
import { resolveTeam } from "./worldcup";
import type { TeamValuation } from "./types";

const TM_WC_URL = "https://www.transfermarkt.co.uk/wm/teilnehmer/pokalwettbewerb/FIWC";
const ROW_RE =
  /<a title="([^"]+)" href="\/[^"]+\/startseite\/verein\/\d+">[^<]+<\/a><\/td><td class="zentriert">\d+<\/td><td class="zentriert">[^<]+<\/td><td class="zentriert">[^<]+<\/td><td class="zentriert">[^<]+<\/td><td class="rechts">(€[^<]+)<\/td>/g;

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const NAME_TO_CODE = new Map<string, string>();
for (const nation of WC_NATIONS) NAME_TO_CODE.set(norm(nation.name), nation.code);
NAME_TO_CODE.set(norm("Democratic Republic of the Congo"), "COD");
NAME_TO_CODE.set(norm("United States"), "USA");
NAME_TO_CODE.set(norm("Turkiye"), "TUR");

function codeForName(name: string): string | null {
  const hit = NAME_TO_CODE.get(norm(name));
  if (hit) return hit;
  return resolveTeam(name)?.code ?? null;
}

/** Parse Transfermarkt currency strings like "€1.52bn" or "€947.00m". */
export function parseTransfermarktEur(raw: string): number | null {
  const s = raw.replace(/[€,\s]/g, "").trim().toLowerCase();
  const m = s.match(/^([\d.]+)(bn|m|k)?$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === "bn") return Math.round(n * 1_000_000_000);
  if (m[2] === "m") return Math.round(n * 1_000_000);
  if (m[2] === "k") return Math.round(n * 1_000);
  return Math.round(n);
}

export function parseTransfermarktValuations(html: string): Record<string, TeamValuation> {
  const out: Record<string, TeamValuation> = {};
  const now = Date.now();
  for (const match of html.matchAll(ROW_RE)) {
    const name = match[1];
    const totalEur = parseTransfermarktEur(match[2]);
    const code = codeForName(name);
    if (!code || !totalEur) continue;
    out[code] = { totalEur, source: "Transfermarkt", updatedAt: now };
  }
  return out;
}

/** Fetch squad valuations for WC nations from Transfermarkt. */
export async function fetchTransfermarktValuations(): Promise<Record<string, TeamValuation>> {
  const res = await fetch(TM_WC_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "wc-edge-terminal/1.0 (+https://worldcupterminal.xyz)",
    },
    next: { revalidate: 7 * 86_400 },
  });
  if (!res.ok) throw new Error(`Transfermarkt HTTP ${res.status}`);
  const html = await res.text();
  const valuations = parseTransfermarktValuations(html);
  if (Object.keys(valuations).length < 20) {
    throw new Error(`Transfermarkt parse yielded ${Object.keys(valuations).length} teams`);
  }
  return valuations;
}
