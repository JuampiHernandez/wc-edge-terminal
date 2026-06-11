"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

export function Header({ live }: { live: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const { t } = useLocale();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <header className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3 bg-panel">
      <a href="/" className="flex items-center gap-2 shrink-0" aria-label="World Cup Terminal">
        <Image
          src="/brand/icon.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0"
          priority
          aria-hidden
        />
        <Image
          src="/brand/wordmark.png"
          alt="World Cup Terminal"
          width={160}
          height={28}
          className="h-5 sm:h-6 w-auto"
          priority
        />
      </a>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />

        <a
          href="https://worldcupterminal.xyz/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono px-3 py-1.5 border border-border rounded-sm text-muted hover:border-accent hover:text-accent transition-colors"
        >
          {t.header.calendar}
        </a>

        {ready && user ? (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-subtle hidden sm:inline truncate max-w-[120px]">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-[10px] font-mono px-3 py-1.5 border border-border rounded-sm text-muted hover:text-text"
            >
              {t.header.signOut}
            </button>
          </div>
        ) : ready ? (
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="text-[10px] font-mono px-3 py-1.5 border border-accent/50 bg-accent/10 rounded-sm text-accent hover:bg-accent/20 transition-colors"
          >
            {t.header.signUp}
          </button>
        ) : null}

        <span
          className={`w-2 h-2 rounded-full shrink-0 ${live ? "bg-pos live-dot" : "bg-neg"}`}
          title={live ? t.header.live : t.header.offline}
        />
      </div>
    </header>
  );
}
