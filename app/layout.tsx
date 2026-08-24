import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Realify",
  description: "Turn a photo into a 3D model you can place in AR.",
  // capable + title auto-generate apple-mobile-web-app-capable and
  // apple-mobile-web-app-title — the two meta tags that make "Add to Home
  // Screen" launch full-screen with no browser chrome, independent of
  // whether a given iOS version also honors the manifest's own
  // display: "standalone" (app/manifest.ts).
  appleWebApp: {
    title: "Realify",
    statusBarStyle: "black-translucent",
  },
  // Next's Metadata API only emits the modern `mobile-web-app-capable`
  // (see appleWebApp above) — current Safari honors the manifest's own
  // display: "standalone" for this, but the legacy Apple-prefixed tag costs
  // nothing to also include and removes any doubt on an older iOS version
  // still trusting it instead.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Deprecated on `metadata` as of Next 14 — themeColor moved here. #050505
// matches app/manifest.ts's theme_color/background_color and
// styles/themes.css's --color-bg, so the browser chrome, the manifest, and
// the page itself are never three different near-blacks.
export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {/* No explicit height here (not h-dvh, not min-h-full) — deliberately.
          h-dvh looked right (every descendant gets "a real ceiling to size
          against") but doesn't hold up on iOS Safari specifically: dvh is
          defined to live-track the browser chrome as it collapses/expands
          during scroll, and there's a currently-open, widely-reported WebKit
          bug (bugs.webkit.org #297779; multiple Apple developer forum
          threads, including one on apple.com's own site) where
          `position: fixed` elements don't reliably stay in sync with that
          live-changing value — the exact BottomNav-vs-feed mismatch this
          project kept hitting. No CSS height unit fixes a bug in how the
          browser positions `fixed` elements relative to it.

          The actual fix lives in app/(app)/layout.tsx: that group's own
          wrapper is `fixed inset-0` now, not height-based at all — `inset:0`
          on a fixed element is computed directly against the real viewport
          edges on every paint, the same mechanism BottomNav's own `fixed`
          positioning already uses, rather than a cached height value that
          has to stay in sync with a second, independently-computed one.
          Because that div escapes the flow entirely (fixed, not in normal
          flow), body's own height is irrelevant to it — body is left with
          no explicit height so other route groups ((model), (auth), the
          landing page) keep their existing natural-page-scroll behavior,
          each sized with their own min-h-dvh main, untouched by this. */}
      <body className="flex flex-col">
        <ServiceWorkerRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
