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
// Look works too, not just Android scene-viewer. One tab (headphones) is
// an exception: only a .glb was supplied, no .usdz, so per rule 2 (iOS
// Quick Look fails silently without a real USDZ) it's real-3D-viewer only —
// the AR button and QR/link block below are hidden whenever the active
// item has no iosSrc (see lib/arShowcaseItems.ts's own doc comment).

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";
import { buildLogoQr } from "@/lib/qr";
import { AR_SHOWCASE_ITEMS as ITEMS } from "@/lib/arShowcaseItems";

const DesktopArViewer = dynamic(
  () => import("@/components/DesktopArViewer").then((m) => m.DesktopArViewer),
  { ssr: false },
);

export function DesktopShowcaseSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const viewerRef = useRef<{ activateAR: () => void }>(null);
  const active = ITEMS[activeIdx];

  // A desktop visitor has no AR hardware — the "Өөрийн орчинд харах" button
  // below only works for whoever's actually holding a phone. This QR is the
  // real way most people here would ever launch it: scan, land on
  // app/ar/[item]/page.tsx (a phone-only route — desktop UAs never reach it,
  // see lib/supabase/proxy.ts's device gate), tap the same AR button there.
  // Keyed to the item it was generated for, not just the data URL itself —
  // deriving qrDataUrl below from a key comparison (instead of resetting to
  // null synchronously inside the effect on every active.key change) is
  // what a plain useState reset would need react-hooks/set-state-in-effect
  // to warn about; render-time derivation avoids the extra render pass.
  const [qr, setQr] = useState<{ key: string; dataUrl: string } | null>(null);
  useEffect(() => {
    // Items with no iosSrc (e.g. headphones — .glb only, no .usdz) aren't
    // wired up for AR at all (rule 2: iOS Quick Look fails silently
    // without a real USDZ) — skip generating a QR that would lead to a
    // non-functional AR page for them.
    if (!active.iosSrc) return;
    let cancelled = false;
    buildLogoQr(`${window.location.origin}/ar/${active.key}`)
      .then((dataUrl) => {
        if (!cancelled) setQr({ key: active.key, dataUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active.key, active.iosSrc]);
  const qrDataUrl = qr?.key === active.key ? qr.dataUrl : null;

  return (
    <section id="ar" className="px-6 py-24 lg:px-16 lg:py-[140px]" style={{ background: "rgb(217, 215, 206)" }}>
      {/* The fixed 430px right column only leaves the left (viewer) column
          ~400px at 1024px-1279px widths (1024 - px-16*2 - 430 - gap-16) —
          verified live: that's too narrow for the bottom bar's tab
          switcher and "Өөрийн орчинд харах" button to both fit, and they
          visibly overlapped. xl: (not lg:) is the earliest breakpoint
          where the left column is wide enough for that bar; below it, the
          plain `grid` here has no column definition, so the two children
          just stack full-width instead. */}
      <div className="mx-auto grid max-w-[1400px] items-center gap-16 xl:grid-cols-[1fr_minmax(0,430px)]">
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
            {active.iosSrc && (
              <button
                onClick={() => viewerRef.current?.activateAR()}
                className="flex items-center gap-2 bg-[#eeeee9] text-[#111111] hover:opacity-90"
                style={{ fontSize: "13px", fontWeight: 400, padding: "12px 16px" }}
              >
                Өөрийн орчинд харах
                <ArrowUpRight className="size-4" />
              </button>
            )}
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

          {active.iosSrc && (
            <div className="mt-8 flex items-center gap-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL, not a remote/static asset next/image can optimize.
                <img
                  src={qrDataUrl}
                  alt={`${active.label} — утсаараа AR-аар үзэх QR код`}
                  className="size-20 rounded-md"
                  style={{ boxShadow: "0 1px 2px rgb(0 0 0 / 0.12)" }}
                />
              ) : (
                <div className="size-20 animate-pulse rounded-md" style={{ background: "rgb(200, 198, 189)" }} />
              )}
              <p style={{ maxWidth: "200px", fontSize: "12px", fontWeight: 400, lineHeight: "17px", color: "rgb(96, 98, 89)" }}>
                Утасныхаа камераар уншуулаад шууд AR-аар өрөөндөө байрлуулж үзээрэй.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
