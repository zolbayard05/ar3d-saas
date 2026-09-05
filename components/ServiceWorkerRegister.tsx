"use client";

import { useEffect } from "react";

/**
 * public/sw.js caches only the public shell — see that file's own comment.
 *
 * Skipped outside production: sw.js caches "/" itself with a stale-while-
 * revalidate strategy (serve the cached shell instantly, refresh it in the
 * background for next time) — exactly the right tradeoff for real
 * visitors, but murder on local dev, where every edit to the landing page
 * needs to show up on the very next reload, not the one after. Confirmed
 * live: with the SW registered, `npm run dev` edits to "/" only ever
 * appeared one reload late, reading as "my change didn't apply" over and
 * over until the SW was unregistered by hand.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  }, []);

  return null;
}
