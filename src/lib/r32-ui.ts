import { R32_FIXTURES, type R32Fixture } from "./bracket-r32";
import { WC_NATIONS, nationName } from "./teams-list";
import { flagFor } from "./worldcup";

export type TeamMeta = {
  code: string;
  name: string;
  flag: string;
};

export function teamMeta(code: string): TeamMeta {
  const n = WC_NATIONS.find((x) => x.code === code);
  return {
    code,
    name: n?.name ?? nationName(code),
    flag: n?.flag ?? flagFor(code),
  };
}

export function formatMatchWhen(kickoff: number, locale: string) {
  const lang = locale === "es" ? "es" : "en-US";
  const d = new Date(kickoff);
  return {
    day: d.toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

export function groupFixturesByDay(locale: string): [string, R32Fixture[]][] {
  const groups = new Map<string, R32Fixture[]>();
  for (const m of R32_FIXTURES) {
    const key = new Date(m.kickoff).toLocaleDateString(locale === "es" ? "es" : "en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return [...groups.entries()];
}
