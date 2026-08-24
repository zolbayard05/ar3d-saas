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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
