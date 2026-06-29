"use client";

import { useCallback, useState } from "react";
import { R32_FIXTURES, fixtureForTeam } from "@/lib/bracket-r32";
import { useLocale } from "@/components/LocaleProvider";
import { AgendaView } from "./r32/AgendaView";
import { CarouselView } from "./r32/CarouselView";
import { ClassicBracketView } from "./r32/ClassicBracketView";
import { RadialBracketView } from "./r32/RadialBracketView";

export type R32ViewId = "agenda" | "carousel" | "radial" | "classic";

export type R32ViewProps = {
  selectedCode: string | null;
  activeMatchId: number | null;
  picks: Record<number, string>;
  onTeamClick: (code: string, matchId: number) => void;
};

const VIEWS: { id: R32ViewId; labelKey: R32ViewId }[] = [
  { id: "classic", labelKey: "classic" },
  { id: "radial", labelKey: "radial" },
  { id: "agenda", labelKey: "agenda" },
  { id: "carousel", labelKey: "carousel" },
];

export function R32Showcase({
  selectedCode,
  onSelect,
}: {
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
}) {
  const { t } = useLocale();
  const [view, setView] = useState<R32ViewId>("classic");
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  const [picks, setPicks] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const m of R32_FIXTURES) {
      if (m.winnerCode) init[m.id] = m.winnerCode;
    }
    return init;
  });

  const onTeamClick = useCallback(
    (code: string, matchId: number) => {
      setActiveMatchId(matchId);
      if (selectedCode === code) {
        setPicks((prev) => ({ ...prev, [matchId]: code }));
        return;
      }
      onSelect(code);
    },
    [onSelect, selectedCode],
  );

  const viewProps: R32ViewProps = {
    selectedCode,
    activeMatchId:
      activeMatchId ??
      (selectedCode ? (fixtureForTeam(selectedCode)?.id ?? null) : null),
    picks,
    onTeamClick,
  };

  return (
    <div className="r32-shell">
      <p className="r32-hint">{t.showcase.hint}</p>

      <div className="r32-view-tabs" role="tablist" aria-label={t.showcase.viewPicker}>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={`r32-view-tab ${view === v.id ? "r32-view-tab-active" : ""}`}
            onClick={() => setView(v.id)}
          >
            {t.showcase.views[v.labelKey]}
          </button>
        ))}
      </div>

      <div className="r32-view-stage" key={view}>
        {view === "radial" && <RadialBracketView {...viewProps} />}
        {view === "classic" && <ClassicBracketView {...viewProps} />}
        {view === "agenda" && <AgendaView {...viewProps} />}
        {view === "carousel" && <CarouselView {...viewProps} />}
      </div>
    </div>
  );
}
