import { readFileSync } from "fs";
import path from "path";
import { resolveTeam } from "./worldcup";
import { WC_NATIONS } from "./teams-list";

export type IcsEvent = {
  block: string;
  uid: string;
  matchNum: number;
  summary: string;
  description: string;
  location: string;
  teamCodes: string[];
};

const VALID_CODES = new Set(WC_NATIONS.map((n) => n.code));
const ICS_PATH = path.join(process.cwd(), "public/world_cup_2026.ics");

function field(block: string, name: string): string {
  const re = new RegExp(`^${name}:(.*)$`, "m");
  return block.match(re)?.[1]?.trim() ?? "";
}

function unescapeIcs(s: string): string {
  return s.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, "\n");
}

function stripFlags(s: string): string {
  return s
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, "")
    .replace(/[\u{1F3F4}][\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{3}[\u{E007F}]/gu, "")
    .trim();
}

function teamsFromSummary(summary: string): string[] {
  const sides = summary.includes(" - ")
    ? summary.split(" - ")
    : summary.includes(" v ")
      ? summary.split(" v ")
      : [];

  const codes: string[] = [];
  for (const side of sides) {
    const label = stripFlags(side.replace(/^Round of \d+ - /i, "").replace(/^Quarter-final - /i, "").replace(/^Semi-final - /i, "").replace(/^Final - /i, "").replace(/^Third-place play-off - /i, ""));
    if (!label || /winner match|loser match|group [a-l]|best 3rd/i.test(label)) continue;
    const team = resolveTeam(label);
    if (team && VALID_CODES.has(team.code)) codes.push(team.code);
  }
  return codes;
}

function groupFromDescription(description: string): string | null {
  const m = description.match(/\|\s*Group\s+([A-L])\s*\|/i);
  return m?.[1]?.toUpperCase() ?? null;
}

function groupsFromKnockoutSummary(summary: string): Set<string> {
  const groups = new Set<string>();
  for (const m of summary.matchAll(/Group\s+([A-L])/gi)) {
    groups.add(m[1].toUpperCase());
  }
  const best = summary.match(/Best 3rd \(([A-L/]+)\)/i);
  if (best) {
    for (const g of best[1].split("/")) groups.add(g.toUpperCase());
  }
  return groups;
}

function winnerRefs(summary: string): number[] {
  return [...summary.matchAll(/(?:Winner|Loser) Match (\d+)/gi)].map((m) => parseInt(m[1], 10));
}

export function parseIcsEvents(ics = readFileSync(ICS_PATH, "utf8")): IcsEvent[] {
  return ics
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((chunk) => {
      const block = `BEGIN:VEVENT${chunk.split("END:VEVENT")[0]}END:VEVENT`;
      const description = field(block, "DESCRIPTION");
      const matchNum = parseInt(description.match(/Match\s+(\d+)/i)?.[1] ?? "0", 10);
      return {
        block,
        uid: field(block, "UID"),
        matchNum,
        summary: field(block, "SUMMARY"),
        description,
        location: unescapeIcs(field(block, "LOCATION")),
        teamCodes: teamsFromSummary(field(block, "SUMMARY")),
      };
    });
}

function buildTeamGroupMap(events: IcsEvent[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of events) {
    const group = groupFromDescription(e.description);
    if (!group) continue;
    for (const code of e.teamCodes) map.set(code, group);
  }
  return map;
}

function groupsForMatch(
  matchNum: number,
  byNum: Map<number, IcsEvent>,
  teamGroup: Map<string, string>,
  cache: Map<number, Set<string>>,
): Set<string> {
  if (cache.has(matchNum)) return cache.get(matchNum)!;
  const e = byNum.get(matchNum);
  if (!e) return new Set();

  const groups = new Set<string>();
  const descGroup = groupFromDescription(e.description);
  if (descGroup) groups.add(descGroup);

  for (const code of e.teamCodes) {
    const g = teamGroup.get(code);
    if (g) groups.add(g);
  }

  for (const g of groupsFromKnockoutSummary(e.summary)) groups.add(g);

  for (const ref of winnerRefs(e.summary)) {
    for (const g of groupsForMatch(ref, byNum, teamGroup, cache)) groups.add(g);
  }

  cache.set(matchNum, groups);
  return groups;
}

export function filterEventsByTeams(events: IcsEvent[], teamCodes: string[]): IcsEvent[] {
  const selected = new Set(teamCodes.filter((c) => VALID_CODES.has(c)));
  if (selected.size === 0) return [];

  const teamGroup = buildTeamGroupMap(events);
  const selectedGroups = new Set(
    [...selected].map((c) => teamGroup.get(c)).filter((g): g is string => Boolean(g)),
  );

  const byNum = new Map(events.map((e) => [e.matchNum, e]));
  const cache = new Map<number, Set<string>>();

  return events.filter((e) => {
    if (e.teamCodes.some((c) => selected.has(c))) return true;
    const groups = groupsForMatch(e.matchNum, byNum, teamGroup, cache);
    for (const g of groups) {
      if (selectedGroups.has(g)) return true;
    }
    return false;
  });
}

export function buildIcs(events: IcsEvent[], calName: string, calDesc: string): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//world-cup-terminal//World Cup 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calName}`,
    "X-WR-TIMEZONE:UTC",
    `X-WR-CALDESC:${calDesc}`,
  ].join("\r\n");

  const body = events.map((e) => e.block).join("\r\n");
  return `${header}\r\n${body}\r\nEND:VCALENDAR\r\n`;
}

export function fullCalendarIcs(): string {
  return readFileSync(ICS_PATH, "utf8");
}

function isConfirmedRoundOf32(e: IcsEvent): boolean {
  if (!/Round of 32/i.test(e.description)) return false;
  return /STATUS:CONFIRMED/i.test(e.block);
}

/** All scheduled, confirmed Round-of-32 fixtures (matches 73–88). */
export function roundOf32CalendarIcs(): string {
  const events = parseIcsEvents().filter(isConfirmedRoundOf32);
  return buildIcs(
    events,
    `${CAL_NAME} · Round of 32`,
    `${events.length} confirmed Round-of-32 fixtures · FIFA World Cup 2026.`,
  );
}

const CAL_NAME = "FIFA World Cup 2026";

export function filteredCalendarIcs(teamCodes: string[]): string {
  const events = parseIcsEvents();
  const filtered = filterEventsByTeams(events, teamCodes);
  const names = teamCodes
    .filter((c) => VALID_CODES.has(c))
    .map((c) => WC_NATIONS.find((n) => n.code === c)?.name ?? c)
    .join(", ");
  return buildIcs(
    filtered,
    CAL_NAME,
    names
      ? `${filtered.length} matches for ${names} · FIFA World Cup 2026 (USA / Canada / Mexico).`
      : `FIFA World Cup 2026 (USA / Canada / Mexico).`,
  );
}

export function parseTeamQuery(raw: string | null): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((c) => VALID_CODES.has(c)))];
}
