"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useLocale } from "@/components/LocaleProvider";

function SunIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="w-3 h-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="3" />
      <path strokeLinecap="round" d="M8 1.5v1.25M8 13.25V14.5M14.5 8h-1.25M2.75 8H1.5M12.4 3.6l-.88.88M4.48 11.52l-.88.88M12.4 12.4l-.88-.88M4.48 4.48l-.88-.88" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="w-3 h-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12.8 10.2a5.5 5.5 0 0 1-7-7 5.5 5.5 0 1 0 7 7Z"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 border border-border rounded-sm text-muted hover:border-accent hover:text-accent transition-colors"
      title={isLight ? t.theme.switchToDark : t.theme.switchToLight}
      aria-label={isLight ? t.theme.switchToDark : t.theme.switchToLight}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
      {isLight ? t.theme.dark : t.theme.light}
    </button>
  );
}
