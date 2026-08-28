"use client";

import { useSyncExternalStore } from "react";

// Tailwind's own default breakpoints (1024px/1280px) — not new values
// invented for this. Checked widest-first so the first match wins.
const BREAKPOINTS = [
  { query: "(min-width: 1280px)", columns: 4 },
  { query: "(min-width: 1024px)", columns: 3 },
] as const;

function getColumns(): number {
  for (const { query, columns } of BREAKPOINTS) {
    if (window.matchMedia(query).matches) return columns;
  }
  return 2;
}

function subscribe(callback: () => void) {
  const mqls = BREAKPOINTS.map(({ query }) => window.matchMedia(query));
  mqls.forEach((mql) => mql.addEventListener("change", callback));
  return () => mqls.forEach((mql) => mql.removeEventListener("change", callback));
}

/**
 * MasonryGrid's column count: 2 below lg (its original, mobile-only
 * design), 3 at lg, 4 at xl. useSyncExternalStore (not useState+useEffect)
 * specifically because its getServerSnapshot (2, matching what SSR has
 * always rendered) and the first client read are allowed to disagree
 * without React treating it as a hydration error — the same category of
 * bug this project hit twice in one session already (2026-08-28) from a
 * plain useEffect-driven window check. Same pattern as
 * components/InstallPrompt.tsx's own window-derived state.
 */
export function useColumnCount(): number {
  return useSyncExternalStore(subscribe, getColumns, () => 2);
}
