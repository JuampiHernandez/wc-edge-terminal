"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "wc-edge-follows";

export function readFollows(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeFollows(codes: string[]) {
  localStorage.setItem(KEY, JSON.stringify(codes));
}

export function useFollows() {
  const [follows, setFollows] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFollows(readFollows());
    setReady(true);
  }, []);

  const toggle = useCallback((code: string) => {
    setFollows((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      writeFollows(next);
      return next;
    });
  }, []);

  const setAll = useCallback((codes: string[]) => {
    writeFollows(codes);
    setFollows(codes);
  }, []);

  return { follows, toggle, setAll, ready };
}
