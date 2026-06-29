"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { R32_FIXTURES } from "@/lib/bracket-r32";

const ICS_PATH = "/api/calendar?round=r32";

export default function RoundOf32CalendarPage() {
  const { t } = useLocale();
  const [matchCount, setMatchCount] = useState<number | null>(R32_FIXTURES.length);

  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => "",
  );

  const links = useMemo(() => {
    if (!host) {
      return { google: "#", webcal: "#" };
    }
    const webcal = `webcal://${host}${ICS_PATH}`;
    return {
      google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
      webcal,
    };
  }, [host]);

  useEffect(() => {
    let cancelled = false;
    fetch(ICS_PATH)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setMatchCount((text.match(/BEGIN:VEVENT/g) ?? []).length);
      })
      .catch(() => {
        if (!cancelled) setMatchCount(R32_FIXTURES.length);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center p-6">
      <main className="w-full max-w-md border border-border bg-panel rounded-sm p-8 text-center relative">
        <p className="absolute top-4 left-4 text-[10px] text-subtle">by juampi</p>
        <div className="absolute top-4 right-4">
          <LocaleToggle />
        </div>

        <Image
          src="/brand/icon.png"
          alt="World Cup Terminal"
          width={64}
          height={64}
          className="mx-auto mb-3 h-16 w-16"
        />
        <h1 className="text-xl font-semibold tracking-tight">{t.header.calendar}</h1>
        <p className="text-[12px] text-subtle mt-2 mb-6">{t.header.calendarHint}</p>

        <div className="space-y-2">
          <a
            href={links.webcal}
            className="block w-full py-3 px-4 text-[12px] font-mono border border-accent bg-accent/15 text-accent rounded-sm transition-colors hover:bg-accent/25"
          >
            {t.calendar.addToCalendar}
          </a>
          <a
            href={links.google}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 px-4 text-[12px] font-mono border border-border text-muted rounded-sm transition-colors hover:bg-elevated hover:text-text"
          >
            {t.calendar.addToGoogle}
          </a>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex justify-around text-[10px] text-subtle">
          <div>
            <div className="text-lg font-semibold text-text">{matchCount ?? "—"}</div>
            {t.calendar.matches}
          </div>
          <div>
            <div className="text-lg font-semibold text-text">32</div>
            {t.calendar.teams}
          </div>
        </div>

        <a href="/" className="inline-block mt-8 text-[10px] text-accent hover:underline">
          {t.calendar.backToTerminal}
        </a>
      </main>
    </div>
  );
}
