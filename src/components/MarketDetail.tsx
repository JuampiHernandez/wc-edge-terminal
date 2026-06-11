"use client";

import type { Market, Signal, SignalKind, TeamContext } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { scoreMarket, signalsForMarket } from "@/lib/edge";
import { INFO_SIGNAL_KINDS } from "@/lib/signals";
import { localizedKindMeta, toneColor } from "@/lib/i18n";
import { flagFor, flagForLabel } from "@/lib/worldcup";
import { fmtUsd, fmtPp, timeAgo } from "@/lib/format";

const GROUP_DEFS: { key: "availability" | "schedule" | "conditions" | "news"; kinds: SignalKind[] }[] = [
  { key: "availability", kinds: ["injury", "suspension", "lineup", "card_watch"] },
  { key: "schedule", kinds: ["fatigue"] },
  { key: "conditions", kinds: ["weather", "referee"] },
  { key: "news", kinds: ["news"] },
];

function SignalRow({ s }: { s: Signal }) {
  const { locale, t } = useLocale();
  const meta = localizedKindMeta(locale, s.kind);
  const primary = s.context ?? s.headline;
  const secondary = s.context ? s.headline : s.detail;
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
        <div className="text-[11px] text-text leading-snug">{primary}</div>
        {secondary && <div className="text-[9px] text-subtle truncate">{secondary}</div>}
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
        <div className="text-[8px] text-subtle">{timeAgo(s.t, t.time.now)}</div>
      </div>
    </a>
  );
}

function fmtEur(value: number): string {
  if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toFixed(0)}`;
}

function SquadPanel({ teamContext }: { teamContext?: TeamContext }) {
  const players = teamContext?.players ?? [];
  const valuation = teamContext?.valuation?.totalEur;

  return (
    <div className="border-b border-border shrink-0 px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-accent">Plantilla</div>
          <div className="text-[9px] text-subtle">
            {players.length > 0
              ? `${players.length} jugadores en cache`
              : "sin plantilla en cache; el cron la precalienta"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.18em] text-subtle">valoración</div>
          <div className="text-[11px] text-text tabular-nums">
            {valuation ? fmtEur(valuation) : "sin fuente"}
          </div>
          {teamContext?.valuation?.source && (
            <div className="text-[8px] text-subtle">{teamContext.valuation.source}</div>
          )}
        </div>
      </div>
      {players.length > 0 && (
        <div className="mt-2 text-[9px] text-subtle leading-relaxed">
          {players.slice(0, 14).join(" · ")}
          {players.length > 14 ? ` · +${players.length - 14}` : ""}
        </div>
      )}
    </div>
  );
}

export function MarketDetail({
  market,
  signals,
  teamContext,
}: {
  market: Market | null;
  signals: Signal[];
  teamContext?: TeamContext;
}) {
  const { t } = useLocale();

  if (!market) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-subtle">
        {t.marketDetail.selectMarket}
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

      <div className="px-4 py-3 border-b border-border shrink-0 grid grid-cols-3 gap-2">
        <Stat label={t.marketDetail.market} value={`${mktPct.toFixed(1)}%`} />
        <Stat label={t.marketDetail.fair} value={`${fairPct.toFixed(1)}%`} color={edgeColor} />
        <Stat label={t.marketDetail.edge} value={`${fmtPp(edgePp)}pp`} color={edgeColor} />
      </div>

      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="relative h-2 bg-elevated rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-muted/40" style={{ width: `${mktPct}%` }} />
          <div
            className="absolute inset-y-0 w-0.5"
            style={{ left: `${fairPct}%`, background: edgeColor }}
            title={`${t.marketDetail.fair} ${fairPct.toFixed(1)}%`}
          />
        </div>
        <div className="flex justify-between text-[8px] text-subtle mt-1">
          <span>{t.marketDetail.marketPct(mktPct)}</span>
          <span style={{ color: edgeColor }}>{t.marketDetail.fairPct(fairPct)}</span>
        </div>
        <div className="flex gap-3 mt-2 text-[10px] text-subtle">
          <span>
            {t.marketDetail.vol} {fmtUsd(market.volume)}
          </span>
          <span>
            {t.marketDetail.liq} {fmtUsd(market.liquidity)}
          </span>
          {typeof market.change24h === "number" && (
            <span style={{ color: market.change24h >= 0 ? "var(--pos)" : "var(--neg)" }}>
              {t.marketDetail.change24h} {fmtPp(market.change24h)}pp
            </span>
          )}
        </div>
      </div>

      {market.teamCode && <SquadPanel teamContext={teamContext} />}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
        <div className="text-[10px] uppercase tracking-[0.25em] text-accent mb-1">
          {t.marketDetail.relatedInfo}
        </div>
        <div className="text-[9px] text-subtle mb-2">{t.marketDetail.relatedSubtitle(linked.length)}</div>
        {linked.length === 0 && (
          <div className="py-6 text-center text-[10px] text-subtle">{t.marketDetail.noLinked}</div>
        )}
        {GROUP_DEFS.map((g) => {
          const items = linked.filter((s) => g.kinds.includes(s.kind));
          if (items.length === 0) return null;
          return (
            <div key={g.key} className="mb-3">
              <div className="text-[9px] uppercase tracking-[0.2em] text-subtle mb-1">
                {t.marketDetail.groups[g.key]}
              </div>
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
