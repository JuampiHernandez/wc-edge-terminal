"use client";

import { CLASSIC_LEFT_IDS, CLASSIC_RIGHT_IDS } from "@/lib/bracket-r32";
import type { R32ViewProps } from "../R32Showcase";
import { MatchupCard } from "./MatchupCard";

const ROWS = 8;

function rowY(i: number) {
  return ((i + 0.5) / ROWS) * 100;
}

function pairMidY(p: number) {
  return (rowY(p * 2) + rowY(p * 2 + 1)) / 2;
}

function quadMidY(q: number) {
  return (pairMidY(q * 2) + pairMidY(q * 2 + 1)) / 2;
}

/** Bracket connector paths — left wing mirrors on the right. */
function wingPaths(side: "left" | "right"): string[] {
  const paths: string[] = [];
  const duel = side === "left" ? 34 : 66;
  const stub = side === "left" ? 38 : 62;
  const pair = side === "left" ? 42 : 58;
  const quad = side === "left" ? 46 : 54;
  const half = side === "left" ? 48 : 52;

  for (let i = 0; i < ROWS; i++) {
    const y = rowY(i);
    paths.push(`M ${duel} ${y} H ${stub}`);
  }

  for (let p = 0; p < 4; p++) {
    const y0 = rowY(p * 2);
    const y1 = rowY(p * 2 + 1);
    const mid = pairMidY(p);
    paths.push(`M ${stub} ${y0} H ${pair}`);
    paths.push(`M ${stub} ${y1} H ${pair}`);
    paths.push(`M ${pair} ${y0} V ${y1}`);
    paths.push(`M ${pair} ${mid} H ${quad}`);
  }

  for (let q = 0; q < 2; q++) {
    const y0 = pairMidY(q * 2);
    const y1 = pairMidY(q * 2 + 1);
    const mid = quadMidY(q);
    paths.push(`M ${quad} ${y0} H ${half}`);
    paths.push(`M ${quad} ${y1} H ${half}`);
    paths.push(`M ${half} ${y0} V ${y1}`);
    paths.push(`M ${half} ${mid} H 50`);
  }

  return paths;
}

function Wing({
  ids,
  side,
  selectedCode,
  activeMatchId,
  picks,
  onTeamClick,
}: {
  ids: number[];
  side: "left" | "right";
  selectedCode: string | null;
  activeMatchId: number | null;
  picks: Record<number, string>;
  onTeamClick: (code: string, matchId: number) => void;
}) {
  return (
    <div className={`bracket-board-wing bracket-board-wing-${side}`}>
      {ids.map((id) => {
        const lit = activeMatchId === id;
        return (
          <div key={id} className="bracket-board-slot">
            <MatchupCard
              matchId={id}
              selectedCode={selectedCode}
              pick={picks[id]}
              lit={lit}
              onTeamClick={onTeamClick}
              variant="bracket"
            />
          </div>
        );
      })}
    </div>
  );
}

export function ClassicBracketView({
  selectedCode,
  activeMatchId,
  picks,
  onTeamClick,
}: R32ViewProps) {
  const lines = [...wingPaths("left"), ...wingPaths("right")];

  return (
    <div className="bracket-board">
      <header className="bracket-board-head">
        <span className="bracket-board-title">World Cup</span>
        <span className="bracket-board-sub">Round of 32 · confirmed fixtures</span>
      </header>

      <div className="bracket-board-stage">
        <svg
          className="bracket-board-lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {lines.map((d, i) => (
            <path key={i} d={d} className="bracket-board-line" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <div className="bracket-board-grid">
          <Wing
            ids={CLASSIC_LEFT_IDS}
            side="left"
            selectedCode={selectedCode}
            activeMatchId={activeMatchId}
            picks={picks}
            onTeamClick={onTeamClick}
          />

          <div className="bracket-board-center">
            <span className="bracket-board-badge">R32</span>
            <div className="bracket-board-trophy" aria-hidden>
              🏆
            </div>
          </div>

          <Wing
            ids={CLASSIC_RIGHT_IDS}
            side="right"
            selectedCode={selectedCode}
            activeMatchId={activeMatchId}
            picks={picks}
            onTeamClick={onTeamClick}
          />
        </div>
      </div>
    </div>
  );
}
