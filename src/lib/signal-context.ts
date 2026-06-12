import type { Locale } from "@/lib/i18n/constants";
import type { Signal } from "@/lib/types";

/** English digest stored once at cron — shown for every UI locale. */
export function signalContext(signal: Signal): string | undefined {
  return signal.context ?? signal.contextEn;
}

/**
 * Digest line for the signal feed / market detail.
 * Generated once in English at cron time — same text for en and es UI
 * (static labels still translate via i18n files).
 */
export function localizedSignalContext(signal: Signal, _locale: Locale): string | undefined {
  return signalContext(signal);
}

export function signalHasLocalizedContext(signal: Signal, locale: Locale): boolean {
  return Boolean(localizedSignalContext(signal, locale));
}
