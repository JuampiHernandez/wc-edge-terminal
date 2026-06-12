"use client";

// Left-panel "Matchday" tab: today's games with live 1X2 odds, then upcoming
// games (filtered to followed teams when the user follows anyone).

import { useMemo } from "react";
import type { MatchFixture } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { useFollows } from "@/lib/follows";
import { flagFor } from "@/lib/worldcup";

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function MatchRow({
  m,
  active,
  onSelect,
  showDate,
  locale,
  pendingLabel,
}: {
  m: MatchFixture;
  active: boolean;
  onSelect: (id: string) => void;
  showDate: boolean;
  locale: string;
  pendingLabel: string;
}) {
  const d = new Date(m.kickoff);
  const lang = locale === "es" ? "es" : "en-US";
  const time = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  const date = d.toLocaleDateString(lang, { weekday: "short", day: "numeric" });
  const o = m.odds;
  const homeLeads = o ? o.home >= o.away : false;

  return (
    <button
      type="button"
      onClick={() => onSelect(m.id)}
      className={`w-full text-left px-3 py-2 border-b border-border/50 flex items-center gap-2 transition-colors ${
        active ? "bg-elevated" : "hover:bg-elevated/50"
      }`}
    >
      <div className="shrink-0 w-10 text-center">
        <div className="text-[10px] text-text tabular-nums">{showDate ? date : time}</div>
        <div className="text-[8px] text-subtle truncate">
          {showDate ? time : m.stageLabel?.replace(/^Group /, "Grp ")}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] leading-none">{flagFor(m.homeCode)}</span>
          <span className="text-[11px] text-text truncate flex-1">{m.homeName}</span>
          <span
            className={`text-[11px] tabular-nums ${o && homeLeads ? "font-semibold text-text" : "text-muted"}`}
          >
            {o ? pct(o.home) : "–"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[12px] leading-none">{flagFor(m.awayCode)}</span>
          <span className="text-[11px] text-text truncate flex-1">{m.awayName}</span>
          <span
            className={`text-[11px] tabular-nums ${o && !homeLeads ? "font-semibold text-text" : "text-muted"}`}
          >
            {o ? pct(o.away) : "–"}
          </span>
        </div>
      </div>
      <div className="shrink-0 w-8 text-right">
        <div className="text-[8px] uppercase text-subtle">x</div>
        <div className="text-[10px] tabular-nums text-subtle" title={o ? undefined : pendingLabel}>
          {o ? pct(o.draw) : "–"}
        </div>
      </div>
    </button>
  );
}

export function MatchdayList({
  matchday,
  selectedMatchId,
  onSelectMatch,
}: {
  matchday: MatchFixture[];
  selectedMatchId: string | null;
  onSelectMatch: (id: string) => void;
}) {
  const { t, locale } = useLocale();
  const { follows, ready } = useFollows();

  const now = Date.now();
  const { today, upcoming, filteredByFollows } = useMemo(() => {
    const today = matchday.filter((m) => sameLocalDay(m.kickoff, now));
    const later = matchday.filter((m) => !sameLocalDay(m.kickoff, now) && m.kickoff > now);
    const useFollowFilter = ready && follows.length > 0;
    const upcoming = useFollowFilter
      ? later.filter((m) => follows.includes(m.homeCode) || follows.includes(m.awayCode))
      : later;
    return { today, upcoming, filteredByFollows: useFollowFilter };
  }, [matchday, follows, ready, now]);

  const lang = locale === "es" ? "es" : "en-US";
  const todayLabel = new Date(now).toLocaleDateString(lang, { month: "short", day: "numeric" });

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      <div className="px-3 pt-2 pb-1 shrink-0 flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-[0.25em] text-accent">
          {t.matchday.today} · {todayLabel}
        </span>
        <span className="text-[8px] text-subtle">Polymarket 1X2</span>
      </div>
      {today.length === 0 && (
        <div className="px-3 py-4 text-center text-[10px] text-subtle">{t.matchday.noGamesToday}</div>
      )}
      {today.map((m) => (
        <MatchRow
          key={m.id}
          m={m}
          active={m.id === selectedMatchId}
          onSelect={onSelectMatch}
          showDate={false}
          locale={locale}
          pendingLabel={t.matchday.oddsPending}
        />
      ))}

      <div className="px-3 pt-3 pb-1 shrink-0 flex items-baseline justify-between">
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
        <MatchRow
          key={m.id}
          m={m}
          active={m.id === selectedMatchId}
          onSelect={onSelectMatch}
          showDate
          locale={locale}
          pendingLabel={t.matchday.oddsPending}
        />
      ))}
      {!filteredByFollows && upcoming.length > 0 && (
        <div className="px-3 py-2 text-[8px] text-subtle text-center shrink-0">
          {t.matchday.followHint}
        </div>
      )}
    </div>
  );
}
