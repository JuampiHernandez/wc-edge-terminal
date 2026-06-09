"use client";

import type { Market, Signal } from "@/lib/types";
import { scoreMarket, signalsForMarket } from "@/lib/edge";
import { INFO_SIGNAL_KINDS } from "@/lib/signals";
import { KIND_META, toneColor } from "@/lib/signal-meta";
import { flagFor, flagForLabel } from "@/lib/worldcup";
import { fmtUsd, fmtPp, timeAgo } from "@/lib/format";

const GROUPS: { title: string; kinds: string[] }[] = [
  { title: "Availability", kinds: ["injury", "suspension", "lineup", "card_watch"] },
  { title: "Schedule", kinds: ["fatigue"] },
  { title: "Conditions", kinds: ["weather", "referee"] },
  { title: "News", kinds: ["news"] },
];

function SignalRow({ s }: { s: Signal }) {
  const meta = KIND_META[s.kind];
  return (
    <a
      href={s.url}
      target={s.url ? "_blank" : undefined}
      rel="noopener noreferrer"
      className={`flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0 ${
        s.url ? "hover:bg-elevated/40 -mx-2 px-2 rounded-sm" : ""
      }`}
    >
      <span className="shrink-0 mt-0.5 text-[10px]" style={{ color: toneColor[meta.tone] }} title={meta.label}>
        {meta.glyph}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-text leading-snug">{s.headline}</div>
        {s.detail && <div className="text-[9px] text-subtle truncate">{s.detail}</div>}
      </div>
      <div className="shrink-0 text-right">
        {s.priceImpact && (
          <div
            className="text-[10px] font-semibold tabular-nums"
            style={{ color: s.priceImpact.direction === "up" ? "var(--pos)" : "var(--neg)" }}
          >
            {s.priceImpact.direction === "up" ? "▲" : "▼"} {s.priceImpact.estPct.toFixed(1)}
          </div>
        )}
        <div className="text-[8px] text-subtle">{timeAgo(s.t)}</div>
      </div>
    </a>
  );
}

export function MarketDetail({ market, signals }: { market: Market | null; signals: Signal[] }) {
  if (!market) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-subtle">
        select a market to see why it moves
      </div>
    );
  }

  const score = scoreMarket(market, signals);
  const linked = signalsForMarket(market, signals).filter((s) =>
    INFO_SIGNAL_KINDS.includes(s.kind),
  );
  const mktPct = market.yesPrice * 100;
  const fairPct = score.fairPrice * 100;
  const edgePp = score.edge * 100;
  const edgeColor = edgePp >= 0 ? "var(--pos)" : "var(--neg)";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="text-[9px] uppercase tracking-[0.25em] text-subtle">{market.eventTitle}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl leading-none">
            {flagFor(market.teamCode) !== "◻" ? flagFor(market.teamCode) : flagForLabel(market.label)}
          </span>
          <h2 className="text-lg text-text font-semibold">{market.label}</h2>
        </div>
        <div className="text-[10px] text-subtle mt-1 truncate">{market.question}</div>
      </div>

      {/* Price vs fair price */}
      <div className="px-4 py-3 border-b border-border shrink-0 grid grid-cols-3 gap-2">
        <Stat label="Market" value={`${mktPct.toFixed(1)}%`} />
        <Stat label="Fair (model)" value={`${fairPct.toFixed(1)}%`} color={edgeColor} />
        <Stat label="Edge" value={`${fmtPp(edgePp)}pp`} color={edgeColor} />
      </div>

      {/* Edge bar */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="relative h-2 bg-elevated rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-muted/40" style={{ width: `${mktPct}%` }} />
          <div
            className="absolute inset-y-0 w-0.5"
            style={{ left: `${fairPct}%`, background: edgeColor }}
            title={`fair ${fairPct.toFixed(1)}%`}
          />
        </div>
        <div className="flex justify-between text-[8px] text-subtle mt-1">
          <span>market {mktPct.toFixed(0)}%</span>
          <span style={{ color: edgeColor }}>fair {fairPct.toFixed(0)}%</span>
        </div>
        <div className="flex gap-3 mt-2 text-[10px] text-subtle">
          <span>vol {fmtUsd(market.volume)}</span>
          <span>liq {fmtUsd(market.liquidity)}</span>
          {typeof market.change24h === "number" && (
            <span style={{ color: market.change24h >= 0 ? "var(--pos)" : "var(--neg)" }}>
              24h {fmtPp(market.change24h)}pp
            </span>
          )}
        </div>
      </div>

      {/* Why this moves */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
        <div className="text-[10px] uppercase tracking-[0.25em] text-accent mb-1">
          Related information
        </div>
        <div className="text-[9px] text-subtle mb-2">
          For this market only · news & factors · {linked.length} item{linked.length === 1 ? "" : "s"}
        </div>
        {linked.length === 0 && (
          <div className="py-6 text-center text-[10px] text-subtle">
            no news or factors linked to this market yet
          </div>
        )}
        {GROUPS.map((g) => {
          const items = linked.filter((s) => g.kinds.includes(s.kind));
          if (items.length === 0) return null;
          return (
            <div key={g.title} className="mb-3">
              <div className="text-[9px] uppercase tracking-[0.2em] text-subtle mb-1">{g.title}</div>
              {items.map((s) => (
                <SignalRow key={s.id} s={s} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.2em] text-subtle">{label}</div>
      <div className="text-lg font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
