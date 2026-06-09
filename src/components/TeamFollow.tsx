"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "@/components/LocaleProvider";
import { WC_NATIONS } from "@/lib/teams-list";
import { useFollows } from "@/lib/follows";

export function TeamFollow() {
  const { follows, toggle } = useFollows();
  const { data: session, status } = useSession();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const filtered = WC_NATIONS.filter((n) =>
    n.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function saveDigest() {
    if (status !== "authenticated") {
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
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted mb-1">{t.teamFollow.title}</div>
        <div className="text-[9px] text-subtle mb-2">{t.teamFollow.subtitle}</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.teamFollow.searchPlaceholder}
          className="w-full bg-elevated border border-border rounded-sm px-2 py-1 text-[11px] text-text placeholder:text-subtle focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.map((n) => {
          const on = follows.includes(n.code);
          return (
            <button
              key={n.code}
              type="button"
              onClick={() => toggle(n.code)}
              className={`w-full text-left px-3 py-2 border-b border-border/50 flex items-center gap-2 transition-colors ${
                on ? "bg-accent/10" : "hover:bg-elevated/50"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-sm border shrink-0 flex items-center justify-center text-[10px] ${
                  on ? "border-accent bg-accent/20 text-accent" : "border-border text-subtle"
                }`}
              >
                {on ? "✓" : ""}
              </span>
              <span className="text-sm leading-none">{n.flag}</span>
              <span className="text-[11px] text-text flex-1">{n.name}</span>
              <span className="text-[9px] text-subtle">{n.code}</span>
            </button>
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
