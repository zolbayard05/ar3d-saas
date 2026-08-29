"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { buildLogoQr } from "@/lib/qr";

// window.location is unavailable during SSR/first hydration — same
// no-op-subscribe useSyncExternalStore pattern components/ModelShare.tsx
// and components/InstallPrompt.tsx already use for reading a client-only
// global without a setState-in-effect (react-hooks/set-state-in-effect).
function subscribeNever() {
  return () => {};
}
function getOriginSnapshot() {
  return window.location.origin;
}
function getServerOriginSnapshot() {
  return "";
}

/**
 * The desktop landing's one functional CTA — scanning it opens the site's
 * own root URL on the visitor's phone, which lib/supabase/proxy.ts's
 * device gate lets straight through (it only blocks non-mobile UAs), so it
 * lands on the real, unaffected mobile splash → /login flow immediately.
 * Reuses lib/qr.ts's buildLogoQr (extracted from ModelShare.tsx) rather
 * than a second copy of the same canvas/logo-badge logic.
 */
export function DesktopQrCard() {
  const origin = useSyncExternalStore(subscribeNever, getOriginSnapshot, getServerOriginSnapshot);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    buildLogoQr(`${origin}/`)
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [origin]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-glass-border bg-surface-hover p-6 shadow-glass-card">
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt="Realify-г утсандаа нээх QR код"
          className="size-40 rounded-md shadow-card"
        />
      ) : (
        <div className="size-40 animate-pulse rounded-md bg-surface" />
      )}
      <p className="text-small uppercase tracking-wide text-text-muted">
        Утасны камераар уншуулаарай
      </p>
    </div>
  );
}
