export const LOCALE_COOKIE = "wc-edge-locale";

export type Locale = "en" | "es";

export const DEFAULT_LOCALE: Locale = "en";

/** Countries where Spanish is the primary UI language. */
export const SPANISH_COUNTRIES = new Set([
  "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GQ", "GT", "HN", "MX",
  "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE",
]);
