"use client";

import { R32_FIXTURES, hubAngle, polar } from "@/lib/bracket-r32";
import { teamMeta } from "@/lib/r32-ui";
import type { R32ViewProps } from "../R32Showcase";
import { MatchupCard } from "./MatchupCard";

const CX = 200;
const CY = 200;
const R_POD = 138;
const R_HUB = 102;
const R_ADV = 64;

export function RadialBracketView({
  selectedCode,
  activeMatchId,
  picks,
  onTeamClick,
}: R32ViewProps) {
  return (
    <div className="bracket-radial-wrap">
      <svg viewBox="0 0 400 400" className="bracket-radial-svg" aria-hidden>
        {R32_FIXTURES.map((m) => {
          const lit = activeMatchId === m.id;
          const pick = picks[m.id];
          const angle = hubAngle(m.id);
          const pod = polar(CX, CY, R_POD, angle);
          const hub = polar(CX, CY, R_HUB, angle);
          const adv = pick ? polar(CX, CY, R_ADV, angle) : null;

          return (
            <g key={m.id} className={lit ? "bracket-radial-match-lit" : ""}>
              <line
                x1={pod.x}
                y1={pod.y}
                x2={hub.x}
                y2={hub.y}
                className="bracket-radial-line"
              />
              {adv && (
                <line
                  x1={hub.x}
                  y1={hub.y}
                  x2={adv.x}
                  y2={adv.y}
                  className="bracket-radial-line bracket-radial-line-win"
                />
              )}
              <circle cx={hub.x} cy={hub.y} r={3} className="bracket-radial-hub" />
            </g>
          );
        })}

        <g className="bracket-radial-trophy" transform={`translate(${CX - 12}, ${CY - 16})`}>
          <path
            d="M12 2c-3 0-5 2-5 5v2H4c-1 0-1 1-1 1v2c0 3 2 5 5 5h1v4H5v2h14v-2h-3v-4h1c3 0 5-2 5-5v-2c0-1-1-2-2-1h-3V7c0-3-2-5-5-5zm0 3c1 0 2 1 2 2v2h-4V7c0-1 1-2 2-2z"
            fill="currentColor"
          />
        </g>

        {R32_FIXTURES.map((m) => {
          const code = picks[m.id];
          if (!code) return null;
          const pt = polar(CX, CY, R_ADV, hubAngle(m.id));
          const team = teamMeta(code);
          return (
            <g key={`w-${m.id}`} transform={`translate(${pt.x}, ${pt.y})`}>
              <circle r={14} className="bracket-radial-win-ring" />
              <text y={5} textAnchor="middle" className="bracket-radial-win-flag">
                {team.flag}
              </text>
              <text y={22} textAnchor="middle" className="bracket-radial-win-code">
                {code}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="bracket-radial-pods">
        {R32_FIXTURES.map((m) => {
          const pt = polar(CX, CY, R_POD, hubAngle(m.id));
          const lit =
            activeMatchId === m.id ||
            selectedCode === m.homeCode ||
            selectedCode === m.awayCode;

          return (
            <div
              key={m.id}
              className="bracket-radial-pod-slot"
              style={{
                left: `${((pt.x / 400) * 100).toFixed(2)}%`,
                top: `${((pt.y / 400) * 100).toFixed(2)}%`,
              }}
            >
              <MatchupCard
                matchId={m.id}
                selectedCode={selectedCode}
                pick={picks[m.id]}
                lit={lit}
                onTeamClick={onTeamClick}
                variant="compact"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
