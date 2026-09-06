// Seventh section, after DesktopPipelineSection.tsx. Every style value below
// is copied verbatim from getComputedStyle() against the reference
// mockup's own document, same method as the other sections. Content is a
// close paraphrase, not a claim about a specific measured number — the
// real fidelity work (frequency-separated texture cleanup, CLAUDE.md rule
// 24) is real, but this mockup section names no metric to be honest or
// dishonest about, just "detail/materials/performance" framing.

const HIGHLIGHTS = ["Өндөр нарийвчлалтай геометр.", "Бодит материал.", "Веб-д бэлэн гүйцэтгэл."];

export function DesktopMaterialSection() {
  return (
    <section className="grid lg:grid-cols-2" style={{ background: "rgb(13, 14, 13)" }}>
      <div className="flex flex-col justify-center px-6 py-24 lg:px-16 lg:py-[140px]">
        <p
          className="uppercase"
          style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
        >
          Дизайнаараа өндөр нарийвчлалтай
        </p>
        <h2
          className="text-balance text-[#f5f4ef]"
          style={{
            fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
            fontWeight: 650,
            lineHeight: 0.91,
            letterSpacing: "-0.075em",
            marginBottom: "28px",
          }}
        >
          Ширхэг бүр
          <br />
          <em className="not-italic" style={{ color: "rgb(203, 208, 191)", fontWeight: 450 }}>
            чухал.
          </em>
        </h2>
        <p style={{ maxWidth: "430px", fontSize: "17px", fontWeight: 400, lineHeight: "26.35px", color: "rgb(173, 174, 167)" }}>
          {HIGHLIGHTS.map((line, i) => (
            <span key={line}>
              {line}
              {i < HIGHLIGHTS.length - 1 && <br />}
            </span>
          ))}
        </p>
      </div>

      {/* Close-up crop of the same licensed chair photo
          DesktopCategoriesSection.tsx's "Тавилга" card uses (Pexels
          License, free for commercial use) — shows both material grain
          and joinery geometry, matching this section's own copy. First
          filled with CSS-only placeholder art (a crosshatch pattern, no
          real photo at all), then briefly a crop of a 1024px is_showcase
          model render (DesktopCategoriesSection.tsx's own header comment
          has the story on why that whole approach got replaced) —
          crosshatch/radial gradient kept as a subtle overlay on top
          either way, tying it back to the section's original texture
          motif instead of dropping it outright. */}
      <div
        className="relative aspect-square lg:aspect-auto"
        style={{ backgroundColor: "rgb(20, 18, 15)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed local /public asset, no remote optimization needed */}
        <img
          src="/icons/material/chair-detail.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover object-center opacity-90"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.05) 0px, rgb(255 255 255 / 0.05) 1px, transparent 1px, transparent 14px)," +
              "radial-gradient(45% 45% at 65% 40%, rgb(230 210 170 / 0.25), transparent 70%)," +
              "linear-gradient(0deg, rgb(20 18 15 / 0.55), transparent 45%)",
          }}
        />
        <div className="absolute bottom-8 left-8">
          <span
            className="inline-flex items-center gap-2 uppercase"
            style={{
              fontSize: "9px",
              fontWeight: 400,
              color: "rgb(27, 28, 24)",
              letterSpacing: "1.08px",
              background: "rgb(240, 238, 230)",
              padding: "13px",
            }}
          >
            Материалын нарийвчлал →
          </span>
        </div>
      </div>
    </section>
  );
}
