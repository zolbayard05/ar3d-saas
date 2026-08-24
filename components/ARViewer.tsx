"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "@google/model-viewer";
import { buildModelUrl } from "@/lib/models";
import { Spinner } from "@/components/ui/Spinner";

export interface ARViewerProps {
  glbKey: string;
  usdzKey: string;
  scale: number;
  alt?: string;
  className?: string;
}

export interface ARViewerHandle {
  activateAR: () => void;
}

type ModelViewerElement = HTMLElement & { activateAR: () => Promise<void>; loaded: boolean };

/**
 * CLAUDE.md rule 11 — this file imports "@google/model-viewer" for its
 * customElements.define() side effect, which needs `window`. Callers MUST
 * bring this in via `next/dynamic(() => import("@/components/ARViewer"), {
 * ssr: false })`, never a plain import — a plain import runs this during
 * SSR and breaks the build. (See components/ModelDetail.tsx.)
 *
 * Rule 8's exact config: ar, ar-modes="webxr scene-viewer quick-look",
 * src = GLB, ios-src = USDZ.
 *
 * The primary "View in your room" CTA lives in ModelDetail, not here — the
 * design (design/02-detail.png) puts it as a full-width bar below the
 * secondary-actions row, outside the square viewer's own box, which the
 * default ar-button slot (an absolutely-positioned overlay confined to the
 * viewer's bounds) can't produce. So ModelDetail's button calls
 * activateAR() — a public model-viewer method, not a hand-rolled anchor,
 * rule 7 is still about not hand-rolling the iOS rel="ar" anchor itself,
 * which this never touches. An empty slotted button suppresses model-viewer's
 * own default corner AR icon so there's exactly one visible AR trigger.
 */
export const ARViewer = forwardRef<ARViewerHandle, ARViewerProps>(function ARViewer(
  { glbKey, usdzKey, scale, alt, className },
  ref,
) {
  const viewerRef = useRef<ModelViewerElement>(null);
  const [loaded, setLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    activateAR: () => void viewerRef.current?.activateAR(),
  }));

  // model-viewer mounts and renders an empty/transparent canvas well before
  // the GLB itself has finished fetching — over the gradient backdrop that
  // reads as "there's no model here" rather than "still loading." Its own
  // "load" event is the real ready signal (fires once the asset is decoded
  // and about to be revealed), not the dynamic-import fallback one level up
  // in ModelDetail.tsx, which only covers the @google/model-viewer chunk
  // itself. The synchronous `.loaded` check right after attaching guards
  // the case where the model already finished (e.g. browser cache) before
  // this effect's listener could attach — same race ModelCard.tsx's image
  // ref callback exists to close.
  useEffect(() => {
    setLoaded(false);
    const el = viewerRef.current;
    if (!el) return;
    function onLoad() {
      setLoaded(true);
    }
    el.addEventListener("load", onLoad);
    if (el.loaded) setLoaded(true);
    return () => el.removeEventListener("load", onLoad);
  }, [glbKey]);

  const glbUrl = buildModelUrl(glbKey);
  const usdzUrl = buildModelUrl(usdzKey);
  const scaleAttr = `${scale} ${scale} ${scale}`;

  return (
    <div className="relative">
      <model-viewer
        ref={viewerRef}
        src={glbUrl}
        ios-src={usdzUrl}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        scale={scaleAttr}
        alt={alt || "3D model"}
        shadow-intensity="1"
        className={className}
        // Subtle radial gradient instead of a flat surface color so the model
        // has visual depth to sit against — tokens only (rule from
        // styles/tokens.css's header comment), no raw hex.
        style={{
          background: "radial-gradient(circle at 50% 38%, var(--color-surface-hover), var(--color-bg) 75%)",
        }}
      >
        <button slot="ar-button" aria-hidden="true" tabIndex={-1} style={{ display: "none" }} />
      </model-viewer>
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner size="lg" label="Loading model" />
        </div>
      )}
    </div>
  );
});
