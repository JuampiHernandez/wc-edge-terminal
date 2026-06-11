"use client";

import { useMemo, useState } from "react";
import type { Market, MarketEvent } from "@/lib/types";
import { WC_NATIONS } from "@/lib/teams-list";

function marketForTeam(events: MarketEvent[], code: string): Market | undefined {
  const winner = events.find((e) => e.slug === "world-cup-winner");
  return (
    winner?.markets.find((m) => m.teamCode === code) ??
    events.flatMap((e) => e.markets).find((m) => m.teamCode === code)
  );
}

export function TeamMarketList({
  events,
  selectedSlug,
  onSelect,
}: {
  events: MarketEvent[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const teams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WC_NATIONS.map((team) => ({ team, market: marketForTeam(events, team.code) }))
      .filter(({ market }) => Boolean(market))
      .filter(({ team }) => !q || team.name.toLowerCase().includes(q) || team.code.toLowerCase().includes(q));
  }, [events, query]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="buscar equipos…"
          className="w-full bg-elevated border border-border rounded-sm px-2 py-1 text-[11px] text-text placeholder:text-subtle focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {teams.length === 0 && (
          <div className="py-8 text-center text-[10px] text-subtle">sin equipos</div>
        )}
        {teams.map(({ team, market }) => {
          if (!market) return null;
          const active = market.slug === selectedSlug;
          return (
            <button
              key={team.code}
              type="button"
              onClick={() => onSelect(market.slug)}
              className={`w-full text-left px-3 py-2 border-b border-border/50 flex items-center gap-2 transition-colors ${
                active ? "bg-elevated" : "hover:bg-elevated/50"
              }`}
            >
              <span className="text-sm leading-none shrink-0 w-5 text-center">{team.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text truncate">{team.name}</div>
                <div className="text-[9px] text-subtle truncate">{team.code} · World Cup Winner</div>
              </div>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-text">
                {Math.round(market.yesPrice * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
