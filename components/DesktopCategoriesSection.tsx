// Second section after the hero (DesktopIntroSection.tsx), light-background
// band in the reference mockup — the only light section on the page.
// Every style value (colors, gradients, font sizes, spacing) is copied
// verbatim from getComputedStyle() against the reference mockup's own
// document, same measurement method as DesktopHeroTumble.tsx /
// DesktopIntroSection.tsx.
//
// Copy is adapted, not translated verbatim: the mockup's 4 cards are
// furniture sub-categories (Lounge/Lighting/Tables/Bedroom), which would
// imply Realify is furniture-only — the hero explicitly pitches "any
// product" (chair, sneaker, backpack side by side), so these instead show
// that same real breadth (footwear/bags/furniture/home goods) rather than
// a fixed furniture catalog structure the app doesn't have.
//
// Every image below is a REAL Realify render, not stock photography or
// CSS placeholder art (the previous CardArt gradient blobs this replaced):
// Гутал/Тавилга/Гэрийн бараа are the server-rendered `render_url` webp of
// three real `models` rows curated is_showcase=true in production
// (sneaker/wooden chair/vase — buildModelUrl resolves the same way
// ARViewer.tsx and ModelCard.tsx already do); Цүнх reuses the backpack
// photo set from DesktopIntroSection.tsx, since none of the current
// showcase models happens to be a bag.
import { buildModelUrl } from "@/lib/models";

const CARDS = [
  { num: "01", label: "Гутал", src: buildModelUrl("models/20fef5e3-a970-40b5-a8d7-2a8fd57d6196.612451ce.webp"), featured: true },
  { num: "02", label: "Цүнх", src: "/icons/intro/backpack-front.webp" },
  { num: "03", label: "Тавилга", src: buildModelUrl("models/090b7751-5b57-419e-80a4-7f495cfaeffc.67b70637.webp") },
  { num: "04", label: "Гэрийн бараа", src: buildModelUrl("models/2913cd29-8000-4cbd-bf15-da3222efbd07.ecd77b0c.webp") },
];

export function DesktopCategoriesSection() {
  return (
    <section className="px-6 py-24 lg:px-16 lg:py-[160px]" style={{ background: "rgb(232, 230, 223)" }}>
      <div className="mx-auto max-w-[1400px]">
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
          Бүтээгдэхүүний шинэ хэмжээс
        </p>
        <h2
          className="text-balance"
          style={{
            fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
            fontWeight: 650,
            lineHeight: 0.91,
            letterSpacing: "-0.075em",
            color: "rgb(21, 22, 18)",
            marginBottom: "64px",
          }}
        >
          Бүтээгдэхүүн
          <br />
          <em className="not-italic" style={{ color: "rgb(96, 98, 89)", fontWeight: 450 }}>
            чинь илүү үнэмшилтэй
          </em>
          <br />
          харагдах ёстой.
        </h2>

        {/* flex-wrap's own algorithm wraps based on each card's un-grown
            flex-basis sum (260 + 220*3 + 3*15 gaps = 965px) vs the
            available width — verified live: that stops fitting once the
            viewport (minus its own padding) drops below ~1093px, which
            includes the whole lg range (1024-1279px), producing a broken
            "3 cards + 1 lone full-width-stretched card" row rather than a
            clean wrap. A 2-column grid below xl sidesteps the flex-wrap
            math entirely — the featured card spans both columns as a
            banner, the other 3 land 2-then-1 with no stretch — and xl:flex
            restores the original, pixel-matched 4-across row untouched. */}
        <div className="grid grid-cols-2 gap-[15px] xl:flex xl:flex-wrap">
          {CARDS.map((card) => (
            <div
              key={card.num}
              className={`relative aspect-[300/385] overflow-hidden ${card.featured ? "col-span-2 xl:col-span-1" : ""}`}
              style={{
                background: "rgb(20, 21, 17)",
                flex: card.featured ? "1.55 1 260px" : "1 1 220px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote R2/CDN + a fixed local asset, no next/image remote-pattern config for either */}
              <img src={card.src} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover object-center" />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-16"
                style={{ background: "linear-gradient(180deg, rgb(10 11 9 / 0.6), transparent)" }}
              />
              <div className="relative p-[17px]">
                <span
                  className="uppercase"
                  style={{ fontSize: "9px", fontWeight: 400, color: "rgb(240, 240, 235)", letterSpacing: "1.17px" }}
                >
                  {card.num} / {card.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
