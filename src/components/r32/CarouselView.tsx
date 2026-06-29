"use client";

import { useEffect, useRef } from "react";
import { R32_FIXTURES } from "@/lib/bracket-r32";
import { formatMatchWhen, teamMeta } from "@/lib/r32-ui";
import { useLocale } from "@/components/LocaleProvider";
import type { R32ViewProps } from "../R32Showcase";

export function CarouselView({ selectedCode, activeMatchId, picks, onTeamClick }: R32ViewProps) {
  const { locale } = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeMatchId || !trackRef.current) return;
    const el = trackRef.current.querySelector(`[data-match="${activeMatchId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeMatchId]);

  return (
    <div className="r32-carousel-wrap">
      <div className="r32-carousel" ref={trackRef}>
        {R32_FIXTURES.map((m) => {
          const pick = picks[m.id];
          const when = formatMatchWhen(m.kickoff, locale);
          const home = teamMeta(m.homeCode);
          const away = teamMeta(m.awayCode);
          const lit =
            activeMatchId === m.id ||
            selectedCode === m.homeCode ||
            selectedCode === m.awayCode;

          return (
            <article
              key={m.id}
              data-match={m.id}
              className={`r32-carousel-slide ${lit ? "r32-match-lit" : ""}`}
            >
              <span className="r32-carousel-id">Match {m.id}</span>
              <div className="r32-carousel-duel">
                <button
                  type="button"
                  className={`r32-carousel-team ${selectedCode === m.homeCode ? "r32-team-selected" : ""} ${pick === m.homeCode ? "r32-team-picked" : ""}`}
                  onClick={() => onTeamClick(m.homeCode, m.id)}
                >
                  <span className="r32-carousel-flag">{home.flag}</span>
                  <span>{home.name}</span>
                </button>
                <div className="r32-carousel-divider" />
                <button
                  type="button"
                  className={`r32-carousel-team ${selectedCode === m.awayCode ? "r32-team-selected" : ""} ${pick === m.awayCode ? "r32-team-picked" : ""}`}
                  onClick={() => onTeamClick(m.awayCode, m.id)}
                >
                  <span className="r32-carousel-flag">{away.flag}</span>
                  <span>{away.name}</span>
                </button>
              </div>
              <p className="r32-carousel-meta">
                {when.day} · {when.time} · {m.venue}
              </p>
              {m.score && <p className="r32-score">{m.score}</p>}
            </article>
          );
        })}
      </div>
      <p className="r32-carousel-hint">← swipe →</p>
    </div>
  );
}
