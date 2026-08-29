"use client";

import { useEffect } from "react";

/**
 * Fixes a reproduced bug: returning from wire.mn's checkout via the phone's
 * back gesture (rather than reaching the success redirect) restores this
 * page from the browser's back-forward cache (bfcache) instead of doing a
 * fresh navigation. A bfcache restore replays the exact DOM/JS snapshot
 * from right before the user left — React's event handlers and any
 * viewport-dependent fixed positioning (BottomNav, rule 39) never
 * re-initialize against the browser chrome's CURRENT state, so the nav
 * visibly shifts position and stops responding to taps until the page is
 * manually reloaded.
 *
 * `pageshow`'s `persisted` flag is the standard way to detect a bfcache
 * restore (the event fires on every page show; `persisted` is false for a
 * normal/fresh load and true only on a bfcache restore) — reloading on
 * that specific case forces a clean hydration against the real, current
 * viewport instead of trying to hand-patch React/layout state back into
 * sync after the fact.
 */
export function BfcacheReload() {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
