import type { SignalKind } from "@/lib/types";
import { KIND_META, toneColor } from "@/lib/signal-meta";
import { DEFAULT_LOCALE, type Locale } from "./constants";
import { en, type Messages } from "./en";
import { es } from "./es";

const MESSAGES: Record<Locale, Messages> = { en, es };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

export function kindLabel(locale: Locale, kind: SignalKind): string {
  return getMessages(locale).signalKinds[kind];
}

export function localizedKindMeta(locale: Locale, kind: SignalKind) {
  const base = KIND_META[kind];
  return { ...base, label: kindLabel(locale, kind) };
}

export { toneColor, KIND_META, KIND_ORDER } from "@/lib/signal-meta";
export { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./constants";
export { resolveLocale, LOCALE_HEADER } from "./resolve-locale";
