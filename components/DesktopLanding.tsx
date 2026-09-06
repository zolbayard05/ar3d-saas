import { DesktopHeroTumble } from "@/components/DesktopHeroTumble";
import { DesktopIntroSection } from "@/components/DesktopIntroSection";
import { DesktopCategoriesSection } from "@/components/DesktopCategoriesSection";
import { DesktopWireframeSection } from "@/components/DesktopWireframeSection";
import { DesktopShowcaseSection } from "@/components/DesktopShowcaseSection";
import { DesktopPipelineSection } from "@/components/DesktopPipelineSection";
import { DesktopMaterialSection } from "@/components/DesktopMaterialSection";
import { DesktopFinalCta } from "@/components/DesktopFinalCta";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

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
      {/* The reference nav's own computed background-color is fully
          transparent — no glass/blur bar, it floats directly over the hero. */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-6 lg:px-16">
        <Link
          href="/"
          className="uppercase text-[#f5f4ef]"
          style={{ fontSize: "14px", fontWeight: 750, letterSpacing: "-0.84px" }}
        >
          Realify3D
        </Link>
        <div className="hidden items-center gap-8 lg:flex">
          <a href="#categories" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
            Бүтээгдэхүүн
          </a>
          <a href="#how-it-works" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
            Хэрхэн ажилладаг
          </a>
          <a href="#" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
            Бизнест
          </a>
          <a href="#" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
            Технологи
          </a>
          <a href="#" className="hover:text-[#f5f4ef]" style={NAV_LINK_STYLE}>
            Үнэ
          </a>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="hidden hover:text-[#f5f4ef] lg:block" style={NAV_LINK_STYLE}>
            Нэвтрэх
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 bg-[#eeeee9] text-[#111111] hover:opacity-90"
            style={{ fontSize: "11px", fontWeight: 700, padding: "12px 16px", lineHeight: "16.5px" }}
          >
            Эхлэх
            <ArrowUpRight className="size-3.5" />
          </Link>
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
      <DesktopIntroSection />
      <DesktopCategoriesSection />
      <DesktopWireframeSection />
      <DesktopShowcaseSection />
      <DesktopPipelineSection />
      <DesktopMaterialSection />
      <DesktopFinalCta />
    </main>
  );
}
