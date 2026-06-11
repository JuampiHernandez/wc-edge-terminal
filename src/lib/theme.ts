export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "wc-edge-theme";
export const CALENDAR_THEME: Theme = "light";
export const APP_VISITED_KEY = "wc-from-app";

export function isCalendarPath(pathname: string): boolean {
  return pathname === "/calendar" || pathname.startsWith("/calendar/");
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export function cameFromApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(APP_VISITED_KEY) === "1") return true;
    const ref = document.referrer;
    if (ref) return new URL(ref).origin === window.location.origin;
  } catch {
    /* ignore */
  }
  return false;
}

export function markAppVisited(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(APP_VISITED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Light for shared/direct calendar links; terminal theme when opened from the app. */
export function getCalendarEntryTheme(): Theme {
  return cameFromApp() ? getStoredTheme() : CALENDAR_THEME;
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
