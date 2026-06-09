"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { WC_NATIONS } from "@/lib/teams-list";
import { useFollows } from "@/lib/follows";

type Mode = "all" | "teams";

export default function CalendarPage() {
  const { t } = useLocale();
  const [mode, setMode] = useState<Mode>("all");
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const { follows, toggle } = useFollows();

  const icsPath = useMemo(() => {
    if (mode === "all") return "/api/calendar";
    if (follows.length === 0) return null;
    return `/api/calendar?teams=${follows.sort().join(",")}`;
  }, [mode, follows]);

  const links = useMemo(() => {
    if (typeof window === "undefined" || !icsPath) {
      return { google: "#", webcal: "#" };
    }
    const host = window.location.host;
    const webcal = `webcal://${host}${icsPath}`;
    return {
      google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
      webcal,
    };
  }, [icsPath]);

  const canExport = mode === "all" || follows.length > 0;

  useEffect(() => {
    if (mode === "all") {
      setMatchCount(104);
      return;
    }
    if (!icsPath) {
      setMatchCount(null);
      return;
    }
    let cancelled = false;
    fetch(icsPath)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setMatchCount((text.match(/BEGIN:VEVENT/g) ?? []).length);
      })
      .catch(() => {
        if (!cancelled) setMatchCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, icsPath]);

  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center p-6">
      <main className="w-full max-w-md border border-border bg-panel rounded-sm p-8 text-center relative">
        <div className="absolute top-4 right-4">
          <LocaleToggle />
        </div>

        <Image
          src="/brand/icon.jpg"
          alt="World Cup Terminal"
          width={64}
          height={64}
          className="mx-auto mb-3 h-16 w-16 rounded-full"
        />
        <h1 className="text-xl font-semibold tracking-tight">{t.calendar.title}</h1>
        <p className="text-[12px] text-subtle mt-2 mb-6">{t.calendar.subtitle}</p>

        <div className="text-left mb-6 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`flex-1 py-2 px-3 text-[11px] font-mono border rounded-sm transition-colors ${
                mode === "all"
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted hover:bg-elevated"
              }`}
            >
              {t.calendar.allMatches}
            </button>
            <button
              type="button"
              onClick={() => setMode("teams")}
              className={`flex-1 py-2 px-3 text-[11px] font-mono border rounded-sm transition-colors ${
                mode === "teams"
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted hover:bg-elevated"
              }`}
            >
              {t.calendar.myTeams}
            </button>
          </div>

          {mode === "teams" && (
            <div>
              <p className="text-[10px] text-subtle mb-1.5">{t.calendar.tapHint}</p>
              <div className="max-h-44 overflow-y-auto border border-border rounded-sm bg-elevated">
                {WC_NATIONS.map((n) => {
                  const on = follows.includes(n.code);
                  return (
                    <button
                      key={n.code}
                      type="button"
                      onClick={() => toggle(n.code)}
                      className={`w-full text-left px-2.5 py-1.5 border-b border-border/50 last:border-b-0 flex items-center gap-2 transition-colors ${
                        on ? "bg-accent/10 text-accent" : "text-text hover:bg-panel"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center text-[9px] ${
                          on ? "border-accent bg-accent/20" : "border-border text-subtle"
                        }`}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="text-sm leading-none">{n.flag}</span>
                      <span className="text-[11px] flex-1">{n.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-subtle mt-1.5">
                {follows.length === 0
                  ? t.calendar.pickCountry
                  : t.calendar.countriesSelected(follows.length)}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <a
            href={links.google}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!canExport}
            className={`block w-full py-3 px-4 text-[12px] font-mono border rounded-sm transition-colors ${
              canExport
                ? "border-accent bg-accent/15 text-accent hover:bg-accent/25"
                : "border-border text-subtle pointer-events-none opacity-50"
            }`}
          >
            {t.calendar.addGoogle}
          </a>
          <a
            href={links.webcal}
            aria-disabled={!canExport}
            className={`block w-full py-3 px-4 text-[12px] font-mono border rounded-sm transition-colors ${
              canExport
                ? "border-border text-text hover:bg-elevated"
                : "border-border text-subtle pointer-events-none opacity-50"
            }`}
          >
            {t.calendar.subscribe}
          </a>
        </div>

        <p className="text-[10px] text-subtle mt-6 leading-relaxed">{t.calendar.timezoneNote}</p>

        <div className="mt-8 pt-6 border-t border-border flex justify-around text-[10px] text-subtle">
          <div>
            <div className="text-lg font-semibold text-text">{matchCount ?? "—"}</div>
            {t.calendar.matches}
          </div>
          <div>
            <div className="text-lg font-semibold text-text">48</div>
            {t.calendar.teams}
          </div>
          <div>
            <div className="text-lg font-semibold text-text">Jun 11</div>
            {t.calendar.kickoff}
          </div>
        </div>

        <a href="/" className="inline-block mt-8 text-[10px] text-accent hover:underline">
          {t.calendar.backToTerminal}
        </a>
      </main>
    </div>
  );
}
