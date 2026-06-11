"use client";

import { useState } from "react";
import type { MarketEvent, Signal } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { MarketList } from "./MarketList";
import { TeamMarketList } from "./TeamMarketList";
import { TeamFollow } from "./TeamFollow";

export function LeftPanel({
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
  const [tab, setTab] = useState<"markets" | "teams" | "follow">("markets");
  const { t } = useLocale();

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="shrink-0 flex border-b border-border">
        {(["markets", "teams", "follow"] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={`flex-1 text-[10px] uppercase tracking-[0.2em] py-2 border-b-2 transition-colors ${
              tab === tabKey
                ? "border-accent text-accent"
                : "border-transparent text-subtle hover:text-muted"
            }`}
          >
            {tabKey === "markets"
              ? t.leftPanel.markets
              : tabKey === "teams"
                ? t.leftPanel.teams
                : t.leftPanel.follow}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "markets" ? (
          <MarketList
            events={events}
            signals={signals}
            selectedSlug={selectedSlug}
            onSelect={onSelect}
          />
        ) : tab === "teams" ? (
          <TeamMarketList events={events} selectedSlug={selectedSlug} onSelect={onSelect} />
        ) : (
          <TeamFollow />
        )}
      </div>
    </div>
  );
}
