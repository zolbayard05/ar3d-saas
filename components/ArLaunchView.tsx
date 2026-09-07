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
        className="flex flex-1 items-center justify-center"
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
      <div className="flex flex-1">
        <DesktopArViewer ref={viewerRef} src={item.src} iosSrc={item.iosSrc} alt={item.alt} className="size-full" />
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
