"use client";

import { useEffect, useState } from "react";

/** Ticking "M:SS" elapsed since `startIso`, for in-progress generation status text (design/05, 06). */
export function useElapsedTime(startIso: string): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const totalSeconds = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
