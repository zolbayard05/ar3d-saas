/**
 * The mockup's `.phone-mock`/`.phone-screen`/`.phone-notch` frame chrome —
 * extracted from DesktopProcessSection.tsx (its original, 1:1-mockup home)
 * so DesktopHowItWorksDetailed.tsx can reuse the exact same phone-bezel
 * treatment around real screenshots instead of a plain bordered box. Every
 * pixel value here is copied straight from the approved mockup's own CSS,
 * not re-derived — see DesktopProcessSection.tsx's own comment for why.
 */
export function PhoneMock({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto w-full"
      style={{
        maxWidth: 230,
        aspectRatio: "230 / 468",
        background: "#0d0d0c",
        borderRadius: 34,
        padding: 9,
        boxShadow: "0 30px 60px -20px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.12)",
      }}
    >
      <div
        className="relative size-full overflow-hidden"
        style={{ borderRadius: 26, background: "#141311" }}
      >
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-2.5 z-10 -translate-x-1/2 rounded-full"
          style={{ width: 60, height: 16, background: "#0d0d0c" }}
        />
        {children}
      </div>
    </div>
  );
}
