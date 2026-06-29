"use client";

import { fixtureById } from "@/lib/bracket-r32";
import { formatMatchWhen, teamMeta } from "@/lib/r32-ui";
import { useLocale } from "@/components/LocaleProvider";

type MatchupCardProps = {
  matchId: number;
  selectedCode: string | null;
  pick?: string;
  lit: boolean;
  onTeamClick: (code: string, matchId: number) => void;
  variant?: "default" | "compact" | "bracket";
  showMeta?: boolean;
  className?: string;
};

function FaceBtn({
  code,
  matchId,
  selected,
  picked,
  faded,
  compact,
  bracket,
  onTeamClick,
}: {
  code: string;
  matchId: number;
  selected: boolean;
  picked: boolean;
  faded: boolean;
  compact: boolean;
  bracket?: boolean;
  onTeamClick: (code: string, matchId: number) => void;
}) {
  const team = teamMeta(code);
  return (
    <button
      type="button"
      className={[
        bracket ? "bracket-duel-team" : "r32-matchup-team",
        compact && "r32-matchup-team-compact",
        selected && "r32-team-selected",
        picked && "r32-team-picked",
        faded && "r32-team-faded",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onTeamClick(code, matchId)}
      aria-label={team.name}
    >
      <span className={bracket ? "bracket-duel-flag" : "r32-matchup-flag"}>{team.flag}</span>
      <span className={bracket ? "bracket-duel-code" : "r32-matchup-code"}>{team.code}</span>
    </button>
  );
}

export function MatchupCard({
  matchId,
  selectedCode,
  pick,
  lit,
  onTeamClick,
  variant = "default",
  showMeta = false,
  className,
}: MatchupCardProps) {
  const { locale } = useLocale();
  const m = fixtureById(matchId);
  if (!m) return null;

  const compact = variant === "compact";
  const bracket = variant === "bracket";
  const when = formatMatchWhen(m.kickoff, locale);

  if (bracket) {
    return (
      <article
        className={[
          "bracket-duel",
          lit && "bracket-duel-lit",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`${teamMeta(m.homeCode).name} vs ${teamMeta(m.awayCode).name}`}
      >
        <FaceBtn
          code={m.homeCode}
          matchId={matchId}
          selected={selectedCode === m.homeCode}
          picked={pick === m.homeCode}
          faded={Boolean(pick && pick !== m.homeCode)}
          compact={false}
          bracket
          onTeamClick={onTeamClick}
        />
        <span className="bracket-duel-v">v</span>
        <FaceBtn
          code={m.awayCode}
          matchId={matchId}
          selected={selectedCode === m.awayCode}
          picked={pick === m.awayCode}
          faded={Boolean(pick && pick !== m.awayCode)}
          compact={false}
          bracket
          onTeamClick={onTeamClick}
        />
      </article>
    );
  }

  return (
    <article
      className={[
        "r32-matchup-card",
        compact && "r32-matchup-card-compact",
        lit && "r32-matchup-card-lit",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${teamMeta(m.homeCode).name} vs ${teamMeta(m.awayCode).name}`}
    >
      {showMeta && (
        <div className="r32-matchup-meta">
          <span>{when.time}</span>
          {m.score && <span className="r32-score">{m.score}</span>}
        </div>
      )}
      <div className="r32-matchup-face">
        <FaceBtn
          code={m.homeCode}
          matchId={matchId}
          selected={selectedCode === m.homeCode}
          picked={pick === m.homeCode}
          faded={Boolean(pick && pick !== m.homeCode)}
          compact={compact}
          onTeamClick={onTeamClick}
        />
        <span className="r32-matchup-vs">vs</span>
        <FaceBtn
          code={m.awayCode}
          matchId={matchId}
          selected={selectedCode === m.awayCode}
          picked={pick === m.awayCode}
          faded={Boolean(pick && pick !== m.awayCode)}
          compact={compact}
          onTeamClick={onTeamClick}
        />
      </div>
    </article>
  );
}
