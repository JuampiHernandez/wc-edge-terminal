"use client";

// Center view for a selected match: live moneyline odds plus every signal
// (news, injuries, weather, schedule) that could move this market.

import { useMemo } from "react";
import type { MatchFixture, Signal } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { signalsForMatch } from "@/lib/signals";
import { flagFor } from "@/lib/worldcup";
import { fmtUsd, fmtPp } from "@/lib/format";
import { PolymarketCta, SignalRow } from "./MarketDetail";

const TEAM_KINDS = new Set(["injury", "suspension", "card_watch", "news", "line_move"]);
const MAX_PER_GROUP = 12;

function OddsBox({
  label,
  flag,
  price,
  change,
  lead,
}: {
  label: string;
  flag?: string;
  price?: number;
  change?: number;
  lead?: boolean;
}) {
  return (
    <div className={`flex-1 rounded-sm border px-3 py-2 ${lead ? "border-accent/60 bg-elevated" : "border-border"}`}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-subtle truncate">
        {flag && <span className="text-[12px] leading-none">{flag}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">
        {typeof price === "number" ? `${(price * 100).toFixed(1)}%` : "–"}
      </div>
      {typeof change === "number" && change !== 0 && (
        <div
          className="text-[9px] tabular-nums"
          style={{ color: change >= 0 ? "var(--pos)" : "var(--neg)" }}
        >
          {fmtPp(change)}pp 24h
        </div>
      )}
    </div>
  );
}

export function MatchDetail({ match, signals }: { match: MatchFixture; signals: Signal[] }) {
  const { t, locale } = useLocale();
  const lang = locale === "es" ? "es" : "en-US";

  const linked = useMemo(() => signalsForMatch(match, signals), [match, signals]);
  const groups = useMemo(() => {
    const home: Signal[] = [];
    const away: Signal[] = [];
    const shared: Signal[] = [];
    for (const s of linked) {
      const teams = s.entities.teams ?? [];
      const hitsHome = teams.includes(match.homeCode);
      const hitsAway = teams.includes(match.awayCode);
      if (!TEAM_KINDS.has(s.kind) || (hitsHome && hitsAway)) shared.push(s);
      else if (hitsHome) home.push(s);
      else if (hitsAway) away.push(s);
    }
    return { home, away, shared };
  }, [linked, match.homeCode, match.awayCode]);

  const d = new Date(match.kickoff);
  const when = `${d.toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  const o = match.odds;
  const lead: "home" | "away" | null = o ? (o.home >= o.away ? "home" : "away") : null;

  const sections: { key: string; title: string; flag?: string; items: Signal[] }[] = [
    { key: "home", title: match.homeName, flag: flagFor(match.homeCode), items: groups.home },
    { key: "away", title: match.awayName, flag: flagFor(match.awayCode), items: groups.away },
    { key: "shared", title: t.matchDetail.conditions, items: groups.shared },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="text-[9px] uppercase tracking-[0.25em] text-subtle">
          {[match.stageLabel, when, match.venue].filter(Boolean).join(" · ")}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl leading-none">{flagFor(match.homeCode)}</span>
          <h2 className="text-lg text-text font-semibold truncate">
            {match.homeName} <span className="text-subtle font-normal">vs</span> {match.awayName}
          </h2>
          <span className="text-2xl leading-none">{flagFor(match.awayCode)}</span>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-accent">
            {t.matchDetail.moneyline}
          </span>
        </div>
        <div className="flex gap-2">
          <OddsBox
            label={match.homeCode}
            flag={flagFor(match.homeCode)}
            price={o?.home}
            change={o?.homeChange24h}
            lead={lead === "home"}
          />
          <OddsBox label={t.matchDetail.draw} price={o?.draw} />
          <OddsBox
            label={match.awayCode}
            flag={flagFor(match.awayCode)}
            price={o?.away}
            change={o?.awayChange24h}
            lead={lead === "away"}
          />
        </div>
        {o ? (
          <>
            <div className="relative h-2 bg-elevated rounded-full overflow-hidden mt-3 flex">
              <div className="h-full" style={{ width: `${o.home * 100}%`, background: "var(--accent)" }} />
              <div className="h-full bg-muted/40" style={{ width: `${o.draw * 100}%` }} />
              <div className="h-full bg-muted/80" style={{ width: `${o.away * 100}%` }} />
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-subtle">
              <span>
                {t.matchDetail.vol24h} {fmtUsd(o.volume24hr)}
              </span>
              <span>
                {t.matchDetail.liq} {fmtUsd(o.liquidity)}
              </span>
              <span className="ml-auto">
                {t.matchDetail.kickoff} {when}
              </span>
            </div>
            <div className="mt-3">
              <PolymarketCta
                href={`https://polymarket.com/event/${o.eventSlug}`}
                label={t.matchDetail.trade}
              />
            </div>
          </>
        ) : (
          <div className="mt-2 text-[10px] text-subtle">{t.matchday.oddsPending}</div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
        <div className="text-[10px] uppercase tracking-[0.25em] text-accent mb-1">
          {t.matchDetail.whatMoves}
        </div>
        <div className="text-[9px] text-subtle mb-2">
          {t.matchDetail.whatMovesSubtitle(linked.length)}
        </div>
        {linked.length === 0 && (
          <div className="py-6 text-center text-[10px] text-subtle">{t.matchDetail.noNews}</div>
        )}
        {sections.map((g) => {
          if (g.items.length === 0) return null;
          return (
            <div key={g.key} className="mb-3">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-subtle mb-1">
                {g.flag && <span className="text-[11px] leading-none">{g.flag}</span>}
                <span>{g.title}</span>
                <span className="text-subtle/70">· {g.items.length}</span>
              </div>
              {g.items.slice(0, MAX_PER_GROUP).map((s) => (
                <SignalRow key={s.id} s={s} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
