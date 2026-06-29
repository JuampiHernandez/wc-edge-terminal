import type { SignalKind } from "@/lib/types";

export type Messages = {
  meta: { title: string; description: string };
  header: { calendar: string; calendarHint: string; signUp: string; signOut: string; live: string; offline: string };
  theme: { dark: string; light: string; switchToDark: string; switchToLight: string };
  locale: { en: string; es: string; switchToEn: string; switchToEs: string };
  leftPanel: { matchday: string; markets: string; teams: string };
  marketList: { searchPlaceholder: string; allEvents: (n: number) => string; noMarkets: string };
  matchday: {
    today: string;
    upcoming: string;
    yourTeams: string;
    allTeams: string;
    noGamesToday: string;
    noUpcoming: string;
    draw: string;
    oddsPending: string;
    followHint: string;
  };
  matchDetail: {
    kickoff: string;
    draw: string;
    vol24h: string;
    liq: string;
    moneyline: string;
    whatMoves: string;
    whatMovesSubtitle: (count: number) => string;
    conditions: string;
    noNews: string;
    trade: string;
  };
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
    bet: string;
    groups: { availability: string; conditions: string; news: string; global: string };
  };
  radar: {
    tab: string;
    feedTab: string;
    subtitle: string;
    noNews: string;
    more: (n: number) => string;
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
    addToCalendar: string;
    addToGoogle: string;
    matches: string;
    teams: string;
    backToTerminal: string;
  };
  showcase: {
    hint: string;
    aria: string;
    viewPicker: string;
    views: {
      agenda: string;
      carousel: string;
      radial: string;
      classic: string;
    };
    pickCountry: string;
    newsSubtitle: string;
    loading: string;
    noNews: string;
  };
  time: { now: string };
  signalKinds: Record<SignalKind, string>;
};

export const en: Messages = {
  meta: {
    title: "World Cup Terminal",
    description:
      "Interactive knockout bracket preview. Tap a nation for official news. Add confirmed Round-of-32 fixtures to your calendar.",
  },
  header: {
    calendar: "Round of 32",
    calendarHint: "Add all confirmed Round-of-32 matches to your calendar",
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
    matchday: "Matchday",
    markets: "Markets",
    teams: "Teams",
  },
  matchday: {
    today: "Today",
    upcoming: "Upcoming",
    yourTeams: "your teams",
    allTeams: "all teams",
    noGamesToday: "no games today",
    noUpcoming: "no upcoming games in this window",
    draw: "draw",
    oddsPending: "odds pending",
    followHint: "follow teams in the Teams tab to filter this list",
  },
  matchDetail: {
    kickoff: "Kickoff",
    draw: "Draw",
    vol24h: "24h vol",
    liq: "liq",
    moneyline: "Moneyline · Polymarket",
    whatMoves: "What can move this market",
    whatMovesSubtitle: (count: number) =>
      `news & factors for both teams · ${count} item${count === 1 ? "" : "s"}`,
    conditions: "Conditions & schedule",
    noNews: "no signals linked to this match yet",
    trade: "Bet on Polymarket ↗",
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
    bet: "Bet on Polymarket ↗",
    groups: {
      availability: "Availability",
      conditions: "Conditions",
      news: "News",
      global: "Tournament",
    },
  },
  radar: {
    tab: "Radar",
    feedTab: "Feed",
    subtitle: "odds + news that can move them",
    noNews: "no market-moving news yet",
    more: (n: number) => `+${n} more — open the match for everything`,
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
    subtitle: "Add matches to your calendar",
    allMatches: "All matches",
    myTeams: "My teams",
    tapHint: "Tap a country to select · tap again to remove",
    pickCountry: "Pick at least one country to export.",
    countriesSelected: (n: number) =>
      `${n} ${n === 1 ? "country" : "countries"} · group + possible knockout fixtures`,
    addToCalendar: "Add to your calendar",
    addToGoogle: "Google Calendar",
    matches: "matches",
    teams: "teams",
    backToTerminal: "← back to terminal",
  },
  showcase: {
    hint: "Round of 32 · tap a team for news · tap again to pick winner",
    aria: "World Cup Round of 32 bracket",
    viewPicker: "Layout style",
    views: {
      agenda: "Agenda",
      carousel: "Carousel",
      radial: "Radial",
      classic: "Classic",
    },
    pickCountry: "Tap a classified nation to read official news below",
    newsSubtitle: "Official sources · BBC, Guardian, ESPN & more",
    loading: "Loading news…",
    noNews: "No official news for this nation yet",
  },
  time: {
    now: "now",
  },
  signalKinds: {
    injury: "INJURY",
    suspension: "SUSPENSION",
    card_watch: "CARD WATCH",
    weather: "WEATHER",
    referee: "REFEREE",
    news: "NEWS",
    social_velocity: "SOCIAL",
    whale_flow: "WHALE FLOW",
    line_move: "PRICE MOVE",
    cross_book: "CROSS-BOOK",
  },
};
