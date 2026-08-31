"use client";

import { useEffect, useRef } from "react";
import { DesktopMockupObject } from "@/components/DesktopMockupObject";


interface Beat {
  kicker: string;
  eyebrow?: string;
  heading: React.ReactNode;
  body: string;
  pills?: string[];
  align?: "left" | "right";
}

// Verbatim from the approved mockup (realify-landing-v3.html, beat1-beat5) —
// the one thing this whole component exists to reproduce exactly.
const BEATS: Beat[] = [
  {
    kicker: "01 / 05",
    eyebrow: "Зөвхөн утсан дээр ажилладаг AR туршлага",
    heading: (
      <>
        Бүтээгдэхүүнээ <em className="font-extrabold not-italic text-landing-accent">илүү бодитоор</em>{" "}
        харуул.
      </>
    ),
    body: "Зургаас 3D, 3D-ээс AR. Бүтээгдэхүүнээ шинэ түвшинд танилцуул.",
    pills: ["30–100 секунд", "Бодит хэмжээтэй", "iOS · Android AR"],
  },
  {
    kicker: "02 / 05",
    heading: (
      <>
        Зурагнаас <em className="font-extrabold not-italic text-landing-accent">3D</em> туршлага
        руу.
      </>
    ),
    body: "Бүтээгдэхүүний зургаа оруул. AI-аар 3D загвараа бүтээ.",
    pills: ["GLB + USDZ", "< 8MB файл"],
    align: "right",
  },
  {
    kicker: "03 / 05",
    heading: (
      <>
        Бүтээгдэхүүнээ{" "}
        <em className="font-extrabold not-italic text-landing-accent">бүх талаас нь</em> хар.
      </>
    ),
    body: "Эргүүл. Томруул. Судал. Деталь бүрийг нь мэдэр.",
  },
  {
    kicker: "04 / 05 · AR",
    heading: (
      <>
        Өөрийн <em className="font-extrabold not-italic text-landing-accent">орчинд</em>{" "}
        байрлуулж үз.
      </>
    ),
    body: "Худалдаж авахаасаа өмнө бодит орчинд нь турш.",
    pills: ["iOS · Android AR", "Бодит хэмжээтэй"],
    align: "right",
  },
  {
    kicker: "05 / 05",
    heading: (
      <>
        Төсөөлөх шаардлагагүй.{" "}
        <em className="font-extrabold not-italic text-landing-accent">Шууд хар.</em>
      </>
    ),
    body: "Илүү бодит туршлага. Илүү итгэлтэй сонголт.",
  },
];

/**
 * The mockup's "tumble" narrative (offficestud.io-modeled): one real model,
 * pinned centered via a 600vh sticky stage, rotating continuously
 * (DesktopMockupObject's mode="scroll", driven by this same wrapperRef)
 * while 5 copy beats crossfade in turn. Ported 1:1 from
 * realify-landing-v3.html's own onScroll math — same triangular-falloff
 * opacity/translateY per beat, imperatively written to each beat's own DOM
 * node (not React state) so this doesn't re-render on every scroll tick.
 */
export function DesktopHeroTumble() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function onScroll() {
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const total = wrapper.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      const f = p * BEATS.length;
      beatRefs.current.forEach((el, i) => {
        if (!el) return;
        const center = i + 0.5;
        const d = Math.abs(f - center);
        const op = Math.max(0, 1 - d / 0.82);
        el.style.opacity = String(op);
        el.style.transform = `translateY(${(f < center ? 28 : -28) * (1 - op)}px)`;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={wrapperRef} className="relative" style={{ height: "600vh" }}>
      <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden bg-landing-bg">
        {/* Radial accent-tinted glow behind the object + a darkening vignette
            at the edges — mockup's .tumble-stage::before/::after. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(60% 55% at 62% 48%, var(--color-landing-accent-soft), transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 50%, transparent 45%, rgb(0 0 0 / 0.4) 100%)",
          }}
        />

        {/* Giant background wordmark — warm gradient text-clip fading toward
            the edge, mockup's .tumble-bgtype. */}
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center text-center font-extrabold"
          style={{
            fontSize: "clamp(8rem, 22vw, 21rem)",
            lineHeight: 0.86,
            letterSpacing: "-0.02em",
            backgroundImage:
              "linear-gradient(120deg, #4a3b28 0%, #2c2318 32%, #17130c 60%, #0a0a0a 85%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitMaskImage:
              "linear-gradient(200deg, rgb(0 0 0 / 0.95) 0%, rgb(0 0 0 / 0.55) 50%, rgb(0 0 0 / 0) 92%)",
            maskImage:
              "linear-gradient(200deg, rgb(0 0 0 / 0.95) 0%, rgb(0 0 0 / 0.55) 50%, rgb(0 0 0 / 0) 92%)",
          }}
        >
          REALIFY
        </p>

        <div
          className="relative z-10"
          style={{
            width: "min(50vw, 420px)",
            height: "min(50vw, 420px)",
            filter: "drop-shadow(0 40px 50px rgb(0 0 0 / 0.6))",
          }}
        >
          <DesktopMockupObject
            objUrl="/icons/mockup/chair.obj"
            textureUrl="/icons/mockup/chair_diffuse.png"
            metalness={0.3}
            roughness={0.42}
            mode="scroll"
            progressRef={wrapperRef}
            className="size-full"
          />
        </div>

        {BEATS.map((beat, i) => (
          <div
            key={beat.kicker}
            ref={(el) => {
              beatRefs.current[i] = el;
            }}
            className="absolute inset-0 z-20 flex flex-col justify-center"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            {/* Constrained to the same centered max-w-feed wrap every other
                section uses (mockup's own `.tumble-copy` sits inside its
                page-wide max-width:1280px wrap, not flush to the viewport
                edge) — pulls the copy in toward the model instead of
                hugging the screen edge. */}
            <div
              className={`mx-auto flex w-full max-w-feed px-6 lg:px-12 ${
                beat.align === "right" ? "justify-end text-right" : "justify-start text-left"
              }`}
            >
              <div className="flex max-w-lg flex-col gap-4">
                {beat.eyebrow && (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-landing-border-glass bg-landing-glow-faint py-1.5 pl-2 pr-3 text-small text-landing-text-muted">
                    <span
                      className="size-1.5 rounded-full bg-landing-live"
                      style={{ boxShadow: "0 0 8px var(--color-landing-live)" }}
                    />
                    {beat.eyebrow}
                  </span>
                )}
                <span className="text-small font-semibold uppercase tracking-wide text-landing-accent">
                  {beat.kicker}
                </span>
                {i === 0 ? (
                  <h1
                    className="font-bold text-landing-text text-balance"
                    style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.2rem)", lineHeight: 1.05 }}
                  >
                    {beat.heading}
                  </h1>
                ) : (
                  <h2
                    className="font-bold text-landing-text text-balance"
                    style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.2rem)", lineHeight: 1.05 }}
                  >
                    {beat.heading}
                  </h2>
                )}
                <p className="max-w-md text-body text-landing-text-muted">{beat.body}</p>
                {beat.pills && (
                  <div className="flex flex-wrap gap-2.5">
                    {beat.pills.map((pill) => (
                      <span
                        key={pill}
                        className="rounded-full border border-landing-border-glass bg-landing-glow-faint px-3 py-1.5 text-small uppercase tracking-wide text-landing-text-muted"
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex flex-col items-center gap-2">
          <span className="text-small uppercase tracking-wide text-landing-text-muted">
            Скролл хийгээрэй
          </span>
          <span className="h-7 w-px animate-pulse bg-gradient-to-b from-landing-text-muted to-transparent" />
        </div>
      </div>
    </div>
  );
}
