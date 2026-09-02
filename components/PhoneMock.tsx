export interface PhoneMockProps {
  children: React.ReactNode;
  /**
   * "card" (default): width-driven, capped at the mockup's own 230px —
   * used in grid layouts (DesktopHowItWorksDetailed's step cards) where the
   * frame must shrink to its grid cell.
   * "lightbox": height-driven instead (up to 80vh, capped at 760px so it
   * doesn't outgrow reasonable phone proportions on very tall monitors),
   * width left intrinsic via aspect-ratio — for DesktopHowItWorksDetailed's
   * click-to-enlarge dialog, where the frame should grow to fill the
   * available space rather than stay pinned at card size.
   */
  variant?: "card" | "lightbox";
}

const BASE_ASPECT = "230 / 468";
// Bezel chrome (padding/radii/notch) scaled up for the lightbox variant so
// it doesn't look thinner-than-designed at ~1.6x the card's linear size —
// a fixed factor picked against the lightbox's own height cap, not derived
// from a runtime size (there's only ever these two call sites).
const LIGHTBOX_SCALE = 1.6;

/**
 * The mockup's `.phone-mock`/`.phone-screen`/`.phone-notch` frame chrome —
 * extracted from DesktopProcessSection.tsx (its original, 1:1-mockup home,
 * since removed) so DesktopHowItWorksDetailed.tsx can reuse the exact same
 * phone-bezel treatment around real screenshots instead of a plain bordered
 * box. Every pixel value here is copied straight from the approved
 * mockup's own CSS, not re-derived — see this file's git history for why.
 */
export function PhoneMock({ children, variant = "card" }: PhoneMockProps) {
  const scale = variant === "lightbox" ? LIGHTBOX_SCALE : 1;
  const sizing: React.CSSProperties =
    variant === "lightbox"
      ? { height: "min(80vh, 760px)", aspectRatio: BASE_ASPECT }
      : { maxWidth: 230, aspectRatio: BASE_ASPECT };

  return (
    <div
      className={variant === "lightbox" ? "mx-auto" : "mx-auto w-full"}
      style={{
        ...sizing,
        background: "#0d0d0c",
        borderRadius: 34 * scale,
        padding: 9 * scale,
        boxShadow: "0 30px 60px -20px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.12)",
      }}
    >
      <div
        className="relative size-full overflow-hidden"
        style={{ borderRadius: 26 * scale, background: "#141311" }}
      >
        <div
          aria-hidden="true"
          className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full"
          style={{ top: 10 * scale, width: 60 * scale, height: 16 * scale, background: "#0d0d0c" }}
        />
        {children}
      </div>
    </div>
  );
}
