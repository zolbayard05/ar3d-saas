"use client";

import { useEffect, useState } from "react";

/** Raw ticking seconds elapsed since `startIso` — the timer behind useElapsedTime's "M:SS" string. */
export function useElapsedSeconds(startIso: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
}
