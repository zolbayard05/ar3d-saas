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

const CARDS = [
  { num: "01", label: "Гутал", gradient: "linear-gradient(145deg, rgb(212, 213, 206), rgb(116, 118, 110))", featured: true },
  { num: "02", label: "Цүнх", gradient: "linear-gradient(140deg, rgb(70, 72, 62), rgb(184, 183, 171))" },
  { num: "03", label: "Тавилга", gradient: "linear-gradient(140deg, rgb(185, 175, 160), rgb(65, 60, 54))" },
  { num: "04", label: "Гэрийн бараа", gradient: "linear-gradient(140deg, rgb(129, 134, 125), rgb(218, 214, 201))" },
];

function CardArt({ featured }: { featured?: boolean }) {
  if (featured) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="relative size-[62%] overflow-hidden rounded-[9999px]" style={{ background: "rgb(36 38 34 / 0.85)" }}>
          <div
            style={{
              position: "absolute",
              inset: "-20%",
              background: "linear-gradient(35deg, transparent 45%, rgb(255 255 255 / 0.35) 50%, transparent 55%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              right: "14%",
              width: "26%",
              height: "26%",
              borderRadius: "9999px",
              background: "rgb(10 11 9 / 0.6)",
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div
        className="h-[46%] w-[36%] rounded-t-[9999px]"
        style={{ border: "3px solid rgb(20 21 17 / 0.7)", borderBottom: "none" }}
      />
      <div
        className="absolute h-[18%] w-[20%]"
        style={{ background: "rgb(20 21 17 / 0.7)", bottom: "27%" }}
      />
    </div>
  );
}

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
              className={`relative aspect-[300/385] ${card.featured ? "col-span-2 xl:col-span-1" : ""}`}
              style={{
                background: card.gradient,
                flex: card.featured ? "1.55 1 260px" : "1 1 220px",
              }}
            >
              <CardArt featured={card.featured} />
              <div className="relative p-[17px]">
                <span
                  className="uppercase"
                  style={{ fontSize: "9px", fontWeight: 400, color: "rgb(21, 22, 18)", letterSpacing: "1.17px" }}
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
