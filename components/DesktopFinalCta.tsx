import { DesktopEntryChoice } from "@/components/DesktopEntryChoice";

/**
 * "Бүтээгдэхүүн бүр..." — 1:1 clone of the mockup's `.final-cta`: a
 * deliberate return to dark after the cream categories/bento sections
 * (the hero's closing bookend), rounded top corners overlapping the cream
 * section above it, one warm accent glow. DesktopEntryChoice replaces what
 * used to be a bare DesktopQrCard — same real QR by default, plus an
 * explicit second tab for a visitor who wants the Chrome extension instead
 * of AR on their phone.
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
        <DesktopEntryChoice />
      </div>
    </section>
  );
}
