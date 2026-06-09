"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketEvent, Signal } from "./types";

export type TerminalData = {
  events: MarketEvent[];
  signals: Signal[];
  sources: { id: string; ok: boolean; note?: string }[];
  generatedAt: number;
};

const EMPTY: TerminalData = { events: [], signals: [], sources: [], generatedAt: 0 };

/** Polls /api/terminal on an interval and exposes the latest payload. */
export function useTerminal(intervalMs = 30_000) {
  const [data, setData] = useState<TerminalData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    async function load() {
      try {
        const res = await fetch("/api/terminal", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as TerminalData;
        if (!aliveRef.current) return;
        setData(json);
        setError(null);
      } catch (e) {
        if (aliveRef.current) setError(String(e));
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    }

    void load();
    const iv = setInterval(load, intervalMs);
    return () => {
      aliveRef.current = false;
      clearInterval(iv);
    };
  }, [intervalMs]);

  return { data, loading, error };
}
