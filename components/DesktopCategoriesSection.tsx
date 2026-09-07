"use client";

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
// that same real breadth (footwear/bags/apparel/home goods) rather than a
// fixed furniture catalog structure the app doesn't have.
//
// Now a client component (was a plain Server Component) — each card
// crossfades its static photo into a REAL interactive 3D model on hover
// (drag-to-orbit, same DesktopHeroModelViewer/<model-viewer> the hero
// already uses), not just a nicer photo. Every photo is a real studio
// product shot of the exact same physical product the paired .glb
// represents — sneaker/backpack reuse the hero's own real-GLB assets;
// vest/rose (replacing the section's original chair-render card) are new,
// user-supplied product-scan .glb files with their own matching photos.
const CARDS = [
  { num: "01", label: "Гутал", photoSrc: "/icons/categories/sneaker.webp", glbSrc: "/icons/mockup/sneaker.glb", featured: true },
  { num: "02", label: "Цүнх", photoSrc: "/icons/categories/backpack.webp", glbSrc: "/icons/mockup/backpack.glb" },
  { num: "03", label: "Хувцас", photoSrc: "/icons/categories/vest.webp", glbSrc: "/icons/mockup/vest.glb" },
  { num: "04", label: "Гэрийн бараа", photoSrc: "/icons/categories/vase.webp", glbSrc: "/icons/mockup/rose.glb" },
];

import { useState } from "react";
import dynamic from "next/dynamic";

// Rule 11: "@google/model-viewer"'s customElements.define() touches
// `window` at import time — every caller brings it in via next/dynamic
// with ssr:false, same as every other <model-viewer> usage on this page.
const DesktopHeroModelViewer = dynamic(
  () => import("@/components/DesktopHeroModelViewer").then((m) => m.DesktopHeroModelViewer),
  { ssr: false },
);

function CategoryCard({ card }: { card: (typeof CARDS)[number] }) {
  const [hovered, setHovered] = useState(false);
  // Mounts the (potentially large — these are real, uncompressed product
  // scans, not thumbnails; vest/rose run 22-30 MB) 3D model only on first
  // hover, not on page load for all 4 cards at once — then keeps it
  // mounted so re-hovering the same card doesn't re-fetch it.
  const [loaded, setLoaded] = useState(false);
  // Separate from `loaded` (mounted) — becomes true only once
  // model-viewer's own "load" event fires. The photo only fades out once
  // this is true: without it, hovering a still-loading 22-30 MB model
  // instantly hid the photo and showed a blank black card for however
  // long the fetch took (reproduced live) — the photo now stays put as a
  // placeholder until the model is actually ready to swap in.
  const [modelReady, setModelReady] = useState(false);
  const showModel = hovered && modelReady;

  return (
    <div
      className={`relative aspect-[300/385] overflow-hidden ${card.featured ? "col-span-2 xl:col-span-1" : ""}`}
      style={{
        background: "rgb(20, 21, 17)",
        flex: card.featured ? "1.55 1 260px" : "1 1 220px",
      }}
      onMouseEnter={() => {
        setHovered(true);
        setLoaded(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed local /public asset, no remote optimization needed */}
      <img
        src={card.photoSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover object-center transition-opacity duration-500"
        style={{ opacity: showModel ? 0 : 1 }}
      />
      {loaded && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: showModel ? 1 : 0, pointerEvents: showModel ? "auto" : "none" }}
        >
          <DesktopHeroModelViewer
            src={card.glbSrc}
            alt={card.label}
            className="size-full"
            onLoad={() => setModelReady(true)}
          />
        </div>
      )}
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
  );
}

export function DesktopCategoriesSection() {
  return (
    <section id="product" className="px-6 py-24 lg:px-16 lg:py-[160px]" style={{ background: "rgb(232, 230, 223)" }}>
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
            <CategoryCard key={card.num} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
