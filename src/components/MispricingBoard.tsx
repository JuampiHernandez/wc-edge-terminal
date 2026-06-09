"use client";

import type { EdgeScore } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { fmtPp } from "@/lib/format";
import { flagForLabel } from "@/lib/worldcup";

export function MispricingBoard({
  edges,
  onSelect,
  selectedSlug,
}: {
  edges: EdgeScore[];
  onSelect: (slug: string) => void;
  selectedSlug: string | null;
}) {
  const { t } = useLocale();
  const top = edges.slice(0, 24);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 shrink-0">
        <span className="text-[10px] uppercase tracking-[0.25em] text-accent">{t.mispricing.title}</span>
        <span className="text-[9px] text-subtle">{t.mispricing.subtitle}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden flex items-stretch">
        {top.length === 0 && (
          <div className="flex items-center px-4 text-[10px] text-subtle">{t.mispricing.empty}</div>
        )}
        {top.map((e) => {
          const edgePp = e.edge * 100;
          const color = edgePp >= 0 ? "var(--pos)" : "var(--neg)";
          const active = e.marketSlug === selectedSlug;
          return (
            <button
              key={e.marketSlug}
              type="button"
              onClick={() => onSelect(e.marketSlug)}
              className={`shrink-0 w-40 text-left px-3 py-2 border-r border-border flex flex-col justify-between gap-1 transition-colors ${
                active ? "bg-elevated" : "hover:bg-elevated/50"
              }`}
            >
              <div>
                <div className="text-[11px] text-text truncate flex items-center gap-1">
                  <span className="text-sm leading-none">{flagForLabel(e.label)}</span>
                  {e.label}
                </div>
                <div className="text-[8px] text-subtle truncate">{e.eventTitle}</div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-[9px] text-muted tabular-nums">
                  {Math.round(e.marketPrice * 100)}% → {Math.round(e.fairPrice * 100)}%
                </div>
                <div className="text-sm font-semibold tabular-nums" style={{ color }}>
                  {fmtPp(edgePp)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
