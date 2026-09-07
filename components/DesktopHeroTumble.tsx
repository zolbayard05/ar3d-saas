"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, PlayCircle } from "lucide-react";
import { DesktopMockupObject } from "@/components/DesktopMockupObject";
import { DesktopWaitlistCta } from "@/components/DesktopWaitlistCta";

// Rule 11 (this project's own convention, extended to DesktopHeroModelViewer
// too): "@google/model-viewer"'s customElements.define() touches `window`
// at import time, so every caller brings it in via next/dynamic with
// ssr:false, never a plain import.
const DesktopHeroModelViewer = dynamic(
  () => import("@/components/DesktopHeroModelViewer").then((m) => m.DesktopHeroModelViewer),
  { ssr: false },
);

interface Beat {
  eyebrow?: string;
  heading: React.ReactNode;
  body: string;
  align?: "left" | "right";
  /** First beat only — the huge stacked-line headline treatment, distinct from beats 2/3's smaller "scroll story" moments. */
  big?: boolean;
  /** Which 3D object this beat shows — each beat gets its own object so the whole scene (not just the copy) crossfades beat to beat, demonstrating "any product," not just one chair. */
  object: "chair" | "sneaker" | "backpack";
}

// Every value on the "chair" beat below (font sizes/weights, colors, letter
// spacing, line height, copy text) is copied verbatim from getComputedStyle()
// run directly against the reference mockup's own document — not eyeballed.
// Prior attempts at this queried the WRONG document: the mockup's public URL
// is a wrapper page that embeds the real content in a cross-origin
// <iframe src="https://...builderio.dev/">, which silently blocks
// contentDocument access. Navigating a tab straight to that iframe's own src
// loads the identical visuals as an accessible top-level document, which is
// what these numbers were measured against.
const MUTED_TEXT = "rgb(203, 208, 191)";
const MUTED_WEIGHT = 450;

const BEATS: Beat[] = [
  {
    eyebrow: "Веб дээрх 3D давхарга",
    big: true,
    object: "chair",
    heading: (
      <>
        <span className="block">Хүссэн бараа</span>
        <span className="block">бүтээгдэхүүнээ</span>
        <span className="block" style={{ color: MUTED_TEXT, fontWeight: MUTED_WEIGHT }}>3D загвар болгох боломж.</span>
      </>
    ),
    body: "Chrome Extension ашиглан веб дээрх бүтээгдэхүүнийг интерактив 3D загвар болон гар утаснаасаа AR-аар туршиж үз.",
  },
  {
    object: "sneaker",
    heading: (
      <>
        Дурын онлайн дэлгүүрийн зурган дээр —{" "}
        <em className="font-extrabold not-italic" style={{ color: MUTED_TEXT }}>шууд 3D-ээр.</em>
      </>
    ),
    body: "Right-click хийхэд л хангалттай — ямар ч бүтээгдэхүүн, ямар ч сайт дээр эргэдэг, чирж үзэх бодит 3D объект болно.",
  },
  {
    object: "backpack",
    heading: (
      <>
        Худалдан авахаасаа өмнө.{" "}
        <em className="font-extrabold not-italic" style={{ color: MUTED_TEXT }}>Өөрийн орчинд.</em>
      </>
    ),
    body: "Боломжтой бүтээгдэхүүнийг AR-аар өрөөндөө байрлуулж, бодит хэмжээгээр нь харна.",
  },
];

export function DesktopHeroTumble() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Separate from beatRefs: the object (chair/sneaker/backpack) itself
  // needs pointer-events:auto to be draggable, which — because pointer-
  // events values set closer to an element win over an ancestor's — means
  // it would otherwise ignore beatRefs' own auto/none toggle below.
  // Toggling it here too, on the exact same op>0.5 threshold, is what
  // actually stops an invisible beat's object from eating clicks meant for
  // the visible one underneath.
  const objectRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function onScroll() {
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const total = wrapper.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      // f=0 must land exactly on beat 0's center so the hero is fully
      // visible at page load (scroll=0), not mid-fade — centers at each
      // integer beat index, f sweeping 0..BEATS.length-1 across the whole
      // scroll range, not 0..BEATS.length (which left the last beat
      // fading OUT by the time scroll finished).
      const f = p * (BEATS.length - 1);
      beatRefs.current.forEach((el, i) => {
        if (!el) return;
        const center = i;
        const d = Math.abs(f - center);
        const op = Math.max(0, 1 - d / 0.82);
        el.style.opacity = String(op);
        el.style.transform = `translateY(${(f < center ? 28 : -28) * (1 - op)}px)`;
        // All 3 beats share the same absolute inset-0 slot, stacked by DOM
        // order — without this, a later (higher-stacked), fully invisible
        // beat still intercepts pointer events over an earlier, visible
        // one (opacity:0 doesn't stop hit-testing). Only the most-visible
        // beat should be interactive at any scroll position.
        el.style.pointerEvents = op > 0.5 ? "auto" : "none";
        const objectEl = objectRefs.current[i];
        if (objectEl) {
          objectEl.style.pointerEvents = op > 0.5 ? "auto" : "none";
          // <model-viewer> (sneaker/backpack) forces pointer-events: auto
          // on itself internally, which wins over the wrapper's value
          // above — has to be overridden directly on the element itself.
          const modelViewer = objectEl.querySelector("model-viewer") as HTMLElement | null;
          if (modelViewer) modelViewer.style.pointerEvents = op > 0.5 ? "auto" : "none";
        }
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={wrapperRef} className="relative" style={{ height: `${BEATS.length * 120}vh` }}>
      <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden bg-[#050505]">
        {/* Near-black stage with a soft cool-white light beam glowing in
            from the top-right corner (matching a reference screenshot the
            user provided directly — no on-disk file for it in this
            environment, so reproduced as a CSS gradient instead of an
            <img>), a second, warmer sage-accent glow low on the page (same
            muted sage used on the "3D арилжаа" text for palette cohesion)
            to break up the otherwise flat dark lower half, plus the
            existing edge-darkening vignette underneath. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(65% 85% at 88% -8%, rgb(200 205 220 / 0.38), transparent 64%), radial-gradient(60% 55% at 8% 108%, rgb(203 208 191 / 0.26), transparent 68%), radial-gradient(120% 90% at 50% 50%, transparent 55%, rgb(0 0 0 / 0.5) 100%)",
          }}
        />

        {BEATS.map((beat, i) => (
          <div
            key={i}
            ref={(el) => {
              beatRefs.current[i] = el;
            }}
            className="absolute inset-0 z-20 flex flex-col will-change-transform"
            style={{ opacity: i === 0 ? 1 : 0, pointerEvents: i === 0 ? "auto" : "none" }}
          >
            {/* pt-[150px] lives on this text div specifically, not the
                outer beat wrapper — the object below is absolutely
                positioned, and CSS padding on a positioned ancestor shifts
                an absolute child's containing block too (unlike
                justify-content, which only affects in-flow children).
                Padding here instead of on the wrapper is what lets the
                text move up under the nav while the object stays exactly
                where it always was (still centered via its own
                items-center below), per direct correction — an earlier
                attempt put the padding on the shared wrapper and pulled
                the object up with it, which wasn't asked for. */}
            {/* Left padding that aligns the text column with the nav logo
                (below) lives on THIS row, not the max-w-xl/lg column
                itself — Tailwind's border-box preflight means padding on
                an element with its own max-width eats directly into that
                element's content budget, which is what caused the 7-line
                wrap when this padding briefly lived on the inner div
                instead. Padding on this unconstrained row just shifts
                everything right without shrinking anything. */}
            <div
              className={`flex w-full pl-6 pr-6 pt-[150px] lg:pl-[269px] lg:pr-16 ${
                beat.align === "right" ? "justify-end text-right" : "justify-start text-left"
              }`}
            >
              {/* pl-6 lg:pl-[269px] above + this div's own pl-6 = 293px
                  total, measured live to match the nav logo's own left
                  edge exactly (getBoundingClientRect on both at 1920px). */}
              <div className={`flex flex-col gap-5 pl-6 ${beat.big ? "max-w-xl" : "max-w-lg"}`}>
                {beat.eyebrow && (
                  <span
                    className="inline-flex w-fit items-center gap-2 uppercase"
                    style={{
                      fontSize: "10px",
                      fontWeight: 400,
                      letterSpacing: "1.5px",
                      lineHeight: "15px",
                      color: "rgb(174, 177, 165)",
                    }}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: "rgb(174, 177, 165)" }} />
                    {beat.eyebrow}
                  </span>
                )}
                {i === 0 ? (
                  <h1
                    className="text-balance text-[#f5f4ef]"
                    style={
                      beat.big
                        ? {
                            // Reduced from clamp(2.75rem, 6.15vw, 7.375rem)
                            // — that size was tuned for the original short
                            // 2-line headline; the new, longer 3-line copy
                            // wrapped to 5 visual lines and overwhelmed the
                            // fold at that size. Matches the scale already
                            // used sitewide for every other section heading
                            // (Categories/Pipeline/Showcase/Material/
                            // HowItWorks/FinalCta all use this exact clamp).
                            fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
                            fontWeight: 650,
                            lineHeight: 0.91,
                            letterSpacing: "-0.075em",
                          }
                        : { fontSize: "clamp(2.1rem, 4.2vw, 3.2rem)", lineHeight: 1.05 }
                    }
                  >
                    {beat.heading}
                  </h1>
                ) : (
                  <h2
                    className="font-bold text-balance text-[#f5f4ef]"
                    style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.2rem)", lineHeight: 1.05 }}
                  >
                    {beat.heading}
                  </h2>
                )}
                <p
                  style={
                    beat.big
                      ? { maxWidth: "430px", fontSize: "16px", fontWeight: 400, lineHeight: "24px", color: "rgb(167, 168, 164)" }
                      : undefined
                  }
                  className={beat.big ? undefined : "max-w-md text-body text-[#a7a8a4]"}
                >
                  {beat.body}
                </p>
                {beat.big && (
                  <div className="flex flex-wrap items-center gap-5 pt-1">
                    <DesktopWaitlistCta
                      source="hero"
                      className="flex items-center gap-2 bg-[#eeeee9] uppercase text-[#111111] hover:opacity-90"
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.33px",
                        lineHeight: "16.5px",
                        padding: "17px 20px",
                      }}
                    />
                    <a
                      href="#how-it-works"
                      className="flex items-center gap-2 text-[#f5f4ef] hover:opacity-80"
                      style={{ fontSize: "13px", fontWeight: 400 }}
                    >
                      <PlayCircle className="size-5" />
                      Хэрхэн ажилладагийг үзэх
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Each beat's own bare floating 3D object, same slot every
                time — this is what actually crossfades beat to beat (its
                parent div's opacity/transform, driven by the scroll
                handler above), not just the copy. Reverted from the
                browser-window-mockup treatment per direct request (keep
                this exact bare-object + corner-annotation look; nav/copy
                elsewhere unchanged) — chair uses DesktopMockupObject's
                mode="sway" (a small idle side-to-side sway), matching the
                last-known-good pre-Phase-1 version exactly (commit
                da19ea3). An earlier revert attempt here mistakenly used
                mode="scroll" (a full continuous 360° turn tied to scroll
                position across the whole wrapperRef range) — at some
                scroll positions mid-rotation the chair's legs visibly
                tilted/drooped, which is what got reported and fixed.
                sneaker/backpack are
                real converted product scans (usdz -> glb, unscaled and
                unprocessed at the user's explicit request) shown via
                <model-viewer>'s own auto-rotate — a different rotation
                mechanism, but the same "here's a real object, not a
                photo" point. */}
            <div
              className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-end ${
                beat.object === "chair" ? "pr-6 lg:pr-[132px]" : "pr-6 lg:pr-[8vw]"
              }`}
              aria-hidden={beat.object !== "chair"}
            >
              <div
                ref={(el) => {
                  objectRefs.current[i] = el;
                }}
                className="relative"
                style={{
                  pointerEvents: i === 0 ? "auto" : "none",
                  // The plain min(Xvw, cap) sizing below was tuned against a
                  // ~1920px viewport and never re-checked at narrower ones —
                  // verified live: at 1024-1440px the object's box actually
                  // overlapped the text column's right edge. The extra
                  // calc() term reserves the text column's own width
                  // (px-16 + max-w-xl/lg) plus a fixed gap, so the object's
                  // box can never grow wide enough to reach it, at any
                  // viewport width.
                  ...(beat.object === "chair"
                    ? {
                        width: "max(240px, min(58vw, 800px, calc(100vw - 820px)))",
                        height: "max(240px, min(58vw, 800px, calc(100vw - 820px)))",
                        filter: "drop-shadow(0 40px 50px rgb(0 0 0 / 0.6))",
                      }
                    : {
                        width: "max(200px, min(42vw, 580px, calc(92vw - 624px)))",
                        height: "max(200px, min(42vw, 580px, calc(92vw - 624px)))",
                        filter: "drop-shadow(0 40px 50px rgb(0 0 0 / 0.6))",
                      }),
                }}
              >
                {beat.object === "chair" && (
                  <>
                    <DesktopMockupObject
                      objUrl="/icons/mockup/chair.obj"
                      textureUrl="/icons/mockup/chair_diffuse.png"
                      metalness={0.3}
                      roughness={0.42}
                      mode="sway"
                      className="size-full"
                    />
                    <span
                      className="pointer-events-none absolute text-tiny uppercase tracking-wide text-[#7a7b76]"
                      style={{ top: "1.5rem", right: 0, textAlign: "right" }}
                    >
                      01
                      <br />
                      Жинхэнэ материал
                    </span>
                    <span
                      className="pointer-events-none absolute text-tiny uppercase tracking-wide text-[#7a7b76]"
                      style={{ bottom: "1.5rem", left: 0 }}
                    >
                      02
                      <br />
                      Веб-д бэлэн геометр
                    </span>
                  </>
                )}
                {beat.object === "sneaker" && (
                  <DesktopHeroModelViewer src="/icons/mockup/sneaker.glb" alt="Гутал" className="size-full" />
                )}
                {beat.object === "backpack" && (
                  <DesktopHeroModelViewer src="/icons/mockup/backpack.glb" alt="Цүнх" className="size-full" />
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="pointer-events-none absolute bottom-10 right-6 z-20 flex items-center gap-2 lg:right-12">
          <span className="text-small uppercase tracking-wide text-[#a7a8a4]">
            Доош гүйлгээрэй
          </span>
          <ChevronDown className="size-4 animate-pulse text-[#a7a8a4]" />
        </div>
      </div>
    </div>
  );
}
