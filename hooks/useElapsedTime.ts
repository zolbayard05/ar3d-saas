"use client";

import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";

/** Ticking "M:SS" elapsed since `startIso`, for in-progress generation status text. */
export function useElapsedTime(startIso: string): string {
  const totalSeconds = useElapsedSeconds(startIso);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
