/**
 * Single source of truth for "is this request from a phone" — used both to
 * gate desktop traffic away from the functional app (lib/supabase/proxy.ts)
 * and to branch app/page.tsx between the mobile splash and the desktop
 * marketing landing. AR only works on a mobile device (rule 9/10 — WebXR is
 * unavailable on desktop and iPhone Safari alike; AR launches through
 * native Quick Look/Scene Viewer), so a desktop visitor has nothing to do
 * in the functional app anyway.
 *
 * Standard UA heuristic. iPadOS Safari's DEFAULT user agent is
 * indistinguishable from macOS (Apple's own choice since iOS 13) — an iPad
 * in default mode will be treated as desktop and see the landing page.
 * Acceptable known gap, not silently swept under the rug: an iPad *can* do
 * AR Quick Look, but there's no reliable server-side signal for it without
 * the visitor switching on Safari's "Request Mobile Website" themselves.
 */
export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPod|iPad|Mobi/i.test(userAgent);
}
