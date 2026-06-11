"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Market, MarketEvent } from "@/lib/types";
import { useLocale } from "@/components/LocaleProvider";
import { WC_NATIONS } from "@/lib/teams-list";
import { useFollows } from "@/lib/follows";
import { createClient } from "@/lib/supabase/client";

function marketForTeam(events: MarketEvent[], code: string): Market | undefined {
  const winner = events.find((e) => e.slug === "world-cup-winner");
  return (
    winner?.markets.find((m) => m.teamCode === code) ??
    events.flatMap((e) => e.markets).find((m) => m.teamCode === code)
  );
}

export function TeamMarketList({
  events,
  selectedSlug,
  onSelect,
}: {
  events: MarketEvent[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const { follows, toggle, setAll } = useFollows();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/follow")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { teams?: string[] } | null) => {
        if (data?.teams && data.teams.length > 0) setAll(data.teams);
      })
      .catch(() => {});
  }, [user, setAll]);

  const teams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WC_NATIONS.map((team) => ({ team, market: marketForTeam(events, team.code) }))
      .filter(({ market }) => Boolean(market))
      .filter(({ team }) => !q || team.name.toLowerCase().includes(q) || team.code.toLowerCase().includes(q));
  }, [events, query]);

  async function saveDigest() {
    if (!user) {
      setMsg(t.teamFollow.signUpForDigest);
      return;
    }
    if (follows.length === 0) {
      setMsg(t.teamFollow.selectTeam);
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: follows }),
      });
      const data = (await res.json()) as { error?: string; digest?: string };
      if (!res.ok) throw new Error(data.error ?? "failed");
      setMsg(t.teamFollow.digestEnabled(data.digest ?? ""));
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.teamFollow.searchPlaceholder}
          className="w-full bg-elevated border border-border rounded-sm px-2 py-1 text-[11px] text-text placeholder:text-subtle focus:outline-none focus:border-accent"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {teams.length === 0 && (
          <div className="py-8 text-center text-[10px] text-subtle">{t.marketList.noMarkets}</div>
        )}
        {teams.map(({ team, market }) => {
          if (!market) return null;
          const active = market.slug === selectedSlug;
          const followed = follows.includes(team.code);
          return (
            <div
              key={team.code}
              className={`flex items-center border-b border-border/50 transition-colors ${
                active ? "bg-elevated" : followed ? "bg-accent/5" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(market.slug)}
                className={`flex-1 min-w-0 text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                  active ? "" : "hover:bg-elevated/50"
                }`}
              >
                <span className="text-sm leading-none shrink-0 w-5 text-center">{team.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-text truncate">{team.name}</div>
                  <div className="text-[9px] text-subtle truncate">{team.code} · World Cup Winner</div>
                </div>
              </button>
              <button
                type="button"
                aria-label={followed ? `${team.name} followed` : `Follow ${team.name}`}
                aria-pressed={followed}
                onClick={() => toggle(team.code)}
                className="shrink-0 px-3 py-2 hover:bg-elevated/50 transition-colors"
              >
                <span
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center text-[10px] ${
                    followed ? "border-accent bg-accent/20 text-accent" : "border-border text-subtle"
                  }`}
                >
                  {followed ? "✓" : ""}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="shrink-0 px-3 py-2 border-t border-border space-y-1.5">
        <div className="text-[9px] text-subtle">{t.teamFollow.teamsSelected(follows.length)}</div>
        <button
          type="button"
          onClick={saveDigest}
          disabled={saving}
          className="w-full text-[10px] font-mono py-1.5 border border-accent/50 bg-accent/10 text-accent rounded-sm hover:bg-accent/20 disabled:opacity-50"
        >
          {saving ? t.teamFollow.saving : t.teamFollow.enableDigest}
        </button>
        {msg && <div className="text-[9px] text-muted leading-snug">{msg}</div>}
      </div>
    </div>
  );
}
