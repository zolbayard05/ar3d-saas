"use client";

import { useEffect } from "react";

/** public/sw.js caches only the public shell — see that file's own comment. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  }, []);

  return null;
}
