"use client";

import { useMemo } from "react";
import type { Signal } from "@/lib/types";
import { INFO_SIGNAL_KINDS } from "@/lib/signals";
import { flagFor } from "@/lib/worldcup";
import { nationName } from "@/lib/teams-list";
import { useLocale } from "@/components/LocaleProvider";

const OFFICIAL_SOURCES =
  /bbc|guardian|espn|fifa|skysports|reuters|associated press|ap news|cbssports|fourfourtwo|independent|sportsnet|marca/i;

function signalsForNation(code: string, signals: Signal[]): Signal[] {
  return signals
    .filter((s) => INFO_SIGNAL_KINDS.includes(s.kind))
    .filter((s) => s.entities.teams?.includes(code))
    .filter((s) => OFFICIAL_SOURCES.test(s.source) || s.confidence >= 0.65)
    .sort((a, b) => b.t - a.t || b.severity - a.severity)
    .slice(0, 8);
}

function timeAgo(ts: number, locale: string): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return new Date(ts).toLocaleDateString(locale === "es" ? "es" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

type Props = {
  code: string | null;
  signals: Signal[];
  loading: boolean;
};

export function CountryNewsPanel({ code, signals, loading }: Props) {
  const { t, locale } = useLocale();

  const items = useMemo(
    () => (code ? signalsForNation(code, signals) : []),
    [code, signals],
  );

  if (!code) {
    return (
      <section className="news-panel news-panel-empty">
        <p>{t.showcase.pickCountry}</p>
      </section>
    );
  }

  const name = nationName(code);
  const flag = flagFor(code);

  return (
    <section className="news-panel">
      <header className="news-panel-header">
        <span className="news-panel-flag">{flag}</span>
        <div>
          <h2>{name}</h2>
          <p>{t.showcase.newsSubtitle}</p>
        </div>
      </header>

      {loading ? (
        <p className="news-panel-muted">{t.showcase.loading}</p>
      ) : items.length === 0 ? (
        <p className="news-panel-muted">{t.showcase.noNews}</p>
      ) : (
        <ul className="news-list">
          {items.map((s) => (
            <li key={s.id}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  <span className="news-headline">{s.headline}</span>
                  <span className="news-meta">
                    {s.source} · {timeAgo(s.t, locale)}
                  </span>
                </a>
              ) : (
                <div>
                  <span className="news-headline">{s.headline}</span>
                  <span className="news-meta">
                    {s.source} · {timeAgo(s.t, locale)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
