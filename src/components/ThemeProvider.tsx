"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  applyTheme,
  getCalendarEntryTheme,
  getStoredTheme,
  isCalendarPath,
  markAppVisited,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onCalendar = isCalendarPath(pathname);
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    if (!onCalendar) {
      markAppVisited();
    }
  }, [onCalendar]);

  useEffect(() => {
    if (onCalendar) {
      applyTheme(getCalendarEntryTheme());
      return;
    }
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, onCalendar]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((current) => (current === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
