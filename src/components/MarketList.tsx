"use client";

import { useMemo, useState } from "react";
import type { Market, MarketEvent } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { flagFor, flagForLabel } from "@/lib/worldcup";
import { fmtUsd } from "@/lib/format";

const DEFAULT_EVENT = "world-cup-winner";

export function MarketList({
  events,
  selectedSlug,
  onSelect,
}: {
  events: MarketEvent[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>(DEFAULT_EVENT);

  const rows = useMemo(() => {
    const all: Market[] = [];
    for (const ev of events) {
      if (eventFilter !== "all" && ev.slug !== eventFilter) continue;
      all.push(...ev.markets);
    }
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter((m) => m.label.toLowerCase().includes(q) || m.eventTitle.toLowerCase().includes(q))
      : all;
    return filtered.sort((a, b) => b.yesPrice - a.yesPrice);
  }, [events, query, eventFilter]);

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
        {rows.map((m) => {
          const active = m.slug === selectedSlug;
          const pct = Math.round(m.yesPrice * 100);
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
