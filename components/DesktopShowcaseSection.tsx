"use client";

// Every style value below is copied verbatim from getComputedStyle()
// against the reference mockup's own document — see DesktopHeroTumble.tsx
// for the method.
//
// A desktop visitor has no AR hardware, so the in-panel "AR-аар харах"
// button no longer calls model-viewer's activateAR() (that only ever did
// anything on a phone anyway) — it reveals a QR overlay, styled like the
// nav's own Liquid Glass capsule (DesktopLanding.tsx), right over the
// viewer. Scanning it lands on app/ar/[item]/page.tsx (phone-only route),
// same as the sidebar's own QR. Shown for every item now, headphones
// included — that item just has no real .usdz (only a .glb was supplied),
// so its phone page shows the real interactive 3D viewer without an AR-
// placement button (ArLaunchView.tsx's own guard), not a broken one.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, X } from "lucide-react";
import { buildLogoQr } from "@/lib/qr";
import { AR_SHOWCASE_ITEMS as ITEMS } from "@/lib/arShowcaseItems";

const DesktopArViewer = dynamic(
  () => import("@/components/DesktopArViewer").then((m) => m.DesktopArViewer),
  { ssr: false },
);

// Same recipe as the nav's floating capsule (DesktopLanding.tsx) — kept in
// sync manually since Desktop*.tsx has no shared token file to pull from.
const LIQUID_GLASS_STYLE = {
  background: "linear-gradient(180deg, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0.03) 65%), rgb(14 14 12 / 0.55)",
  backdropFilter: "blur(20px) saturate(160%)",
  WebkitBackdropFilter: "blur(20px) saturate(160%)",
  border: "1px solid rgb(255 255 255 / 0.16)",
  boxShadow: "0 10px 30px -12px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.25)",
} as const;

export function DesktopShowcaseSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showQrOverlay, setShowQrOverlay] = useState(false);
  const active = ITEMS[activeIdx];

  // Keyed to the item it was generated for, not just the data URL itself —
  // deriving qrDataUrl below from a key comparison (instead of resetting to
  // null synchronously inside the effect on every active.key change) is
  // what a plain useState reset would need react-hooks/set-state-in-effect
  // to warn about; render-time derivation avoids the extra render pass.
  const [qr, setQr] = useState<{ key: string; dataUrl: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    buildLogoQr(`${window.location.origin}/ar/${active.key}`)
      .then((dataUrl) => {
        if (!cancelled) setQr({ key: active.key, dataUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active.key]);
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
                  onClick={() => {
                    setActiveIdx(i);
                    setShowQrOverlay(false);
                  }}
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
              onClick={() => setShowQrOverlay(true)}
              className="flex items-center gap-2 bg-[#eeeee9] text-[#111111] hover:opacity-90"
              style={{ fontSize: "13px", fontWeight: 400, padding: "12px 16px" }}
            >
              AR-аар харах
              <ArrowUpRight className="size-4" />
            </button>
          </div>

          {/* Liquid Glass QR overlay — see LIQUID_GLASS_STYLE's own comment
              for why these values are hand-kept in sync with the nav
              capsule rather than shared from a token file. Click-outside
              (the dark scrim) or the explicit X both close it; switching
              tabs above also closes it (stale QR mid-transition otherwise). */}
          {showQrOverlay && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: "rgb(0 0 0 / 0.5)" }}
              onClick={() => setShowQrOverlay(false)}
            >
              <div
                className="relative flex flex-col items-center gap-4 rounded-2xl px-9 py-8"
                style={LIQUID_GLASS_STYLE}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowQrOverlay(false)}
                  aria-label="Хаах"
                  className="absolute flex items-center justify-center rounded-full hover:opacity-80"
                  style={{ top: "10px", right: "10px", width: "24px", height: "24px", background: "rgb(255 255 255 / 0.14)", color: "rgb(240, 240, 235)" }}
                >
                  <X className="size-3.5" />
                </button>
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data: URL, not a remote/static asset next/image can optimize.
                  // buildLogoQr renders at 480x480 (lib/qr.ts) — 360px display is still upscaling room to spare, no blur.
                  <img
                    src={qrDataUrl}
                    alt={`${active.label} — утсаараа AR-аар үзэх QR код`}
                    className="rounded-xl bg-white p-3"
                    style={{ width: "360px", height: "360px" }}
                  />
                ) : (
                  <div className="animate-pulse rounded-xl" style={{ width: "360px", height: "360px", background: "rgb(255 255 255 / 0.16)" }} />
                )}
                <p className="text-center" style={{ maxWidth: "300px", fontSize: "13px", lineHeight: "19px", color: "rgb(220, 222, 214)" }}>
                  Утасныхаа камераар уншуулаад {active.label.toLowerCase()}-г AR-аар өрөөндөө байрлуулж үзээрэй.
                </p>
              </div>
            </div>
          )}
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
