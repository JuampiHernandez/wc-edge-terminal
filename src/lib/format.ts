// Small presentation helpers shared across the terminal UI.

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

export function fmtPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** Signed percentage-point delta, e.g. +4.2 / -1.0. */
export function fmtPp(pp: number): string {
  const s = pp >= 0 ? "+" : "";
  return `${s}${pp.toFixed(1)}`;
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return "now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}
