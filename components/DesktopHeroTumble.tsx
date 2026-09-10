"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, PlayCircle } from "lucide-react";
import { DesktopMockupObject, type DesktopMockupObjectHandle } from "@/components/DesktopMockupObject";
import { DesktopVideoDialog } from "@/components/DesktopVideoDialog";

// "Хэрхэн ажилладагийг үзэх" opens this exact demo video rather than
// scrolling to #how-it-works — a real walkthrough answers "how does this
// work" more directly than the static numbered list further down the page.
const HOW_IT_WORKS_VIDEO_ID = "wLpbTi2dV1o";

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
  /** Beat 0 only — the Chrome-extension mention isn't relevant on a phone; shown/hidden via lg: instead of body's own text. */
  mobileBody?: string;
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
    mobileBody: "Онлайн дэлгүүрийн зурган дээрх бүтээгдэхүүнийг өөрийн утаснаасаа шууд интерактив 3D загвар болгож, AR-аар өрөөндөө байрлуулж үз.",
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
  // The chair's own imperative pause/resume handle (see
  // DesktopMockupObjectHandle) — sneaker/backpack are handled by directly
  // toggling the <model-viewer> auto-rotate attribute instead, queried via
  // objectRefs the same way pointer-events already is below.
  const mockupRefs = useRef<(DesktopMockupObjectHandle | null)[]>([]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Settles the scroll position on whichever beat is nearest once the
    // user stops scrolling mid-crossfade — otherwise resting between two
    // beats leaves both partially visible/overlapping (the crossfade math
    // below is intentionally unchanged; this only nudges where scrolling
    // comes to rest, same idea as CSS scroll-snap, hand-rolled because the
    // "snap points" here are scroll positions inside one continuous
    // sticky-pinned range, not separate child elements). Only fires while
    // strictly inside the pinned range (0 < p < 1) — never yanks the page
    // back into the hero once the visitor has scrolled on past it, and
    // never fires while the hero hasn't started scroll-jacking yet.
    //
    // Driven by requestAnimationFrame, not a fixed setTimeout debounce —
    // a per-frame "did scrollY actually move since last frame" check is
    // the tightest a stop-detector can get (bounded by frame rate itself,
    // ~16ms, rather than an arbitrary wall-clock guess), so the snap
    // engages the instant scrolling genuinely stops instead of after a
    // perceptible extra wait. 2 still frames (not 1) as the threshold —
    // real momentum/wheel scrolling moves scrollY on essentially every
    // frame, so this still doesn't fire mid-scroll; it's a two-frame
    // safety margin, not a timing budget.
    //
    // That frame-counting heuristic alone is NOT reliable on touch/
    // momentum-scrolling platforms (iOS/Android), though — reproduced live
    // as "snap doesn't work on mobile": a phone's native inertia scroll
    // can have brief low-velocity lulls where scrollY barely changes
    // between two frames well before momentum has actually finished, so
    // the heuristic fires early, calls scrollTo, and the browser's own
    // still-ongoing native momentum immediately fights/overrides it —
    // net effect, nothing visibly happens. The scrollend event (supported
    // in all current mobile/desktop browsers) is the browser's own
    // authoritative "every bit of scrolling, including inertia, has now
    // fully settled" signal — calling scrollTo there never has native
    // momentum left to fight. Both mechanisms call the same trySnap()
    // below and can't double-fire (guarded by settledAtCurrentPosition);
    // the rAF path stays as a fast desktop-wheel/trackpad path and a
    // fallback for the rare browser without scrollend.
    let lastF = 0;
    let lastP = 0;
    let lastScrollY = window.scrollY;
    let settledAtCurrentPosition = true;
    let rafId = 0;
    // Which beat f was resting at when the CURRENT scroll gesture began
    // (captured in onScroll, the instant it sees settledAtCurrentPosition
    // flip from true to false). trySnap below judges direction from net
    // displacement against this — f - restBeat — rather than the sign of
    // the very last per-frame scrollY delta. That last-frame-delta approach
    // (tried first) was NOT reliable: trackpad momentum commonly ends with
    // a tiny reverse micro-bounce in its final frame or two as it
    // decelerates, which flipped the recorded "direction" to backward right
    // before the gesture actually settled — even though the whole gesture
    // was clearly forward — and made trySnap fall back to plain
    // nearest-round (reverting on any <50% forward progress). Reported
    // directly, still reproducing after that fix: ANY forward scroll,
    // however small, kept snapping back. Net displacement from the beat the
    // gesture started at isn't fooled by one bad trailing frame.
    let restBeat = 0;

    // Minimum time (ms) scrollY must sit still before a stop is treated as
    // real, not just the natural gap between two notches of a plain
    // (non-precision) mouse wheel. Time-based rather than frame-count so
    // this behaves the same regardless of display refresh rate.
    const STILL_MS = 140;
    let lastMoveAt = performance.now();

    function trySnap() {
      if (!wrapper || settledAtCurrentPosition || lastP <= 0 || lastP >= 1) return;
      // Any net displacement from the gesture's starting beat commits a
      // full step in that direction — never reverts to the beat being
      // left, however little of the scroll actually happened. Math.ceil/
      // Math.floor of lastF itself (not restBeat) so a single fast/long
      // gesture that crosses more than one beat still lands on the right
      // one, not just restBeat±1.
      const delta = lastF - restBeat;
      const nearest =
        Math.abs(delta) < 0.02 ? restBeat : delta > 0 ? Math.ceil(lastF - 0.02) : Math.floor(lastF + 0.02);
      settledAtCurrentPosition = true;
      if (Math.abs(lastF - nearest) < 0.02) return;
      const targetTotal = wrapper.offsetHeight - window.innerHeight;
      if (targetTotal <= 0) return;
      const targetP = nearest / (BEATS.length - 1);
      const wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: wrapperTop + targetP * targetTotal, behavior: "smooth" });
    }

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
      // Capture the resting beat right as a new gesture begins (still
      // settled from the previous one, about to flip false below) — this
      // is "where trySnap should measure net displacement from" for
      // whatever gesture is about to happen.
      if (settledAtCurrentPosition) restBeat = Math.round(lastF);
      lastF = f;
      lastP = p;
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
        const active = op > 0.5;
        el.style.pointerEvents = active ? "auto" : "none";
        const objectEl = objectRefs.current[i];
        if (objectEl) {
          objectEl.style.pointerEvents = active ? "auto" : "none";
          // <model-viewer> (sneaker/backpack) forces pointer-events: auto
          // on itself internally, which wins over the wrapper's value
          // above — has to be overridden directly on the element itself.
          const modelViewer = objectEl.querySelector("model-viewer") as HTMLElement | null;
          if (modelViewer) {
            modelViewer.style.pointerEvents = active ? "auto" : "none";
            // Every beat's object stays mounted simultaneously (only
            // opacity distinguishes the active one), so model-viewer's own
            // off-screen auto-pause never kicks in — all 3 sit inside the
            // same on-screen rect regardless of visibility. Dropping
            // auto-rotate on the inactive ones stops their continuous
            // per-frame WebGL redraw (real cost on mobile GPUs, and the
            // main cause of general scroll jank on the hero).
            modelViewer.toggleAttribute("auto-rotate", active);
          }
        }
        mockupRefs.current[i]?.setActive(active);
      });

      // A real scroll event means motion is still happening — allow the
      // next genuine stop to trigger a snap. tick() below tracks the actual
      // idle timer off its own per-frame scrollY comparison, not this.
      settledAtCurrentPosition = false;
    }

    function tick() {
      const now = performance.now();
      const y = window.scrollY;
      if (y !== lastScrollY) {
        lastScrollY = y;
        lastMoveAt = now;
      }
      if (now - lastMoveAt >= STILL_MS) trySnap();
      rafId = requestAnimationFrame(tick);
    }

    const supportsScrollEnd = "onscrollend" in window;

    window.addEventListener("scroll", onScroll, { passive: true });
    if (supportsScrollEnd) window.addEventListener("scrollend", trySnap);
    onScroll();
    rafId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (supportsScrollEnd) window.removeEventListener("scrollend", trySnap);
      cancelAnimationFrame(rafId);
    };
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
            className={`absolute inset-0 z-20 flex flex-col will-change-transform ${beat.big ? "" : "justify-center"}`}
            style={{ opacity: i === 0 ? 1 : 0, pointerEvents: i === 0 ? "auto" : "none" }}
          >
            {/* pt-[150px] (beat 0/"big" only) lives on this text div
                specifically, not the outer beat wrapper — the object below
                is absolutely positioned, and CSS padding on a positioned
                ancestor shifts an absolute child's containing block too
                (unlike justify-content, which only affects in-flow
                children). Padding here instead of on the wrapper is what
                lets the text move up under the nav while the object stays
                exactly where it always was (still centered via its own
                items-center below), per direct correction — an earlier
                attempt put the padding on the shared wrapper and pulled
                the object up with it, which wasn't asked for.
                Beats 1/2 (sneaker/backpack) skip that padding and instead
                get justify-center on the outer wrapper above — direct
                request to bring their text to "the same level as the
                model" (the object's own items-center), not pinned under
                the nav like beat 0's. */}
            {/* Left padding that aligns the text column with the nav logo
                (below) lives on THIS row, not the max-w-xl/lg column
                itself — Tailwind's border-box preflight means padding on
                an element with its own max-width eats directly into that
                element's content budget, which is what caused the 7-line
                wrap when this padding briefly lived on the inner div
                instead. Padding on this unconstrained row just shifts
                everything right without shrinking anything. */}
            <div
              className={`flex w-full pl-6 pr-6 lg:pl-[269px] lg:pr-16 ${beat.big ? "pt-20 lg:pt-[150px]" : ""} ${
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
                  className={`${beat.big ? "" : "max-w-md text-body text-[#a7a8a4]"} ${beat.mobileBody ? "hidden lg:block" : ""}`}
                >
                  {beat.body}
                </p>
                {beat.mobileBody && (
                  <p
                    style={{ maxWidth: "430px", fontSize: "16px", fontWeight: 400, lineHeight: "24px", color: "rgb(167, 168, 164)" }}
                    className="lg:hidden"
                  >
                    {beat.mobileBody}
                  </p>
                )}
                {beat.big && (
                  <div className="flex flex-wrap items-center gap-5 pt-1">
                    <DesktopVideoDialog
                      videoId={HOW_IT_WORKS_VIDEO_ID}
                      className="flex items-center gap-2 text-[#f5f4ef] hover:opacity-80"
                      style={{ fontSize: "13px", fontWeight: 400 }}
                    >
                      <PlayCircle className="size-5" />
                      Хэрхэн ажилладагийг үзэх
                    </DesktopVideoDialog>
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
              className={`pointer-events-none relative mt-8 flex items-center justify-center lg:absolute lg:inset-0 lg:mt-0 lg:justify-end ${
                beat.object === "chair" ? "lg:pr-[132px]" : "lg:pr-[8vw]"
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
                        width: "clamp(160px, 50vw, max(240px, min(58vw, 800px, calc(100vw - 820px))))",
                        height: "clamp(160px, 50vw, max(240px, min(58vw, 800px, calc(100vw - 820px))))",
                        filter: "drop-shadow(0 40px 50px rgb(0 0 0 / 0.6))",
                      }
                    : {
                        width: "clamp(140px, 42vw, max(200px, min(42vw, 580px, calc(92vw - 624px))))",
                        height: "clamp(140px, 42vw, max(200px, min(42vw, 580px, calc(92vw - 624px))))",
                        filter: "drop-shadow(0 40px 50px rgb(0 0 0 / 0.6))",
                      }),
                }}
              >
                {beat.object === "chair" && (
                  <DesktopMockupObject
                    ref={(el) => {
                      mockupRefs.current[i] = el;
                    }}
                    objUrl="/icons/mockup/chair.obj"
                    textureUrl="/icons/mockup/chair_diffuse.png"
                    metalness={0.3}
                    roughness={0.42}
                    mode="sway"
                    className="size-full"
                  />
                )}
                {beat.object === "sneaker" && (
                  <DesktopHeroModelViewer src="/icons/mockup/sneaker.glb" alt="Гутал" className="size-full" autoRotate={i === 0} />
                )}
                {beat.object === "backpack" && (
                  <DesktopHeroModelViewer src="/icons/mockup/backpack.glb" alt="Цүнх" className="size-full" autoRotate={i === 0} />
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
