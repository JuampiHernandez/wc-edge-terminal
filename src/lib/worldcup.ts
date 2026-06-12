// Static World Cup reference data.
// - WC_EVENTS: Polymarket event slugs we track (verified live from gamma-api).
// - VENUES: 2026 host stadiums with coordinates (for venue weather).
// - TEAM_FLAGS: emoji flags for clean rendering + fuzzy name→code mapping.

/** Polymarket World Cup event slugs, grouped by category. */
export const WC_EVENTS = {
  outright: [
    { slug: "world-cup-winner", title: "World Cup Winner", category: "Outright" },
    { slug: "world-cup-golden-boot-winner", title: "Golden Boot Winner", category: "Outright" },
    { slug: "which-continent-will-win-the-world-cup", title: "Winning Continent", category: "Outright" },
    { slug: "world-cup-team-to-advance-to-knockout-stages", title: "Advance to Knockouts", category: "Advancement" },
    { slug: "world-cup-nation-to-reach-final", title: "Reach Final", category: "Advancement" },
    { slug: "world-cup-nation-to-reach-semifinals", title: "Reach Semifinals", category: "Advancement" },
    { slug: "world-cup-nation-to-reach-quarterfinals", title: "Reach Quarterfinals", category: "Advancement" },
    { slug: "world-cup-nation-to-reach-round-of-16", title: "Reach Round of 16", category: "Advancement" },
    { slug: "world-cup-player-to-score", title: "Player to Score", category: "Scorers" },
    { slug: "world-cup-nation-of-top-goalscorer", title: "Nation of Top Scorer", category: "Scorers" },
    { slug: "world-cup-top-scorer-nation", title: "Top Scorer (Nation)", category: "Scorers" },
  ],
  groups: "ABCDEFGHIJKL".split("").map((g) => ({
    slug: `world-cup-group-${g.toLowerCase()}-winner`,
    title: `Group ${g} Winner`,
    category: "Groups",
  })),
  novelty: [
    { slug: "will-neymar-play-in-the-world-cup", title: "Neymar plays?", category: "Novelty" },
    { slug: "will-iran-play-in-the-world-cup", title: "Iran plays?", category: "Novelty" },
  ],
} as const;

/** Flat list of every tracked event slug. */
export const ALL_WC_EVENT_SLUGS: { slug: string; title: string; category: string }[] = [
  ...WC_EVENTS.outright,
  ...WC_EVENTS.groups,
  ...WC_EVENTS.novelty,
];

export type Venue = {
  id: string;
  city: string;
  stadium: string;
  country: "USA" | "Mexico" | "Canada";
  lat: number;
  lon: number;
  /** Rough elevation in meters — altitude is a real edge for goals/fatigue. */
  elevationM: number;
};

/** 2026 FIFA World Cup host venues. */
export const VENUES: Venue[] = [
  { id: "mexico-city", city: "Mexico City", stadium: "Estadio Azteca", country: "Mexico", lat: 19.3029, lon: -99.1505, elevationM: 2240 },
  { id: "guadalajara", city: "Guadalajara", stadium: "Estadio Akron", country: "Mexico", lat: 20.6817, lon: -103.4626, elevationM: 1566 },
  { id: "monterrey", city: "Monterrey", stadium: "Estadio BBVA", country: "Mexico", lat: 25.6690, lon: -100.2444, elevationM: 500 },
  { id: "toronto", city: "Toronto", stadium: "BMO Field", country: "Canada", lat: 43.6332, lon: -79.4185, elevationM: 76 },
  { id: "vancouver", city: "Vancouver", stadium: "BC Place", country: "Canada", lat: 49.2768, lon: -123.1119, elevationM: 3 },
  { id: "atlanta", city: "Atlanta", stadium: "Mercedes-Benz Stadium", country: "USA", lat: 33.7554, lon: -84.4008, elevationM: 320 },
  { id: "boston", city: "Boston", stadium: "Gillette Stadium", country: "USA", lat: 42.0909, lon: -71.2643, elevationM: 28 },
  { id: "dallas", city: "Dallas", stadium: "AT&T Stadium", country: "USA", lat: 32.7473, lon: -97.0945, elevationM: 150 },
  { id: "houston", city: "Houston", stadium: "NRG Stadium", country: "USA", lat: 29.6847, lon: -95.4107, elevationM: 15 },
  { id: "kansas-city", city: "Kansas City", stadium: "Arrowhead Stadium", country: "USA", lat: 39.0489, lon: -94.4839, elevationM: 270 },
  { id: "los-angeles", city: "Los Angeles", stadium: "SoFi Stadium", country: "USA", lat: 33.9535, lon: -118.3392, elevationM: 30 },
  { id: "miami", city: "Miami", stadium: "Hard Rock Stadium", country: "USA", lat: 25.9580, lon: -80.2389, elevationM: 2 },
  { id: "new-york", city: "New York/NJ", stadium: "MetLife Stadium", country: "USA", lat: 40.8135, lon: -74.0745, elevationM: 7 },
  { id: "philadelphia", city: "Philadelphia", stadium: "Lincoln Financial Field", country: "USA", lat: 39.9008, lon: -75.1675, elevationM: 12 },
  { id: "san-francisco", city: "San Francisco Bay", stadium: "Levi's Stadium", country: "USA", lat: 37.4030, lon: -121.9698, elevationM: 4 },
  { id: "seattle", city: "Seattle", stadium: "Lumen Field", country: "USA", lat: 47.5952, lon: -122.3316, elevationM: 5 },
];

/** name (lowercased) → { code, flag }. Used to resolve outcomes to nations. */
export const TEAMS: Record<string, { code: string; flag: string }> = {
  argentina: { code: "ARG", flag: "🇦🇷" },
  france: { code: "FRA", flag: "🇫🇷" },
  spain: { code: "ESP", flag: "🇪🇸" },
  england: { code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  brazil: { code: "BRA", flag: "🇧🇷" },
  germany: { code: "GER", flag: "🇩🇪" },
  portugal: { code: "POR", flag: "🇵🇹" },
  netherlands: { code: "NED", flag: "🇳🇱" },
  belgium: { code: "BEL", flag: "🇧🇪" },
  uruguay: { code: "URU", flag: "🇺🇾" },
  colombia: { code: "COL", flag: "🇨🇴" },
  croatia: { code: "CRO", flag: "🇭🇷" },
  mexico: { code: "MEX", flag: "🇲🇽" },
  usa: { code: "USA", flag: "🇺🇸" },
  morocco: { code: "MAR", flag: "🇲🇦" },
  japan: { code: "JPN", flag: "🇯🇵" },
  "south korea": { code: "KOR", flag: "🇰🇷" },
  switzerland: { code: "SUI", flag: "🇨🇭" },
  denmark: { code: "DEN", flag: "🇩🇰" },
  ecuador: { code: "ECU", flag: "🇪🇨" },
  senegal: { code: "SEN", flag: "🇸🇳" },
  canada: { code: "CAN", flag: "🇨🇦" },
  austria: { code: "AUT", flag: "🇦🇹" },
  sweden: { code: "SWE", flag: "🇸🇪" },
  egypt: { code: "EGY", flag: "🇪🇬" },
  ghana: { code: "GHA", flag: "🇬🇭" },
  iran: { code: "IRN", flag: "🇮🇷" },
  algeria: { code: "ALG", flag: "🇩🇿" },
  turkiye: { code: "TUR", flag: "🇹🇷" },
  "south africa": { code: "RSA", flag: "🇿🇦" },
  czechia: { code: "CZE", flag: "🇨🇿" },
  scotland: { code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  norway: { code: "NOR", flag: "🇳🇴" },
  uzbekistan: { code: "UZB", flag: "🇺🇿" },
  paraguay: { code: "PAR", flag: "🇵🇾" },
  panama: { code: "PAN", flag: "🇵🇦" },
  qatar: { code: "QAT", flag: "🇶🇦" },
  australia: { code: "AUS", flag: "🇦🇺" },
  "saudi arabia": { code: "KSA", flag: "🇸🇦" },
  tunisia: { code: "TUN", flag: "🇹🇳" },
  "ivory coast": { code: "CIV", flag: "🇨🇮" },
  "cape verde": { code: "CPV", flag: "🇨🇻" },
  jordan: { code: "JOR", flag: "🇯🇴" },
  haiti: { code: "HAI", flag: "🇭🇹" },
  "new zealand": { code: "NZL", flag: "🇳🇿" },
  curacao: { code: "CUW", flag: "🇨🇼" },
  iraq: { code: "IRQ", flag: "🇮🇶" },
  "bosnia-herzegovina": { code: "BIH", flag: "🇧🇦" },
  "congo dr": { code: "COD", flag: "🇨🇩" },
  curaçao: { code: "CUW", flag: "🇨🇼" },
  // Aliases used by Polymarket match-event titles.
  "united states": { code: "USA", flag: "🇺🇸" },
  "bosnia and herzegovina": { code: "BIH", flag: "🇧🇦" },
  "cote d'ivoire": { code: "CIV", flag: "🇨🇮" },
  "cabo verde": { code: "CPV", flag: "🇨🇻" },
  "dr congo": { code: "COD", flag: "🇨🇩" },
  "korea republic": { code: "KOR", flag: "🇰🇷" },
};

/** Continent / region outcomes (not nations). */
export const REGIONS: Record<string, { code: string; flag: string }> = {
  europe: { code: "EUR", flag: "🇪🇺" },
  "south america": { code: "SAM", flag: "🌎" },
  "north america": { code: "NAM", flag: "🗽" },
  africa: { code: "AFR", flag: "🌍" },
  asia: { code: "ASI", flag: "🌏" },
  oceania: { code: "OCE", flag: "🏝️" },
  "another continent": { code: "OTH", flag: "🌐" },
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Fuzzy-resolve a free-text label to a team/region code + flag. */
export function resolveTeam(label: string): { code: string; flag: string } | null {
  const key = norm(label);
  if (TEAMS[key]) return TEAMS[key];
  if (REGIONS[key]) return REGIONS[key];
  for (const [name, meta] of Object.entries(TEAMS)) {
    if (key.includes(norm(name))) return meta;
  }
  for (const [name, meta] of Object.entries(REGIONS)) {
    if (key.includes(norm(name))) return meta;
  }
  return null;
}

export function flagFor(code?: string): string {
  if (!code) return "◻";
  const team = Object.values(TEAMS).find((t) => t.code === code);
  if (team) return team.flag;
  const region = Object.values(REGIONS).find((r) => r.code === code);
  return region?.flag ?? "◻";
}

/** Resolve flag directly from a market label (fallback when teamCode is missing). */
export function flagForLabel(label: string): string {
  return resolveTeam(label)?.flag ?? "◻";
}
