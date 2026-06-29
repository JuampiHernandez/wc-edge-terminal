"use client";

import { R32_FIXTURES } from "@/lib/bracket-r32";
import { formatMatchWhen, groupFixturesByDay, teamMeta } from "@/lib/r32-ui";
import { useLocale } from "@/components/LocaleProvider";
import type { R32ViewProps } from "../R32Showcase";

function TeamBtn({
  code,
  matchId,
  selected,
  picked,
  faded,
  onClick,
}: {
  code: string;
  matchId: number;
  selected: boolean;
  picked: boolean;
  faded: boolean;
  onClick: () => void;
}) {
  const team = teamMeta(code);
  return (
    <button
      type="button"
      className={[
        "r32-team",
        selected && "r32-team-selected",
        picked && "r32-team-picked",
        faded && "r32-team-faded",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      aria-label={team.name}
    >
      <span className="r32-team-flag">{team.flag}</span>
      <span className="r32-team-name">{team.name}</span>
    </button>
  );
}

export function AgendaView({ selectedCode, picks, onTeamClick }: R32ViewProps) {
  const { locale } = useLocale();
  const days = groupFixturesByDay(locale);

  return (
    <div className="r32-agenda">
      {days.map(([label, matches]) => (
        <section key={label} className="r32-agenda-day">
          <h3 className="r32-agenda-date">{label}</h3>
          <div className="r32-agenda-line" />
          {matches.map((m) => {
            const pick = picks[m.id];
            const when = formatMatchWhen(m.kickoff, locale);
            const lit =
              selectedCode === m.homeCode ||
              selectedCode === m.awayCode ||
              pick === m.homeCode ||
              pick === m.awayCode;

            return (
              <article
                key={m.id}
                className={`r32-agenda-match ${lit ? "r32-match-lit" : ""}`}
              >
                <div className="r32-agenda-meta">
                  <span>{when.time}</span>
                  <span>{m.venue}</span>
                  {m.score && <span className="r32-score">{m.score}</span>}
                </div>
                <div className="r32-agenda-teams">
                  <TeamBtn
                    code={m.homeCode}
                    matchId={m.id}
                    selected={selectedCode === m.homeCode}
                    picked={pick === m.homeCode}
                    faded={Boolean(pick && pick !== m.homeCode)}
                    onClick={() => onTeamClick(m.homeCode, m.id)}
                  />
                  <span className="r32-vs">vs</span>
                  <TeamBtn
                    code={m.awayCode}
                    matchId={m.id}
                    selected={selectedCode === m.awayCode}
                    picked={pick === m.awayCode}
                    faded={Boolean(pick && pick !== m.awayCode)}
                    onClick={() => onTeamClick(m.awayCode, m.id)}
                  />
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
