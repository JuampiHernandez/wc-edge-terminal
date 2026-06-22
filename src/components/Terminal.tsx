"use client";

import { useMemo, useState } from "react";
import { useTerminal } from "@/lib/useTerminal";
import { rankEdges } from "@/lib/edge";
import { linksToMarket } from "@/lib/signals";
import type { Market, Signal } from "@/lib/types";
import { Header } from "./Header";
import { LeftPanel } from "./LeftPanel";
import { MarketDetail } from "./MarketDetail";
import { MatchDetail } from "./MatchDetail";
import { RightPanel } from "./RightPanel";
import { MispricingBoard } from "./MispricingBoard";

type Selection = { kind: "market"; slug: string } | { kind: "match"; id: string };

export function Terminal() {
  const { data, loading, error } = useTerminal();
  const [selection, setSelection] = useState<Selection | null>(null);

  const markets = useMemo<Market[]>(
    () => data.events.flatMap((e) => e.markets),
    [data.events],
  );

  const edges = useMemo(() => rankEdges(data.events, data.signals), [data.events, data.signals]);

  // Default: the next game on the board; otherwise the tournament-winner favorite.
  const defaultSelection = useMemo<Selection | null>(() => {
    if (data.matchday.length > 0) return { kind: "match", id: data.matchday[0].id };
    const winner = data.events.find((e) => e.slug === "world-cup-winner");
    const slug = winner?.markets[0]?.slug ?? markets[0]?.slug;
    return slug ? { kind: "market", slug } : null;
  }, [data.matchday, data.events, markets]);

  const effectiveSelection = useMemo<Selection | null>(() => {
    if (selection?.kind === "market" && markets.some((m) => m.slug === selection.slug)) {
      return selection;
    }
    if (selection?.kind === "match" && data.matchday.some((m) => m.id === selection.id)) {
      return selection;
    }
    return defaultSelection;
  }, [selection, markets, data.matchday, defaultSelection]);

  const selectedMarket = useMemo(
    () =>
      effectiveSelection?.kind === "market"
        ? markets.find((m) => m.slug === effectiveSelection.slug) ?? null
        : null,
    [markets, effectiveSelection],
  );

  const selectedMatch = useMemo(
    () =>
      effectiveSelection?.kind === "match"
        ? data.matchday.find((m) => m.id === effectiveSelection.id) ?? null
        : null,
    [data.matchday, effectiveSelection],
  );

  const selectedSlug = effectiveSelection?.kind === "market" ? effectiveSelection.slug : null;
  const selectedMatchId = effectiveSelection?.kind === "match" ? effectiveSelection.id : null;

  const selectMarket = (slug: string) => setSelection({ kind: "market", slug });
  const selectMatch = (id: string) => setSelection({ kind: "match", id });

  function jumpFromSignal(s: Signal) {
    const hit = markets.find((m) => linksToMarket(s, m));
    if (hit) selectMarket(hit.slug);
  }

  const live = !error && !loading;

  return (
    <div className="terminal-shell">
      <Header live={live} />

      <div className="terminal-main">
        <aside className="terminal-col terminal-col-left hidden lg:flex">
          <LeftPanel
            events={data.events}
            matchday={data.matchday}
            selectedSlug={selectedSlug}
            selectedMatchId={selectedMatchId}
            onSelect={selectMarket}
            onSelectMatch={selectMatch}
          />
        </aside>

        <section className="terminal-col terminal-col-center">
          {selectedMatch ? (
            <MatchDetail match={selectedMatch} signals={data.signals} />
          ) : (
            <MarketDetail
              market={selectedMarket}
              signals={data.signals}
              teamContext={selectedMarket?.teamCode ? data.teams[selectedMarket.teamCode] : undefined}
            />
          )}
        </section>

        <aside className="terminal-col terminal-col-right hidden lg:flex">
          <RightPanel
            matchday={data.matchday}
            signals={data.signals}
            selectedMatchId={selectedMatchId}
            onSelectMatch={selectMatch}
            onJump={jumpFromSignal}
          />
        </aside>
      </div>

      <footer className="terminal-footer">
        <MispricingBoard edges={edges} onSelect={selectMarket} selectedSlug={selectedSlug} />
      </footer>
    </div>
  );
}
