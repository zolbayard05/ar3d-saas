"use client";

// Fourth section after DesktopWireframeSection.tsx. Every style value below
// is copied verbatim from getComputedStyle() against the reference
// mockup's own document — see DesktopHeroTumble.tsx for the method.
//
// The "View in your space" button here is a REAL AR launch (DesktopArViewer
// -> model-viewer's activateAR(), same rule-7/8 config ARViewer.tsx uses),
// not a decorative mockup — backed by the same sneaker/backpack GLBs
// already used in the hero, now paired with their original USDZ source
// files (copied into public/icons/mockup/ alongside the GLBs) so iOS Quick
// Look works too, not just Android scene-viewer.

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";

const DesktopArViewer = dynamic(
  () => import("@/components/DesktopArViewer").then((m) => m.DesktopArViewer),
  { ssr: false },
);

const ITEMS = [
  { key: "backpack", label: "Цүнх", src: "/icons/mockup/backpack.glb", iosSrc: "/icons/mockup/backpack.usdz", alt: "Цүнх" },
  { key: "sneaker", label: "Гутал", src: "/icons/mockup/sneaker.glb", iosSrc: "/icons/mockup/sneaker.usdz", alt: "Гутал" },
] as const;

export function DesktopShowcaseSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const viewerRef = useRef<{ activateAR: () => void }>(null);
  const active = ITEMS[activeIdx];

  return (
    <section className="px-6 py-24 lg:px-16 lg:py-[140px]" style={{ background: "rgb(217, 215, 206)" }}>
      <div className="mx-auto grid max-w-[1400px] items-center gap-16 lg:grid-cols-[1fr_minmax(0,430px)]">
        <div className="relative aspect-[772/600] w-full" style={{ background: "rgb(36 38 34)" }}>
          <div className="absolute inset-0 flex items-center justify-between p-[17px]">
            <span
              className="uppercase"
              style={{ fontSize: "9px", fontWeight: 400, color: "rgb(170, 173, 163)", letterSpacing: "1.17px" }}
            >
              Шууд харагдац
            </span>
            <span
              className="uppercase"
              style={{ fontSize: "9px", fontWeight: 500, color: "rgb(241, 241, 232)", letterSpacing: "1.17px" }}
            >
              {active.label} / 0{activeIdx + 1}
            </span>
          </div>

          <DesktopArViewer
            ref={viewerRef}
            key={active.key}
            src={active.src}
            iosSrc={active.iosSrc}
            alt={active.alt}
            className="absolute inset-0 size-full"
          />

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-[17px]">
            <div className="flex gap-6">
              {ITEMS.map((item, i) => (
                <button
                  key={item.key}
                  onClick={() => setActiveIdx(i)}
                  className="border-b pb-1 uppercase"
                  style={{
                    fontSize: "9px",
                    fontWeight: i === activeIdx ? 500 : 400,
                    letterSpacing: "1.17px",
                    color: i === activeIdx ? "rgb(241, 241, 232)" : "rgb(160, 163, 154)",
                    borderColor: i === activeIdx ? "rgb(241, 241, 232)" : "transparent",
                  }}
                >
                  {item.label} / 0{i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => viewerRef.current?.activateAR()}
              className="flex items-center gap-2 bg-[#eeeee9] text-[#111111] hover:opacity-90"
              style={{ fontSize: "13px", fontWeight: 400, padding: "12px 16px" }}
            >
              Өөрийн орчинд харах
              <ArrowUpRight className="size-4" />
            </button>
          </div>
        </div>

        <div>
          <p
            className="uppercase"
            style={{ fontSize: "10px", fontWeight: 400, color: "rgb(174, 177, 165)", letterSpacing: "1.5px", marginBottom: "20px" }}
          >
            WebAR, шууд бэлэн
          </p>
          <h2
            className="text-balance"
            style={{
              fontSize: "clamp(2.2rem, 4.95vw, 5.9375rem)",
              fontWeight: 650,
              lineHeight: 0.91,
              letterSpacing: "-0.075em",
              color: "rgb(24, 25, 22)",
              marginBottom: "28px",
            }}
          >
            Худалдан авахаасаа
            <br />
            <em className="not-italic" style={{ color: "rgb(96, 98, 89)", fontWeight: 450 }}>
              өмнө үз.
            </em>
          </h2>
          <p style={{ maxWidth: "320px", fontSize: "16px", fontWeight: 400, lineHeight: "24px", color: "rgb(80, 82, 73)" }}>
            Хэрэглэгчид секундын дотор бүтээгдэхүүнээ өөрийн орчинд, бодит хэмжээгээр байрлуулж үзнэ.
          </p>
          <a
            href="#how-it-works"
            className="mt-6 inline-flex items-center gap-1.5"
            style={{ fontSize: "12px", fontWeight: 700, color: "rgb(24, 25, 22)" }}
          >
            WebAR-г үзэх
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
