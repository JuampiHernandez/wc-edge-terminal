"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketEvent, MatchFixture, Signal, TeamContext } from "./types";

export type TerminalData = {
  events: MarketEvent[];
  matchday: MatchFixture[];
  signals: Signal[];
  teams: Record<string, TeamContext>;
  sources: { id: string; ok: boolean; note?: string }[];
  generatedAt: number;
};

const EMPTY: TerminalData = {
  events: [],
  matchday: [],
  signals: [],
  teams: {},
  sources: [],
  generatedAt: 0,
};

/**
 * Loads /api/terminal once per page load and exposes the payload, plus a manual
 * `refresh()` the user can trigger on demand.
 *
 * Background polling is intentionally disabled: an always-open tab polling every
 * 30s was driving the heavy server-side aggregation around the clock and burning
 * Fluid Active CPU 24/7. The site stays fully usable — it just shows a snapshot
 * taken at load time, and users can refresh to pull fresh data.
 */
export function useTerminal() {
  const [data, setData] = useState<TerminalData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/terminal", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TerminalData;
      if (!aliveRef.current) return;
      setData({ ...json, matchday: json.matchday ?? [] });
      setError(null);
    } catch (e) {
      if (aliveRef.current) setError(String(e));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    // One-shot fetch on mount; state updates happen after the awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}
