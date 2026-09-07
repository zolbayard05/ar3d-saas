"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, PlayCircle } from "lucide-react";
import { DesktopMockupObject } from "@/components/DesktopMockupObject";
import { DesktopBrowserMockup } from "@/components/DesktopBrowserMockup";
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

// Which "before" photo + fake URL each beat's DesktopBrowserMockup shows
// before "activating" into the real 3D object. chair/sneaker use a real
// render of that exact same asset (cropped screenshot of
// DesktopMockupObject's chair.obj / the sneaker.glb via
// DesktopShowcaseSection, public/icons/mockup/{chair,sneaker}-photo.webp)
// instead of an unrelated stock photo — the first pass used Pexels photos
// from DesktopCategoriesSection that didn't actually depict the same
// product as the 3D reveal (a leather Eames-style chair photo fading into
// a black tufted chesterfield; a studio sneaker photo fading into a red/
// blue trail shoe), which undercut the "here's its real 3D twin" point of
// the whole demo. backpack already used a real photo of the literal
// physical backpack the GLB was scanned from (see DesktopIntroSection's
// own header comment) — already correct, left unchanged.
const MOCKUP_META: Record<Beat["object"], { photoSrc: string; urlLabel: string }> = {
  chair: { photoSrc: "/icons/mockup/chair-photo.webp", urlLabel: "mebel-shop.mn/tavilga/sandal" },
  sneaker: { photoSrc: "/icons/mockup/sneaker-photo.webp", urlLabel: "gutal.mn/product/sneaker-42" },
  backpack: { photoSrc: "/icons/intro/backpack-front.webp", urlLabel: "delguur.mn/cunh/jansport" },
};

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
            className="absolute inset-0 z-20 flex flex-col justify-center will-change-transform"
            style={{ opacity: i === 0 ? 1 : 0, pointerEvents: i === 0 ? "auto" : "none" }}
          >
            <div
              className={`flex w-full px-6 lg:px-16 ${
                beat.align === "right" ? "justify-end text-right" : "justify-start text-left"
              }`}
            >
              <div className={`flex flex-col gap-5 ${beat.big ? "max-w-xl" : "max-w-lg"}`}>
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

            {/* Each beat's own DesktopBrowserMockup — a stylized browser
                window (product photo -> extension "activates" -> real 3D
                object), same slot every time, crossfading beat to beat via
                the parent div's opacity/transform (the scroll handler
                above). Dramatizes what the extension actually does instead
                of showing a bare floating object with no context for what
                the "3D" is a transform of. Chair keeps the exact same
                DesktopMockupObject (mode="sway" now — mode="scroll"'s
                precise scroll-tied turn didn't fit inside a framed window
                the way it did floating free); sneaker/backpack keep their
                exact same real-GLB <model-viewer>, camera-controls and all
                — drag-to-orbit still works, unchanged. */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end pr-6 lg:pr-[96px]">
              <div
                ref={(el) => {
                  objectRefs.current[i] = el;
                }}
                className="relative"
                style={{
                  pointerEvents: i === 0 ? "auto" : "none",
                  // Same overlap-prevention approach as before this file's
                  // own prior header comment describes (verified at
                  // 1024-1440px via getBoundingClientRect): the calc() term
                  // reserves the text column's own width + a fixed gap so
                  // this box can never grow wide enough to reach it. One
                  // shared formula across all 3 beats now (previously
                  // chair had a larger range than sneaker/backpack) since
                  // all 3 render through the same browser-window frame —
                  // a size jump between beats would look jarring.
                  width: "max(260px, min(46vw, 640px, calc(100vw - 820px)))",
                }}
              >
                <DesktopBrowserMockup
                  photoSrc={MOCKUP_META[beat.object].photoSrc}
                  urlLabel={MOCKUP_META[beat.object].urlLabel}
                  className="w-full"
                >
                  {beat.object === "chair" && (
                    <DesktopMockupObject
                      objUrl="/icons/mockup/chair.obj"
                      textureUrl="/icons/mockup/chair_diffuse.png"
                      metalness={0.3}
                      roughness={0.42}
                      mode="sway"
                      className="size-full"
                    />
                  )}
                  {beat.object === "sneaker" && (
                    <DesktopHeroModelViewer src="/icons/mockup/sneaker.glb" alt="Гутал" className="size-full" />
                  )}
                  {beat.object === "backpack" && (
                    <DesktopHeroModelViewer src="/icons/mockup/backpack.glb" alt="Цүнх" className="size-full" />
                  )}
                </DesktopBrowserMockup>
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
