// Confirmed Round-of-32 fixtures — post group stage (June 27, 2026).
// Sources: FIFA bracket / Yahoo Sports / NBC Sports knockout coverage.

import { WC_NATIONS, nationName } from "./teams-list";
import { flagFor } from "./worldcup";

export type R32Fixture = {
  id: number;
  homeCode: string;
  awayCode: string;
  kickoff: number;
  venue: string;
  /** Set when the match is finished. */
  winnerCode?: string;
  score?: string;
};

/** All 32 nations that advanced from the group stage. */
export const R32_QUALIFIED = new Set([
  "MEX", "RSA", "SUI", "CAN", "BIH", "BRA", "MAR", "USA", "AUS", "PAR", "GER", "CIV",
  "ECU", "NED", "JPN", "SWE", "BEL", "EGY", "ESP", "CPV", "FRA", "NOR", "SEN", "ARG",
  "AUT", "ALG", "COL", "POR", "COD", "ENG", "CRO", "GHA",
]);

/** 16 confirmed Round-of-32 matchups (matches 73–88). */
export const R32_FIXTURES: R32Fixture[] = [
  {
    id: 73,
    homeCode: "RSA",
    awayCode: "CAN",
    kickoff: Date.parse("2026-06-28T19:00:00Z"),
    venue: "Los Angeles",
    winnerCode: "CAN",
    score: "0–1",
  },
  {
    id: 74,
    homeCode: "BRA",
    awayCode: "JPN",
    kickoff: Date.parse("2026-06-29T17:00:00Z"),
    venue: "Houston",
  },
  {
    id: 75,
    homeCode: "GER",
    awayCode: "PAR",
    kickoff: Date.parse("2026-06-29T20:30:00Z"),
    venue: "Boston",
  },
  {
    id: 76,
    homeCode: "NED",
    awayCode: "MAR",
    kickoff: Date.parse("2026-06-30T01:00:00Z"),
    venue: "Monterrey",
  },
  {
    id: 77,
    homeCode: "CIV",
    awayCode: "NOR",
    kickoff: Date.parse("2026-06-30T17:00:00Z"),
    venue: "Dallas",
  },
  {
    id: 78,
    homeCode: "FRA",
    awayCode: "SWE",
    kickoff: Date.parse("2026-06-30T21:00:00Z"),
    venue: "New York",
  },
  {
    id: 79,
    homeCode: "MEX",
    awayCode: "ECU",
    kickoff: Date.parse("2026-07-01T01:00:00Z"),
    venue: "Mexico City",
  },
  {
    id: 80,
    homeCode: "ENG",
    awayCode: "COD",
    kickoff: Date.parse("2026-07-01T16:00:00Z"),
    venue: "Atlanta",
  },
  {
    id: 81,
    homeCode: "BEL",
    awayCode: "SEN",
    kickoff: Date.parse("2026-07-01T20:00:00Z"),
    venue: "Seattle",
  },
  {
    id: 82,
    homeCode: "USA",
    awayCode: "BIH",
    kickoff: Date.parse("2026-07-02T00:00:00Z"),
    venue: "San Francisco",
  },
  {
    id: 83,
    homeCode: "ESP",
    awayCode: "AUT",
    kickoff: Date.parse("2026-07-02T19:00:00Z"),
    venue: "Los Angeles",
  },
  {
    id: 84,
    homeCode: "POR",
    awayCode: "CRO",
    kickoff: Date.parse("2026-07-02T23:00:00Z"),
    venue: "Toronto",
  },
  {
    id: 85,
    homeCode: "SUI",
    awayCode: "ALG",
    kickoff: Date.parse("2026-07-03T03:00:00Z"),
    venue: "Vancouver",
  },
  {
    id: 86,
    homeCode: "AUS",
    awayCode: "EGY",
    kickoff: Date.parse("2026-07-03T18:00:00Z"),
    venue: "Dallas",
  },
  {
    id: 87,
    homeCode: "ARG",
    awayCode: "CPV",
    kickoff: Date.parse("2026-07-03T22:00:00Z"),
    venue: "Miami",
  },
  {
    id: 88,
    homeCode: "COL",
    awayCode: "GHA",
    kickoff: Date.parse("2026-07-04T01:30:00Z"),
    venue: "Kansas City",
  },
];

/** Classic bracket wing order (matches reference bracket poster). */
export const CLASSIC_LEFT_IDS = [75, 78, 73, 76, 84, 83, 82, 81];
export const CLASSIC_RIGHT_IDS = [74, 77, 79, 80, 87, 86, 85, 88];

export function fixtureById(id: number): R32Fixture | undefined {
  return R32_FIXTURES.find((m) => m.id === id);
}

export type BracketTeam = {
  code: string;
  name: string;
  flag: string;
  matchId: number;
  side: "home" | "away";
  angle: number;
};

export function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function bracketTeams(): BracketTeam[] {
  const byCode = new Map(WC_NATIONS.map((n) => [n.code, n]));
  const out: BracketTeam[] = [];

  R32_FIXTURES.forEach((m, i) => {
    const base = (i / 16) * 360 - 90;
    for (const [side, code, offset] of [
      ["home", m.homeCode, -5],
      ["away", m.awayCode, 5],
    ] as const) {
      const n = byCode.get(code);
      out.push({
        code,
        name: n?.name ?? nationName(code),
        flag: n?.flag ?? flagFor(code),
        matchId: m.id,
        side,
        angle: base + offset,
      });
    }
  });

  return out;
}

export function fixtureForTeam(code: string): R32Fixture | undefined {
  return R32_FIXTURES.find((m) => m.homeCode === code || m.awayCode === code);
}

export function hubAngle(matchId: number): number {
  const i = R32_FIXTURES.findIndex((m) => m.id === matchId);
  return i >= 0 ? (i / 16) * 360 - 90 : 0;
}

export function hubPoint(matchId: number, cx: number, cy: number, r: number) {
  return polar(cx, cy, r, hubAngle(matchId));
}
