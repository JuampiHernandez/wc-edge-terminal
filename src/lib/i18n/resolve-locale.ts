import { DEFAULT_LOCALE, LOCALE_COOKIE, SPANISH_COUNTRIES, type Locale } from "./constants";

export const LOCALE_HEADER = "x-locale";

function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "es";
}

function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag || tag === "*") continue;
    if (tag.startsWith("es")) return "es";
    if (tag.startsWith("en")) return "en";
  }
  return null;
}

function localeFromCountry(country: string | null | undefined): Locale | null {
  if (!country) return null;
  return SPANISH_COUNTRIES.has(country.toUpperCase()) ? "es" : "en";
}

export function resolveLocale(input: {
  cookie?: string | null;
  country?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;

  const fromCountry = localeFromCountry(input.country);
  if (fromCountry) return fromCountry;

  const fromLanguage = localeFromAcceptLanguage(input.acceptLanguage);
  if (fromLanguage) return fromLanguage;

  return DEFAULT_LOCALE;
}
