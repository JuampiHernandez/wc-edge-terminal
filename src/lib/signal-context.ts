import type { Locale } from "@/lib/i18n/constants";
import type { Signal } from "@/lib/types";

/** LLM refusal boilerplate occasionally stored as a digest — never show it. */
const REFUSAL_RE =
  /^(i can(no|')t|i cannot|i(['']| a)m (sorry|unable)|sorry[, ]|as an ai|non posso|no puedo|lo siento|je ne peux|ich kann)/i;

/** English digest stored once at cron — shown for every UI locale. */
export function signalContext(signal: Signal): string | undefined {
  const ctx = signal.context ?? signal.contextEn;
  if (!ctx || REFUSAL_RE.test(ctx.trim())) return undefined;
  return ctx;
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
