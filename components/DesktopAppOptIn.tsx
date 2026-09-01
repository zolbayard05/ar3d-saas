"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

// One year — an explicit opt-in should stick across visits, not re-prompt
// every session. Matches lib/supabase/proxy.ts's DESKTOP_OPT_IN_COOKIE name
// exactly; that file is the actual gate this cookie disables, this button is
// just the one place that ever sets it.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Sits beside DesktopQrCard on the landing page (DesktopFinalCta.tsx) as
 * the escape hatch from lib/supabase/proxy.ts's desktop gate — that gate's
 * own justification (AR only works on a phone, so a desktop visitor has
 * nothing to do in the functional app) stopped being universally true once
 * the Chrome extension (right-click a product photo -> 3D) gave desktop
 * visitors a real reason to want Library/Settings without picking up a
 * phone. The QR code stays the default path (most visitors are here to try
 * AR, which genuinely needs a phone); this is for the visitor who already
 * knows they want the desktop app.
 *
 * document.cookie is synchronous, so it's already in the browser's cookie
 * jar before router.push's own request fires — proxy.ts (which reads
 * request cookies) sees it on that very first request, same as it would
 * for a full page load.
 */
export function DesktopAppOptIn() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `realify-desktop-opt-in=1; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
        router.push("/dashboard");
      }}
      className="flex items-center gap-1.5 text-small text-landing-text-faint underline underline-offset-4 hover:text-landing-text"
    >
      Эсвэл desktop дээрээ үргэлжлүүлэх
      <ArrowRight className="size-3.5" />
    </button>
  );
}
