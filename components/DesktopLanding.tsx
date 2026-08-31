import { DesktopHeroTumble } from "@/components/DesktopHeroTumble";
import { DesktopIntroSection } from "@/components/DesktopIntroSection";
import { DesktopProcessSection } from "@/components/DesktopProcessSection";
import { DesktopCategoriesSection } from "@/components/DesktopCategoriesSection";
import { DesktopBentoSection } from "@/components/DesktopBentoSection";
import { DesktopFinalCta } from "@/components/DesktopFinalCta";

/**
 * Desktop's entire experience (app/page.tsx branches here for any non-mobile
 * UA — see lib/isMobileUserAgent.ts). AR only works on a phone (rule 9/10),
 * so there's nothing functional to offer a desktop visitor; this is
 * marketing-only, one viewport-tall hero, no deep scroll needed to see the
 * point (2026 3D-landing research: "the main animation should be placed
 * right in the hero section so visitors see it immediately, no scrolling
 * required").
 *
 * The mockup (realify-landing-v3.html) is now cloned 1:1, colors and models
 * included — not adapted to the app's own dark/no-accent-hue tokens
 * anymore (that adaptation was reverted; CLAUDE.md's now-deleted Design
 * system rules used to require it). Every landing color lives under the
 * --color-landing-* namespace (app/globals.css) so it never touches the
 * shared tokens the rest of the product still uses.
 *
 * The mockup used two specific real models throughout — a black tufted
 * leather armchair everywhere except the process section, and a white
 * boucle sofa (its own photo *and* its own 3D result) only in the process
 * section — not any row from the app's own `models` table (an earlier
 * pass here wired up the DB's existing "Wooden Dining Chair"/"Modern
 * Wooden Sofa" showcase rows by title-guessing; completely different,
 * unrelated furniture, corrected). These two were never run through the
 * real generate pipeline at all — they're marketing-only assets, not user
 * content — so they're not `models` rows or GLB either: `objUrl`s the
 * raw OBJ + diffuse PNG the mockup itself renders (`public/icons/mockup/`,
 * extracted from `realify-landing-v3.html`'s `objSrc`/`texDiffuseB64` and
 * `sofaObjSrc`/`sofaTexDiffuseB64`), rendered by `DesktopMockupObject`
 * with the mockup's own Three.js recipe (see that file for why: a GLB/
 * model-viewer conversion of the exact same geometry+texture kept coming
 * out visibly aliased in a way the mockup's own render never was).
 */

export async function DesktopLanding() {
  return (
    <main className="relative flex min-h-dvh flex-col bg-landing-bg">
      {/* Fixed, mix-blend-difference nav with a right-side AR hint — the
          mockup's exact nav treatment. */}
      <nav className="fixed inset-x-0 top-0 z-50 mix-blend-difference flex items-center justify-between px-6 py-5 lg:px-12">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="size-6 rounded-md" />
          <p className="text-body font-bold uppercase tracking-wide text-landing-text">Realify</p>
        </div>
        <p className="text-small uppercase tracking-wide text-landing-text">
          Утсандаа нээж AR-аар үзээрэй →
        </p>
      </nav>

      {/* Page-wide film grain (mockup's `.grain`) — the one texture that
          separates a "premium" flat-dark UI from a plain one per the
          mockup's own research notes. Achromatic SVG turbulence, fixed,
          very low opacity — no accent hue introduced. Painted after the nav
          (same z-50, later in DOM wins the tie) so it sits above it, same
          as the mockup's higher z-index — z-60 isn't a real Tailwind scale
          step, so stacking order does the same job instead of an arbitrary
          value. */}
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
      <DesktopProcessSection
        sourceImageSrc="/icons/mockup/sofa_photo.png"
        title="White Boucle Sofa"
      />
      <DesktopCategoriesSection />
      <DesktopBentoSection />
      <DesktopFinalCta />
    </main>
  );
}
