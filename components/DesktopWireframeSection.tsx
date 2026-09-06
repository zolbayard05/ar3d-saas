"use client";

// Third section after DesktopCategoriesSection.tsx. Every style value below
// (colors, sizes, spacing) is copied verbatim from getComputedStyle()
// against the reference mockup's own document — see DesktopHeroTumble.tsx
// for the measurement method.
//
// Unlike DesktopIntroSection/DesktopCategoriesSection, this section needed
// no copy adaptation — a wireframe-vs-shaded reveal of a real reconstructed
// mesh is exactly what the real pipeline produces (Tripo geometry, this
// app's own compressed/textured GLB), so the mockup's own framing already
// matches. The chair asset is illustrative (the actual pipeline turns a
// user's own photo into a mesh, not this specific chair) — same footnote
// as the hero's chair beat.
//
// The drag-reveal reuses DesktopMockupObject's existing renderMode prop
// (shaded/wireframe) exactly as DesktopMockupObject.tsx's own doc comment
// already anticipates for this section: two full-size instances stacked,
// wireframe underneath, shaded on top clipped by a pointer-driven divider —
// not a shared canvas with swapped materials, so neither instance's
// scene-lifecycle code changes.

import { useRef, useState } from "react";
import { DesktopMockupObject } from "@/components/DesktopMockupObject";

const MUTED_TEXT = "rgb(203, 208, 191)";

export function DesktopWireframeSection() {
  const [reveal, setReveal] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setReveal(Math.max(0, Math.min(100, pct)));
  }

  return (
    <section className="px-6 py-24 lg:px-16 lg:py-[140px]" style={{ background: "rgb(17, 18, 16)" }}>
      <div className="mx-auto grid max-w-[1400px] items-center gap-16 lg:grid-cols-[minmax(0,430px)_1fr]">
        <div>
          <p
            className="uppercase"
            style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
          >
            Хэмжигдсэн нарийвчлал
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
            Гэрэл
            <br />
            зургаас
            <br />
            <em className="not-italic" style={{ color: MUTED_TEXT, fontWeight: 450 }}>
              дижитал хувь.
            </em>
          </h2>
          <p style={{ maxWidth: "430px", fontSize: "16px", fontWeight: 400, lineHeight: "24px", color: "rgb(167, 168, 164)" }}>
            Бодит биет зүйл — гадаргуу, өнцөг, дэлгэц бүрт зориулж дахин бүтээгдэнэ.
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative aspect-[772/600] w-full touch-none select-none overflow-hidden"
          onPointerDown={(e) => {
            draggingRef.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            updateFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) updateFromClientX(e.clientX);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
        >
          <div className="absolute inset-0">
            <DesktopMockupObject
              objUrl="/icons/mockup/chair.obj"
              textureUrl="/icons/mockup/chair_diffuse.png"
              metalness={0.3}
              roughness={0.42}
              mode="sway"
              swaySeed={0}
              renderMode="wireframe"
              className="size-full"
            />
          </div>
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>
            <DesktopMockupObject
              objUrl="/icons/mockup/chair.obj"
              textureUrl="/icons/mockup/chair_diffuse.png"
              metalness={0.3}
              roughness={0.42}
              mode="sway"
              swaySeed={0}
              renderMode="shaded"
              className="size-full"
            />
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 w-px"
            style={{ left: `${reveal}%`, background: "rgb(238, 238, 238)" }}
          />
          <div
            className="pointer-events-none absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${reveal}%`, top: "50%", background: "rgb(238, 238, 238)" }}
          />

          <span
            className="pointer-events-none absolute uppercase"
            style={{
              left: "5%",
              bottom: "5%",
              fontSize: "9px",
              fontWeight: 400,
              color: "rgb(238, 238, 238)",
              letterSpacing: "1.26px",
            }}
          >
            Үүсгэсэн 3D загвар
          </span>
        </div>
      </div>
    </section>
  );
}
