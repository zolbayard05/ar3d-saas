import { DesktopHeroTumble } from "@/components/DesktopHeroTumble";
import { DesktopHowItWorksSection } from "@/components/DesktopHowItWorksSection";
import { DesktopIntroSection } from "@/components/DesktopIntroSection";
import { DesktopCategoriesSection } from "@/components/DesktopCategoriesSection";
import { DesktopShowcaseSection } from "@/components/DesktopShowcaseSection";
import { DesktopPipelineSection } from "@/components/DesktopPipelineSection";
import { DesktopFinalCta } from "@/components/DesktopFinalCta";
import { DesktopWaitlistCta } from "@/components/DesktopWaitlistCta";
import Link from "next/link";

// The reference mockup's real, own-document computed font-family (extracted
// via direct navigation to its cross-origin iframe's src, not the wrapper
// page — see DesktopHeroTumble.tsx) is Geist, which is already this app's
// global font (app/layout.tsx) — no separate font load needed here.
const NAV_LINK_STYLE = { fontSize: "11px", fontWeight: 400, color: "rgb(170, 170, 170)", lineHeight: "16.5px" };

/**
 * Desktop's entire experience (app/page.tsx branches here for any non-mobile
 * UA — see lib/isMobileUserAgent.ts). Being rebuilt section by section per
 * the user's explicit request (2026-09-05) — only the hero is wired up so
 * far; the rest of the page intentionally isn't rendered yet.
 *
 * Every style value below (colors, sizes, spacing) is copied verbatim from
 * getComputedStyle() run directly against the reference mockup's own
 * document (not eyeballed from a screenshot) — see DesktopHeroTumble.tsx
 * for how that measurement was taken.
 */
export async function DesktopLanding() {
  return (
    <main className="relative flex min-h-dvh flex-col bg-[#050505]">
      {/* Apple "Liquid Glass" (WWDC 2025) treatment: a floating capsule,
          not an edge-to-edge bar — real Liquid Glass never spans full
          width, it reads as a distinct material hovering over content.
          backdrop-blur+saturate picks up whatever scrolls underneath
          (dark hero, light Categories/Pipeline sections alike); the dark
          base tint (not a white one) keeps the existing light nav-text
          colors readable over both, since a dark scrim reliably darkens
          either background rather than only working on dark ones. The
          inset top highlight is the glass "rim light" — no extra DOM node
          needed, box-shadow alone gives it. */}
      <nav className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 lg:px-8">
        <div
          className="flex w-full max-w-[1400px] items-center justify-between rounded-full px-6 py-3 lg:px-8"
          style={{
            background:
              "linear-gradient(180deg, rgb(255 255 255 / 0.14) 0%, rgb(255 255 255 / 0.02) 65%), rgb(14 14 12 / 0.45)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid rgb(255 255 255 / 0.14)",
            boxShadow: "0 10px 30px -12px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.25)",
          }}
        >
          <Link href="/" className="flex items-center gap-2 uppercase text-[#f5f4ef]">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed local /public asset, no remote optimization needed */}
            <img src="/icon-192.png" alt="" className="size-6 rounded-md" />
            <span style={{ fontSize: "14px", fontWeight: 750, letterSpacing: "-0.84px" }}>Realify3D</span>
          </Link>
          {/* All 4 targets are real anchors now — #product/#commerce/#ar
              are added to DesktopCategoriesSection/DesktopPipelineSection/
              DesktopShowcaseSection below; #how-it-works is the new section
              inserted right after the hero. Previously 4 of 5 links here
              pointed at IDs that didn't exist anywhere in the codebase. */}
          <div className="hidden items-center gap-8 lg:flex">
            <a href="#product" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
              Бүтээгдэхүүн
            </a>
            <a href="#how-it-works" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
              Хэрхэн ажилладаг
            </a>
            <a href="#commerce" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
              3D Commerce
            </a>
            <a href="#ar" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
              AR
            </a>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hidden hover:text-[#f5f4ef] lg:block" style={NAV_LINK_STYLE}>
              Нэвтрэх
            </Link>
            <DesktopWaitlistCta
              source="nav"
              className="flex items-center gap-1.5 rounded-full bg-[#eeeee9] text-[#111111] hover:opacity-90"
              style={{ fontSize: "11px", fontWeight: 700, padding: "12px 16px", lineHeight: "16.5px" }}
            />
          </div>
        </div>
      </nav>

      {/* Page-wide film grain — achromatic SVG turbulence, fixed, very low
          opacity. Painted after the nav (same z-50, later in DOM wins the
          tie) so it sits above it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 opacity-5 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <DesktopHeroTumble />
      <DesktopHowItWorksSection />
      <DesktopIntroSection />
      <DesktopCategoriesSection />
      <DesktopShowcaseSection />
      <DesktopPipelineSection />
      <DesktopFinalCta />
    </main>
  );
}
