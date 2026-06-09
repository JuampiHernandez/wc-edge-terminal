"use client";

import { useMemo, useState } from "react";
import type { Market, MarketEvent, Signal } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { scoreMarket } from "@/lib/edge";
import { INFO_SIGNAL_KINDS, linksToMarket } from "@/lib/signals";
import { flagFor, flagForLabel } from "@/lib/worldcup";
import { fmtUsd } from "@/lib/format";

const DEFAULT_EVENT = "world-cup-winner";

type Row = { market: Market; edge: number; signalCount: number };

export function MarketList({
  events,
  signals,
  selectedSlug,
  onSelect,
}: {
  events: MarketEvent[];
  signals: Signal[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>(DEFAULT_EVENT);

  const rows = useMemo<Row[]>(() => {
    const all: Row[] = [];
    for (const ev of events) {
      if (eventFilter !== "all" && ev.slug !== eventFilter) continue;
      for (const m of ev.markets) {
        const score = scoreMarket(m, signals);
        const linked = signals.filter(
          (s) => INFO_SIGNAL_KINDS.includes(s.kind) && linksToMarket(s, m),
        );
        all.push({ market: m, edge: score.edge, signalCount: linked.length });
      }
    }
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter((r) => r.market.label.toLowerCase().includes(q) || r.market.eventTitle.toLowerCase().includes(q))
      : all;
    return filtered.sort((a, b) => b.market.yesPrice - a.market.yesPrice);
  }, [events, signals, query, eventFilter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.marketList.searchPlaceholder}
          className="w-full bg-elevated border border-border rounded-sm px-2 py-1 text-[11px] text-text placeholder:text-subtle focus:outline-none focus:border-accent"
        />
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="mt-1.5 w-full bg-elevated border border-border rounded-sm px-2 py-1 text-[10px] text-muted focus:outline-none focus:border-accent"
        >
          <option value="all">{t.marketList.allEvents(events.length)}</option>
          {events.map((ev) => (
            <option key={ev.slug} value={ev.slug}>
              {ev.title} ({ev.markets.length})
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 && (
          <div className="py-8 text-center text-[10px] text-subtle">{t.marketList.noMarkets}</div>
        )}
        {rows.map(({ market: m, edge, signalCount }) => {
          const active = m.slug === selectedSlug;
          const pct = Math.round(m.yesPrice * 100);
          const edgePp = edge * 100;
          const hasEdge = Math.abs(edgePp) >= 0.5;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.slug)}
              className={`w-full text-left px-3 py-2 border-b border-border/50 flex items-center gap-2 transition-colors ${
                active ? "bg-elevated" : "hover:bg-elevated/50"
              }`}
            >
              <span className="text-sm leading-none shrink-0 w-5 text-center">
                {flagFor(m.teamCode) !== "◻" ? flagFor(m.teamCode) : flagForLabel(m.label)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text truncate">{m.label}</div>
                <div className="text-[9px] text-subtle truncate">
                  {m.eventTitle} · {fmtUsd(m.volume)}
                </div>
              </div>
              {signalCount > 0 && (
                <span className="shrink-0 text-[8px] px-1 py-0.5 rounded-sm border border-accent/40 text-accent">
                  {signalCount}
                </span>
              )}
              {hasEdge && (
                <span
                  className="shrink-0 text-[9px] font-semibold tabular-nums w-9 text-right"
                  style={{ color: edgePp >= 0 ? "var(--pos)" : "var(--neg)" }}
                >
                  {edgePp >= 0 ? "+" : ""}
                  {edgePp.toFixed(1)}
                </span>
              )}
              <span className="shrink-0 text-[12px] font-semibold tabular-nums w-9 text-right text-text">
                {pct}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
