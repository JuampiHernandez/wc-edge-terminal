"use client";

import { useMemo, useState } from "react";
import { useTerminal } from "@/lib/useTerminal";
import { rankEdges } from "@/lib/edge";
import { linksToMarket } from "@/lib/signals";
import type { Market, Signal } from "@/lib/types";
import { Header } from "./Header";
import { LeftPanel } from "./LeftPanel";
import { MarketDetail } from "./MarketDetail";
import { SignalFeed } from "./SignalFeed";
import { MispricingBoard } from "./MispricingBoard";

export function Terminal() {
  const { data, loading, error } = useTerminal(30_000);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const markets = useMemo<Market[]>(
    () => data.events.flatMap((e) => e.markets),
    [data.events],
  );

  const edges = useMemo(() => rankEdges(data.events, data.signals), [data.events, data.signals]);

  const defaultSelectedSlug = useMemo(() => {
    if (markets.length === 0) return null;
    const winner = data.events.find((e) => e.slug === "world-cup-winner");
    const top = winner?.markets[0];
    return top?.slug ?? markets[0]?.slug ?? null;
  }, [markets, data.events]);

  const effectiveSelectedSlug =
    selectedSlug && markets.some((m) => m.slug === selectedSlug) ? selectedSlug : defaultSelectedSlug;

  const selected = useMemo(
    () => markets.find((m) => m.slug === effectiveSelectedSlug) ?? null,
    [markets, effectiveSelectedSlug],
  );

  function jumpFromSignal(s: Signal) {
    const hit = markets.find((m) => linksToMarket(s, m));
    if (hit) setSelectedSlug(hit.slug);
  }

  const live = !error && !loading;

  return (
    <div className="terminal-shell">
      <Header live={live} />

      <div className="terminal-main">
        <aside className="terminal-col terminal-col-left hidden lg:flex">
          <LeftPanel
            events={data.events}
            signals={data.signals}
            selectedSlug={effectiveSelectedSlug}
            onSelect={setSelectedSlug}
          />
        </aside>

        <section className="terminal-col terminal-col-center">
          <MarketDetail
            market={selected}
            signals={data.signals}
            teamContext={selected?.teamCode ? data.teams[selected.teamCode] : undefined}
          />
        </section>

        <aside className="terminal-col terminal-col-right hidden lg:flex">
          <SignalFeed signals={data.signals} onJump={jumpFromSignal} />
        </aside>
      </div>

      <footer className="terminal-footer">
        <MispricingBoard edges={edges} onSelect={setSelectedSlug} selectedSlug={effectiveSelectedSlug} />
      </footer>
    </div>
  );
}
