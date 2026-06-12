"use client";

// Right-panel "Radar" tab: one pinned card per match of the day — live 1X2
// odds plus the top news linked to that market — followed by the next games
// of the user's followed teams. A curated alternative to the raw signal feed.

import { useMemo } from "react";
import type { MatchFixture, Signal } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { useFollows } from "@/lib/follows";
import { signalsForMatch } from "@/lib/signals";
import { localizedKindMeta, toneColor, type Locale } from "@/lib/i18n";
import { localizedSignalContext } from "@/lib/signal-context";
import { flagFor } from "@/lib/worldcup";
import { timeAgo } from "@/lib/format";

/** Kinds worth pinning to a match card (causes, not price reactions). */
const RADAR_KINDS = new Set([
  "injury",
  "suspension",
  "card_watch",
  "news",
  "weather",
  "referee",
]);

const MAX_UPCOMING = 6;

function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function topSignals(match: MatchFixture, signals: Signal[], limit: number): Signal[] {
  return signalsForMatch(match, signals)
    .filter((s) => RADAR_KINDS.has(s.kind))
    .sort((a, b) => b.severity - a.severity || b.t - a.t)
    .slice(0, limit);
}

function pct(p?: number): string {
  return typeof p === "number" ? `${Math.round(p * 100)}%` : "–";
}

function NewsLine({ s, locale, nowLabel }: { s: Signal; locale: Locale; nowLabel: string }) {
  const meta = localizedKindMeta(locale, s.kind);
  const digest = localizedSignalContext(s, locale);
  const text = digest ?? s.headline;
  const inner = (
    <>
      <span className="shrink-0 mt-[1px] text-[10px]" style={{ color: toneColor[meta.tone] }} title={meta.label}>
        {meta.glyph}
      </span>
      <span className="flex-1 min-w-0 text-[10px] text-muted leading-snug line-clamp-2">{text}</span>
      <span className="shrink-0 text-[8px] text-subtle tabular-nums mt-[2px]">{timeAgo(s.t, nowLabel)}</span>
    </>
  );
  if (s.url) {
    return (
      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-start gap-1.5 py-1 px-2 -mx-2 rounded-sm hover:bg-elevated/60"
      >
        {inner}
      </a>
    );
  }
  return <div className="flex items-start gap-1.5 py-1">{inner}</div>;
}

function RadarCard({
  m,
  signals,
  active,
  onSelect,
  showDate,
  maxNews,
}: {
  m: MatchFixture;
  signals: Signal[];
  active: boolean;
  onSelect: (id: string) => void;
  showDate: boolean;
  maxNews: number;
}) {
  const { t, locale } = useLocale();
  const lang = locale === "es" ? "es" : "en-US";

  const news = useMemo(() => topSignals(m, signals, maxNews + 1), [m, signals, maxNews]);
  const shown = news.slice(0, maxNews);
  const extra = news.length - shown.length;

  const d = new Date(m.kickoff);
  const time = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = d.toLocaleDateString(lang, { weekday: "short", day: "numeric" });
  const o = m.odds;
  const homeLeads = o ? o.home >= o.away : false;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(m.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(m.id);
        }
      }}
      className={`mx-2 mb-2 rounded-sm border px-2.5 py-2 cursor-pointer transition-colors ${
        active ? "border-accent/60 bg-elevated" : "border-border hover:bg-elevated/40"
      }`}
    >
      <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-subtle">
        <span className="tabular-nums">{showDate ? `${date} · ${time}` : time}</span>
        <span className="truncate ml-2">{m.stageLabel}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[13px] leading-none">{flagFor(m.homeCode)}</span>
        <span
          className={`text-[11px] truncate ${o && homeLeads ? "font-semibold text-text" : "text-muted"}`}
        >
          {m.homeName}
        </span>
        <span
          className={`text-[11px] tabular-nums ${o && homeLeads ? "font-semibold text-text" : "text-muted"}`}
        >
          {pct(o?.home)}
        </span>
        <span className="text-[9px] text-subtle tabular-nums px-1" title={t.matchday.draw}>
          x {pct(o?.draw)}
        </span>
        <span
          className={`text-[11px] tabular-nums ml-auto ${o && !homeLeads ? "font-semibold text-text" : "text-muted"}`}
        >
          {pct(o?.away)}
        </span>
        <span
          className={`text-[11px] truncate max-w-[72px] ${o && !homeLeads ? "font-semibold text-text" : "text-muted"}`}
        >
          {m.awayName}
        </span>
        <span className="text-[13px] leading-none">{flagFor(m.awayCode)}</span>
      </div>

      {o && (
        <div className="relative h-1 bg-elevated rounded-full overflow-hidden mt-1.5 flex">
          <div className="h-full" style={{ width: `${o.home * 100}%`, background: "var(--accent)" }} />
          <div className="h-full bg-muted/40" style={{ width: `${o.draw * 100}%` }} />
          <div className="h-full bg-muted/80" style={{ width: `${o.away * 100}%` }} />
        </div>
      )}

      <div className="mt-1.5 border-t border-border/50 pt-1">
        {shown.length === 0 ? (
          <div className="text-[9px] text-subtle py-0.5">{t.radar.noNews}</div>
        ) : (
          shown.map((s) => <NewsLine key={s.id} s={s} locale={locale} nowLabel={t.time.now} />)
        )}
        {extra > 0 && (
          <div className="text-[8px] text-subtle pt-0.5">{t.radar.more(extra)}</div>
        )}
      </div>
    </div>
  );
}

export function MatchRadar({
  matchday,
  signals,
  selectedMatchId,
  onSelectMatch,
}: {
  matchday: MatchFixture[];
  signals: Signal[];
  selectedMatchId: string | null;
  onSelectMatch: (id: string) => void;
}) {
  const { t } = useLocale();
  const { follows, ready } = useFollows();

  const now = Date.now();
  const { today, upcoming, filteredByFollows } = useMemo(() => {
    const today = matchday.filter((m) => sameLocalDay(m.kickoff, now));
    const later = matchday
      .filter((m) => !sameLocalDay(m.kickoff, now) && m.kickoff > now)
      .sort((a, b) => a.kickoff - b.kickoff);
    const useFollowFilter = ready && follows.length > 0;
    const upcoming = (
      useFollowFilter
        ? later.filter((m) => follows.includes(m.homeCode) || follows.includes(m.awayCode))
        : later
    ).slice(0, MAX_UPCOMING);
    return { today, upcoming, filteredByFollows: useFollowFilter };
  }, [matchday, follows, ready, now]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      <div className="px-3 pt-2 pb-1.5 shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] uppercase tracking-[0.25em] text-accent">
            {t.matchday.today}
          </span>
          <span className="text-[8px] text-subtle">{t.radar.subtitle}</span>
        </div>
      </div>
      {today.length === 0 && (
        <div className="px-3 py-4 text-center text-[10px] text-subtle">
          {t.matchday.noGamesToday}
        </div>
      )}
      {today.map((m) => (
        <RadarCard
          key={m.id}
          m={m}
          signals={signals}
          active={m.id === selectedMatchId}
          onSelect={onSelectMatch}
          showDate={false}
          maxNews={3}
        />
      ))}

      <div className="px-3 pt-2 pb-1.5 shrink-0 flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-[0.25em] text-subtle">
          {t.matchday.upcoming}
        </span>
        <span className="text-[8px] text-subtle">
          {filteredByFollows ? t.matchday.yourTeams : t.matchday.allTeams}
        </span>
      </div>
      {upcoming.length === 0 && (
        <div className="px-3 py-4 text-center text-[10px] text-subtle">
          {t.matchday.noUpcoming}
          {!filteredByFollows && <div className="mt-1">{t.matchday.followHint}</div>}
        </div>
      )}
      {upcoming.map((m) => (
        <RadarCard
          key={m.id}
          m={m}
          signals={signals}
          active={m.id === selectedMatchId}
          onSelect={onSelectMatch}
          showDate
          maxNews={2}
        />
      ))}
      {!filteredByFollows && upcoming.length > 0 && (
        <div className="px-3 pb-2 text-[8px] text-subtle text-center shrink-0">
          {t.matchday.followHint}
        </div>
      )}
    </div>
  );
}
