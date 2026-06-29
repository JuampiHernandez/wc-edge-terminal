"use client";

import { useState } from "react";
import { useTerminal } from "@/lib/useTerminal";
import { Header } from "./Header";
import { R32Showcase } from "./R32Showcase";
import { CountryNewsPanel } from "./CountryNewsPanel";

export function Terminal() {
  const { data, loading, error } = useTerminal();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const live = !error && !loading;

  return (
    <div className="showcase-shell">
      <Header live={live} />

      <main className="showcase-main">
        <R32Showcase selectedCode={selectedCode} onSelect={setSelectedCode} />
        <CountryNewsPanel code={selectedCode} signals={data.signals} loading={loading} />
      </main>
    </div>
  );
}
