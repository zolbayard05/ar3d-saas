"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { Box } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import type { DesktopArViewerHandle } from "@/components/DesktopArViewer";
import type { ArShowcaseItem } from "@/lib/arShowcaseItems";

// Rule 11 — same reasoning as ARViewer.tsx's own dynamic import: this pulls
// in @google/model-viewer for its customElements.define() side effect,
// which needs `window` and would break SSR as a plain import.
const DesktopArViewer = dynamic(
  () => import("@/components/DesktopArViewer").then((m) => m.DesktopArViewer),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
        }}
      >
        <Spinner size="lg" label="Ачаалж байна" />
      </div>
    ),
  },
);

/**
 * What a phone lands on after scanning DesktopShowcaseSection.tsx's QR
 * code — same bottom-docked AR-button convention as ModelDetail.tsx's real
 * "Өрөөндөө байрлуулах" CTA (breathing glow + accent pill), reused here
 * rather than invented fresh, just pointed at a static demo asset instead
 * of a user's own R2-hosted model.
 */
export function ArLaunchView({ item }: { item: ArShowcaseItem }) {
  const viewerRef = useRef<DesktopArViewerHandle>(null);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* `relative` + `absolute inset-0` on the viewer, not `flex` + `size-full`
          — model-viewer's shadow-DOM `:host` sets `contain: strict`, which
          makes a percentage `height:100%` resolve to 0 inside a flex row
          (reproduced live: computed 390x0, model loaded but zero pixels to
          draw into). Same fix shape DesktopShowcaseSection.tsx already uses
          for this exact component; ModelDetail.tsx hit the same class of bug
          and worked around it with aspect-ratio instead — see its comment. */}
      <div className="relative flex-1">
        <DesktopArViewer ref={viewerRef} src={item.src} iosSrc={item.iosSrc} alt={item.alt} className="absolute inset-0 size-full" />
      </div>

      <div className="relative flex flex-col gap-2 px-4 pb-8 pt-2">
        {item.iosSrc && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-4 -top-4 h-24 animate-breathe rounded-full opacity-40 blur-2xl"
              style={{
                background: "radial-gradient(ellipse at center, var(--color-glow-strong) 0%, transparent 70%)",
              }}
            />
            <button
              type="button"
              onClick={() => viewerRef.current?.activateAR()}
              className="relative flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-body font-semibold uppercase tracking-wide text-accent-text shadow-card hover:bg-accent-hover"
            >
              <Box className="size-5" />
              AR-аар байрлуулах
            </button>
          </>
        )}
        <p className="text-center text-small text-text-muted">{item.label} — Realify демо загвар</p>
      </div>
    </div>
  );
}
