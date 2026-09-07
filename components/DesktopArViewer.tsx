"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import "@google/model-viewer";

export interface DesktopArViewerProps {
  src: string;
  /** Omit for an item with no real USDZ — `ar`/`ar-modes`/`ios-src` are then left off entirely rather than pointing iOS Quick Look at nothing (rule 2: silent failure). */
  iosSrc?: string;
  alt: string;
  className?: string;
}

export interface DesktopArViewerHandle {
  activateAR: () => void;
}

type ModelViewerElement = HTMLElement & { activateAR: () => Promise<void> };

/**
 * A real, working "View in your space" AR launcher for the desktop
 * landing's showcase section — distinct from ARViewer.tsx (which resolves
 * R2-hosted user models via buildModelUrl(key)) and from
 * DesktopHeroModelViewer.tsx (tuned for the hero's forced-auto-rotate
 * floating display, no AR/zoom): this is a static /public asset with real
 * `ar`/`ios-src` wired up, same rule-7/8 config ARViewer.tsx uses
 * (ar-modes="webxr scene-viewer quick-look", src=GLB, ios-src=USDZ) — the
 * button in DesktopShowcaseSection.tsx actually launches AR, it isn't a
 * decorative mockup of one. Same rule-11 requirement: this file's top-level
 * "@google/model-viewer" import touches `window` at module load, so every
 * caller MUST bring it in via next/dynamic(..., { ssr: false }).
 */
export const DesktopArViewer = forwardRef<DesktopArViewerHandle, DesktopArViewerProps>(
  function DesktopArViewer({ src, iosSrc, alt, className }, ref) {
    const viewerRef = useRef<ModelViewerElement>(null);

    useImperativeHandle(ref, () => ({
      activateAR: () => void viewerRef.current?.activateAR(),
    }));

    return (
      <model-viewer
        ref={viewerRef}
        src={src}
        {...(iosSrc ? { "ios-src": iosSrc, ar: true, "ar-modes": "webxr scene-viewer quick-look" } : {})}
        camera-controls
        auto-rotate
        shadow-intensity="1"
        alt={alt}
        className={className}
        style={{ background: "transparent" }}
      >
        {iosSrc && <button slot="ar-button" aria-hidden="true" tabIndex={-1} style={{ display: "none" }} />}
      </model-viewer>
    );
  },
);
