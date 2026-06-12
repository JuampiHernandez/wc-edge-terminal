"use client";

// Right column: "Radar" (curated — today's match markets with odds + the news
// linked to each) is the default; the raw global signal feed lives behind the
// "Feed" tab for power users.

import { useState } from "react";
import type { MatchFixture, Signal } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { MatchRadar } from "./MatchRadar";
import { SignalFeed } from "./SignalFeed";

type Tab = "radar" | "feed";

export function RightPanel({
  matchday,
  signals,
  selectedMatchId,
  onSelectMatch,
  onJump,
}: {
  matchday: MatchFixture[];
  signals: Signal[];
  selectedMatchId: string | null;
  onSelectMatch: (id: string) => void;
  onJump: (s: Signal) => void;
}) {
  const [tab, setTab] = useState<Tab>("radar");
  const { t } = useLocale();

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="shrink-0 flex border-b border-border">
        {(["radar", "feed"] as const).map((tabKey) => (
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
            {tabKey === "radar" ? t.radar.tab : t.radar.feedTab}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "radar" ? (
          <MatchRadar
            matchday={matchday}
            signals={signals}
            selectedMatchId={selectedMatchId}
            onSelectMatch={onSelectMatch}
          />
        ) : (
          <SignalFeed signals={signals} onJump={onJump} />
        )}
      </div>
    </div>
  );
}
