import { DesktopLanding } from "@/components/DesktopLanding";

// The landing page is now a single, responsive experience — DesktopLanding
// renders for every visitor, and CSS breakpoints (not server-side UA
// sniffing) govern what's shown at what viewport width. Chrome-extension
// content ("Chrome-д нэмэх" CTAs/copy) is hidden below `lg:` since a
// browser extension has no relevance on a phone — see each Desktop*.tsx
// section for the specific hidden/lg:block or lg:hidden pairs.
//
// This is unrelated to lib/supabase/proxy.ts's device gate or
// lib/isMobileUserAgent.ts, which govern desktop-vs-mobile access to the
// *functional app* (dashboard/library/create — AR only works on a phone).
// "/" is unconditionally exempt from that gate (proxy.ts), so this file
// never actually depended on isMobileUserAgent for anything but choosing
// which JSX to render — that's what's changing here, not the gate itself.
export default function Home() {
  return <DesktopLanding />;
}
