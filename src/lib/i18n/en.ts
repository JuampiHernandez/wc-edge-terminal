import type { SignalKind } from "@/lib/types";

export type Messages = {
  meta: { title: string; description: string };
  header: { calendar: string; signUp: string; signOut: string; live: string; offline: string };
  theme: { dark: string; light: string; switchToDark: string; switchToLight: string };
  locale: { en: string; es: string; switchToEn: string; switchToEs: string };
  leftPanel: { markets: string; follow: string };
  marketList: { searchPlaceholder: string; allEvents: (n: number) => string; noMarkets: string };
  marketDetail: {
    selectMarket: string;
    market: string;
    fair: string;
    edge: string;
    marketPct: (pct: number) => string;
    fairPct: (pct: number) => string;
    vol: string;
    liq: string;
    change24h: string;
    relatedInfo: string;
    relatedSubtitle: (count: number) => string;
    noLinked: string;
    groups: { availability: string; schedule: string; conditions: string; news: string };
  };
  signalFeed: {
    title: string;
    subtitle: string;
    live: string;
    all: string;
    priority: string;
    priorityAll: string;
    priorityNotable: string;
    priorityHigh: string;
    notable: string;
    high: string;
    noMatch: string;
    tryLowering: string;
    ago: string;
    highBadge: string;
  };
  mispricing: { title: string; subtitle: string; empty: string };
  teamFollow: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    teamsSelected: (n: number) => string;
    enableDigest: string;
    saving: string;
    signUpForDigest: string;
    selectTeam: string;
    digestEnabled: (digest: string) => string;
  };
  calendar: {
    title: string;
    subtitle: string;
    allMatches: string;
    myTeams: string;
    tapHint: string;
    pickCountry: string;
    countriesSelected: (n: number) => string;
    addGoogle: string;
    subscribe: string;
    timezoneNote: string;
    matches: string;
    teams: string;
    kickoff: string;
    backToTerminal: string;
  };
  time: { now: string };
  signalKinds: Record<SignalKind, string>;
};

export const en: Messages = {
  meta: {
    title: "WC Edge Terminal",
    description:
      "The information edge for 2026 World Cup prediction markets — injuries, lineups, weather, whale flow and line moves, linked to every Polymarket market.",
  },
  header: {
    calendar: "Calendar",
    signUp: "Sign up",
    signOut: "Sign out",
    live: "live",
    offline: "offline",
  },
  theme: {
    dark: "Dark",
    light: "Light",
    switchToDark: "Switch to dark mode",
    switchToLight: "Switch to light mode",
  },
  locale: {
    en: "EN",
    es: "ES",
    switchToEn: "Switch to English",
    switchToEs: "Switch to Spanish",
  },
  leftPanel: {
    markets: "Markets",
    follow: "Follow",
  },
  marketList: {
    searchPlaceholder: "search markets…",
    allEvents: (n: number) => `all events (${n})`,
    noMarkets: "no markets",
  },
  marketDetail: {
    selectMarket: "select a market to see why it moves",
    market: "Market",
    fair: "Fair (model)",
    edge: "Edge",
    marketPct: (pct: number) => `market ${pct.toFixed(0)}%`,
    fairPct: (pct: number) => `fair ${pct.toFixed(0)}%`,
    vol: "vol",
    liq: "liq",
    change24h: "24h",
    relatedInfo: "Related information",
    relatedSubtitle: (count: number) =>
      `For this market only · news & factors · ${count} item${count === 1 ? "" : "s"}`,
    noLinked: "no news or factors linked to this market yet",
    groups: {
      availability: "Availability",
      schedule: "Schedule",
      conditions: "Conditions",
      news: "News",
    },
  },
  signalFeed: {
    title: "Signal Feed",
    subtitle: "Global · all teams & markets",
    live: "live",
    all: "all",
    priority: "priority:",
    priorityAll: "all signals",
    priorityNotable: "notable only",
    priorityHigh: "high impact only",
    notable: "notable",
    high: "high",
    noMatch: "no signals match",
    tryLowering: 'try lowering priority to "all"',
    ago: "ago",
    highBadge: "HIGH",
  },
  mispricing: {
    title: "Mispricing Board",
    subtitle: "model fair price vs market · sorted by divergence",
    empty: "no divergence detected — signals are in line with prices",
  },
  teamFollow: {
    title: "Follow teams",
    subtitle: "Daily email digest · all news for your teams, end of day",
    searchPlaceholder: "search teams…",
    teamsSelected: (n: number) => `${n} team${n === 1 ? "" : "s"} selected`,
    enableDigest: "Enable daily email digest",
    saving: "saving…",
    signUpForDigest: "Sign up with Google to enable daily emails.",
    selectTeam: "Select at least one team.",
    digestEnabled: (digest: string) => `Daily digest enabled · ${digest}`,
  },
  calendar: {
    title: "FIFA World Cup 2026",
    subtitle: "Add matches to your calendar — all of them, or only the teams you follow.",
    allMatches: "All matches",
    myTeams: "My teams",
    tapHint: "Tap a country to select · tap again to remove",
    pickCountry: "Pick at least one country to export.",
    countriesSelected: (n: number) =>
      `${n} ${n === 1 ? "country" : "countries"} · group + possible knockout fixtures`,
    addGoogle: "Add to Google Calendar",
    subscribe: "Subscribe (Apple / Outlook)",
    timezoneNote: "Times show in your timezone. Stadium & city are in each event location.",
    matches: "matches",
    teams: "teams",
    kickoff: "kickoff",
    backToTerminal: "← back to terminal",
  },
  time: {
    now: "now",
  },
  signalKinds: {
    injury: "INJURY",
    lineup: "LINEUP",
    suspension: "SUSPENSION",
    card_watch: "CARD WATCH",
    weather: "WEATHER",
    referee: "REFEREE",
    fatigue: "FATIGUE",
    news: "NEWS",
    social_velocity: "SOCIAL",
    whale_flow: "WHALE FLOW",
    line_move: "LINE MOVE",
    cross_book: "CROSS-BOOK",
  },
};
