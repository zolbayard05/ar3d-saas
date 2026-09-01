import { DesktopAppOptIn } from "@/components/DesktopAppOptIn";
import { DesktopQrCard } from "@/components/DesktopQrCard";

/**
 * "Бүтээгдэхүүн бүр..." — 1:1 clone of the mockup's `.final-cta`: a
 * deliberate return to dark after the cream categories/bento sections
 * (the hero's closing bookend), rounded top corners overlapping the cream
 * section above it, one warm accent glow. Reuses DesktopQrCard as-is
 * (real, scannable QR) rather than the mockup's decorative striped
 * placeholder box, which never encoded anything real.
 */
export function DesktopFinalCta() {
  return (
    <section
      className="relative overflow-hidden px-6 py-32 text-center lg:px-12"
      style={{
        background: "var(--color-landing-bg)",
        color: "var(--color-landing-text)",
        borderRadius: "32px 32px 0 0",
        marginTop: -32,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2"
        style={{
          top: 0,
          width: 640,
          height: 640,
          transform: "translate(-50%, -40%)",
          background: "radial-gradient(closest-side, var(--color-landing-accent-soft), transparent 70%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-feed flex-col items-center gap-8">
        <h2 className="max-w-md text-display font-extrabold text-balance">
          Бүтээгдэхүүн бүр{" "}
          <em className="font-extrabold not-italic text-landing-accent">өөрийн гэсэн</em>{" "}
          туршлагатай.
        </h2>
        <p
          className="text-heading font-extrabold tracking-wide"
          style={{ color: "var(--color-landing-text-faint)" }}
        >
          REALIFY
        </p>
        <DesktopQrCard />
        <DesktopAppOptIn />
      </div>
    </section>
  );
}
