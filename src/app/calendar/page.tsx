"use client";

import { useMemo } from "react";

export default function CalendarPage() {
  const links = useMemo(() => {
    if (typeof window === "undefined") return { google: "#", webcal: "#", download: "/world_cup_2026.ics" };
    const host = window.location.host;
    const webcal = `webcal://${host}/world_cup_2026.ics`;
    return {
      google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
      webcal,
      download: "/world_cup_2026.ics",
    };
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-text flex items-center justify-center p-6">
      <main className="w-full max-w-md border border-border bg-panel rounded-sm p-8 text-center">
        <div className="text-4xl mb-3">🏆</div>
        <h1 className="text-xl font-semibold tracking-tight">FIFA World Cup 2026</h1>
        <p className="text-[12px] text-subtle mt-2 mb-8">
          Every match, in your calendar. One tap.
        </p>

        <div className="space-y-2">
          <a
            href={links.google}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 px-4 text-[12px] font-mono border border-accent bg-accent/15 text-accent rounded-sm hover:bg-accent/25 transition-colors"
          >
            Add to Google Calendar
          </a>
          <a
            href={links.webcal}
            className="block w-full py-3 px-4 text-[12px] font-mono border border-border text-text rounded-sm hover:bg-elevated transition-colors"
          >
            Subscribe (Apple / Outlook)
          </a>
          <a
            href={links.download}
            download
            className="block w-full py-3 px-4 text-[12px] font-mono border border-border text-muted rounded-sm hover:bg-elevated transition-colors"
          >
            Download .ics file
          </a>
        </div>

        <p className="text-[10px] text-subtle mt-6 leading-relaxed">
          Times show in your timezone. Stadium &amp; city are in each event location.
        </p>

        <div className="mt-8 pt-6 border-t border-border flex justify-around text-[10px] text-subtle">
          <div>
            <div className="text-lg font-semibold text-text">104</div>
            matches
          </div>
          <div>
            <div className="text-lg font-semibold text-text">48</div>
            teams
          </div>
          <div>
            <div className="text-lg font-semibold text-text">Jun 11</div>
            kickoff
          </div>
        </div>

        <a href="/" className="inline-block mt-8 text-[10px] text-accent hover:underline">
          ← back to terminal
        </a>
      </main>
    </div>
  );
}
