// Hero section immediately after (app/page.tsx -> DesktopLanding.tsx ->
// DesktopHeroTumble, then this). Every style value below (colors, sizes,
// spacing) is copied verbatim from getComputedStyle() run directly against
// the reference mockup's own document — see DesktopHeroTumble.tsx for how
// that measurement was taken (direct navigation to the mockup's own
// cross-origin iframe src, not the wrapper page).
//
// Copy is deliberately NOT a verbatim translation of the mockup's own text.
// The mockup's "Three Photos" / "MATERIAL STUDY" framing describes a fixed
// 3-shot, detail-crop-included workflow this app doesn't have — the real
// pipeline (lib/classifyAngles.ts) accepts up to 8 photos, auto-picks the
// best match for each of 4 canonical angles (front/left/back/right) via
// Gemini, and explicitly EXCLUDES close-up/detail crops rather than using
// them ("MATERIAL STUDY" would directly contradict that). Kept the layout
// and every measured style pixel-for-pixel; swapped only the words that
// would otherwise overclaim.

const MUTED_TEXT = "rgb(203, 208, 191)";
const MUTED_WEIGHT = 450;

// Real photos (not this section's old CSS placeholder art) — the same
// object shot from 3 of lib/classifyAngles.ts's 4 canonical angles
// (front/left/back/right; this card row only ever shows 3), cropped from
// one AI-generated 4-up reference sheet down to just the product itself
// (public/icons/intro/crop.mjs-style extraction — the sheet's own baked-in
// "Front"/"Back"/... captions are trimmed off since the card already
// prints its own Mongolian label below).
const CARDS = [
  { num: "01", label: "УРД ТАЛААС", src: "/icons/intro/backpack-front.webp" },
  { num: "02", label: "ЗҮҮН ТАЛААС", src: "/icons/intro/backpack-left.webp" },
  { num: "03", label: "АРД ТАЛААС", src: "/icons/intro/backpack-back.webp" },
];

const FLOW = [
  { label: "ОРЦ", value: "ЗУРАГ" },
  { label: "ГАРАЛТ", value: "3D ЗАГВАР" },
  { label: "БАЙРШИЛ", value: "WEB AR" },
];

export function DesktopIntroSection() {
  return (
    <section className="bg-[#0a0b0c] px-6 py-24 lg:px-16 lg:py-[160px]">
      <div className="mx-auto max-w-[1110px]">
        <p
          className="uppercase"
          style={{
            fontSize: "10px",
            fontWeight: 400,
            color: "rgb(174, 177, 165)",
            letterSpacing: "1.5px",
            marginBottom: "20px",
          }}
        >
          Хувиргалт
        </p>
        <h2
          className="text-balance text-[#f5f4ef]"
          style={{
            fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
            fontWeight: 650,
            lineHeight: 0.91,
            letterSpacing: "-0.075em",
            marginBottom: "64px",
          }}
        >
          Нэг бүтээгдэхүүн.
          <br />
          Хэдэн ч зураг.
          <br />
          <em className="not-italic" style={{ color: MUTED_TEXT, fontWeight: MUTED_WEIGHT }}>
            Нэг бэлэн 3D загвар.
          </em>
        </h2>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          {CARDS.map((card) => (
            <div
              key={card.num}
              className="relative aspect-[358/390]"
              style={{ background: "rgb(36, 38, 34)", border: "1px solid rgb(48, 49, 46)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed local /public asset, no remote optimization needed */}
              <img
                src={card.src}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 size-full object-cover object-center"
              />
              {/* Scrim so the label/num row stays legible over whatever
                  falls directly behind it in the source photo. */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-20"
                style={{ background: "linear-gradient(180deg, rgb(10 11 9 / 0.55), transparent)" }}
              />
              <div className="relative flex items-center justify-between p-[17px]">
                <span
                  className="uppercase"
                  style={{ fontSize: "9px", fontWeight: 400, color: "rgb(227, 228, 220)", letterSpacing: "1px" }}
                >
                  {card.label}
                </span>
                <span style={{ fontSize: "11px", fontWeight: 400, color: "rgb(255, 255, 255)", letterSpacing: "1.08px" }}>
                  {card.num}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-6 flex justify-center sm:-mt-[21px]">
          <div
            className="inline-flex items-center uppercase"
            style={{
              fontSize: "9px",
              fontWeight: 400,
              letterSpacing: "1.08px",
              color: "rgb(20, 21, 17)",
              background: "rgb(223, 227, 210)",
              padding: "9px 13px",
            }}
          >
            AI дахин бүтээлт
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-6">
          {FLOW.map((step, i) => (
            <div key={step.label} className="flex items-center gap-6">
              <div className="text-center">
                <p
                  className="uppercase"
                  style={{ fontSize: "10px", fontWeight: 400, color: "rgb(102, 104, 97)", letterSpacing: "1.3px" }}
                >
                  {step.label}
                </p>
                <p
                  className="uppercase"
                  style={{ fontSize: "11px", fontWeight: 700, color: "rgb(240, 240, 235)", letterSpacing: "1.3px" }}
                >
                  {step.value}
                </p>
              </div>
              {i < FLOW.length - 1 && <span style={{ color: "rgb(102, 104, 97)" }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
