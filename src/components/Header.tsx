"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header({ live }: { live: boolean }) {
  const { data: session, status } = useSession();
  const { t } = useLocale();

  return (
    <header className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3 bg-panel">
      <a href="/" className="flex items-center gap-2 shrink-0">
        <span className="text-accent text-sm font-bold tracking-tight">⌖ WC EDGE</span>
      </a>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />

        <a
          href="/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono px-3 py-1.5 border border-border rounded-sm text-muted hover:border-accent hover:text-accent transition-colors"
        >
          {t.header.calendar}
        </a>

        {status === "authenticated" && session?.user ? (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-subtle hidden sm:inline truncate max-w-[120px]">
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-[10px] font-mono px-3 py-1.5 border border-border rounded-sm text-muted hover:text-text"
            >
              {t.header.signOut}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn("google")}
            className="text-[10px] font-mono px-3 py-1.5 border border-accent/50 bg-accent/10 rounded-sm text-accent hover:bg-accent/20 transition-colors"
          >
            {t.header.signUp}
          </button>
        )}

        <span
          className={`w-2 h-2 rounded-full shrink-0 ${live ? "bg-pos live-dot" : "bg-neg"}`}
          title={live ? t.header.live : t.header.offline}
        />
      </div>
    </header>
  );
}
