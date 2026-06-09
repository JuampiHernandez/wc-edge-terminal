"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Signal, SignalKind } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { KIND_ORDER, localizedKindMeta, toneColor } from "@/lib/i18n";
import { flagFor } from "@/lib/worldcup";
import { timeAgo } from "@/lib/format";

export function SignalFeed({
  signals,
  onJump,
}: {
  signals: Signal[];
  onJump: (s: Signal) => void;
}) {
  const { locale, t } = useLocale();
  const [active, setActive] = useState<SignalKind | "all">("all");
  const [minSev, setMinSev] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

  const kindsPresent = useMemo(() => {
    const set = new Set(signals.map((s) => s.kind));
    return KIND_ORDER.filter((k) => set.has(k));
  }, [signals]);

  const filtered = useMemo(() => {
    return signals
      .filter((s) => {
        const kindOk = active === "all" || s.kind === active;
        const sevOk = s.severity >= minSev;
        return kindOk && sevOk;
      })
      .slice(0, 120);
  }, [signals, active, minSev]);

  function pickKind(k: SignalKind | "all") {
    setActive(k);
    setMinSev(1);
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [active, minSev]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted">{t.signalFeed.title}</div>
            <div className="text-[9px] text-subtle">{t.signalFeed.subtitle}</div>
          </div>
          <span className="flex items-center gap-1 text-[9px] text-pos">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-pos inline-block" /> {t.signalFeed.live}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          <Chip on={active === "all"} onClick={() => pickKind("all")}>
            {t.signalFeed.all}
          </Chip>
          {kindsPresent.map((k) => (
            <Chip
              key={k}
              on={active === k}
              onClick={() => pickKind(k)}
              color={toneColor[localizedKindMeta(locale, k).tone]}
            >
              {localizedKindMeta(locale, k).label.toLowerCase()}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-[8px] text-subtle mr-0.5">{t.signalFeed.priority}</span>
          {([1, 2, 3] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              title={
                sev === 1
                  ? t.signalFeed.priorityAll
                  : sev === 2
                    ? t.signalFeed.priorityNotable
                    : t.signalFeed.priorityHigh
              }
              onClick={() => setMinSev(sev)}
              className={`text-[8px] px-1.5 py-0.5 rounded-sm border ${
                minSev === sev ? "border-accent text-accent" : "border-border text-subtle"
              }`}
            >
              {sev === 1 ? t.signalFeed.all : sev === 2 ? t.signalFeed.notable : t.signalFeed.high}
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-[10px] text-subtle px-3">
            {t.signalFeed.noMatch}
            {active !== "all" && minSev > 1 && (
              <div className="mt-1 text-[9px]">{t.signalFeed.tryLowering}</div>
            )}
          </div>
        ) : (
          filtered.map((s) => {
            const meta = localizedKindMeta(locale, s.kind);
            const team = s.entities.teams?.[0];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onJump(s)}
                className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-elevated/50 flex items-start gap-2"
              >
                <span className="shrink-0 mt-0.5 text-[11px]" style={{ color: toneColor[meta.tone] }}>
                  {meta.glyph}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-[8px] uppercase tracking-[0.15em]"
                      style={{ color: toneColor[meta.tone] }}
                    >
                      {meta.label}
                    </span>
                    {team && <span className="text-[10px] leading-none">{flagFor(team)}</span>}
                    {s.severity === 3 && (
                      <span className="text-[7px] px-1 rounded-sm bg-accent/20 text-accent">
                        {t.signalFeed.highBadge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text leading-snug">{s.headline}</div>
                  <div className="flex items-center gap-2 text-[8px] text-subtle mt-0.5">
                    <span>{s.source}</span>
                    <span>·</span>
                    <span>
                      {timeAgo(s.t, t.time.now)} {t.signalFeed.ago}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  color,
  children,
}: {
  on: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[9px] px-1.5 py-0.5 rounded-sm border transition-colors ${
        on ? "border-accent bg-accent/10 text-text" : "border-border text-subtle hover:text-muted"
      }`}
      style={on && color ? { borderColor: color, color } : undefined}
    >
      {children}
    </button>
  );
}
