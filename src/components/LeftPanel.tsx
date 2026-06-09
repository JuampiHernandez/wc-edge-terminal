"use client";

import { useState } from "react";
import type { MarketEvent, Signal } from "@/lib/types";
import { MarketList } from "./MarketList";
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
  const [tab, setTab] = useState<"markets" | "follow">("markets");

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="shrink-0 flex border-b border-border">
        {(["markets", "follow"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 text-[10px] uppercase tracking-[0.2em] py-2 border-b-2 transition-colors ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-subtle hover:text-muted"
            }`}
          >
            {t === "markets" ? "Markets" : "Follow"}
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
        ) : (
          <TeamFollow />
        )}
      </div>
    </div>
  );
}
