"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (selectedSlug || markets.length === 0) return;
    const winner = data.events.find((e) => e.slug === "world-cup-winner");
    const top = winner?.markets[0];
    setSelectedSlug(top?.slug ?? markets[0]?.slug ?? null);
  }, [selectedSlug, markets, data.events]);

  const selected = useMemo(
    () => markets.find((m) => m.slug === selectedSlug) ?? null,
    [markets, selectedSlug],
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
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />
        </aside>

        <section className="terminal-col terminal-col-center">
          <MarketDetail market={selected} signals={data.signals} />
        </section>

        <aside className="terminal-col terminal-col-right hidden lg:flex">
          <SignalFeed signals={data.signals} onJump={jumpFromSignal} />
        </aside>
      </div>

      <footer className="terminal-footer">
        <MispricingBoard edges={edges} onSelect={setSelectedSlug} selectedSlug={selectedSlug} />
      </footer>
    </div>
  );
}
