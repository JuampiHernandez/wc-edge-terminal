"use client";

import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";

export function LocaleToggle() {
  const { locale, t, setLocale } = useLocale();
  const next: Locale = locale === "en" ? "es" : "en";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="text-[10px] font-mono px-2 py-1.5 border border-border rounded-sm text-muted hover:border-accent hover:text-accent transition-colors tabular-nums"
      title={next === "es" ? t.locale.switchToEs : t.locale.switchToEn}
      aria-label={next === "es" ? t.locale.switchToEs : t.locale.switchToEn}
    >
      {locale === "en" ? t.locale.es : t.locale.en}
    </button>
  );
}
