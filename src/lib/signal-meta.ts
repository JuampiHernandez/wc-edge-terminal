import type { SignalKind } from "./types";

export type Tone = "pos" | "neg" | "flow" | "neutral";

export const KIND_META: Record<SignalKind, { label: string; glyph: string; tone: Tone }> = {
  injury: { label: "INJURY", glyph: "✚", tone: "neg" },
  suspension: { label: "SUSPENSION", glyph: "⊘", tone: "neg" },
  card_watch: { label: "CARD WATCH", glyph: "▮", tone: "neg" },
  weather: { label: "WEATHER", glyph: "☂", tone: "neutral" },
  referee: { label: "REFEREE", glyph: "⚑", tone: "neutral" },
  news: { label: "NEWS", glyph: "■", tone: "neutral" },
  social_velocity: { label: "SOCIAL", glyph: "◆", tone: "neutral" },
  whale_flow: { label: "WHALE FLOW", glyph: "≋", tone: "flow" },
  line_move: { label: "PRICE MOVE", glyph: "↕", tone: "neutral" },
  cross_book: { label: "CROSS-BOOK", glyph: "⇄", tone: "neutral" },
};

export const toneColor: Record<Tone, string> = {
  pos: "var(--pos)",
  neg: "var(--neg)",
  flow: "var(--accent)",
  neutral: "var(--muted)",
};

export const KIND_ORDER: SignalKind[] = [
  "injury",
  "suspension",
  "card_watch",
  "news",
  "line_move",
  "weather",
];
