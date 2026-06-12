// RSS feed registry — general wires + per-nation BBC/Guardian team pages.

import { WC_NATIONS } from "./teams-list";

export type RssFeed = {
  id: string;
  source: string;
  url: string;
  limit: number;
  /** Feed is already scoped (WC tag or single nation) — skip broad relevance filter. */
  scoped?: boolean;
  /** Auto-tag this nation on every item from the feed. */
  teamCode?: string;
};

/** BBC team slug overrides (lowercase nation name is the default). */
const BBC_TEAM_SLUG: Record<string, string> = {
  CIV: "ivory-coast",
  COD: "dr-congo",
  CZE: "czech-republic",
  CUW: "curacao",
  KOR: "south-korea",
  KSA: "saudi-arabia",
  NZL: "new-zealand",
  RSA: "south-africa",
  TUR: "turkey",
  BIH: "bosnia-herzegovina",
  USA: "usa",
};

function nationSlug(code: string, name: string): string {
  return BBC_TEAM_SLUG[code] ?? name.toLowerCase().replace(/\s+/g, "-").replace(/ü/g, "u");
}

function nationFeeds(): RssFeed[] {
  const feeds: RssFeed[] = [];
  for (const nation of WC_NATIONS) {
    const slug = nationSlug(nation.code, nation.name);
    feeds.push({
      id: `bbc-${slug}`,
      source: "BBC Sport",
      url: `https://feeds.bbci.co.uk/sport/football/teams/${slug}/rss.xml`,
      limit: 25,
      scoped: true,
      teamCode: nation.code,
    });
    feeds.push({
      id: `guardian-${slug}`,
      source: "Guardian",
      url: `https://www.theguardian.com/football/${slug}/rss`,
      limit: 18,
      scoped: true,
      teamCode: nation.code,
    });
  }
  return feeds;
}

const GENERAL_FEEDS: RssFeed[] = [
  { id: "espn-soccer", source: "ESPN", url: "https://www.espn.com/espn/rss/soccer/news", limit: 80 },
  { id: "bbc-football", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml", limit: 80 },
  {
    id: "guardian-wc",
    source: "Guardian",
    url: "https://www.theguardian.com/football/world-cup-2026/rss",
    limit: 80,
    scoped: true,
  },
  { id: "marca-futbol", source: "Marca", url: "https://www.marca.com/rss/futbol.xml", limit: 60 },
  { id: "guardian-football", source: "Guardian", url: "https://www.theguardian.com/football/rss", limit: 60 },
  { id: "sky-football", source: "Sky Sports", url: "https://www.skysports.com/rss/12040", limit: 60 },
  { id: "fourfourtwo", source: "FourFourTwo", url: "https://www.fourfourtwo.com/feeds/all", limit: 50 },
  {
    id: "independent-football",
    source: "Independent",
    url: "https://www.independent.co.uk/sport/football/rss",
    limit: 50,
  },
  { id: "cbs-soccer", source: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/soccer/", limit: 50 },
  { id: "sportsnet", source: "Sportsnet", url: "https://www.sportsnet.ca/feed/", limit: 40 },
  {
    id: "guardian-spain",
    source: "Guardian",
    url: "https://www.theguardian.com/football/spain/rss",
    limit: 40,
    scoped: true,
    teamCode: "ESP",
  },
];

export const NEWS_FEEDS: RssFeed[] = [...GENERAL_FEEDS, ...nationFeeds()];
