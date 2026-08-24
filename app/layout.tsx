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
  title: "AR3D",
  description: "Turn a photo into a 3D model you can place in AR.",
  // capable + title auto-generate apple-mobile-web-app-capable and
  // apple-mobile-web-app-title — the two meta tags that make "Add to Home
  // Screen" launch full-screen with no browser chrome, independent of
  // whether a given iOS version also honors the manifest's own
  // display: "standalone" (app/manifest.ts).
  appleWebApp: {
    title: "AR3D",
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
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}
    >
      {/* h-dvh, not min-h-full: min-height is a floor, and a floor lets body
          render taller than the CURRENTLY live dvh value whenever the two
          diverge even briefly (e.g. right after a client-only child like
          InstallPrompt mounts and inserts new fixed content post-hydration).
          When that happens body itself becomes scrollable, which shifts
          (app)/layout.tsx's in-flow feed relative to BottomNav (fixed,
          tracks the real viewport, unaffected by body's scroll) — the same
          min vs h footgun that div's own comment already documents, one
          level up, previously dormant here because body only ever had one
          child (already itself h-dvh-sized) until InstallPrompt became a
          second one. h-dvh on both html and body removes the ambiguity
          entirely: every level of the chain reports the same live value. */}
      <body className="flex h-dvh flex-col">
        <ServiceWorkerRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
